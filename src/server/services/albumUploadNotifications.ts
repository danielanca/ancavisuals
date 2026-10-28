import { randomUUID } from "node:crypto";
import { firestore } from "../firestore";
import { sendEmail } from "../notifications/mailer";
import { adminUser } from "../constants/credentials";
import { APP_BASE_URL } from "../constants/domain";
import { logActivityOnce } from "./activity.service";

const COLLECTION = "albumUploadSessions";
const IDLE_MS = 15 * 60_000;
const ref = (id: string) => firestore().collection(COLLECTION).doc(id);
const safeId = (id: string) => /^[a-f0-9-]{36}$/i.test(id);
const html = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
interface UploadSession {
  eventId: string;
  slug: string;
  total: number;
  pending: string[];
  lastActivityAt: number;
  finishRequested: boolean;
  leaseUntil: number;
}

// Durable progress of the latest batch per event (albumUploadProgress/<eventId>): how many photos
// the owner meant to upload and which still haven't arrived. Unlike the session above it survives
// a closed page, the 15-minute alert and retries, so the admin can show "500 din 1385" and resume.
const PROGRESS = "albumUploadProgress";
const progressRef = (eventId: string) => firestore().collection(PROGRESS).doc(eventId);

export interface AlbumUploadProgress {
  slug: string;
  expected: number;
  pending: string[];
  startedAt: number;
  lastActivityAt: number;
  finishedAt: number | null;
}

/**
 * `resume`: the batch continues the previous one for this album (retry of failed photos, or the same
 * selection picked again after the page closed), so the expected total and start time are kept.
 */
export async function beginAlbumUpload(eventId: string, slug: string, filenames: string[], resume = false): Promise<string> {
  const id = randomUUID();
  const now = Date.now();
  await ref(id).set({ eventId, slug, total: filenames.length, pending: filenames,
    lastActivityAt: now, finishRequested: false, leaseUntil: 0 });
  await firestore().runTransaction(async (tx) => {
    const snapshot = await tx.get(progressRef(eventId));
    const previous = snapshot.exists ? (snapshot.data() as AlbumUploadProgress) : null;
    if (resume && previous && previous.slug === slug && previous.pending.length > 0) {
      tx.set(progressRef(eventId), { ...previous, lastActivityAt: now, finishedAt: null });
    } else {
      tx.set(progressRef(eventId), { slug, expected: filenames.length, pending: filenames, startedAt: now, lastActivityAt: now, finishedAt: null } satisfies AlbumUploadProgress);
    }
  });
  return id;
}

export async function getAlbumUploadProgress(eventId: string): Promise<AlbumUploadProgress | null> {
  const snapshot = await progressRef(eventId).get();
  return snapshot.exists ? (snapshot.data() as AlbumUploadProgress) : null;
}

/** "Am rezolvat": the owner dismisses the warning (e.g. finished the upload another way). */
export async function clearAlbumUploadProgress(eventId: string): Promise<void> {
  await progressRef(eventId).delete();
}

// Successful originals are recorded by the server, not inferred from browser counters.
export async function recordAlbumUploadSuccess(id: string, eventId: string, filename: string): Promise<void> {
  if (!safeId(id)) throw new Error("Invalid upload session");
  await firestore().runTransaction(async (tx) => {
    const doc = ref(id);
    const snapshot = await tx.get(doc);
    const progressSnapshot = await tx.get(progressRef(eventId));
    const now = Date.now();
    if (snapshot.exists) {
      const session = snapshot.data() as UploadSession;
      if (session.eventId !== eventId) throw new Error("Upload session mismatch");
      tx.update(doc, { pending: session.pending.filter((name) => name !== filename), lastActivityAt: now });
    }
    // The progress counts the photo even if the session was already closed by the idle alert.
    if (progressSnapshot.exists) {
      const progress = progressSnapshot.data() as AlbumUploadProgress;
      const pending = progress.pending.filter((name) => name !== filename);
      tx.update(progressRef(eventId), { pending, lastActivityAt: now, ...(pending.length === 0 ? { finishedAt: now } : {}) });
    }
  });
}

export async function touchAlbumUpload(id: string, eventId: string, finish: boolean): Promise<void> {
  if (!safeId(id)) throw new Error("Invalid upload session");
  await firestore().runTransaction(async (tx) => {
    const doc = ref(id);
    const snapshot = await tx.get(doc);
    if (!snapshot.exists) return;
    if (snapshot.data()?.eventId !== eventId) throw new Error("Upload session mismatch");
    tx.update(doc, { lastActivityAt: Date.now(), ...(finish ? { finishRequested: true } : {}) });
  });
}

export async function notifyIncompleteAlbumUpload(id: string, now = Date.now()): Promise<boolean> {
  const session = await firestore().runTransaction(async (tx) => {
    const doc = ref(id);
    const snapshot = await tx.get(doc);
    if (!snapshot.exists) return undefined;
    const data = snapshot.data() as UploadSession;
    if (data.leaseUntil > now || (!data.finishRequested && now - data.lastActivityAt < IDLE_MS)) return undefined;
    if (!data.pending.length) { tx.delete(doc); return undefined; }
    tx.update(doc, { leaseUntil: now + 5 * 60_000, finishRequested: true });
    return data;
  });
  if (!session) return false;
  try {
    if (!adminUser.email) throw new Error("Admin notification email missing");
    await sendEmail({
      to: adminUser.email,
      subject: `⚠️ Upload incomplet: ${session.slug} — ${session.pending.length}/${session.total} originale neconfirmate`,
      source: "album-upload",
      html: `<p>Nu s-a confirmat încărcarea tuturor fotografiilor originale în albumul <strong>${html(session.slug)}</strong>.</p>
        <p>${session.total - session.pending.length}/${session.total} încărcate și confirmate; ${session.pending.length} neconfirmate după reîncercare sau întreruperea uploadului.</p>
        <p>Verifică și reîncarcă fișierele de mai jos. Lipsa confirmării poate apărea și dacă transferul s-a încheiat, dar conexiunea s-a întrerupt înainte de înregistrarea rezultatului.</p>
        <ul>${session.pending.map((name) => `<li>${html(name)}</li>`).join("")}</ul>
        <p><a href="${APP_BASE_URL}/admin">Deschide administrarea evenimentelor</a></p>`,
    });
    await logActivityOnce(`album-upload-incomplete:${id}`, {
      type: "upload_incomplete",
      title: `Upload incomplet: ${session.slug}`,
      description: `${session.pending.length} din ${session.total} originale nu au fost confirmate`,
      metadata: { slug: session.slug, route: "/admin/album-health" },
      emailSent: true,
    });
    await ref(id).delete();
    return true;
  } catch (error) {
    // Keep the durable report so an SMTP outage cannot silently discard the alert.
    await ref(id).update({ leaseUntil: 0 });
    throw error;
  }
}

export async function checkIncompleteAlbumUploads(now = Date.now()): Promise<void> {
  const sessions = await firestore().collection(COLLECTION).get();
  for (const doc of sessions.docs) {
    try { await notifyIncompleteAlbumUpload(doc.id, now); }
    catch { console.error("[album-upload] Notification pending; will retry", doc.id); }
  }
}

let timer: ReturnType<typeof setInterval> | undefined;
export function startAlbumUploadNotifications(): void {
  if (timer) return;
  let running = false;
  const check = async () => {
    if (running) return;
    running = true;
    try { await checkIncompleteAlbumUploads(); }
    catch { console.error("[album-upload] Could not check pending uploads"); }
    finally { running = false; }
  };
  void check();
  timer = setInterval(() => void check(), 60_000);
  timer.unref();
}
