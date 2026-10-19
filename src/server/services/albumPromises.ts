/*
 * Purpose: "Promisiuni" — every album update that carries a date ("pozele vor fi gata în jurul
 * datei de…", "mai durează 10 zile, noua estimare…") is a promise made to a client. The newest
 * dated update of an album is its open promise (a later estimate replaces the earlier one) until
 * the admin marks it done. The admin dashboard lists them, and a daily email reminds the owner
 * 4 days before the date and once more if the date passes — so no client is forgotten.
 */
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { sendEmail } from "../notifications/mailer";
import { adminUser } from "../constants/credentials";
import { APP_BASE_URL } from "../constants/domain";
import { ALBUM_UPDATE_META, formatEstimateDate, parseAlbumUpdateKind } from "../../shared/albumUpdates";

const UPDATES = "albumUpdates";
const EVENTS = "adminEvents";
/** The reminder email goes this many days before the promised date. */
export const PROMISE_REMINDER_DAYS = 4;

export type PromiseStatus = "overdue" | "soon" | "later";

export type AlbumPromise = {
  id: string;
  albumSlug: string;
  clients: string[];
  kind: string;
  label: string;
  text: string;
  estimateDate: string;
  createdAt: string | null;
  daysLeft: number;
  status: PromiseStatus;
  reminderSentAt: string | null;
  overdueReminderSentAt: string | null;
};

const isoOf = (value: unknown): string | null => {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return null;
};

/** Today's date in Romania as YYYY-MM-DD (the promise dates are calendar days there). */
export function todayInBucharest(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Europe/Bucharest" });
}

