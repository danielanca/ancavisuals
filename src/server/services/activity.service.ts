import type { Timestamp } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { firestore } from "../firestore.js";

export type ActivityType = "contact" | "visitor" | "subscribe" | "lead" | "offer_viewed" | "seo_visit"
  | "task_overdue" | "upload_incomplete" | "processing_failed" | "processing_complete" | "album_zip" | "email_failed";

export interface ActivityRecord {
  id?: string;
  type: ActivityType;
  title: string;
  description: string;
  metadata: Record<string, string>;
  read: boolean;
  emailSent: boolean;
  createdAt?: Timestamp;
}

export interface NotificationSettings {
  email: {
    newVisitor: boolean;
    returningVisitor: boolean;
    subscribe: boolean;
    lead: boolean;
    offerViewed: boolean;
    seoOrganic: boolean;
  };
}

const DEFAULT_SETTINGS: NotificationSettings = {
  email: {
    newVisitor: false,
    returningVisitor: false,
    subscribe: true,
    lead: true,
    offerViewed: true,
    seoOrganic: false,
  },
};

const COLLECTION = "site_activity";
const SETTINGS_DOC = "admin_settings/notifications";

export async function logActivity(record: Omit<ActivityRecord, "id" | "read" | "createdAt">): Promise<string> {
  const db = firestore();
  const ref = await db.collection(COLLECTION).add({
    ...record,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

/** Log a durable operational event once. The key should identify one incident, not a recurring check. */
export async function logActivityOnce(key: string, record: Omit<ActivityRecord, "id" | "read" | "createdAt">): Promise<string> {
  const db = firestore();
  const id = `system_${Buffer.from(key).toString("base64url").slice(0, 120)}`;
  const ref = db.collection(COLLECTION).doc(id);
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    if (!existing.exists) transaction.create(ref, { ...record, read: false, createdAt: FieldValue.serverTimestamp() });
  });
  return id;
}

export async function getActivities(limit = 60): Promise<ActivityRecord[]> {
  const db = firestore();
  const snap = await db.collection(COLLECTION)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ActivityRecord));
}

export async function markAllRead(): Promise<void> {
  const db = firestore();
  const snap = await db.collection(COLLECTION).where("read", "==", false).get();
  const batch = db.batch();
  snap.docs.forEach((doc) => batch.update(doc.ref, { read: true }));
  await batch.commit();
}

export async function markRead(id: string): Promise<void> {
  const db = firestore();
  await db.collection(COLLECTION).doc(id).update({ read: true });
}

export async function deleteActivity(id: string): Promise<void> {
  const db = firestore();
  await db.collection(COLLECTION).doc(id).delete();
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const db = firestore();
  const [collection, docId] = SETTINGS_DOC.split("/");
  const snap = await db.collection(collection).doc(docId).get();
  if (!snap.exists) return DEFAULT_SETTINGS;
  const data = snap.data() as Partial<NotificationSettings>;
  return {
    email: { ...DEFAULT_SETTINGS.email, ...(data.email ?? {}), newVisitor: false, returningVisitor: false },
  };
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  const db = firestore();
  const [collection, docId] = SETTINGS_DOC.split("/");
  await db.collection(collection).doc(docId).set(settings, { merge: true });
}

export async function markActivityEmailSent(id: string): Promise<void> {
  await firestore().collection(COLLECTION).doc(id).update({ emailSent: true });
}

export async function deleteVisitorActivities(): Promise<void> {
  const db = firestore();
  // Bounded batches; the admin repeats this request until the backlog is gone.
  const snapshot = await db.collection(COLLECTION).where("type", "==", "visitor").limit(400).get();
  if (snapshot.empty) return;
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}
