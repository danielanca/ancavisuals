/*
 * Purpose: "Timp pentru familie" — Estera asks, from /zile-ocupate, for a day or a range of days
 * kept free for the family (holiday, family events); the owner gets an email and approves or
 * declines in /admin/calendar-familie, and she gets an email back. Approved ranges show on her
 * calendar and feed, and count as booked in the public availability check.
 */
import { randomUUID } from "crypto";
import { firestore } from "../firestore";
import { APP_BASE_URL } from "../constants/domain";
import { sendEmail } from "../notifications/mailer";
import { getFamilyCalendarSettings } from "./familyCalendar.service";
import { addDays, FAMILY_CALENDAR_PAGE, type FamilyTimeRequest } from "../../shared/familyCalendar";

const COLLECTION = () => firestore().collection("familyTimeRequests");
const OWNER_EMAIL = "ancadaniel1994@gmail.com";
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const FAMILY_TIME_MAX_DAYS = 60;
export const FAMILY_TIME_NOTE_MAX = 500;

const validDay = (value: unknown): value is string =>
  typeof value === "string" && DAY.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().startsWith(value);

export function rangeDays(start: string, end: string): string[] {
  const days: string[] = [];
  for (let day = start; day <= end && days.length <= FAMILY_TIME_MAX_DAYS; day = addDays(day, 1)) days.push(day);
  return days;
}

function toRequest(id: string, data: Record<string, unknown>): FamilyTimeRequest {
  return {
    id,
    startDate: String(data.startDate),
    endDate: String(data.endDate),
    note: String(data.note ?? ""),
    status: data.status === "approved" || data.status === "rejected" ? data.status : "pending",
    createdAt: String(data.createdAt ?? ""),
    decidedAt: typeof data.decidedAt === "string" ? data.decidedAt : null,
    reply: typeof data.reply === "string" ? data.reply : "",
  };
}

