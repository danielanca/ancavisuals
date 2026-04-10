import crypto from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "../firestoreInit.js";

export type ShareRecord = {
  id: string;
  slug: string;
  items: string[];
  expiresAt: number;
};

type ShareRecordDocument = {
  slug?: string;
  items?: string[];
  expiresAt?: number;
  expiresAtTs?: Timestamp;
};

const makeId = () => crypto.randomBytes(10).toString("hex");

export async function createShareRecord(slug: string, items: string[], days: number): Promise<ShareRecord> {
  const id = makeId();
  const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;

  await db
    .collection("shares")
    .doc(id)
    .set({
      slug,
      items,
      expiresAt,
      expiresAtTs: Timestamp.fromMillis(expiresAt),
      createdAt: FieldValue.serverTimestamp(),
    });

  return { id, slug, items, expiresAt };
}

export async function readShareRecord(id: string): Promise<ShareRecord> {
  const snap = await db.collection("shares").doc(id).get();
  if (!snap.exists) throw new Error("not_found");

  const data = (snap.data() as ShareRecordDocument | undefined) ?? {};

  const slug = String(data?.slug ?? "");
  const items = Array.isArray(data?.items) ? data.items.map(String) : [];

  const expiresAt =
    typeof data?.expiresAt === "number"
      ? data.expiresAt
      : typeof data?.expiresAtTs?.toMillis === "function"
        ? data.expiresAtTs.toMillis()
        : 0;

  if (!slug || !expiresAt) throw new Error("invalid_record");

  return { id, slug, items, expiresAt };
}
