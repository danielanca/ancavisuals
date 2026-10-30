/*
 * Purpose: messages from the family calendar (/zile-ocupate) to Estera and the helper (Salomeea), by
 * email and, when a phone is set in /admin/calendar-familie, by SMS:
 * - the helper hears right away when she's assigned to an event;
 * - a week and a day before each event, a reminder (Estera: every event, the helper: hers). Sent
 *   once per person, event, day and kind (familyCalendarReminders/<key>), from the 09:00 cron.
 * - a message the owner writes in the admin, to one or both of them, by email and/or SMS.
 * The helper never gets prices; Estera's reminder email has the price, SMS never do.
 */
import { firestore } from "../firestore";
import { APP_BASE_URL } from "../constants/domain";
import { sendEmail } from "../notifications/mailer";
import { isSmsConfigured, sendSms } from "../notifications/sms";
import { addDays, eventEmoji, eventTitle, FAMILY_CALENDAR_PAGE, formatEur, helperEvents, type FamilyCalendarEvent } from "../../shared/familyCalendar";
import { escapeHtml, formatDays, getFamilyCalendarSettings, loadFamilyCalendarEvents, todayInRomania } from "./familyCalendar.service";

const REMINDERS_SENT = () => firestore().collection("familyCalendarReminders");
const pageUrl = () => `${APP_BASE_URL}${FAMILY_CALENDAR_PAGE}`;
const shortPageUrl = () => pageUrl().replace(/^https?:\/\/(www\.)?/, "");

type Person = { name: string; email: string; phone: string; withPrice: boolean };
export type Sent = { email: boolean; sms: boolean };

const eventLine = (event: FamilyCalendarEvent) => [eventTitle(event), event.location].filter(Boolean).join(", ");

