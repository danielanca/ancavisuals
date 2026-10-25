import cron from "node-cron";
import { processAutoSignReminders } from "../services/handoverSignReminder";

/** Every day at 11 (Romania, never at night for SMS): remind clients who haven't signed their PV yet. */
export function startHandoverSignReminderCron(): void {
  cron.schedule("0 11 * * *", () => {
    processAutoSignReminders()
      .then((count) => { if (count > 0) console.log(`[handover sign cron] Reminder sent for ${count} PV(s)`); })
      .catch((error) => console.error("[handover sign cron] Run failed:", error));
  }, { timezone: "Europe/Bucharest" });
  console.log("[handover sign cron] Started - daily 11:00 Europe/Bucharest");
}
