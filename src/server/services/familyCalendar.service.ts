/*
 * Purpose: server side of the family calendar (src/shared/familyCalendar.ts). The page
 * /zile-ocupate needs a login (familyCalendarAuth.service.ts); only the calendar-app feed uses the
 * secret token in settings/familyCalendar, which the admin can replace. The email invites Estera
 * to the page with the coming weeks; the Monday cron (when turned on) sends her the week's plan.
 */
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { firestore } from "../firestore";
import { expandEventDates } from "../utils/expandEventDates";
import { APP_BASE_URL } from "../constants/domain";
import { ESTERA_EMAIL } from "../middleware/requireFirebaseAuth";
import { sendEmail } from "../notifications/mailer";
import {
  addDays, eventEmoji, eventsBetween, eventTitle, FAMILY_CALENDAR_PAGE, formatEur, mondayOf,
  type FamilyCalendarEvent,
} from "../../shared/familyCalendar";

const SETTINGS_DOC = () => firestore().collection("settings").doc("familyCalendar");
const CONFIRMED_STATUSES = new Set(["confirmat", "finalizat"]);
/** Past events stay visible this long, so the list also shows what was just done. */
const HISTORY_DAYS = 90;

export type FamilyCalendarSettings = {
  token: string;
  recipientEmail: string;
  weeklyEmail: boolean;
  lastEmailAt: string | null;
  lastWeeklyEmailWeek: string | null;
};

const newToken = () => randomBytes(18).toString("base64url");

export async function getFamilyCalendarSettings(): Promise<FamilyCalendarSettings> {
  const ref = SETTINGS_DOC();
  const data = (await ref.get()).data() ?? {};
  const settings: FamilyCalendarSettings = {
    token: typeof data.token === "string" && data.token ? data.token : newToken(),
    recipientEmail: typeof data.recipientEmail === "string" && data.recipientEmail ? data.recipientEmail : ESTERA_EMAIL,
    weeklyEmail: data.weeklyEmail === true,
    lastEmailAt: typeof data.lastEmailAt === "string" ? data.lastEmailAt : null,
    lastWeeklyEmailWeek: typeof data.lastWeeklyEmailWeek === "string" ? data.lastWeeklyEmailWeek : null,
  };
  if (data.token !== settings.token) await ref.set({ token: settings.token }, { merge: true });
  return settings;
}

export async function updateFamilyCalendarSettings(update: Partial<Omit<FamilyCalendarSettings, "token">>): Promise<void> {
  await SETTINGS_DOC().set(update, { merge: true });
}

/** A new secret link; the old one (and calendars subscribed to it) stop working. */
export async function rotateFamilyCalendarToken(): Promise<string> {
  const token = newToken();
  await SETTINGS_DOC().set({ token }, { merge: true });
  return token;
}

export async function isFamilyCalendarToken(candidate: string): Promise<boolean> {
  const data = (await SETTINGS_DOC().get()).data();
  const token = typeof data?.token === "string" ? data.token : "";
  if (!token || !candidate || candidate.length > 128) return false;
  const digest = (value: string) => new Uint8Array(createHash("sha256").update(value).digest());
  return timingSafeEqual(digest(candidate), digest(token));
}

const todayInRomania = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Bucharest" });

/** Confirmed events from HISTORY_DAYS ago onwards, with the location from the linked contract. */
export async function loadFamilyCalendarEvents(today = todayInRomania()): Promise<FamilyCalendarEvent[]> {
  const db = firestore();
  const snapshot = await db.collection("adminEvents").get();
  const from = addDays(today, -HISTORY_DAYS);
  const events: (FamilyCalendarEvent & { contractId?: string })[] = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!CONFIRMED_STATUSES.has(data.status)) continue;
    const dates = expandEventDates(data);
    if (dates.length === 0 || dates[dates.length - 1] < from) continue;
    const total = Number(data.pricing?.total);
    events.push({
      id: doc.id,
      dates,
      type: String(data.typeLabel || data.type || "Eveniment"),
      clientName: String(data.client?.fullName ?? "").trim(),
      location: "",
      total: Number.isFinite(total) && total > 0 ? total : null,
      status: String(data.status),
      contractId: typeof data.contractId === "string" && data.contractId ? data.contractId : undefined,
    });
  }
  const contractIds = [...new Set(events.map((event) => event.contractId).filter((id): id is string => Boolean(id)))];
  const contracts = contractIds.length ? await db.getAll(...contractIds.map((id) => db.collection("contracts").doc(id))) : [];
  const locations = new Map(contracts.map((doc) => [doc.id, String(doc.data()?.eventLocation ?? "").trim()]));
  return events
    .map(({ contractId, ...event }) => ({ ...event, location: (contractId && locations.get(contractId)) || "" }))
    .sort((a, b) => a.dates[0].localeCompare(b.dates[0]));
}

// --- Email (monochrome, square, like the other client emails) ---

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const formatDays = (dates: readonly string[]) => {
  const format = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return dates.length > 1 ? `${format(dates[0])} – ${format(dates[dates.length - 1])}` : format(dates[0]);
};

