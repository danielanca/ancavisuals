/*
 * Purpose: the family calendar ("Calendarul meu pentru Estera") — the owner's confirmed events
 * as seen by his wife on /zile-ocupate (she signs in with her email and a one-time code): a month
 * view, a list with each event's price and date, and a subscribable .ics feed (secret link) with
 * reminders a week and a day before. Shared by the server (feed + emails) and the page.
 */

export type FamilyCalendarEvent = {
  id: string;
  /** Every day of the event, "YYYY-MM-DD", sorted. */
  dates: string[];
  /** "Nuntă", "Botez"… */
  type: string;
  clientName: string;
  location: string;
  /** Total price in EUR, null when not set. */
  total: number | null;
  status: string;
};

/** A day or range Estera asked to keep free for the family; the owner approves it. */
export type FamilyTimeRequest = {
  id: string;
  startDate: string;
  endDate: string;
  note: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  decidedAt: string | null;
  /** The owner's answer, optional. */
  reply: string;
};

export const FAMILY_TIME_STATUS_LABEL: Record<FamilyTimeRequest["status"], string> = {
  pending: "⏳ Așteaptă răspuns",
  approved: "✓ Aprobat",
  rejected: "✕ Neaprobat",
};

export type FamilyCalendarData = {
  events: FamilyCalendarEvent[];
  familyTime: FamilyTimeRequest[];
  /** Secret .ics feed for calendar apps (they can't sign in). */
  icsUrl: string;
  generatedAt: string;
};

/** The page Estera signs in to. */
export const FAMILY_CALENDAR_PAGE = "/zile-ocupate";

/** The calendar-app feed for a token. */
export const familyCalendarIcsPath = (token: string) => `/api/family-calendar/${token}/calendar.ics`;

/** Google Calendar "add by URL" link for a public https .ics feed. */
export const googleCalendarSubscribeUrl = (icsUrl: string) =>
  `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(icsUrl.replace(/^https?:\/\//, "webcal://"))}`;

export const formatEur = (amount: number) =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);

const EVENT_EMOJI: Record<string, string> = { "Nuntă": "💍", "Botez": "👶", "Cununie civilă": "🤍", "Logodnă": "💫", "Majorat": "🎉" };
export const eventEmoji = (type: string) => EVENT_EMOJI[type] ?? "📸";

export const eventTitle = (event: Pick<FamilyCalendarEvent, "type" | "clientName">) =>
  [event.type, event.clientName].filter(Boolean).join(" · ");

/** Monday ("YYYY-MM-DD") of the week holding `day`. */
export function mondayOf(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Events with at least one day in [from, to] (inclusive), earliest first. */
export function eventsBetween(events: readonly FamilyCalendarEvent[], from: string, to: string): FamilyCalendarEvent[] {
  return events
    .filter((event) => event.dates.some((day) => day >= from && day <= to))
    .sort((a, b) => a.dates[0].localeCompare(b.dates[0]));
}

// --- .ics feed ---

const escapeIcs = (text: string) => text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
const icsDay = (day: string) => day.replace(/-/g, "");

/** RFC 5545 lines are at most 75 octets; longer ones continue on a line starting with a space. */
function foldIcsLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    if (bytes + size > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** Consecutive days grouped into ranges, so a 2-day wedding is one calendar entry. */
function dayRanges(dates: readonly string[]): { start: string; end: string }[] {
  const ranges: { start: string; end: string }[] = [];
  for (const day of dates) {
    const last = ranges[ranges.length - 1];
    if (last && addDays(last.end, 1) === day) last.end = day;
    else ranges.push({ start: day, end: day });
  }
  return ranges;
}

/**
 * The subscribable calendar: one all-day entry per event (per run of consecutive days), with
 * reminders at 09:00 a week before and the day before. Apple Calendar and Outlook use these
 * reminders; Google Calendar uses the notifications set on the subscribed calendar instead.
 */
export function buildFamilyCalendarIcs(events: readonly FamilyCalendarEvent[], now: Date, familyTime: readonly FamilyTimeRequest[] = [], calendarName = "Evenimente AncaVisuals"): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AncaVisuals//Calendar familie//RO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
    "X-WR-TIMEZONE:Europe/Bucharest",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];
  for (const event of events) {
    const title = `${eventEmoji(event.type)} ${eventTitle(event)}`;
    const description = [
      event.total !== null ? `Preț: ${formatEur(event.total)}` : null,
      event.location ? `Locație: ${event.location}` : null,
      event.dates.length > 1 ? `Zile: ${event.dates.length}` : null,
    ].filter(Boolean).join("\n");
    for (const range of dayRanges(event.dates)) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:${event.id}-${range.start}@ancavisuals.ro`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${icsDay(range.start)}`,
        `DTEND;VALUE=DATE:${icsDay(addDays(range.end, 1))}`,
        `SUMMARY:${escapeIcs(title)}`,
        ...(description ? [`DESCRIPTION:${escapeIcs(description)}`] : []),
        ...(event.location ? [`LOCATION:${escapeIcs(event.location)}`] : []),
        "TRANSP:OPAQUE",
        // All-day events start at 00:00: -P6DT15H = 09:00 a week before, -PT15H = 09:00 the day before.
        "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeIcs(`Peste o săptămână: ${title}`)}`, "TRIGGER:-P6DT15H", "END:VALARM",
        "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeIcs(`Mâine: ${title}`)}`, "TRIGGER:-PT15H", "END:VALARM",
        "END:VEVENT",
      );
    }
  }
  for (const request of familyTime) {
    if (request.status !== "approved") continue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:family-${request.id}@ancavisuals.ro`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDay(request.startDate)}`,
      `DTEND;VALUE=DATE:${icsDay(addDays(request.endDate, 1))}`,
      `SUMMARY:${escapeIcs("🏡 Timp pentru familie")}`,
      ...(request.note ? [`DESCRIPTION:${escapeIcs(request.note)}`] : []),
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}
