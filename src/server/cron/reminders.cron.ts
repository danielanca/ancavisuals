import cron from "node-cron";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { sendEmail } from "../notifications/mailer";
import { APP_BASE_URL } from "../constants/domain";

function buildReminderEmailHtml(title: string, message: string): string {
  return `
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fdf9f5;border-radius:12px;border:1px solid #e8d9c8;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#b07d5c;">Wedding Hub · AncaVisuals</p>
      <h1 style="margin:0 0 20px;font-size:20px;font-weight:400;color:#2f2a26;line-height:1.35;">${title}</h1>
      <p style="margin:0 0 28px;font-size:15px;color:#5a4a3e;line-height:1.65;">${message}</p>
      <hr style="border:none;border-top:1px solid #e3d0bf;margin:0 0 20px;">
      <p style="margin:0;font-size:11px;color:#b09882;">
        Accesează <a href="${APP_BASE_URL}/wedding-hub/reminders" style="color:#b07d5c;">Wedding Hub</a> pentru a gestiona notificările.
      </p>
    </div>
  `;
}

async function processWedding(
  weddingId: string,
  weddingDateRaw: unknown,
  coupleEmail: string,
): Promise<void> {
  const database = firestore();
  const weddingRef = database.collection("wh_weddings").doc(weddingId);
  const now = new Date();

  // Parse wedding date
  let weddingDate: Date;
  if (weddingDateRaw instanceof Timestamp) {
    weddingDate = weddingDateRaw.toDate();
  } else if (typeof weddingDateRaw === "string") {
    weddingDate = new Date(weddingDateRaw);
  } else {
    return; // invalid date, skip
  }
  if (isNaN(weddingDate.getTime())) return;

  const daysUntilWedding = Math.ceil((weddingDate.getTime() - now.getTime()) / 86400000);

  // Fetch preferences
  const prefSnap = await weddingRef.collection("reminders").doc("preferences").get();
  const preferences = prefSnap.exists
    ? prefSnap.data()!
    : { emailNotificationsEnabled: false, inAppNotificationsEnabled: true, emailAddress: "" };

  const emailAddress = preferences.emailAddress || coupleEmail;

  // Fetch pending reminders
  const remindersSnap = await weddingRef
    .collection("reminders")
    .where("status", "==", "pending")
    .get();

  const toFire: FirebaseFirestore.QueryDocumentSnapshot[] = [];

  for (const doc of remindersSnap.docs) {
    if (doc.id === "preferences") continue;
    const data = doc.data();

    if (data.triggerType === "daysBeforeWedding") {
      const targetDays: number | null = data.triggerValue?.daysBeforeWedding ?? null;
      if (targetDays != null && daysUntilWedding <= targetDays) {
        toFire.push(doc);
      }
    } else if (data.triggerType === "specificDate") {
      const specificDate = data.triggerValue?.specificDate;
      if (specificDate) {
        const triggerDate = specificDate instanceof Timestamp
          ? specificDate.toDate()
          : new Date(specificDate);
        if (!isNaN(triggerDate.getTime()) && triggerDate <= now) {
          toFire.push(doc);
        }
      }
    } else if (data.triggerType === "onCondition") {
      const condition: string | null = data.triggerValue?.condition ?? null;

      if (condition === "checklistItemOverdue") {
        const overdueSnap = await weddingRef
          .collection("checklistItems")
          .where("isCompleted", "==", false)
          .where("dueDate", "<", Timestamp.fromDate(now))
          .limit(1)
          .get();
        if (!overdueSnap.empty) toFire.push(doc);
      } else if (condition === "rsvpDeadline") {
        if (daysUntilWedding <= 30 && daysUntilWedding > 0) {
          const pendingGuestsSnap = await database
            .collection("wh_guests")
            .where("weddingId", "==", weddingId)
            .where("rsvpStatus", "==", "asteptare")
            .limit(1)
            .get();
          if (!pendingGuestsSnap.empty) toFire.push(doc);
        }
      }
      // budgetItemUnpaid: skipped until budget module is built
    }
  }

  if (toFire.length === 0) return;

  const batch = database.batch();
  const nowTimestamp = Timestamp.now();

  for (const doc of toFire) {
    const data = doc.data();

    if (data.channels?.email && preferences.emailNotificationsEnabled && emailAddress) {
      try {
        await sendEmail({
          to: emailAddress,
          subject: `Wedding Hub: ${data.title}`,
          html: buildReminderEmailHtml(data.title, data.message),
        });
      } catch (emailError) {
        console.error(`[reminders-cron] Email failed for ${doc.id}:`, emailError);
      }
    }

    batch.update(doc.ref, { status: "sent", sentAt: nowTimestamp, updatedAt: nowTimestamp });
  }

  await batch.commit();
  console.log(`[reminders-cron] Fired ${toFire.length} reminder(s) for wedding ${weddingId}`);
}

async function checkAndSendReminders(): Promise<void> {
  console.log("[reminders-cron] Running daily check...");
  try {
    const database = firestore();
    const weddingsSnap = await database.collection("wh_weddings").get();

    for (const weddingDoc of weddingsSnap.docs) {
      const data = weddingDoc.data();
      try {
        await processWedding(weddingDoc.id, data.weddingDate, data.coupleEmail ?? "");
      } catch (weddingError) {
        console.error(`[reminders-cron] Failed to process wedding ${weddingDoc.id}:`, weddingError);
      }
    }
  } catch (error) {
    console.error("[reminders-cron] Fatal error:", error);
  }
}

export function startRemindersCron(): void {
  cron.schedule("0 9 * * *", checkAndSendReminders);
  console.log("[reminders-cron] Scheduled daily at 09:00");
}
