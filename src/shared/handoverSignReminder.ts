// Reminder for a Proces Verbal sent but not signed yet: the client gets the materials only after
// signing. Shared by the admin list (shows the schedule) and the server (manual button + daily cron).

const DAY_MS = 24 * 60 * 60 * 1000;

/** Automatic reminders: every N days after the PV link (or the last reminder) went out… */
export const AUTO_SIGN_REMINDER_INTERVAL_DAYS = 3;
/** …at most this many times; after that only the manual button sends. */
export const AUTO_SIGN_REMINDER_MAX = 4;

/** When the next automatic reminder goes out, or null when none will. */
export function nextAutoSignReminderAt(args: {
  sentAt: string | null | undefined;
  lastReminderAt: string | null | undefined;
  autoCount: number | null | undefined;
  enabled: boolean | null | undefined;
}): Date | null {
  if (args.enabled === false || (args.autoCount ?? 0) >= AUTO_SIGN_REMINDER_MAX) return null;
  const from = [args.lastReminderAt, args.sentAt]
    .map((value) => (value ? new Date(value) : null))
    .find((date) => date && !isNaN(date.getTime()));
  return from ? new Date(from.getTime() + AUTO_SIGN_REMINDER_INTERVAL_DAYS * DAY_MS) : null;
}

function roDate(value: string): string {
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Bucharest" });
}

/** SMS text (sms.ts strips diacritics before sending). */
export function signReminderSmsText(args: { eventDate: string; link: string; automatedLabel: string }): string {
  return `Bună ziua! Suntem echipa foto-video de la evenimentul din data de ${roDate(args.eventDate)}. Materialele vă așteaptă: semnați procesul verbal de predare și le primiți imediat: ${args.link}\n\n${args.automatedLabel}`;
}
