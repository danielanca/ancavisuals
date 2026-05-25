import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";

export type CollaboratorInviteActionType = "instagram" | "moderation";
export type CollaboratorInviteStatus = "active" | "completed" | "cancelled";

export type CollaboratorInvite = {
  id: string;
  email: string;
  albumSlug: string;
  albumUrl: string;
  inviteInstagram: boolean;
  inviteModeration: boolean;
  status: CollaboratorInviteStatus;
  createdByEmail: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastSentAt: Timestamp;
  nextReminderAt: Timestamp;
  reminderCount: number;
  reminderStage: number;
  completedAt?: Timestamp | null;
  completedActionType?: CollaboratorInviteActionType | null;
  completedByEmail?: string | null;
  lastActionAt?: Timestamp | null;
  remindersFinishedAt?: Timestamp | null;
};

const COLLECTION = "collaboratorInvites";
const REMINDER_SCHEDULE_MS = [
  24 * 60 * 60 * 1000,
  72 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
  14 * 24 * 60 * 60 * 1000,
  30 * 24 * 60 * 60 * 1000,
] as const;

export function buildCollaboratorInviteId(email: string, albumSlug: string): string {
  return `${encodeURIComponent(email.trim().toLowerCase())}__${albumSlug.trim().toLowerCase()}`;
}

export function buildCollaboratorAlbumUrl(albumSlug: string): string {
  return `/media/${encodeURIComponent(albumSlug)}`;
}

export function getReminderScheduleMs(): readonly number[] {
  return REMINDER_SCHEDULE_MS;
}

export async function upsertCollaboratorInvite(input: {
  email: string;
  albumSlug: string;
  inviteInstagram: boolean;
  inviteModeration: boolean;
  createdByEmail: string;
}): Promise<CollaboratorInvite> {
  const email = input.email.trim().toLowerCase();
  const albumSlug = input.albumSlug.trim();
  const id = buildCollaboratorInviteId(email, albumSlug);
  const now = Timestamp.now();
  const nextReminderAt = Timestamp.fromMillis(Date.now() + REMINDER_SCHEDULE_MS[0]);
  const ref = firestore().collection(COLLECTION).doc(id);
  const snapshot = await ref.get();

  const payload: CollaboratorInvite = {
    id,
    email,
    albumSlug,
    albumUrl: buildCollaboratorAlbumUrl(albumSlug),
    inviteInstagram: input.inviteInstagram,
    inviteModeration: input.inviteModeration,
    status: "active",
    createdByEmail: input.createdByEmail,
    createdAt: snapshot.exists ? (snapshot.data()?.createdAt as Timestamp ?? now) : now,
    updatedAt: now,
    lastSentAt: now,
    nextReminderAt,
    reminderCount: snapshot.exists ? Number(snapshot.data()?.reminderCount ?? 0) : 0,
    reminderStage: 0,
    completedAt: null,
    completedActionType: null,
    completedByEmail: null,
    lastActionAt: null,
    remindersFinishedAt: null,
  };

  await ref.set(payload, { merge: true });
  return payload;
}

export async function markCollaboratorInviteCompleted(input: {
  email: string;
  albumSlug: string;
  actionType: CollaboratorInviteActionType;
}): Promise<void> {
  const id = buildCollaboratorInviteId(input.email, input.albumSlug);
  const ref = firestore().collection(COLLECTION).doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return;
  const data = snapshot.data() as Partial<CollaboratorInvite>;
  if (data.status !== "active") return;

  const now = Timestamp.now();
  await ref.set({
    status: "completed",
    updatedAt: now,
    completedAt: now,
    completedActionType: input.actionType,
    completedByEmail: input.email.trim().toLowerCase(),
    lastActionAt: now,
    nextReminderAt: null,
    remindersFinishedAt: now,
  }, { merge: true });
}
