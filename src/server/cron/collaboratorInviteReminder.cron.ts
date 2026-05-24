import cron from "node-cron";
import { Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { firestore } from "../firestore";
import { sendEmail } from "../notifications/mailer";
import { buildCollaboratorInviteHtml, buildCollaboratorInviteSubject } from "../notifications/templates/collaboratorInviteTemplate";
import { getReminderScheduleMs, type CollaboratorInvite } from "../services/collaboratorInvite.service";

const COLLECTION = "collaboratorInvites";
const SENDER_NAME = "Daniel";
const REMINDER_SCHEDULE_MS = getReminderScheduleMs();

async function sendCollaboratorInviteReminders(): Promise<void> {
  const now = Date.now();
  try {
    const snapshot = await firestore()
      .collection(COLLECTION)
      .where("status", "==", "active")
      .get();

    for (const doc of snapshot.docs) {
      const invite = { id: doc.id, ...doc.data() } as CollaboratorInvite;
      const nextReminderAt = invite.nextReminderAt instanceof Timestamp
        ? invite.nextReminderAt.toMillis()
        : 0;

      if (!nextReminderAt || nextReminderAt > now) continue;

      try {
        const user = await getAuth().getUserByEmail(invite.email);
        const passwordSetupUrl = await getAuth().generatePasswordResetLink(invite.email).catch(() => null);
        await sendEmail({
          to: invite.email,
          subject: buildCollaboratorInviteSubject({
            recipientName: user.displayName ?? "",
            albumSlug: invite.albumSlug,
            albumUrl: invite.albumUrl,
            inviteInstagram: invite.inviteInstagram,
            inviteModeration: invite.inviteModeration,
            senderName: SENDER_NAME,
            passwordSetupUrl,
            isReminder: true,
          }),
          html: buildCollaboratorInviteHtml({
            recipientName: user.displayName ?? "",
            albumSlug: invite.albumSlug,
            albumUrl: invite.albumUrl,
            inviteInstagram: invite.inviteInstagram,
            inviteModeration: invite.inviteModeration,
            senderName: SENDER_NAME,
            passwordSetupUrl,
            isReminder: true,
          }),
        });

        const nextStage = Number(invite.reminderStage ?? 0) + 1;
        const hasMoreReminders = nextStage < REMINDER_SCHEDULE_MS.length;
        const updatePayload: Record<string, unknown> = {
          updatedAt: Timestamp.now(),
          lastSentAt: Timestamp.now(),
          reminderCount: Number(invite.reminderCount ?? 0) + 1,
          reminderStage: nextStage,
        };

        if (hasMoreReminders) {
          updatePayload.nextReminderAt = Timestamp.fromMillis(now + REMINDER_SCHEDULE_MS[nextStage]);
        } else {
          updatePayload.nextReminderAt = null;
          updatePayload.remindersFinishedAt = Timestamp.now();
        }

        await doc.ref.set({
          ...updatePayload,
        }, { merge: true });
      } catch (error) {
        console.error(`[collaborator invite cron] Failed for ${invite.email} / ${invite.albumSlug}:`, error);
      }
    }
  } catch (error) {
    console.error("[collaborator invite cron] Fatal error:", error);
  }
}

export function startCollaboratorInviteReminderCron(): void {
  cron.schedule("0 */12 * * *", () => {
    void sendCollaboratorInviteReminders();
  });
  console.log("[collaborator invite cron] Started - every 12 hours, schedule 24h/72h/7d/14d/30d");
}
