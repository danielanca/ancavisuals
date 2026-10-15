import { firestore } from "../firestore";
import { EventEmitter } from "events";

export interface AlbumZipJob {
  slug: string;
  status: "running" | "done" | "error";
  log: string[];
  progress: { done: number; total: number };
  error?: string;
  emitter: EventEmitter;
}

export interface DurableAlbumZipJob {
  slug: string;
  status: "queued" | "running";
  progress: { done: number; total: number };
  retryCount: number;
  nextAttemptAt: number;
  startedAt: number;
}

const COLLECTION = "albumZipProcessingQueue";
const activeRuns = new Set<string>();
const jobs = new Map<string, AlbumZipJob>();
const key = (slug: string) => encodeURIComponent(slug);
const ref = (slug: string) => firestore().collection(COLLECTION).doc(key(slug));

export async function enqueueAlbumZipJob(slug: string): Promise<boolean> {
  const now = Date.now();
  const created = await firestore().runTransaction(async tx => {
    const snapshot = await tx.get(ref(slug));
    if (snapshot.exists) return false;
    tx.set(ref(slug), { slug, status: "queued", progress: { done: 0, total: 0 }, retryCount: 0, nextAttemptAt: now, startedAt: now, updatedAt: now });
    return true;
  });
  return created;
}

export async function getAlbumZipJob(slug: string): Promise<DurableAlbumZipJob | undefined> {
  const snapshot = await ref(slug).get();
  return snapshot.exists ? snapshot.data() as DurableAlbumZipJob : undefined;
}

export async function listAlbumZipJobs(): Promise<DurableAlbumZipJob[]> {
  const snapshot = await firestore().collection(COLLECTION).get();
  return snapshot.docs.map(doc => doc.data() as DurableAlbumZipJob);
}

export async function updateAlbumZipJob(slug: string, update: Partial<DurableAlbumZipJob>): Promise<void> {
  await ref(slug).set({ ...update, updatedAt: Date.now() }, { merge: true });
}

export async function removeAlbumZipJob(slug: string): Promise<void> {
  await ref(slug).delete();
}

export function beginAlbumZipRun(slug: string): boolean {
  if (activeRuns.has(slug)) return false;
  activeRuns.add(slug);
  return true;
}

export function endAlbumZipRun(slug: string): void {
  activeRuns.delete(slug);
}

export function createAlbumZipJob(slug: string): AlbumZipJob {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(50);
  const job: AlbumZipJob = { slug, status: "running", log: [], progress: { done: 0, total: 0 }, emitter };
  jobs.set(slug, job);
  return job;
}

export function getAlbumZipInMemoryJob(slug: string): AlbumZipJob | undefined {
  return jobs.get(slug);
}

export function appendAlbumZipLog(slug: string, message: string): void {
  const job = jobs.get(slug);
  if (!job) return;
  job.log.push(message);
  job.emitter.emit("update", { type: "log", message });
}

export function setAlbumZipProgress(slug: string, done: number, total: number): void {
  const job = jobs.get(slug);
  if (!job) return;
  job.progress = { done, total };
  job.emitter.emit("update", { type: "progress", done, total });
}

export function finishAlbumZipJob(slug: string): void {
  const job = jobs.get(slug);
  if (!job) return;
  job.status = "done";
  job.emitter.emit("update", { type: "done" });
}

export function errorAlbumZipJob(slug: string, error: string): void {
  const job = jobs.get(slug);
  if (!job) return;
  job.status = "error";
  job.error = error;
  job.emitter.emit("update", { type: "error", error });
}

export function serializeAlbumZipJob(job: AlbumZipJob) {
  return { slug: job.slug, status: job.status, log: job.log, progress: job.progress, error: job.error };
}