/** Whole calendar days from `today` to `date` (both YYYY-MM-DD); negative = date passed. */
export function daysBetween(today: string, date: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export function promiseStatus(daysLeft: number): PromiseStatus {
  if (daysLeft < 0) return "overdue";
  return daysLeft <= PROMISE_REMINDER_DAYS ? "soon" : "later";
}

/** Open promises (newest dated, not-done update per album), soonest first. */
export async function listOpenPromises(now = new Date()): Promise<AlbumPromise[]> {
  const db = firestore();
  const [updates, events] = await Promise.all([db.collection(UPDATES).get(), db.collection(EVENTS).get()]);
  const clientsBySlug = new Map<string, string[]>();
  events.docs.forEach((doc) => {
    const data = doc.data();
    const slug = typeof data.albumSlug === "string" ? data.albumSlug.trim() : "";
    const client = String(data.client?.fullName ?? data.title ?? "").trim();
    if (!slug || !client) return;
    const list = clientsBySlug.get(slug) ?? [];
    if (!list.includes(client)) list.push(client);
    clientsBySlug.set(slug, list);
  });

  const latestDated = new Map<string, { id: string; data: FirebaseFirestore.DocumentData; createdAt: string | null }>();
  updates.docs.forEach((doc) => {
    const data = doc.data();
    if (typeof data.estimateDate !== "string" || !data.estimateDate) return;
    const slug = String(data.albumSlug ?? "");
    const createdAt = isoOf(data.createdAt);
    const current = latestDated.get(slug);
    if (!current || (createdAt ?? "") > (current.createdAt ?? "")) latestDated.set(slug, { id: doc.id, data, createdAt });
  });

  const today = todayInBucharest(now);
  return Array.from(latestDated.entries())
    .filter(([, { data }]) => !data.fulfilledAt)
    .map(([slug, { id, data, createdAt }]) => {
      const kind = parseAlbumUpdateKind(data.kind);
      const daysLeft = daysBetween(today, data.estimateDate);
      return {
        id,
        albumSlug: slug,
        clients: clientsBySlug.get(slug) ?? [],
        kind: String(data.kind ?? ""),
        label: kind ? `${ALBUM_UPDATE_META[kind].emoji} ${ALBUM_UPDATE_META[kind].label}` : "Noutate",
        text: String(data.text ?? ""),
        estimateDate: data.estimateDate as string,
        createdAt,
        daysLeft,
        status: promiseStatus(daysLeft),
        reminderSentAt: isoOf(data.promiseReminderSentAt),
        overdueReminderSentAt: isoOf(data.promiseOverdueReminderSentAt),
      };
    })
    .sort((a, b) => a.estimateDate.localeCompare(b.estimateDate));
}

export async function markPromiseDone(id: string): Promise<boolean> {
  const ref = firestore().collection(UPDATES).doc(id);
  const snap = await ref.get();
  if (!snap.exists || typeof snap.data()?.estimateDate !== "string") return false;
  await ref.update({ fulfilledAt: Timestamp.now() });
  return true;
}

const escHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const whenLabel = (daysLeft: number) =>
  daysLeft < 0 ? `a trecut acum ${-daysLeft} ${-daysLeft === 1 ? "zi" : "zile"}` : daysLeft === 0 ? "AZI" : daysLeft === 1 ? "MÂINE" : `peste ${daysLeft} zile`;

export function promiseReminderEmail(promises: AlbumPromise[]): { subject: string; html: string } {
  const overdue = promises.filter((p) => p.status === "overdue").length;
  const subject = overdue > 0
    ? `⏰ Ai promis ceva unor clienți — ${overdue} ${overdue === 1 ? "termen depășit" : "termene depășite"}`
    : `⏰ Ai promis ceva ${promises.length === 1 ? "unui client" : `la ${promises.length} clienți`} — termenul se apropie`;
  const rows = promises.map((p) => {
    const who = p.clients.join(" & ") || p.albumSlug;
    const color = p.status === "overdue" ? "#b91c1c" : "#b45309";
    return `
      <tr><td style="padding:14px 0;border-bottom:1px solid #eee;">
        <p style="margin:0 0 4px;font-size:15px;color:#111;"><strong>${escHtml(who)}</strong> · <span style="color:${color};font-weight:700;">${escHtml(formatEstimateDate(p.estimateDate))} — ${whenLabel(p.daysLeft)}</span></p>
        <p style="margin:0 0 6px;font-size:13px;color:#555;">${escHtml(p.label)} trimisă clientului:</p>
        <p style="margin:0 0 8px;font-size:13px;color:#333;background:#f6f6f6;padding:8px 10px;border-left:3px solid ${color};">${escHtml(p.text)}</p>
        <a href="${APP_BASE_URL}/media/${encodeURIComponent(p.albumSlug)}" style="font-size:13px;color:#111;">Deschide albumul →</a>
      </td></tr>`;
  }).join("");
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 6px;color:#111;">Hei, vezi că ai promis ceva într-o notificare</h2>
      <p style="margin:0 0 16px;color:#555;font-size:14px;">Aceste termene le-ai scris clienților în „Noutăți despre album”. Când e gata, apasă „✓ Făcut” în dashboard; dacă mai durează, publică o estimare nouă.</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;">${rows}</table>
      <p style="margin:18px 0 0;"><a href="${APP_BASE_URL}/admin" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;text-decoration:none;font-weight:600;font-size:14px;">Vezi promisiunile în dashboard</a></p>
    </div>`;
  return { subject, html };
}

/**
 * Daily: one email listing every promise due within PROMISE_REMINDER_DAYS (sent once per promise)
 * and every promise whose date passed (sent once more). Firestore flags keep it to one email per
 * stage even when several servers run the cron.
 */
export async function processPromiseReminders(now = new Date()): Promise<number> {
  const promises = await listOpenPromises(now);
  const due = promises.filter((p) =>
    (p.status === "soon" && !p.reminderSentAt) || (p.status === "overdue" && !p.overdueReminderSentAt));
  if (due.length === 0) return 0;
  const { subject, html } = promiseReminderEmail(due);
  await sendEmail({ to: adminUser.email, subject, html, source: "album-promises" });
  const db = firestore();
  const stamp = Timestamp.fromDate(now);
  await Promise.all(due.map((p) => db.collection(UPDATES).doc(p.id).update(
    p.status === "overdue" ? { promiseOverdueReminderSentAt: stamp } : { promiseReminderSentAt: stamp },
  )));
  return due.length;
}
