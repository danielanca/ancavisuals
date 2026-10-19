import crypto from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "../firestore.js";
import type { ShareCreator } from "../../shared/media/shareLinks";

export type ShareRecord = {
  id: string;
  slug: string;
  items: string[];
  showAll?: boolean;
  expiresAt: number;
  label: string;
  message: string;
  createdBy: ShareCreator;
  createdAt: number | null;
  lastViewedAt: number | null;
  views: number;
  downloads: number;
  forwards: number;
  revoked: boolean;
};

export type ShareExtras = {
  label?: string;
  message?: string;
  createdBy?: ShareCreator;
};

export type ShareCounter = "views" | "downloads" | "forwards";

type ShareRecordDocument = {
  slug?: string;
  items?: string[];
  showAll?: boolean;
  expiresAt?: number;
  expiresAtTs?: Timestamp;
  label?: string;
  message?: string;
  createdBy?: string;
  createdAt?: Timestamp;
  lastViewedAt?: Timestamp;
  views?: number;
  downloads?: number;
  forwards?: number;
  revoked?: boolean;
};

const COLLECTION = "shares";
const MAX_LISTED_SHARES = 500;

const makeId = () => crypto.randomBytes(10).toString("hex");

const toMillis = (value: unknown): number | null =>
  typeof (value as Timestamp | undefined)?.toMillis === "function" ? (value as Timestamp).toMillis() : null;

const toCount = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0);

function parseShareDocument(id: string, data: ShareRecordDocument): ShareRecord {
  const slug = String(data.slug ?? "");
  const items = Array.isArray(data.items) ? data.items.map(String) : [];
  const expiresAt =
    typeof data.expiresAt === "number" ? data.expiresAt : toMillis(data.expiresAtTs) ?? 0;

  if (!slug || !expiresAt) throw new Error("invalid_record");

  return {
    id,
    slug,
    items,
    showAll: data.showAll === true,
    expiresAt,
    label: typeof data.label === "string" ? data.label : "",
    message: typeof data.message === "string" ? data.message : "",
    // Shares made before the manager existed came from the album page with no key.
    createdBy: data.createdBy === "couple" ? "couple" : "guest",
    createdAt: toMillis(data.createdAt),
    lastViewedAt: toMillis(data.lastViewedAt),
    views: toCount(data.views),
    downloads: toCount(data.downloads),
    forwards: toCount(data.forwards),
    revoked: data.revoked === true,
  };
}

export async function createShareRecord(
  slug: string,
  items: string[],
  days: number,
  showAll?: boolean,
  extras: ShareExtras = {},
): Promise<ShareRecord> {
  const id = makeId();
  const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
  const label = extras.label ?? "";
  const message = extras.message ?? "";
  const createdBy: ShareCreator = extras.createdBy ?? "guest";

  await db
    .collection(COLLECTION)
    .doc(id)
    .set({
      slug,
      items,
      expiresAt,
      expiresAtTs: Timestamp.fromMillis(expiresAt),
      createdAt: FieldValue.serverTimestamp(),
      createdBy,
      ...(label ? { label } : {}),
      ...(message ? { message } : {}),
      ...(showAll ? { showAll: true } : {}),
    });

  return {
    id, slug, items, showAll, expiresAt, label, message, createdBy,
    createdAt: Date.now(), lastViewedAt: null, views: 0, downloads: 0, forwards: 0, revoked: false,
  };
}

export async function readShareRecord(id: string): Promise<ShareRecord> {
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) throw new Error("not_found");
  return parseShareDocument(id, (snap.data() as ShareRecordDocument | undefined) ?? {});
}

/** Every share of one album, newest first. Sorted here so no composite index is needed. */
export async function listShareRecordsBySlug(slug: string): Promise<ShareRecord[]> {
  const snap = await db.collection(COLLECTION).where("slug", "==", slug).limit(MAX_LISTED_SHARES).get();
  const records: ShareRecord[] = [];
  for (const doc of snap.docs) {
    try {
      records.push(parseShareDocument(doc.id, (doc.data() as ShareRecordDocument | undefined) ?? {}));
    } catch { /* skip malformed docs */ }
  }
  return records.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export async function updateShareRecord(
  id: string,
  patch: { label?: string; message?: string; revoked?: boolean },
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (patch.label !== undefined) updates.label = patch.label;
  if (patch.message !== undefined) updates.message = patch.message;
  if (patch.revoked !== undefined) updates.revoked = patch.revoked;
  if (Object.keys(updates).length === 0) return;
  await db.collection(COLLECTION).doc(id).update(updates);
}

/** Best-effort stats — a failed counter must never break viewing or downloading. */
export async function bumpShareCounter(id: string, counter: ShareCounter): Promise<void> {
  try {
    await db
      .collection(COLLECTION)
      .doc(id)
      .update({
        [counter]: FieldValue.increment(1),
        ...(counter === "views" ? { lastViewedAt: FieldValue.serverTimestamp() } : {}),
      });
  } catch (error) {
    console.warn(`[share] could not bump ${counter} for ${id}:`, error);
  }
}
