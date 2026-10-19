/*
 * Purpose: one secret key per album that unlocks the couple's share manager on
 * /media/:slug. The admin generates it from EventCard and sends the link only to
 * the couple; guests who have the plain album link never see the manager.
 */
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firestore.js";

const COLLECTION = "albumCoupleKeys";

type CoupleKeyDocument = { key?: string };

const makeKey = () => crypto.randomBytes(16).toString("hex");

const digest = (value: string) => new Uint8Array(crypto.createHash("sha256").update(value).digest());

export async function getCoupleKey(slug: string): Promise<string | null> {
  const snap = await db.collection(COLLECTION).doc(slug).get();
  if (!snap.exists) return null;
  const key = (snap.data() as CoupleKeyDocument | undefined)?.key;
  return typeof key === "string" && key ? key : null;
}

/** Returns the album's key, creating it on first use; `rotate` replaces it so old links stop working. */
export async function ensureCoupleKey(slug: string, rotate = false): Promise<string> {
  if (!rotate) {
    const existing = await getCoupleKey(slug);
    if (existing) return existing;
  }
  const key = makeKey();
  await db.collection(COLLECTION).doc(slug).set({ key, updatedAt: FieldValue.serverTimestamp() });
  return key;
}

export async function verifyCoupleKey(slug: string, candidate: unknown): Promise<boolean> {
  if (typeof candidate !== "string" || !candidate || candidate.length > 128) return false;
  const key = await getCoupleKey(slug);
  if (!key) return false;
  return crypto.timingSafeEqual(digest(key), digest(candidate));
}
