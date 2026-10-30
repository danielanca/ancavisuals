import { brandEmail, emailButton } from "../notifications/templates/emailBrand";
import cron from "node-cron";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { sendEmail } from "../notifications/mailer";
import { APP_BASE_URL } from "../constants/domain";

export function buildReminderEmailHtml(title: string, message: string): string {
  return brandEmail(`
    <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#666;margin:0 0 8px;">Wedding Hub · Reminder</div>
    <h1 style="font-size:24px;font-weight:400;line-height:1.3;color:#111;margin:0 0 18px;">${title}</h1>
    <p style="font-size:15px;line-height:1.65;color:#111;margin:0;padding:16px 18px;border-left:2px solid #111;background:#f5f5f5;">${message}</p>
    ${emailButton(`${APP_BASE_URL}/wedding-hub/reminders`, "Deschide Wedding Hub")}
  `);
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
