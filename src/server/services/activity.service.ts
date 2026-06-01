import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore.js";

export type ActivityType = "visitor" | "subscribe" | "lead" | "offer_viewed";

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
  };
}

const DEFAULT_SETTINGS: NotificationSettings = {
  email: {
    newVisitor: true,
    returningVisitor: false,
    subscribe: true,
    lead: true,
    offerViewed: true,
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

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const db = firestore();
  const [collection, docId] = SETTINGS_DOC.split("/");
  const snap = await db.collection(collection).doc(docId).get();
  if (!snap.exists) return DEFAULT_SETTINGS;
  const data = snap.data() as Partial<NotificationSettings>;
  return {
    email: { ...DEFAULT_SETTINGS.email, ...(data.email ?? {}) },
  };
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  const db = firestore();
  const [collection, docId] = SETTINGS_DOC.split("/");
  await db.collection(collection).doc(docId).set(settings, { merge: true });
}
