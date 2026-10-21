import cron from "node-cron";
import { syncEmailInbox } from "../services/emailInbox.service";

/**
 * Every 10 minutes: copy the replies to the site's emails from the mailbox into /admin/email-log.
 * Production only (a local server would read the same mailbox); EMAIL_INBOX_SYNC=off stops it.
 */
export function startEmailInboxCron(): void {
  if (process.env.NODE_ENV !== "production" || process.env.EMAIL_INBOX_SYNC === "off") return;
  let running = false;
  cron.schedule("*/10 * * * *", async () => {
    if (running) return;
    running = true;
    try {
      const result = await syncEmailInbox();
      if (result.saved > 0) console.log(`[email-inbox] ${result.saved} răspunsuri noi salvate (${result.checked} verificate).`);
    } catch (error) {
      console.error("[email-inbox] sync failed:", error);
    } finally {
      running = false;
    }
  }, { timezone: "Europe/Bucharest" });
}
