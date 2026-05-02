import cron from "node-cron";
import { Timestamp } from "firebase-admin/firestore";
import { v4 as uuidv4 } from "uuid";
import { firestore } from "../firestore";
import { adminUser } from "../constants/credentials";
import { sendEmail } from "../notifications/mailer";

const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_INTERVAL_MS = 48 * 60 * 60 * 1000;
const BASE_URL = process.env.BASE_URL || "https://ancavisuals.ro";

function toIsoString(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "_seconds" in value) {
    const seconds = Number((value as { _seconds?: number })._seconds);
    if (Number.isFinite(seconds)) {
      return new Date(seconds * 1000).toISOString();
    }
  }
  return null;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Bucharest",
  });
}

function getReminderDueAt(eventDoc: FirebaseFirestore.DocumentData): Date | null {
  const eventDate = toIsoString(eventDoc.eventEndDate ?? eventDoc.eventDate);
  if (!eventDate) return null;
  const baseDate = new Date(eventDate);
  if (Number.isNaN(baseDate.getTime())) return null;
  return new Date(baseDate.getTime() + DAY_MS);
}

function getCurrentReminderDueAt(eventDoc: FirebaseFirestore.DocumentData): Date | null {
  const lastSentAt = toIsoString(eventDoc.postEventBackupReminderSentAt);
  if (lastSentAt) {
    const lastSentDate = new Date(lastSentAt);
    if (!Number.isNaN(lastSentDate.getTime())) {
      return new Date(lastSentDate.getTime() + REMINDER_INTERVAL_MS);
    }
  }

  return getReminderDueAt(eventDoc);
}

function buildReminderSubject(args: {
  eventName: string;
  reminderIndex: number;
  reminderDate: string;
}): string {
  return `🛟 Backup media · ${args.reminderDate} · #${args.reminderIndex} · ${args.eventName}`;
}

async function sendBackupReminderEmail(args: {
  eventName: string;
  eventDateLabel: string;
  reminderLabel: string;
  reminderIndex: number;
  albumSlug: string | null;
  confirmationUrl: string;
}) {
  const mediaLink = args.albumSlug ? `${BASE_URL}/media/${encodeURIComponent(args.albumSlug)}` : `${BASE_URL}/admin`;
  const subject = buildReminderSubject({
    eventName: args.eventName,
    reminderIndex: args.reminderIndex,
    reminderDate: args.reminderLabel,
  });

  await sendEmail({
    to: adminUser.email,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:28px;background:#0b0b0b;color:#f5f5f5;border-radius:18px;">
        <p style="margin:0 0 10px;color:#f59e0b;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;">Post event</p>
        <h1 style="margin:0 0 14px;font-size:24px;font-weight:500;color:#fff;">Fă backup la poze și video</h1>
        <p style="margin:0 0 14px;color:#e5e5e5;font-size:15px;line-height:1.7;">
          A trecut momentul de verificare pentru evenimentul <strong>${args.eventName}</strong>.
        </p>
        <p style="margin:0 0 22px;color:#cfcfcf;font-size:14px;line-height:1.7;">
          Data evenimentului: <strong style="color:#fff">${args.eventDateLabel}</strong>.
          Salvează materialele și verifică dacă totul este arhivat corect.
        </p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin:22px 0 0;">
          <a href="${mediaLink}" style="display:inline-block;padding:12px 22px;background:#fff;color:#000;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
            Deschide albumul
          </a>
          <a href="${args.confirmationUrl}" style="display:inline-block;padding:12px 22px;background:#f59e0b;color:#111;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
            Am făcut backup-ul
          </a>
        </div>
        <p style="margin:22px 0 0;color:#6b7280;font-size:12px;line-height:1.6;">
          Acest email se retrimite la fiecare 48 de ore până confirmi backup-ul.
        </p>
      </div>
    `,
  });
}

export async function processPostEventBackupReminders(now = new Date()): Promise<void> {
  const db = firestore();

  const snapshot = await db
    .collection("adminEvents")
    .where("status", "==", "finalizat")
    .get();

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      if (data.postEventBackupConfirmedAt) continue;

      const dueAt = getCurrentReminderDueAt(data);
      if (!dueAt || now < dueAt) continue;

      const eventName = data.client?.fullName?.trim() || data.typeLabel || "evenimentul tău";
      const eventDateLabel = toIsoString(data.eventEndDate ?? data.eventDate)
        ? formatDateTime(toIsoString(data.eventEndDate ?? data.eventDate) as string)
        : "Nespecificată";
      const reminderIndex = Number(data.postEventBackupReminderCount ?? 0) + 1;
      const reminderLabel = now.toLocaleString("ro-RO", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "Europe/Bucharest",
      });
      const confirmationToken = typeof data.postEventBackupConfirmationToken === "string" && data.postEventBackupConfirmationToken.trim()
        ? data.postEventBackupConfirmationToken.trim()
        : uuidv4();
      const confirmationUrl = `${BASE_URL}/api/admin/events/${doc.id}/post-event-backup/confirm?token=${encodeURIComponent(confirmationToken)}`;

      await sendBackupReminderEmail({
        eventName,
        eventDateLabel,
        reminderLabel,
        reminderIndex,
        albumSlug: typeof data.albumSlug === "string" && data.albumSlug.trim() ? data.albumSlug.trim() : null,
        confirmationUrl,
      });

      await doc.ref.update({
        postEventBackupReminderSentAt: Timestamp.now(),
        postEventBackupReminderDueAt: Timestamp.fromDate(dueAt),
        postEventBackupReminderCount: reminderIndex,
        postEventBackupConfirmationToken: confirmationToken,
      });

      console.log(`[post-event backup cron] Reminder trimis: ${doc.id}`);
    } catch (error) {
      console.error(`[post-event backup cron] Failed for ${doc.id}:`, error);
    }
  }
}

export function startPostEventBackupCron(): void {
  cron.schedule("*/15 * * * *", () => {
    processPostEventBackupReminders().catch((error) => {
      console.error("[post-event backup cron] Fatal run error:", error);
    });
  });

  console.log("[post-event backup cron] Started - every 15 minutes");
}
