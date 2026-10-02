import { randomUUID } from "node:crypto";
import { firestore } from "../firestore";

// Full copy of every email the app meant to send — sent, failed, or skipped by a
// filter (bot / cooldown / country / disabled). Unlike `emailDeliveries`, which
// keeps status only, this stores the body too, so a lead whose email never left
// is still readable in /admin/leads.
export const EMAIL_LOG = "emailLog";
export type EmailLogStatus = "pending" | "sent" | "failed" | "skipped";
/** "error" = needs attention (failed, or a lead/contact email blocked by a filter). */
export type EmailLogSeverity = "ok" | "info" | "error";

const MAX_HTML = 200_000; // Firestore docs cap at 1 MiB

export interface EmailLogEntry {
  to: string;
  subject: string;
  html?: string;
  status: EmailLogStatus;
  severity?: EmailLogSeverity;
  source?: string;
  reason?: string;
  error?: string;
  leadId?: string;
  deliveryId?: string;
}

/** Never throws: logging must not break or delay the email it describes. */
export async function logEmail(entry: EmailLogEntry): Promise<string | null> {
  const id = randomUUID();
  try {
    await firestore().collection(EMAIL_LOG).doc(id).set({
      ...entry,
      html: (entry.html ?? "").slice(0, MAX_HTML),
      createdAt: new Date().toISOString(),
    }, { merge: true });
    return id;
  } catch (error) {
    console.error("[email-log] could not persist email", entry.subject, error);
    return null;
  }
}

export async function updateEmailLog(id: string | null, patch: Partial<EmailLogEntry>): Promise<void> {
  if (!id) return;
  try {
    await firestore().collection(EMAIL_LOG).doc(id).set({ ...patch, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    console.error("[email-log] could not update", id, error);
  }
}

export async function getEmailLog(limit = 100) {
  const snapshot = await firestore().collection(EMAIL_LOG).orderBy("createdAt", "desc").limit(limit).get();
  // The list omits bodies; the detail endpoint returns them.
  return snapshot.docs.map((doc) => {
    const { html: _html, ...rest } = doc.data();
    return { id: doc.id, ...rest };
  });
}

export async function getEmailLogEntry(id: string) {
  const doc = await firestore().collection(EMAIL_LOG).doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}
