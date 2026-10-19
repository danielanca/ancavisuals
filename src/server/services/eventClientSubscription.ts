/*
 * Purpose: the client of an event becomes a WhatsApp subscriber of its album automatically,
 * using the phone already on the event, so album updates reach them without a form.
 * Runs once per event (`clientAutoSubscribedAt`): if the client later unsubscribes, we never
 * add them back. Albums shared by two events are skipped — we can't tell whose album it is.
 */
import crypto from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { normalizeRomanianPhoneNumber } from "../notifications/sms";

const EVENTS = "adminEvents";
const SUBSCRIPTIONS = "albumSubscriptions";

export type EventClientSubscribeResult =
  | { status: "subscribed" | "merged"; albumSlug: string; phone: string }
  | { status: "already-done" | "no-album" | "no-phone" | "shared-album" | "missing-event" };

export async function subscribeEventClient(eventId: string): Promise<EventClientSubscribeResult> {
  const db = firestore();
  const eventRef = db.collection(EVENTS).doc(eventId);
  const event = await eventRef.get();
  if (!event.exists) return { status: "missing-event" };
  const data = event.data() ?? {};
  if (data.clientAutoSubscribedAt) return { status: "already-done" };

  const albumSlug = typeof data.albumSlug === "string" ? data.albumSlug : "";
  if (!albumSlug) return { status: "no-album" };
  const phone = normalizeRomanianPhoneNumber(String(data.client?.phone ?? ""));
  if (!phone) return { status: "no-phone" };

  const sameAlbum = await db.collection(EVENTS).where("albumSlug", "==", albumSlug).get();
  if (sameAlbum.docs.some((doc) => doc.id !== eventId)) return { status: "shared-album" };

  const name = String(data.client?.fullName ?? "").trim().slice(0, 80) || null;
  const existing = await db.collection(SUBSCRIPTIONS).where("albumSlug", "==", albumSlug).where("phone", "==", phone).get();
  let status: "subscribed" | "merged";
  if (!existing.empty) {
    const doc = existing.docs[0];
    const channels = Array.isArray(doc.data().channels) ? (doc.data().channels as string[]) : [];
    await doc.ref.update({ channels: Array.from(new Set([...channels, "whatsapp"])), eventId });
    status = "merged";
  } else {
    await db.collection(SUBSCRIPTIONS).add({
      albumSlug,
      email: null,
      phone,
      name,
      channels: ["whatsapp"],
      source: "event-client",
      eventId,
      unsubscribeToken: crypto.randomBytes(12).toString("hex"),
      subscribedAt: Timestamp.now(),
    });
    status = "subscribed";
  }
  await eventRef.update({ clientAutoSubscribedAt: Timestamp.now() });
  return { status, albumSlug, phone };
}