export async function listFamilyTimeRequests(): Promise<FamilyTimeRequest[]> {
  const snapshot = await COLLECTION().get();
  return snapshot.docs
    .map((doc) => toRequest(doc.id, doc.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Days of the approved requests (public availability treats them as booked). */
export async function approvedFamilyDays(): Promise<string[]> {
  const requests = await listFamilyTimeRequests();
  return requests.filter((request) => request.status === "approved").flatMap((request) => rangeDays(request.startDate, request.endDate));
}

export type CreateFamilyTimeResult = { ok: true; request: FamilyTimeRequest } | { ok: false; error: string };

const formatDay = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export const formatRange = (start: string, end: string) => (start === end ? formatDay(start) : `${formatDay(start)} – ${formatDay(end)}`);
const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const emailWrap = (body: string) =>
  `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 20px;background:#fff;color:#111;"><p style="font-size:12px;letter-spacing:3px;margin:0 0 24px;">ANCA VISUALS</p>${body}</div>`;
const emailButton = (href: string, label: string) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;margin-top:16px;padding:12px 18px;background:#111;color:#fff;font-size:14px;font-weight:bold;text-decoration:none;">${label}</a>`;

export function familyTimeRequestEmail(start: string, end: string, note: string, fromEmail: string): { subject: string; html: string } {
  return {
    subject: `Estera a cerut timp pentru familie: ${formatRange(start, end)}`,
    html: emailWrap(`
      <h1 style="font-size:20px;font-weight:normal;margin:0 0 12px;">Cerere nouă de la Estera</h1>
      <p style="font-size:15px;margin:0 0 8px;"><strong style="text-transform:capitalize;">${escapeHtml(formatRange(start, end))}</strong></p>
      ${note ? `<p style="font-size:14px;line-height:1.6;margin:0 0 8px;border-left:3px solid #111;padding-left:10px;">${escapeHtml(note)}</p>` : ""}
      <p style="font-size:13px;color:#666;margin:0;">De la ${escapeHtml(fromEmail)}. Aprobi sau refuzi din admin.</p>
      ${emailButton(`${APP_BASE_URL}/admin/calendar-familie`, "Vezi cererea")}`),
  };
}

export function familyTimeDecisionEmail(request: Pick<FamilyTimeRequest, "status" | "startDate" | "endDate" | "reply">): { subject: string; html: string } {
  const approved = request.status === "approved";
  return {
    subject: approved ? `Aprobat: ${formatRange(request.startDate, request.endDate)} e pentru familie` : `Cererea pentru ${formatRange(request.startDate, request.endDate)} nu a fost aprobată`,
    html: emailWrap(`
      <h1 style="font-size:20px;font-weight:normal;margin:0 0 12px;">${approved ? "Cererea ta a fost aprobată ✓" : "Cererea ta nu a fost aprobată"}</h1>
      <p style="font-size:15px;margin:0 0 8px;"><strong style="text-transform:capitalize;">${escapeHtml(formatRange(request.startDate, request.endDate))}</strong></p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 8px;">${approved ? "Zilele sunt rezervate pentru familie și nu se mai pot lua evenimente în ele." : "Zilele rămân disponibile pentru evenimente."}</p>
      ${request.reply ? `<p style="font-size:14px;line-height:1.6;margin:0;border-left:3px solid #111;padding-left:10px;">${escapeHtml(request.reply)}</p>` : ""}
      ${emailButton(`${APP_BASE_URL}${FAMILY_CALENDAR_PAGE}`, "Deschide calendarul")}`),
  };
}

export async function createFamilyTimeRequest(input: { startDate?: unknown; endDate?: unknown; note?: unknown }, today: string): Promise<CreateFamilyTimeResult> {
  const start = input.startDate;
  const end = input.endDate ?? input.startDate;
  if (!validDay(start) || !validDay(end)) return { ok: false, error: "Alege o zi sau o perioadă." };
  if (end < start) return { ok: false, error: "Ultima zi e înaintea primei zile." };
  if (start < today) return { ok: false, error: "Perioada începe în trecut." };
  if (rangeDays(start, end).length > FAMILY_TIME_MAX_DAYS) return { ok: false, error: `Poți cere cel mult ${FAMILY_TIME_MAX_DAYS} de zile odată.` };
  const note = typeof input.note === "string" ? input.note.trim().slice(0, FAMILY_TIME_NOTE_MAX) : "";

  const id = randomUUID();
  const data = { startDate: start, endDate: end, note, status: "pending", createdAt: new Date().toISOString(), decidedAt: null, reply: "" };
  await COLLECTION().doc(id).set(data);
  const request = toRequest(id, data);

  const { recipientEmail } = await getFamilyCalendarSettings();
  await sendEmail({
    to: OWNER_EMAIL,
    ...familyTimeRequestEmail(start, end, note, recipientEmail),
    source: "family-time-request",
  });
  return { ok: true, request };
}

/** Estera withdraws a request still waiting for an answer. */
export async function cancelFamilyTimeRequest(id: string): Promise<boolean> {
  const ref = COLLECTION().doc(id);
  const doc = await ref.get();
  if (!doc.exists || doc.data()?.status !== "pending") return false;
  await ref.delete();
  return true;
}

export async function decideFamilyTimeRequest(id: string, status: "approved" | "rejected", reply: string): Promise<FamilyTimeRequest | null> {
  const ref = COLLECTION().doc(id);
  const doc = await ref.get();
  if (!doc.exists) return null;
  const update = { status, reply: reply.trim().slice(0, FAMILY_TIME_NOTE_MAX), decidedAt: new Date().toISOString() };
  await ref.set(update, { merge: true });
  const request = toRequest(id, { ...doc.data(), ...update });

  const { recipientEmail } = await getFamilyCalendarSettings();
  await sendEmail({
    to: recipientEmail,
    ...familyTimeDecisionEmail(request),
    source: "family-time-decision",
  });
  return request;
}

export async function deleteFamilyTimeRequest(id: string): Promise<boolean> {
  const ref = COLLECTION().doc(id);
  if (!(await ref.get()).exists) return false;
  await ref.delete();
  return true;
}
