/*
 * Purpose: reminders for the people choosing photos on a personal selection link (owner,
 * 2026-10-27): whoever hasn't gone through all the photos gets an email + SMS a few hours after
 * they stopped, to continue from where they left off. Automatic up to MAX_AUTO_REMINDERS times,
 * at most one a day; the admin can also send one by hand from the album.
 */
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { sendSms, isSmsConfigured } from "../notifications/sms";
import { sendViaFunnel } from "../notifications/emailFunnel";
import { eventDateFromSlug } from "../../shared/albumUpdates";
import { listPhotoReviewers } from "./photoReviewers.service";
import { linkVisitorReviewer, type PhotoReviewer } from "../../shared/media/proposalConsensus";

const LINKS_COLLECTION = "proposalLinks";
const SITE = "https://ancavisuals.ro";
export const REMIND_AFTER_HOURS = 4;
export const MIN_HOURS_BETWEEN_REMINDERS = 20;
export const MAX_AUTO_REMINDERS = 3;
/** Links made before reminders existed don't get automatic ones (no surprise SMS for old albums); the manual button still works. */
export const AUTO_REMINDERS_SINCE = Date.parse("2026-10-27T00:00:00+02:00");
const HOUR = 3_600_000;

type Visitor = { name?: string; viewedCount?: number; lastSeenAt?: Timestamp; completedAt?: Timestamp | null };
export type RemindableLink = {
  token: string;
  albumSlug: string;
  label?: string;
  reviewerId?: string;
  active?: boolean;
  createdAt?: Timestamp;
  totalPhotos?: number;
  visitors?: Record<string, Visitor>;
  completedAt?: Timestamp | null;
  autoReminderCount?: number;
  lastReminderAt?: Timestamp | null;
};

const ms = (value?: Timestamp | null) => value?.toDate?.().getTime() ?? 0;

/**
 * Furthest photo reached on the link by its own person and whether they said they're done.
 * Someone else who opened the link with their own name (Estera on Salomeea's link) doesn't count.
 */
export function linkProgress(link: RemindableLink, reviewers: readonly PhotoReviewer[] = []): { viewed: number; total: number; finished: boolean; lastActivity: number } {
  const visitors = Object.values(link.visitors ?? {})
    .filter(visitor => !link.reviewerId || linkVisitorReviewer(link.reviewerId, visitor.name, reviewers) === link.reviewerId);
  const total = link.totalPhotos ?? 0;
  const viewed = Math.max(0, ...visitors.map(visitor => visitor.viewedCount ?? 0));
  const finished = visitors.some(visitor => visitor.completedAt) || (total > 0 && viewed >= total);
  const lastActivity = Math.max(ms(link.createdAt), ...visitors.map(visitor => ms(visitor.lastSeenAt)));
  return { viewed: Math.min(viewed, total || viewed), total, finished, lastActivity };
}

/** Automatic reminder due: personal link, not finished, quiet for a few hours, not reminded today, under the cap. */
export function autoReminderDue(link: RemindableLink, now: number, reviewers: readonly PhotoReviewer[] = []): boolean {
  if (!link.active || !link.reviewerId || ms(link.createdAt) < AUTO_REMINDERS_SINCE) return false;
  const progress = linkProgress(link, reviewers);
  if (progress.finished || progress.total === 0) return false;
  if (now - progress.lastActivity < REMIND_AFTER_HOURS * HOUR) return false;
  if ((link.autoReminderCount ?? 0) >= MAX_AUTO_REMINDERS) return false;
  return now - ms(link.lastReminderAt) >= MIN_HOURS_BETWEEN_REMINDERS * HOUR;
}

export function reminderMessage(link: RemindableLink, reviewer: PhotoReviewer, reviewers: readonly PhotoReviewer[] = [reviewer]): { text: string; subject: string; html: string } {
  const name = reviewer.name;
  const { viewed, total } = linkProgress(link, reviewers);
  const url = `${SITE}/propune/${link.token}`;
  const date = eventDateFromSlug(link.albumSlug);
  const album = date ? `albumul din ${date}` : "album";
  const where = viewed > 0
    ? `Ai ajuns la poza ${viewed} din ${total} din ${album}.`
    : `Te așteaptă ${total} de poze de ales din ${album}.`;
  const text = `Salut, ${name}! ${where} Continuă de unde ai rămas: ${url}`;
  const subject = viewed > 0 ? `Continuă alegerea pozelor (${viewed}/${total})` : "Te așteaptă pozele de ales";
  const html = `
    <p>Salut, <strong>${escapeHtml(name)}</strong>!</p>
    <p>${escapeHtml(where)} Pozele alese până acum sunt salvate; linkul te duce exact de unde ai rămas.</p>
    <p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none;font-weight:bold">Continuă alegerea pozelor</a></p>
    <p style="color:#777;font-size:13px">Mulțumim mult! Daniel și Estera, Anca Visuals</p>`;
  return { text, subject, html };
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type ReminderResult = { channels: ("email" | "sms")[]; errors: string[] };

/** Sends on every channel the profile has; saves when (and how) the person was reminded. */
export async function sendProposalLinkReminder(link: RemindableLink, reviewer: PhotoReviewer, automatic: boolean, reviewers: readonly PhotoReviewer[] = [reviewer]): Promise<ReminderResult> {
  const message = reminderMessage(link, reviewer, reviewers);
  const result: ReminderResult = { channels: [], errors: [] };
  if (reviewer.email) {
    try {
      await sendViaFunnel({ kind: "notification", to: reviewer.email, subject: message.subject, html: message.html, source: "proposal-link:reminder" });
      result.channels.push("email");
    } catch (error) {
      result.errors.push(`email: ${String(error)}`);
    }
  }
  if (reviewer.phone && isSmsConfigured()) {
    try {
      await sendSms({ to: reviewer.phone, body: message.text, log: { source: "proposal-link-reminder", event: link.albumSlug, recipientName: reviewer.name } });
      result.channels.push("sms");
    } catch (error) {
      result.errors.push(`sms: ${String(error)}`);
    }
  }
  if (result.channels.length > 0) {
    const now = Timestamp.now();
    await firestore().collection(LINKS_COLLECTION).doc(link.token).set({
      lastReminderAt: now,
      lastReminderChannels: result.channels,
      reminderCount: FieldValue.increment(1),
      ...(automatic ? { autoReminderCount: FieldValue.increment(1) } : {}),
    }, { merge: true });
  }
  return result;
}

/** Cron entry: reminds everyone due right now. Returns how many people were reminded. */
export async function processProposalLinkReminders(now = Date.now()): Promise<number> {
  const snapshot = await firestore().collection(LINKS_COLLECTION).where("active", "==", true).get();
  const links = snapshot.docs.map(doc => doc.data() as RemindableLink).filter(link => link.reviewerId);
  if (links.length === 0) return 0;
  const reviewers = await listPhotoReviewers();
  const due = links.filter(link => autoReminderDue(link, now, reviewers));
  let sent = 0;
  for (const link of due) {
    const reviewer = reviewers.find(item => item.id === link.reviewerId);
    if (!reviewer || (!reviewer.email && !reviewer.phone)) continue;
    const result = await sendProposalLinkReminder(link, reviewer, true, reviewers);
    if (result.errors.length) console.error("[proposal-link reminder]", link.token, result.errors.join("; "));
    if (result.channels.length) sent++;
  }
  return sent;
}
