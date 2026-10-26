/*
 * Purpose: the "semnați procesul verbal ca să primiți materialele" reminder for a PV sent but not
 * signed yet, by email and/or SMS depending on what we have from the client. Used by the admin
 * button (any number of times) and by the daily cron. The email comes from the PV (fallback: the
 * linked event); the phone only lives on the event.
 */
import { Timestamp, type DocumentData, type DocumentReference } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { sendHandoverReminderEmail } from "../notifications/templates/handoverEmail";
import { isSmsConfigured, normalizeRomanianPhoneNumber, sendSms } from "../notifications/sms";
import { APP_BASE_URL } from "../constants/domain";
import { AUTOMATED_MESSAGE_LABEL } from "../../shared/albumUpdates";
import { handoverSmsLink, nextAutoSignReminderAt, signReminderSmsText } from "../../shared/handoverSignReminder";

export interface SignReminderResult {
  emailed: boolean;
  smsSent: boolean;
  smsError: string | null;
  signReminderSentAt: string;
  signReminderCount: number;
}

export class SignReminderError extends Error {}

function tsToISO(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return null;
}

/** The client of the event linked to this PV (the phone only lives there). */
export async function linkedEventClient(handoverId: string, handover: DocumentData): Promise<{ email?: string; phone?: string } | null> {
  const db = firestore();
  try {
    if (handover.eventId) {
      const event = await db.collection("adminEvents").doc(String(handover.eventId)).get();
      return event.exists ? (event.data()?.client ?? null) : null;
    }
    // Same fallback as the admin list: only an unambiguous reverse association counts.
    const matches = await db.collection("adminEvents").where("handoverId", "==", handoverId).limit(2).get();
    return matches.docs.length === 1 ? (matches.docs[0].data().client ?? null) : null;
  } catch (error) {
    console.error("[handover] linked event lookup failed:", error);
    return null;
  }
}

export async function sendHandoverSignReminder(
  ref: DocumentReference,
  handover: DocumentData,
  options: { email?: boolean; sms?: boolean; automatic?: boolean } = {},
): Promise<SignReminderResult> {
  if (handover.status !== "sent") {
    throw new SignReminderError("Reminder-ul se poate trimite doar pentru procese verbale trimise și încă nesemnate.");
  }
  const client = await linkedEventClient(ref.id, handover);
  const email = [handover.clientEmail, client?.email].map((v) => String(v ?? "").trim()).find((v) => v.includes("@")) ?? null;
  const phone = normalizeRomanianPhoneNumber(String(client?.phone ?? ""));
  const wantEmail = options.email !== false && Boolean(email);
  const wantSms = options.sms !== false && Boolean(phone) && isSmsConfigured();
  if (!wantEmail && !wantSms) {
    throw new SignReminderError(phone && !isSmsConfigured()
      ? "Clientul nu are email, iar SMS-ul nu este configurat pe server."
      : "Clientul nu are nici email, nici telefon.");
  }

  const link = handoverSmsLink(APP_BASE_URL, handover.token);
  if (wantEmail) {
    await sendHandoverReminderEmail({ to: email!, token: handover.token, eventType: handover.eventType, eventDate: handover.eventDate, baseUrl: APP_BASE_URL });
  }

  let smsSent = false;
  let smsError: string | null = null;
  if (wantSms) {
    try {
      await sendSms({ to: phone!, body: signReminderSmsText({ eventDate: handover.eventDate, link, automatedLabel: AUTOMATED_MESSAGE_LABEL }) });
      smsSent = true;
    } catch (error) {
      console.error("[handover] sign reminder SMS failed:", error);
      smsError = error instanceof Error ? error.message : "SMS eșuat";
      if (!wantEmail) throw new SignReminderError(`SMS-ul nu a putut fi trimis: ${smsError}`);
    }
  }

  const sentAt = Timestamp.now();
  const count = (typeof handover.signReminderCount === "number" ? handover.signReminderCount : 0) + 1;
  const update: Record<string, unknown> = {
    signReminderSentAt: sentAt,
    signReminderCount: count,
    signReminderChannels: [wantEmail ? "email" : null, smsSent ? "sms" : null].filter(Boolean),
  };
  if (options.automatic) update.autoSignReminderCount = (typeof handover.autoSignReminderCount === "number" ? handover.autoSignReminderCount : 0) + 1;
  await ref.update(update);

  return { emailed: wantEmail, smsSent, smsError, signReminderSentAt: sentAt.toDate().toISOString(), signReminderCount: count };
}

/** Daily run: reminds every unsigned PV whose next automatic reminder is due. Returns how many went out. */
export async function processAutoSignReminders(now: Date = new Date()): Promise<number> {
  const snapshot = await firestore().collection("materialsHandover").where("status", "==", "sent").get();
  let sent = 0;
  for (const doc of snapshot.docs) {
    const handover = doc.data();
    const dueAt = nextAutoSignReminderAt({
      sentAt: tsToISO(handover.sentAt),
      lastReminderAt: tsToISO(handover.signReminderSentAt),
      autoCount: handover.autoSignReminderCount,
      enabled: handover.autoSignReminder,
    });
    if (!dueAt || dueAt.getTime() > now.getTime()) continue;
    try {
      await sendHandoverSignReminder(doc.ref, handover, { automatic: true });
      sent++;
    } catch (error) {
      // No contact at all: stop the automatic reminders for this PV instead of retrying daily.
      if (error instanceof SignReminderError) await doc.ref.update({ autoSignReminder: false });
      console.error(`[handover] auto sign reminder failed for ${doc.id}:`, error);
    }
  }
  return sent;
}
