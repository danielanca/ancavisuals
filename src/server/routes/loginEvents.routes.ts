import { Router } from "express";
import type { Request, Response } from "express";
import { sendEmail } from "../notifications/mailer";

const router = Router();
const ADMIN_EMAIL = "ancadaniel1994@gmail.com";

// In-memory rate limiter: max 5 failure emails per IP per 10 minutes
const failureRateMap = new Map<string, { count: number; resetAt: number }>();
const FAILURE_LIMIT = 5;
const FAILURE_WINDOW_MS = 10 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = failureRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    failureRateMap.set(ip, { count: 1, resetAt: now + FAILURE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > FAILURE_LIMIT;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.ip ?? "necunoscut";
}

function parseUserAgent(ua: string): { browser: string; os: string; device: string } {
  let browser = "Necunoscut";
  let os = "Necunoscut";
  let device = "Desktop";

  if (/iPhone/.test(ua)) { device = "iPhone"; os = "iOS"; }
  else if (/iPad/.test(ua)) { device = "iPad"; os = "iPadOS"; }
  else if (/Android/.test(ua) && /Mobile/.test(ua)) { device = "Android Phone"; }
  else if (/Android/.test(ua)) { device = "Android Tablet"; }

  const edgeMatch = ua.match(/Edg\/([\d.]+)/);
  const chromeMatch = ua.match(/Chrome\/([\d.]+)/);
  const firefoxMatch = ua.match(/Firefox\/([\d.]+)/);
  const safariMatch = ua.match(/Version\/([\d.]+).*Safari/);

  if (edgeMatch) browser = `Edge ${edgeMatch[1].split(".")[0]}`;
  else if (/OPR\//.test(ua)) browser = "Opera";
  else if (chromeMatch) browser = `Chrome ${chromeMatch[1].split(".")[0]}`;
  else if (firefoxMatch) browser = `Firefox ${firefoxMatch[1].split(".")[0]}`;
  else if (safariMatch) browser = `Safari ${safariMatch[1].split(".")[0]}`;

  if (!device.includes("Android") && !device.includes("i")) {
    if (/Windows NT 10/.test(ua)) os = "Windows 10/11";
    else if (/Windows NT 6\.1/.test(ua)) os = "Windows 7";
    else if (/Mac OS X/.test(ua)) {
      const m = ua.match(/Mac OS X ([\d_]+)/);
      os = m ? `macOS ${m[1].replace(/_/g, ".")}` : "macOS";
    } else if (/Android/.test(ua)) {
      const m = ua.match(/Android ([\d.]+)/);
      os = m ? `Android ${m[1]}` : "Android";
    } else if (/Linux/.test(ua)) { os = "Linux"; }
  }

  return { browser, os, device };
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const masked = local.length <= 2 ? local[0] + "*" : local[0] + "*".repeat(local.length - 2) + local[local.length - 1];
  return `${masked}@${domain}`;
}

interface GeoResult {
  city: string;
  country: string;
  flag: string;
}

async function geolocateIp(ip: string): Promise<GeoResult> {
  try {
    const isLocal = ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168") || ip.startsWith("10.");
    if (isLocal) return { city: "Local", country: "Rețea locală", flag: "🏠" };

    const response = await fetch(`https://ipwho.is/${ip}`, { signal: AbortSignal.timeout(3000) });
    const data = await response.json() as { success?: boolean; city?: string; country?: string; flag?: { emoji?: string } };

    if (data.success && data.city) {
      return {
        city: data.city,
        country: data.country ?? "",
        flag: data.flag?.emoji ?? "",
      };
    }
  } catch {
    // geolocation failed, continue without it
  }
  return { city: "Necunoscut", country: "", flag: "🌍" };
}

function buildEmailHtml(params: {
  type: "success" | "failure";
  ip: string;
  browser: string;
  os: string;
  device: string;
  screen: string;
  language: string;
  timezone: string;
  location: string;
  attemptedEmail?: string;
  timestamp: string;
  errorCode?: string;
}): string {
  const isSuccess = params.type === "success";
  const accentColor = isSuccess ? "#10b981" : "#f59e0b";
  const badgeBg = isSuccess ? "#064e3b" : "#451a03";
  const badgeText = isSuccess ? "LOGIN SUCCESSFUL" : "LOGIN ATTEMPT ALERT";

  const rows: [string, string][] = [
    ["Data / Ora", params.timestamp],
    ["Locație", params.location],
    ["IP", params.ip],
    ["Browser", params.browser],
    ["Sistem de operare", params.os],
    ["Dispozitiv", params.device],
    ["Rezoluție ecran", params.screen],
    ["Limbă browser", params.language],
    ["Fus orar", params.timezone],
    ...(!isSuccess && params.attemptedEmail ? [["Email încercat", maskEmail(params.attemptedEmail)] as [string, string]] : []),
    ...(!isSuccess && params.errorCode ? [["Cod eroare Firebase", params.errorCode] as [string, string]] : []),
  ];

  const tableRows = rows
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:9px 16px;color:#9ca3af;font-size:12px;white-space:nowrap;border-bottom:1px solid #1f1f1f;width:40%;">${label}</td>
        <td style="padding:9px 16px;color:#f5f5f5;font-size:12px;border-bottom:1px solid #1f1f1f;word-break:break-all;">${value}</td>
      </tr>`,
    )
    .join("");

  return `
    <div style="background:#0a0a0a;padding:40px 20px;font-family:Arial,sans-serif;">
      <div style="max-width:520px;margin:0 auto;background:#111111;border:1px solid #222;border-radius:12px;overflow:hidden;">
        <div style="height:4px;background:${accentColor};"></div>
        <div style="padding:24px 24px 16px;">
          <p style="color:#6b7280;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin:0 0 10px;">AncaVisuals · Admin Security</p>
          <span style="display:inline-block;background:${badgeBg};border:1px solid ${accentColor};color:${accentColor};font-size:10px;font-weight:700;letter-spacing:1.5px;padding:4px 12px;border-radius:6px;">${badgeText}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          ${tableRows}
        </table>
        <div style="padding:16px 24px 24px;">
          <p style="color:#4b5563;font-size:11px;margin:0;line-height:1.6;">
            ${isSuccess
              ? "Dacă nu ești tu, schimbă imediat parola din Firebase Console și revocă toate sesiunile."
              : "Dacă nu ai fost tu, cineva încearcă să acceseze panoul de administrare. Verifică securitatea contului."}
          </p>
        </div>
      </div>
    </div>
  `;
}

// POST /login-event — public, no auth required
router.post("/login-event", async (req: Request, res: Response) => {
  const { type, attemptedEmail, screen, language, timezone, userAgent, errorCode } = req.body as {
    type: "success" | "failure";
    attemptedEmail?: string;
    screen?: string;
    language?: string;
    timezone?: string;
    userAgent?: string;
    errorCode?: string;
  };

  if (type !== "success" && type !== "failure") {
    res.status(400).json({ error: "Invalid type." });
    return;
  }

  const ip = getClientIp(req);

  if (type === "failure" && isRateLimited(ip)) {
    res.json({ ok: true });
    return;
  }

  const ua = userAgent ?? req.headers["user-agent"] ?? "";
  const { browser, os, device } = parseUserAgent(ua);

  const now = new Date();
  const timestamp = now.toLocaleString("ro-RO", {
    timeZone: "Europe/Bucharest",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const geo = await geolocateIp(ip);
  const locationStr = geo.city !== "Necunoscut" ? `${geo.flag} ${geo.city}, ${geo.country}` : "Necunoscut";
  const locationShort = geo.city !== "Necunoscut" ? `${geo.city}, ${geo.country}` : ip;

  const deviceShort = `${browser} / ${os}`;

  const subject = type === "success"
    ? `✅ Login Successful — ${deviceShort} — ${locationShort}`
    : `⚠️ Login Attempt Alert — ${deviceShort} — ${locationShort}`;

  const html = buildEmailHtml({
    type,
    ip,
    browser,
    os,
    device,
    screen: screen ?? "necunoscut",
    language: language ?? "necunoscut",
    timezone: timezone ?? "necunoscut",
    location: locationStr,
    attemptedEmail,
    timestamp,
    errorCode,
  });

  sendEmail({ to: ADMIN_EMAIL, subject, html }).catch(() => {});

  res.json({ ok: true });
});

export default router;
