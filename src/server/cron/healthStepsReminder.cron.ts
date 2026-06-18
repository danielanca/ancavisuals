import cron from "node-cron";
import { firestore } from "../firestore";
import { sendEmail } from "../notifications/mailer";

const USERS = [
  { id: "daniel", email: "ancadaniel1994@gmail.com", name: "Daniel" },
];

async function checkAndSendStepsReminders() {
  const today = new Date().toISOString().slice(0, 10);
  const db = firestore();

  for (const user of USERS) {
    const docRef = db.collection("health_activity_logs").doc(`${user.id}_${today}`);
    const doc = await docRef.get();

    if (doc.exists) continue;

    await sendEmail({
      to: user.email,
      subject: "⚠️ Nu ai logat pașii azi",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0a0a0a; color: #eeeeee; border-radius: 12px;">
          <h2 style="color: #4ade80; margin: 0 0 12px;">Bună, ${user.name}! 👋</h2>
          <p style="color: #aaaaaa; margin: 0 0 16px; line-height: 1.6;">
            Astăzi (<strong style="color: #eeeeee;">${today}</strong>) nu ai logat încă pașii în Health Tracker.
          </p>
          <p style="color: #aaaaaa; margin: 0 0 20px; line-height: 1.6;">
            Deschide aplicația Health pe telefon, fă un screenshot și încarcă-l cât mai ai timp.
          </p>
          <a href="https://ancavisuals.ro/admin/sanatate" style="display: inline-block; padding: 12px 24px; background: #4ade80; color: #0a0a0a; font-weight: 700; border-radius: 8px; text-decoration: none;">
            Loghează pașii acum →
          </a>
          <p style="color: #444444; font-size: 11px; margin: 24px 0 0;">Trimis automat la 22:00 · AncaVisuals Health Tracker</p>
        </div>
      `,
    });

    console.log(`[health-steps-reminder] Reminder trimis pentru ${user.name} (${today})`);
  }
}

export function startHealthStepsReminderCron() {
  // Every day at 22:00
  cron.schedule("0 22 * * *", () => {
    checkAndSendStepsReminders().catch((err) => {
      console.error("[health-steps-reminder] Error:", err);
    });
  }, { timezone: "Europe/Bucharest" });

  console.log("[health-steps-reminder] Cron pornit — verificare zilnică la 22:00");
}
