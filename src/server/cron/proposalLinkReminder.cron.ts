import cron from "node-cron";
import { processProposalLinkReminders } from "../services/proposalLinkReminder";

/**
 * Every hour from 10 to 20 (Romania, never at night for SMS): remind whoever stopped choosing photos.
 * Production only — a local server uses the same Firestore and would send real emails/SMS.
 */
export function startProposalLinkReminderCron(): void {
  if (process.env.NODE_ENV !== "production") return;
  cron.schedule("15 10-20 * * *", () => {
    processProposalLinkReminders()
      .then((count) => { if (count > 0) console.log(`[proposal-link reminder cron] Reminded ${count} person(s)`); })
      .catch((error) => console.error("[proposal-link reminder cron] Run failed:", error));
  }, { timezone: "Europe/Bucharest" });
  console.log("[proposal-link reminder cron] Started - hourly 10:15-20:15 Europe/Bucharest");
}
