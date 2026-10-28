import cron from "node-cron";
import { sendWeeklyFamilyCalendarEmail } from "../services/familyCalendar.service";

/** Mondays at 08:00 (Romania): Estera gets the week's events, when turned on in /admin/calendar-familie. */
export function startFamilyCalendarWeeklyCron(): void {
  if (process.env.NODE_ENV !== "production") return;
  cron.schedule("0 8 * * 1", () => {
    sendWeeklyFamilyCalendarEmail()
      .then((sent) => { if (sent) console.log("[family calendar cron] Weekly plan sent"); })
      .catch((error) => console.error("[family calendar cron] Run failed:", error));
  }, { timezone: "Europe/Bucharest" });
  console.log("[family calendar cron] Started - Mondays 08:00 Europe/Bucharest");
}