function emailHtml(heading: string, intro: string, events: readonly FamilyCalendarEvent[], withPrice: boolean): string {
  const rows = events.map((event) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:14px;color:#111;vertical-align:top;">
        <strong style="text-transform:capitalize;">${escapeHtml(formatDays(event.dates))}</strong><br/>
        ${eventEmoji(event.type)} ${escapeHtml(eventTitle(event))}${event.location ? `<br/><span style="color:#666;">${escapeHtml(event.location)}</span>` : ""}
      </td>
      ${withPrice && event.total !== null ? `<td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:14px;color:#111;text-align:right;vertical-align:top;white-space:nowrap;">${escapeHtml(formatEur(event.total))}</td>` : ""}
    </tr>`).join("");
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 20px;background:#fff;color:#111;">
    <p style="font-size:12px;letter-spacing:3px;margin:0 0 24px;color:#111;">ANCA VISUALS</p>
    <h1 style="font-size:22px;font-weight:normal;margin:0 0 12px;">${escapeHtml(heading)}</h1>
    <p style="font-size:14px;line-height:1.6;margin:0 0 20px;">${escapeHtml(intro)}</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">${rows}</table>
    <a href="${escapeHtml(pageUrl())}" style="display:inline-block;padding:12px 18px;font-size:14px;font-weight:bold;text-decoration:none;background:#111;color:#fff;">Deschide calendarul</a>
  </div>`;
}

/** Email always (when there's an address), SMS when there's a phone and SMS is set up. One failing doesn't stop the other. */
async function deliver(person: Person, message: { subject: string; html: string; sms: string; source: string; event?: string }): Promise<Sent> {
  const sent: Sent = { email: false, sms: false };
  if (person.email) {
    try {
      await sendEmail({ to: person.email, subject: message.subject, html: message.html, source: message.source });
      sent.email = true;
    } catch (error) {
      console.error(`[family calendar] ${message.source} email to ${person.name} failed:`, error);
    }
  }
  if (person.phone && isSmsConfigured()) {
    try {
      await sendSms({ to: person.phone, body: message.sms, log: { source: message.source, event: message.event ?? null, recipientName: person.name } });
      sent.sms = true;
    } catch (error) {
      console.error(`[family calendar] ${message.source} SMS to ${person.name} failed:`, error);
    }
  }
  return sent;
}

/** Tells the helper about events she was just assigned to (only those still to come). */
export async function notifyHelperAssigned(eventIds: readonly string[], today = todayInRomania()): Promise<Sent & { events: number }> {
  if (eventIds.length === 0) return { email: false, sms: false, events: 0 };
  const settings = await getFamilyCalendarSettings();
  const events = helperEvents(await loadFamilyCalendarEvents(today), eventIds).filter((event) => event.dates[event.dates.length - 1] >= today);
  if (events.length === 0) return { email: false, sms: false, events: 0 };
  const first = events[0];
  const subject = events.length === 1
    ? `Ai fost programată: ${eventTitle(first)}, ${formatDays(first.dates)}`
    : `Ai fost programată la ${events.length} evenimente`;
  const sms = events.length === 1
    ? `Anca Visuals: ai fost programata la ${eventLine(first)}, ${formatDays(first.dates)}. Detalii: ${shortPageUrl()}`
    : `Anca Visuals: ai fost programata la ${events.length} evenimente: ${events.map((event) => `${formatDays(event.dates)} - ${eventTitle(event)}`).join("; ")}. Detalii: ${shortPageUrl()}`;
  const sent = await deliver(
    { name: "Salomeea", email: settings.helperEmail, phone: settings.helperPhone, withPrice: false },
    {
      subject,
      html: emailHtml("Ai fost programată", "Te-am trecut în calendar la:", events, false),
      sms,
      source: "family-calendar-assigned",
      event: events.map((event) => event.dates[0]).join(", "),
    },
  );
  return { ...sent, events: events.length };
}

export type ReminderKind = "week" | "day";
const REMINDER_DAYS: Record<ReminderKind, number> = { week: 7, day: 1 };

/** Daily: reminders for events starting in a week or tomorrow. Returns how many people were reminded. */
export async function processFamilyCalendarReminders(today = todayInRomania()): Promise<number> {
  const settings = await getFamilyCalendarSettings();
  if (!settings.reminders) return 0;
  const events = await loadFamilyCalendarEvents(today);
  const helperIds = new Set(settings.helperEventIds);
  const people: { key: string; person: Person; events: readonly FamilyCalendarEvent[] }[] = [
    { key: "family", person: { name: "Estera", email: settings.recipientEmail, phone: settings.recipientPhone, withPrice: true }, events },
    { key: "helper", person: { name: "Salomeea", email: settings.helperEmail, phone: settings.helperPhone, withPrice: false }, events: helperEvents(events, [...helperIds]) },
  ];
  let reminded = 0;
  for (const kind of ["week", "day"] as const) {
    const day = addDays(today, REMINDER_DAYS[kind]);
    for (const { key, person, events: theirs } of people) {
      for (const event of theirs.filter((item) => item.dates[0] === day)) {
        const ref = REMINDERS_SENT().doc(`${key}_${event.id}_${day}_${kind}`);
        if ((await ref.get()).exists) continue;
        const when = kind === "week" ? "Peste o săptămână" : "Mâine";
        const sent = await deliver(person, {
          subject: `${when}: ${eventTitle(event)}`,
          html: emailHtml(`${when}, ${formatDays(event.dates)}`, kind === "week" ? "Un eveniment din calendar e peste o săptămână:" : "Mâine ai eveniment:", [event], person.withPrice),
          sms: `Anca Visuals: ${when.toLowerCase()} (${formatDays(event.dates)}) - ${eventLine(event)}. Detalii: ${shortPageUrl()}`,
          source: `family-calendar-reminder-${kind}`,
          event: day,
        });
        if (sent.email || sent.sms) {
          await ref.set({ sentAt: new Date().toISOString(), email: sent.email, sms: sent.sms });
          reminded++;
        }
      }
    }
  }
  return reminded;
}

export type ManualMessageTarget = "family" | "helper";

/** A message typed by the owner in /admin/calendar-familie. Returns who got it and how. */
export async function sendFamilyCalendarMessage(input: { to: readonly ManualMessageTarget[]; text: string; email: boolean; sms: boolean }): Promise<{ name: string; email: boolean; sms: boolean }[]> {
  const settings = await getFamilyCalendarSettings();
  const people: Record<ManualMessageTarget, Person> = {
    family: { name: "Estera", email: settings.recipientEmail, phone: settings.recipientPhone, withPrice: true },
    helper: { name: "Salomeea", email: settings.helperEmail, phone: settings.helperPhone, withPrice: false },
  };
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 20px;background:#fff;color:#111;">
    <p style="font-size:12px;letter-spacing:3px;margin:0 0 24px;color:#111;">ANCA VISUALS</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 24px;white-space:pre-line;">${escapeHtml(input.text)}</p>
    <a href="${escapeHtml(pageUrl())}" style="display:inline-block;padding:12px 18px;font-size:14px;font-weight:bold;text-decoration:none;background:#111;color:#fff;">Deschide calendarul</a>
  </div>`;
  const results = [];
  for (const target of [...new Set(input.to)]) {
    const person = people[target];
    const sent = await deliver(
      { ...person, email: input.email ? person.email : "", phone: input.sms ? person.phone : "" },
      { subject: "Mesaj despre calendar", html, sms: `Anca Visuals: ${input.text}`, source: "family-calendar-message" },
    );
    results.push({ name: person.name, ...sent });
  }
  return results;
}
