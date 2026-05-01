import cron from "node-cron";
import { firestore } from "../firestore";
import { Timestamp } from "firebase-admin/firestore";
import { sendEmail } from "../notifications/mailer";
import { getNextOccurrence } from "../routes/mementos.routes";

const ADMIN_EMAIL = "ancadaniel1994@gmail.com";

async function checkAndSendMementos() {
  try {
    const db = firestore();
    const now = new Date();

    const snapshot = await db.collection("mementos")
      .where("completed", "==", false)
      .where("emailSent", "==", false)
      .get();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const dueDate = data.dueDate instanceof Timestamp
        ? data.dueDate.toDate()
        : new Date(data.dueDate);

      const reminderMinutes = data.reminderMinutesBefore ?? 0;
      const reminderTime = new Date(dueDate.getTime() - reminderMinutes * 60 * 1000);

      // Send if the reminder time has been reached
      if (now < reminderTime) continue;
      // Don't send if more than 2 hours past the due date
      const twoHoursAfterDue = new Date(dueDate.getTime() + 2 * 60 * 60 * 1000);
      if (now > twoHoursAfterDue) continue;

      const daysUntilDue = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const formattedDate = dueDate.toLocaleString("ro-RO", {
        day: "2-digit", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });

      const categoryLabel = data.category === "ancavisuals" ? "AncaVisuals" : "Personal";
      const recurringLabel: Record<string, string> = {
        weekly: "săptămânal", monthly: "lunar", yearly: "anual",
      };
      const recurringText = data.recurring !== "none"
        ? `<p style="color:#6b7280;font-size:12px;">🔁 Recurent: ${recurringLabel[data.recurring] ?? data.recurring}</p>`
        : "";

      const reminderText = daysUntilDue > 0
        ? `Scadent în <strong>${daysUntilDue} ${daysUntilDue === 1 ? "zi" : "zile"}</strong> — ${formattedDate}`
        : daysUntilDue === 0
          ? `Scadent <strong>azi</strong> — ${formattedDate}`
          : `⚠ Depășit — ${formattedDate}`;

      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `⏰ Memento: ${data.title}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
            <h2 style="color:#7c3aed;margin-bottom:4px;">⏰ Memento</h2>
            <p style="color:#6b7280;font-size:13px;margin-top:0;">${categoryLabel}</p>
            <h3 style="color:#111;font-size:20px;margin:16px 0 8px;">${data.title}</h3>
            ${data.description ? `<p style="color:#374151;font-size:15px;">${data.description}</p>` : ""}
            <p style="color:#6b7280;font-size:13px;margin-top:16px;">${reminderText}</p>
            ${recurringText}
          </div>
        `,
      });

      // If recurring — advance the date and reset; otherwise mark as sent
      if (data.recurring && data.recurring !== "none") {
        const nextDate = getNextOccurrence(dueDate, data.recurring);
        await db.collection("mementos").doc(doc.id).update({
          dueDate: Timestamp.fromDate(nextDate),
          emailSent: false,
        });
      } else {
        await db.collection("mementos").doc(doc.id).update({ emailSent: true });
      }

      console.log(`[mementos cron] Email trimis: ${data.title}`);
    }
  } catch (error) {
    console.error("[mementos cron] Eroare:", error);
  }
}

export { checkAndSendMementos };

export function startMementosCron() {
  cron.schedule("0 8 * * *", checkAndSendMementos);
  console.log("[mementos cron] Pornit — zilnic 08:00");
}
