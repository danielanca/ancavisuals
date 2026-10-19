import cron from "node-cron";
import { processPromiseReminders } from "../services/albumPromises";

/** Every morning at 9 (Romania): "hei, vezi că ai promis ceva" for dates coming up or passed. */
export function startAlbumPromisesCron(): void {
  cron.schedule("0 9 * * *", () => {
    processPromiseReminders()
      .then((count) => { if (count > 0) console.log(`[album promises cron] Reminder sent for ${count} promise(s)`); })
      .catch((error) => console.error("[album promises cron] Run failed:", error));
  }, { timezone: "Europe/Bucharest" });
  console.log("[album promises cron] Started - daily 09:00 Europe/Bucharest");
}
