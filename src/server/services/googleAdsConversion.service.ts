// Server-side Google Ads conversion upload — a backup path for the two
// conversion actions already fired client-side via gtag.js in
// src/client/utils/googleAds.ts ("Trimiteți un formular de client potențial"
// and "Persoană de contact"). Ad blockers, Safari ITP, and gtag.js failing to
// load all silently drop the client-side fire; this reports the same
// conversions from the server using the click id (gclid/gbraid/wbraid)
// captured at landing time, so a blocked browser tab no longer means a lost
// conversion in Google Ads.
//
// Auth: a Google Cloud service account (self-signed JWT → OAuth2 access
// token), the same pattern as FIREBASE_SERVICE_ACCOUNT_BASE64 elsewhere in
// this codebase — no interactive consent screen needed. Google sunset
// developer tokens on 2026-09-09; API access is now tied to the Cloud
// project that owns the service account, not a token, so
// GOOGLE_ADS_DEVELOPER_TOKEN is sent only for backward compatibility and can
// be left blank.
//
// Inert until GOOGLE_ADS_SERVICE_ACCOUNT_BASE64 / GOOGLE_ADS_CUSTOMER_ID are
// set — see the on-boarding notes next to readConfig() for how to obtain
// them.
import { createHash, createSign } from "node:crypto";

interface GoogleAdsConfig {
  serviceAccountEmail: string;
  privateKey: string;
  customerId: string;
  loginCustomerId?: string;
  developerToken?: string;
  apiVersion: string;
}

let warnedMissingConfig = false;

/**
 * Reads the GOOGLE_ADS_* env vars. Returns null (and logs once) when the
 * integration hasn't been provisioned yet:
 *   - GOOGLE_ADS_SERVICE_ACCOUNT_BASE64: base64 of a Cloud service account's
 *     JSON key (Google Cloud Console > IAM & Admin > Service Accounts >
 *     create one > Keys > Add key > JSON), then in Google Ads UI > Admin >
 *     Access and security > Users, add that service account's email as a
 *     Standard user of the Ads account.
 *   - GOOGLE_ADS_CUSTOMER_ID: the target account id, digits only, no dashes.
 *   - GOOGLE_ADS_LOGIN_CUSTOMER_ID: only needed if the service account was
 *     granted access via a manager (MCC) account rather than directly on
 *     the target account — the manager's id, digits only.
 *   - GOOGLE_ADS_LEAD_CONVERSION_ACTION_ID /
 *     GOOGLE_ADS_CONTACT_CLICK_CONVERSION_ACTION_ID: the numeric conversion
 *     action id (NOT the gtag "send_to" label) — Google Ads UI > Goals >
 *     Conversions > open the action > "Codul tipului de conversie".
 *   - The Cloud project owning the service account also needs the Google
 *     Ads API enabled and Explorer (or higher) access — Cloud Console >
 *     APIs & Services > Google Ads API > Access levels.
 */
function readConfig(): GoogleAdsConfig | null {
  const serviceAccountBase64 = process.env.GOOGLE_ADS_SERVICE_ACCOUNT_BASE64;
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;

  if (!serviceAccountBase64 || !customerId) {
    if (!warnedMissingConfig) {
      warnedMissingConfig = true;
      console.log("[googleAdsConversion] Not configured yet — GOOGLE_ADS_SERVICE_ACCOUNT_BASE64 / GOOGLE_ADS_CUSTOMER_ID missing. Skipping server-side conversion uploads until set.");
    }
    return null;
  }

  const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, "base64").toString("utf8")) as {
    client_email: string;
    private_key: string;
  };

  return {
    serviceAccountEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key,
    customerId: customerId.replace(/-/g, ""),
    loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/-/g, "") || undefined,
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || undefined,
    apiVersion: process.env.GOOGLE_ADS_API_VERSION || "v19",
  };
}

