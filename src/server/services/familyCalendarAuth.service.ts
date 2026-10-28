/*
 * Purpose: login for the family calendar (/zile-ocupate). Only the calendar's email (Estera's, set in
 * /admin/calendar-familie) can sign in, with a 6-digit one-time code sent by email or the
 * "Intră direct" button in the same email. No passwords, so nothing to reset. A login gives a
 * 90-day session in an httpOnly cookie; only hashes of codes and sessions are stored.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { firestore } from "../firestore";
import { APP_BASE_URL } from "../constants/domain";
import { sendEmail } from "../notifications/mailer";
import { getFamilyCalendarSettings } from "./familyCalendar.service";
import { FAMILY_CALENDAR_PAGE } from "../../shared/familyCalendar";

export const FAMILY_SESSION_COOKIE = "fc_session";
export const CODE_TTL_MS = 10 * 60_000;
export const SESSION_TTL_MS = 90 * 24 * 3_600_000;
const MAX_ATTEMPTS = 5;
const RESEND_AFTER_MS = 45_000;
const MAX_CODES_PER_HOUR = 6;

const LOGIN_DOC = () => firestore().collection("settings").doc("familyCalendarLogin");
const SESSIONS = () => firestore().collection("familyCalendarSessions");

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(new Uint8Array(Buffer.from(a)), new Uint8Array(Buffer.from(b)));
export const normalizeEmail = (email: unknown) => (typeof email === "string" ? email.trim().toLowerCase() : "");

type LoginState = { codeHash?: string; magicHash?: string; expiresAt?: number; attempts?: number; sentAt?: number[] };

export type RequestCodeResult = { ok: true } | { ok: false; reason: "wrong-email" | "too-soon" | "too-many"; retryInMs?: number };

/** Emails a new code (and a one-click login link) when `email` is the calendar's email. */
export async function requestFamilyLoginCode(email: unknown, now = Date.now()): Promise<RequestCodeResult> {
  const settings = await getFamilyCalendarSettings();
  if (normalizeEmail(email) !== normalizeEmail(settings.recipientEmail)) return { ok: false, reason: "wrong-email" };
  const state = ((await LOGIN_DOC().get()).data() ?? {}) as LoginState;
  const recent = (state.sentAt ?? []).filter((at) => now - at < 3_600_000);
  const last = recent[recent.length - 1];
  if (last && now - last < RESEND_AFTER_MS) return { ok: false, reason: "too-soon", retryInMs: RESEND_AFTER_MS - (now - last) };
  if (recent.length >= MAX_CODES_PER_HOUR) return { ok: false, reason: "too-many" };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const magic = randomBytes(24).toString("base64url");
  await LOGIN_DOC().set({ codeHash: sha256(code), magicHash: sha256(magic), expiresAt: now + CODE_TTL_MS, attempts: 0, sentAt: [...recent, now] });
  const { subject, html } = familyLoginEmail(code, `${APP_BASE_URL}${FAMILY_CALENDAR_PAGE}?intra=${magic}`);
  await sendEmail({ to: settings.recipientEmail, subject, html, source: "family-calendar-login" });
  return { ok: true };
}

export type VerifyResult = { ok: true; session: string } | { ok: false; reason: "invalid" | "expired" | "too-many" };

/** Checks a typed code or the email's login link (each works once); success → a new session. */
export async function verifyFamilyLogin(input: { email?: unknown; code?: unknown; magic?: unknown }, now = Date.now()): Promise<VerifyResult> {
  const ref = LOGIN_DOC();
  const state = ((await ref.get()).data() ?? {}) as LoginState;
  if (!state.codeHash || !state.expiresAt) return { ok: false, reason: "invalid" };
  if (now > state.expiresAt) return { ok: false, reason: "expired" };
  if ((state.attempts ?? 0) >= MAX_ATTEMPTS) return { ok: false, reason: "too-many" };

  let valid = false;
  if (typeof input.magic === "string" && input.magic) {
    valid = Boolean(state.magicHash) && sameHash(sha256(input.magic), state.magicHash!);
  } else {
    const settings = await getFamilyCalendarSettings();
    const code = typeof input.code === "string" ? input.code.replace(/\D/g, "") : "";
    valid = normalizeEmail(input.email) === normalizeEmail(settings.recipientEmail) && code.length === 6 && sameHash(sha256(code), state.codeHash);
  }
  if (!valid) {
    await ref.set({ attempts: (state.attempts ?? 0) + 1 }, { merge: true });
    return { ok: false, reason: (state.attempts ?? 0) + 1 >= MAX_ATTEMPTS ? "too-many" : "invalid" };
  }
  // Used once: neither the code nor the link works again.
  await ref.set({ codeHash: null, magicHash: null, expiresAt: null, attempts: 0 }, { merge: true });
  const session = randomBytes(32).toString("base64url");
  await SESSIONS().doc(sha256(session)).set({ createdAt: now, expiresAt: now + SESSION_TTL_MS });
  return { ok: true, session };
}

export async function familySessionValid(session: string | undefined, now = Date.now()): Promise<boolean> {
  if (!session || session.length > 100) return false;
  const doc = await SESSIONS().doc(sha256(session)).get();
  const expiresAt = Number(doc.data()?.expiresAt);
  return doc.exists && Number.isFinite(expiresAt) && now < expiresAt;
}

export async function endFamilySession(session: string | undefined): Promise<void> {
  if (session && session.length <= 100) await SESSIONS().doc(sha256(session)).delete();
}

/** Signs Estera out everywhere (admin: "Deconectează-o de pe toate dispozitivele"). */
export async function endAllFamilySessions(): Promise<number> {
  const snapshot = await SESSIONS().get();
  await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
  return snapshot.size;
}

/** Reads one cookie from the raw header (the app has no cookie parser). */
export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function sessionCookie(session: string | null, secure: boolean): string {
  const base = `${FAMILY_SESSION_COOKIE}=${session ?? ""}; Path=/api/family-calendar; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
  return session ? `${base}; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}` : `${base}; Max-Age=0`;
}

// The code is in the subject too: phones show it in the notification, and Gmail / iOS offer "Copy code".
export function familyLoginEmail(code: string, loginUrl: string): { subject: string; html: string } {
  return {
    subject: `${code} e codul pentru calendar`,
    html: `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 20px;background:#fff;color:#111;">
    <p style="font-size:12px;letter-spacing:3px;margin:0 0 24px;">ANCA VISUALS</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Codul tău pentru calendarul evenimentelor:</p>
    <p style="font-family:'Courier New',monospace;font-size:34px;font-weight:bold;letter-spacing:6px;margin:0 0 8px;padding:16px;border:2px solid #111;text-align:center;user-select:all;">${code}</p>
    <p style="font-size:13px;color:#666;margin:0 0 24px;">Ține apăsat pe cod ca să-l copiezi. E valabil 10 minute.</p>
    <p style="font-size:15px;margin:0 0 12px;">Sau intră direct, fără cod:</p>
    <a href="${loginUrl}" style="display:inline-block;padding:14px 22px;background:#111;color:#fff;font-size:15px;font-weight:bold;text-decoration:none;">Intră în calendar</a>
    <p style="font-size:12px;color:#999;margin:28px 0 0;">Dacă nu tu ai cerut codul, ignoră emailul. Nimeni nu poate intra fără el.</p>
  </div>`,
  };
}
