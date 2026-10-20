/*
 * SMS goes out through SMSAPI (smsapi.com) when SMSAPI_TOKEN is set, otherwise through Twilio.
 * SMSAPI: OAuth token from the SMSAPI panel; SMSAPI_SENDER = approved sender name (optional,
 * the account default is used without it). The account lives on portal.smsapi.ro, so the API host
 * is api.smsapi.ro (a .ro token is rejected by api.smsapi.com with error 101); SMSAPI_BASE_URL overrides it.
 */
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER ?? "";
// SMS_API_KEY = the name used in the server .env for the same SMSAPI OAuth token.
const SMSAPI_TOKEN = process.env.SMSAPI_TOKEN || process.env.SMS_API_KEY || "";
const SMSAPI_SENDER = process.env.SMSAPI_SENDER ?? "";
const SMSAPI_BASE_URL = (process.env.SMSAPI_BASE_URL || "https://api.smsapi.ro").replace(/\/+$/, "");

export interface SendSmsOptions {
  to: string;
  body: string;
}

const smsapiConfigured = () => Boolean(SMSAPI_TOKEN);
const twilioConfigured = () => Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER);

export function isSmsConfigured(): boolean {
  return smsapiConfigured() || twilioConfigured();
}

const DIACRITICS: Record<string, string> = { ă: "a", â: "a", î: "i", ș: "s", ş: "s", ț: "t", ţ: "t", Ă: "A", Â: "A", Î: "I", Ș: "S", Ş: "S", Ț: "T", Ţ: "T" };

/**
 * Plain GSM text: emoji or diacritics switch the whole SMS to Unicode (70 chars per part
 * instead of 160), so the same message would cost two to three times as much.
 */
export function toSmsText(body: string): string {
  return body
    .replace(/[ăâîșşțţĂÂÎȘŞȚŢ]/g, (c) => DIACRITICS[c] ?? c)
    .replace(/[„“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/…/g, "...")
    .replace(/\p{Extended_Pictographic}|\u200d|\ufe0f/gu, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

export function normalizeRomanianPhoneNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const compact = trimmed.replace(/[^\d+]/g, "");
  if (!compact) return null;

  if (compact.startsWith("+")) {
    const digits = compact.slice(1).replace(/\D/g, "");
    return digits.length >= 7 ? `+${digits}` : null;
  }

  const digits = compact.replace(/\D/g, "");
  if (digits.length < 7) return null;

  if (digits.startsWith("40") && digits.length >= 11) {
    return `+${digits}`;
  }

  if (digits.startsWith("0") && digits.length >= 10) {
    return `+40${digits.slice(1)}`;
  }

  if (digits.length === 9) {
    return `+40${digits}`;
  }

  return `+${digits}`;
}

export async function sendSms({ to, body }: SendSmsOptions): Promise<void> {
  if (!isSmsConfigured()) {
    throw new Error("SMS nu este configurat pe server.");
  }
  const text = toSmsText(body);
  if (smsapiConfigured()) {
    await sendViaSmsapi(to, text);
    return;
  }
  await sendViaTwilio(to, text);
}

async function sendViaSmsapi(to: string, message: string): Promise<void> {
  const payload = new URLSearchParams({ to: to.replace(/^\+/, ""), message, format: "json", encoding: "utf-8" });
  if (SMSAPI_SENDER) payload.set("from", SMSAPI_SENDER);
  const response = await fetch(`${SMSAPI_BASE_URL}/sms.do`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SMSAPI_TOKEN}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: payload.toString(),
  });
  const raw = await response.text();
  let data: { error?: number; message?: string; count?: number } = {};
  try { data = JSON.parse(raw); } catch { /* non-JSON error page */ }
  // SMSAPI answers 200 with { error, message } for most failures (bad token, no credit, sender).
  if (!response.ok || data.error || !data.count) {
    throw new Error(`SMS trimitere eșuată (SMSAPI ${data.error ?? response.status}): ${(data.message ?? raw).slice(0, 200)}`);
  }
}

async function sendViaTwilio(to: string, body: string): Promise<void> {
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const payload = new URLSearchParams({
    To: to,
    From: TWILIO_FROM_NUMBER,
    Body: body,
  });
  const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`SMS trimitere eșuată (${response.status}): ${errorBody.slice(0, 200)}`);
  }
}
