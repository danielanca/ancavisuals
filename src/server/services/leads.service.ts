import { firestore } from "../firestore";

// Every contact request is saved here FIRST, before any bot/cooldown/country
// filter or SMTP call — from 2026-05-31 to 2026-10-02 configurator leads were
// dropped as "bots" and nothing kept their phone numbers.
export const LEADS = "leads";
export type LeadEmailStatus = "pending" | "sent" | "failed" | "skipped";

export interface LeadInput {
  source: string;          // "configurator" | "contact-form" | "campaign:<slug>"
  name?: string;
  phone?: string;
  eventType?: string;
  eventDate?: string;
  location?: string;
  message?: string;
  partial?: boolean;       // configurator step 3, before the final booking
  subject?: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  gclid?: string;
}

const clean = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 2000) : value ?? "");

/** Never throws: a storage outage must not block the email path. */
export async function saveLead(input: LeadInput): Promise<string | null> {
  try {
    const data = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, k === "details" ? v ?? null : clean(v)]));
    const ref = await firestore().collection(LEADS).add({
      ...data,
      emailStatus: "pending" as LeadEmailStatus,
      createdAt: new Date().toISOString(),
    });
    return ref.id;
  } catch (error) {
    console.error("[leads] could not save lead", input.source, input.phone, error);
    return null;
  }
}

export async function updateLeadEmailStatus(id: string | null, emailStatus: LeadEmailStatus, reason?: string): Promise<void> {
  if (!id) return;
  try {
    await firestore().collection(LEADS).doc(id).set({ emailStatus, emailReason: reason ?? null, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    console.error("[leads] could not update email status", id, error);
  }
}

export async function getLeads(limit = 200) {
  const snapshot = await firestore().collection(LEADS).orderBy("createdAt", "desc").limit(limit).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/** Removes the lead only; its entries in `emailLog` stay as the audit trail. */
export async function deleteLead(id: string): Promise<boolean> {
  const ref = firestore().collection(LEADS).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return false;
  await ref.delete();
  return true;
}