function base64url(input: Buffer | string): string {
  return (Buffer.isBuffer(input) ? input : Buffer.from(input))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

let cachedToken: { accessToken: string; expiresAt: number; forEmail: string } | null = null;

// Self-signed JWT → OAuth2 access token exchange (RFC 7523), the standard
// server-to-server flow for Google Cloud service accounts — no browser
// consent screen involved.
async function getAccessToken(config: GoogleAdsConfig): Promise<string> {
  if (cachedToken && cachedToken.forEmail === config.serviceAccountEmail && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({
    iss: config.serviceAccountEmail,
    scope: "https://www.googleapis.com/auth/adwords",
    aud: "https://oauth2.googleapis.com/token",
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  }));
  const signingInput = `${header}.${claims}`;
  const signature = base64url(createSign("RSA-SHA256").update(signingInput).sign(config.privateKey));
  const assertion = `${signingInput}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) {
    throw new Error(`Google service-account token exchange failed: ${response.status} ${await response.text()}`);
  }
  const data = await response.json() as { access_token: string; expires_in: number };
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000, forEmail: config.serviceAccountEmail };
  return cachedToken.accessToken;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

// Romanian numbers only — mirrors toE164Ro() in src/client/utils/googleAds.ts.
// Returns null rather than guessing at a malformed value (a mis-hashed phone
// just silently fails to match, which is safer than sending garbage).
function toE164Ro(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0")) return `+40${digits.slice(1)}`;
  if (digits.startsWith("40")) return `+${digits}`;
  return null;
}

// Google Ads requires "yyyy-MM-dd HH:mm:ss+HH:mm" using the *Ads account's*
// own time zone offset (not UTC, not the server's). The business operates in
// Romania, so Europe/Bucharest is assumed — if the Ads account's time zone
// differs, adjust GOOGLE_ADS_TIME_ZONE.
function nowInAccountTimeZone(): string {
  const timeZone = process.env.GOOGLE_ADS_TIME_ZONE || "Europe/Bucharest";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZoneName: "longOffset",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  const offsetMatch = /GMT([+-]\d{1,2})(?::?(\d{2}))?/.exec(get("timeZoneName"));
  const offsetHours = (offsetMatch?.[1] ?? "+0").padStart(3, "0"); // keeps the sign
  const offsetMinutes = offsetMatch?.[2] ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}${offsetHours}:${offsetMinutes}`;
}

interface ClickIds {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
}

interface UploadClickConversionParams extends ClickIds {
  conversionActionId: string;
  value?: number;
  currency?: string;
  orderId?: string;
  email?: string;
  phone?: string;
}

async function uploadClickConversion(config: GoogleAdsConfig, params: UploadClickConversionParams): Promise<void> {
  if (!params.gclid && !params.gbraid && !params.wbraid) return;

  const userIdentifiers: Record<string, string>[] = [];
  const phone = params.phone ? toE164Ro(params.phone) : null;
  if (phone) userIdentifiers.push({ hashedPhoneNumber: sha256Hex(phone) });
  if (params.email?.trim()) userIdentifiers.push({ hashedEmail: sha256Hex(params.email) });

  const conversion: Record<string, unknown> = {
    conversionAction: `customers/${config.customerId}/conversionActions/${params.conversionActionId}`,
    conversionDateTime: nowInAccountTimeZone(),
    conversionValue: params.value ?? 1.0,
    currencyCode: params.currency ?? "RON",
  };
  if (params.gclid) conversion.gclid = params.gclid;
  else if (params.gbraid) conversion.gbraid = params.gbraid;
  else if (params.wbraid) conversion.wbraid = params.wbraid;
  if (params.orderId) conversion.orderId = params.orderId;
  if (userIdentifiers.length > 0) conversion.userIdentifiers = userIdentifiers;

  const accessToken = await getAccessToken(config);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  if (config.developerToken) headers["developer-token"] = config.developerToken;
  if (config.loginCustomerId) headers["login-customer-id"] = config.loginCustomerId;

  const response = await fetch(
    `https://googleads.googleapis.com/${config.apiVersion}/customers/${config.customerId}:uploadClickConversions`,
    { method: "POST", headers, body: JSON.stringify({ conversions: [conversion], partialFailure: true }) }
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("[googleAdsConversion] Upload request failed:", response.status, JSON.stringify(body));
    return;
  }
  const partialFailureError = (body as { partialFailureError?: unknown }).partialFailureError;
  if (partialFailureError) {
    console.error("[googleAdsConversion] Partial failure:", JSON.stringify(partialFailureError));
    return;
  }
  console.log("[googleAdsConversion] Uploaded conversion", params.conversionActionId, params.gclid ?? params.gbraid ?? params.wbraid);
}

export interface ReportLeadConversionParams extends ClickIds {
  email?: string;
  phone?: string;
  value?: number;
  currency?: string;
  orderId?: string;
}

/** Mirrors fireAdsLeadConversion() client-side — call on any real lead submission. */
export async function reportLeadConversion(params: ReportLeadConversionParams): Promise<void> {
  const config = readConfig();
  if (!config) return;
  const conversionActionId = process.env.GOOGLE_ADS_LEAD_CONVERSION_ACTION_ID;
  if (!conversionActionId) return;
  await uploadClickConversion(config, { ...params, conversionActionId });
}

export interface ReportContactClickConversionParams extends ClickIds {
  phone?: string;
  orderId?: string;
}

/** Mirrors fireAdsContactClickConversion() client-side — call on phone-reveal / WhatsApp click-outs. */
export async function reportContactClickConversion(params: ReportContactClickConversionParams): Promise<void> {
  const config = readConfig();
  if (!config) return;
  const conversionActionId = process.env.GOOGLE_ADS_CONTACT_CLICK_CONVERSION_ACTION_ID;
  if (!conversionActionId) return;
  await uploadClickConversion(config, { ...params, conversionActionId });
}
