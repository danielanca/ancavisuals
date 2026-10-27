import { randomUUID } from "node:crypto";
import { firestore } from "../firestore";

// Every SMS the site tried to send (sent or failed), with the exact text that left, for
// /admin/sms-log. Written by sendSms itself, so a new SMS feature shows up without extra work.
export const SMS_LOG = "smsLog";
export const SMS_LOG_MAX_LIST = 3000;

/** What the caller knows about the message: which feature sent it, for which event, to whom. */
export interface SmsLogContext {
  source: string;
  /** Album slug or a short event label (ex. "25iulie2026", "nunta 2026-08-08"). */
  event?: string | null;
  recipientName?: string | null;
}

export interface SmsLogEntry extends Partial<SmsLogContext> {
  to: string;
  text: string;
  status: "sent" | "failed";
  provider: "smsapi" | "twilio";
  error?: string;
}

/** Never throws: logging must not break or delay the SMS it describes. */
export async function logSms(entry: SmsLogEntry): Promise<void> {
  try {
    await firestore().collection(SMS_LOG).doc(randomUUID()).set({
      to: entry.to,
      text: entry.text,
      status: entry.status,
      provider: entry.provider,
      source: entry.source ?? "necunoscut",
      event: entry.event ?? null,
      recipientName: entry.recipientName ?? null,
      error: entry.error ? entry.error.slice(0, 500) : null,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[sms-log] could not persist SMS to", entry.to, error);
  }
}

export async function getSmsLog(limit = SMS_LOG_MAX_LIST) {
  const snapshot = await firestore().collection(SMS_LOG).orderBy("createdAt", "desc").limit(limit).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
