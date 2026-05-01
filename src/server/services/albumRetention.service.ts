import type { Timestamp } from "firebase-admin/firestore";
import { db } from "../firestore";
import { readRetentionNotifications, type AlbumRetentionNotificationState } from "./printSelection.store";

const DAY_MS = 24 * 60 * 60 * 1000;
export const ALBUM_RETENTION_DAYS = 60;

type TimestampLike = Timestamp | Date | { toDate?: () => Date; _seconds?: number } | string | number | null | undefined;

type AdminEventRetentionDoc = {
  id: string;
  slug: string;
  title: string;
  eventDate: string;
  expiresAt: string;
  remainingMs: number;
  isExpired: boolean;
  notifications: AlbumRetentionNotificationState;
};

const titleFromSlug = (slug: string) =>
  slug.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

export function toDate(value: TimestampLike): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00`)
      : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "object" && typeof value.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const seconds = typeof value === "object" && "_seconds" in value ? value._seconds : undefined;
  if (typeof seconds === "number") {
    const date = new Date(seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function computeAlbumRetention(eventDateInput: TimestampLike, now = new Date()) {
  const eventDate = toDate(eventDateInput);
  if (!eventDate) return null;

  const expiresAt = new Date(eventDate.getTime() + ALBUM_RETENTION_DAYS * DAY_MS);
  const remainingMs = expiresAt.getTime() - now.getTime();

  return {
    eventDate,
    expiresAt,
    remainingMs,
    isExpired: remainingMs <= 0,
  };
}

export async function getAlbumRetentionBySlug(slug: string, now = new Date()) {
  const snapshot = await db
    .collection("adminEvents")
    .where("albumSlug", "==", slug)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  const data = doc.data();
  const retention = computeAlbumRetention(data.eventDate, now);

  if (!retention) return null;

  return {
    eventId: doc.id,
    slug,
    title: titleFromSlug(slug),
    eventDate: retention.eventDate.toISOString(),
    expiresAt: retention.expiresAt.toISOString(),
    remainingMs: retention.remainingMs,
    isExpired: retention.isExpired,
  };
}

export async function listAlbumRetentionCandidates(now = new Date()): Promise<AdminEventRetentionDoc[]> {
  const snapshot = await db
    .collection("adminEvents")
    .orderBy("eventDate", "asc")
    .get();

  const docs = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const data = doc.data() as { albumSlug?: string; eventDate?: TimestampLike };
      const slug = typeof data.albumSlug === "string" ? data.albumSlug.trim() : "";
      if (!slug) return null;

      const retention = computeAlbumRetention(data.eventDate, now);
      if (!retention) return null;

      const notifications = await readRetentionNotifications(slug);

      return {
        id: doc.id,
        slug,
        title: titleFromSlug(slug),
        eventDate: retention.eventDate.toISOString(),
        expiresAt: retention.expiresAt.toISOString(),
        remainingMs: retention.remainingMs,
        isExpired: retention.isExpired,
        notifications,
      };
    }),
  );

  return docs.filter((doc): doc is AdminEventRetentionDoc => !!doc);
}
