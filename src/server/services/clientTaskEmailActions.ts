import { createHash, randomBytes } from "node:crypto";
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { firestore } from "../firestore";

export const TASK_EMAIL_ACTIONS = {
  done: "Este rezolvat",
  tomorrow: "Programează continuarea pe mâine",
  snooze: "Mai am nevoie de timp (+2 ore)",
} as const;
export type TaskEmailAction = keyof typeof TASK_EMAIL_ACTIONS;

export function taskScheduleKey(data: Record<string, unknown>): string {
  return `${data.plannedFor}/${data.scheduledStart}/${data.durationMin ?? 60}`;
}

export function hashTaskActionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createTaskEmailActionToken(scheduleKey: string, now: Date) {
  const token = randomBytes(32).toString("hex");
  return { token, fields: {
    timelineActionTokenHash: hashTaskActionToken(token),
    timelineActionScheduleKey: scheduleKey,
    timelineActionExpiresAt: now.getTime() + 7 * 24 * 60 * 60_000,
  } };
}

export function validTaskEmailAction(data: Record<string, unknown> | undefined, token: string, now: Date): boolean {
  return !!data && /^[a-f0-9]{64}$/.test(token) &&
    (data.status === "todo" || data.status === "doing") &&
    data.timelineActionTokenHash === hashTaskActionToken(token) &&
    data.timelineActionScheduleKey === taskScheduleKey(data) &&
    Number(data.timelineActionExpiresAt) > now.getTime();
}

export function validContinuationTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function applyTaskEmailAction(taskId: string, token: string, action: TaskEmailAction, now = new Date(), continuationTime?: string) {
  if (action === "tomorrow" && !validContinuationTime(continuationTime)) return false;
  const db = firestore();
  const ref = db.collection("clientTasks").doc(taskId);
  return db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    const data = snapshot.data();
    if (!validTaskEmailAction(data, token, now)) return false;
    const timestamp = Timestamp.fromDate(now);
    const update: DocumentData = {
      updatedAt: timestamp, timelineActionTokenHash: null, timelineActionExpiresAt: null,
    };
    if (action === "done") {
      update.status = "done";
      update.completedAt = timestamp;
    } else if (action === "tomorrow") {
      const today = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(now);
      const tomorrow = new Date(`${today}T12:00:00Z`);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      update.plannedFor = tomorrow.toISOString().slice(0, 10);
      update.scheduledStart = continuationTime;
      update.dayOrder = null;
      update.timelineReminderSentKey = null;
      update.timelineReminderSnoozedUntil = null;
    } else {
      update.timelineReminderSnoozedUntil = now.getTime() + 2 * 60 * 60_000;
      update.timelineReminderSentKey = null;
    }
    tx.update(ref, update);
    return true;
  });
}
