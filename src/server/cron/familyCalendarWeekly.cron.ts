import cron from "node-cron";
import { sendWeeklyFamilyCalendarEmail } from "../services/familyCalendar.service";
import { processFamilyCalendarReminders } from "../services/familyCalendarNotify.service";

/**
 * Mondays at 08:00 (Romania): Estera gets the week's events, when turned on in /admin/calendar-familie.
 * Every day at 09:00: reminders a week and a day before each event (Estera + Salomeea, email and SMS).
 * Production only — a local server uses the same Firestore and would send real emails/SMS.
 */
export function startFamilyCalendarWeeklyCron(): void {
  if (process.env.NODE_ENV !== "production") return;
  cron.schedule("0 8 * * 1", () => {
    sendWeeklyFamilyCalendarEmail()
      .then((sent) => { if (sent) console.log("[family calendar cron] Weekly plan sent"); })
      .catch((error) => console.error("[family calendar cron] Run failed:", error));
  }, { timezone: "Europe/Bucharest" });
  cron.schedule("0 9 * * *", () => {
    processFamilyCalendarReminders()
      .then((count) => { if (count > 0) console.log(`[family calendar cron] Reminded ${count} time(s)`); })
      .catch((error) => console.error("[family calendar cron] Reminders failed:", error));
  }, { timezone: "Europe/Bucharest" });
  console.log("[family calendar cron] Started - Mondays 08:00 + reminders daily 09:00 Europe/Bucharest");
}