function eventRowsHtml(events: readonly FamilyCalendarEvent[]): string {
  if (events.length === 0) return `<p style="color:#666;font-size:14px;margin:0;">Niciun eveniment.</p>`;
  return events.map((event) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:14px;color:#111;vertical-align:top;">
        <strong style="text-transform:capitalize;">${escapeHtml(formatDays(event.dates))}</strong><br/>
        ${eventEmoji(event.type)} ${escapeHtml(eventTitle(event))}${event.location ? `<br/><span style="color:#666;">${escapeHtml(event.location)}</span>` : ""}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:14px;color:#111;text-align:right;vertical-align:top;white-space:nowrap;">
        ${event.total !== null ? escapeHtml(formatEur(event.total)) : "—"}
      </td>
    </tr>`).join("");
}

export function familyCalendarEmail(input: { email: string; events: readonly FamilyCalendarEvent[]; today: string; weekly: boolean }): { subject: string; html: string } {
  const pageUrl = `${APP_BASE_URL}${FAMILY_CALENDAR_PAGE}`;
  const weekStart = mondayOf(input.today);
  const thisWeek = eventsBetween(input.events, weekStart, addDays(weekStart, 6));
  const upcoming = eventsBetween(input.events, addDays(weekStart, 7), addDays(input.today, 365));
  const subject = input.weekly
    ? thisWeek.length ? `Săptămâna asta: ${thisWeek.length === 1 ? "1 eveniment" : `${thisWeek.length} evenimente`}` : "Săptămâna asta: niciun eveniment"
    : "Calendarul cu evenimentele mele";
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 20px;background:#fff;color:#111;">
    <p style="font-size:12px;letter-spacing:3px;margin:0 0 24px;color:#111;">ANCA VISUALS</p>
    <h1 style="font-size:22px;font-weight:normal;margin:0 0 12px;">${input.weekly ? "Planul săptămânii" : "Bună, Estera!"}</h1>
    <p style="font-size:14px;line-height:1.6;margin:0 0 20px;">${input.weekly
      ? "Iată ce evenimente am săptămâna aceasta și ce urmează."
      : "Pe ancavisuals.ro/zile-ocupate vezi oricând când am nunți și alte evenimente, cu data și prețul fiecăruia, ca un calendar sau ca o listă. După ce intri, îl poți adăuga și în calendarul din telefon, cu reminder cu o săptămână și cu o zi înainte."}</p>
    ${input.weekly ? "" : `<p style="font-size:14px;line-height:1.6;margin:0 0 20px;">Ca să intri, scrii emailul tău (<strong>${escapeHtml(input.email)}</strong>) și primești pe email un cod de 6 cifre. Nu ai nevoie de parolă.</p>`}
    <a href="${escapeHtml(pageUrl)}" style="display:inline-block;margin:0 0 8px;padding:12px 18px;font-size:14px;font-weight:bold;text-decoration:none;background:#111;color:#fff;">Deschide calendarul</a>
    <h2 style="font-size:13px;letter-spacing:2px;text-transform:uppercase;margin:28px 0 4px;">Săptămâna aceasta</h2>
    <table style="width:100%;border-collapse:collapse;">${eventRowsHtml(thisWeek)}</table>
    <h2 style="font-size:13px;letter-spacing:2px;text-transform:uppercase;margin:28px 0 4px;">Urmează</h2>
    <table style="width:100%;border-collapse:collapse;">${eventRowsHtml(upcoming.slice(0, 15))}</table>
    ${upcoming.length > 15 ? `<p style="font-size:13px;color:#666;margin:12px 0 0;">și încă ${upcoming.length - 15} în calendar.</p>` : ""}
  </div>`;
  return { subject, html };
}

export async function sendFamilyCalendarEmail({ weekly = false, to }: { weekly?: boolean; to?: string } = {}): Promise<{ to: string; events: number }> {
  const settings = await getFamilyCalendarSettings();
  const today = todayInRomania();
  const events = await loadFamilyCalendarEvents(today);
  const recipient = to ?? settings.recipientEmail;
  const { subject, html } = familyCalendarEmail({ email: recipient, events, today, weekly });
  await sendEmail({ to: recipient, subject, html, source: weekly ? "family-calendar-weekly" : "family-calendar" });
  await updateFamilyCalendarSettings(weekly
    ? { lastWeeklyEmailWeek: mondayOf(today), lastEmailAt: new Date().toISOString() }
    : { lastEmailAt: new Date().toISOString(), recipientEmail: recipient });
  return { to: recipient, events: events.length };
}

/** Monday cron: the week's plan, once per week, only when the admin turned it on. */
export async function sendWeeklyFamilyCalendarEmail(): Promise<boolean> {
  const settings = await getFamilyCalendarSettings();
  if (!settings.weeklyEmail || settings.lastWeeklyEmailWeek === mondayOf(todayInRomania())) return false;
  await sendFamilyCalendarEmail({ weekly: true });
  return true;
}

