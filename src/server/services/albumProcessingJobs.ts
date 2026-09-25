import { EventEmitter } from "events";
import { firestore } from "../firestore";

export type JobStatus = "running" | "done" | "error";

export interface ProcessingJob {
  slug: string;
  status: JobStatus;
  log: string[];
  progress: { done: number; total: number };
  initialWithPreview: number;
  error?: string;
  startedAt: number;
  finishedAt?: number;
  emitter: EventEmitter;
}

export interface DurableAlbumJob {
  slug: string;
  status: "queued" | "running";
  pendingPhotos: string[];
  initialized: boolean;
  progress: { done: number; total: number };
  initialWithPreview: number;
  alreadyExisting: number;
  failedAttempts: number;
  retryCount: number;
  nextAttemptAt: number;
  startedAt: number;
}

const jobs = new Map<string, ProcessingJob>();
const activeRuns = new Set<string>();
const QUEUE_COLLECTION = "albumPhotoProcessingQueue";

const queueRef = (slug: string) => firestore().collection(QUEUE_COLLECTION).doc(encodeURIComponent(slug));

export async function enqueueDurableJob(slug: string, initialWithPreview: number): Promise<boolean> {
  const now = Date.now();
  const ref = queueRef(slug);
  const created = await firestore().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (snapshot.exists) return false;
    tx.set(ref, {
      slug,
      status: "queued",
      pendingPhotos: [],
      initialized: false,
      progress: { done: 0, total: 0 },
      initialWithPreview,
      alreadyExisting: 0,
      failedAttempts: 0,
      retryCount: 0,
      nextAttemptAt: now,
      startedAt: now,
      updatedAt: now,
    });
    return true;
  });
  if (created) createJob(slug, initialWithPreview);
  return created;
}

export async function getDurableJob(slug: string): Promise<DurableAlbumJob | undefined> {
  const snapshot = await queueRef(slug).get();
  return snapshot.exists ? snapshot.data() as DurableAlbumJob : undefined;
}

export async function listDurableJobs(): Promise<DurableAlbumJob[]> {
  const snapshot = await firestore().collection(QUEUE_COLLECTION).get();
  return snapshot.docs.map((doc) => doc.data() as DurableAlbumJob);
}

export async function updateDurableJob(slug: string, update: Partial<DurableAlbumJob>): Promise<void> {
  await queueRef(slug).set({ ...update, updatedAt: Date.now() }, { merge: true });
}

export async function completeDurablePhoto(slug: string, filename: string): Promise<DurableAlbumJob | undefined> {
  const ref = queueRef(slug);
  return firestore().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return undefined;
    const job = snapshot.data() as DurableAlbumJob;
    if (!job.pendingPhotos.includes(filename)) return job;
    const pendingPhotos = job.pendingPhotos.filter((photo) => photo !== filename);
    const progress = { done: job.progress.done + 1, total: job.progress.total };
    tx.update(ref, { pendingPhotos, progress, updatedAt: Date.now() });
    return { ...job, pendingPhotos, progress };
  });
}

export async function removeDurableJob(slug: string): Promise<void> {
  await queueRef(slug).delete();
}

export function beginJobRun(slug: string): boolean {
  if (activeRuns.has(slug)) return false;
  activeRuns.add(slug);
  return true;
}

export function endJobRun(slug: string): void {
  activeRuns.delete(slug);
}

export function restoreJobFromQueue(record: DurableAlbumJob, message: string): ProcessingJob {
  let job = jobs.get(record.slug);
  if (!job) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(50);
    job = {
      slug: record.slug,
      status: "running",
      log: [],
      progress: record.progress,
      initialWithPreview: record.initialWithPreview,
      startedAt: record.startedAt,
      emitter,
    };
    jobs.set(record.slug, job);
  } else {
    job.status = "running";
    job.progress = record.progress;
    job.error = undefined;
    job.finishedAt = undefined;
  }
  appendJobLog(record.slug, message);
  return job;
}

export function getJob(slug: string): ProcessingJob | undefined {
  return jobs.get(slug);
}

export function createJob(slug: string, initialWithPreview: number): ProcessingJob {
  const existing = jobs.get(slug);
  if (existing) {
    existing.status = "running";
    existing.log = [];
    existing.progress = { done: 0, total: 0 };
    existing.initialWithPreview = initialWithPreview;
    existing.error = undefined;
    existing.startedAt = Date.now();
    existing.finishedAt = undefined;
    existing.emitter.emit("update", { type: "reset" });
    return existing;
  }
  const emitter = new EventEmitter();
  emitter.setMaxListeners(50);
  const job: ProcessingJob = {
    slug,
    status: "running",
    log: [],
    progress: { done: 0, total: 0 },
    initialWithPreview,
    startedAt: Date.now(),
    emitter,
  };
  jobs.set(slug, job);
  return job;
}

export function appendJobLog(slug: string, message: string): void {
  const job = jobs.get(slug);
  if (!job) return;
  job.log.push(message);
  job.emitter.emit("update", { type: "log", message });
}

export function setJobProgress(slug: string, done: number, total: number): void {
  const job = jobs.get(slug);
  if (!job) return;
  job.progress = { done, total };
  job.emitter.emit("update", { type: "progress", done, total });
}

export function finishJob(slug: string): void {
  const job = jobs.get(slug);
  if (!job) return;
  job.status = "done";
  job.finishedAt = Date.now();
  job.emitter.emit("update", { type: "done" });
}

export function errorJob(slug: string, error: string): void {
  const job = jobs.get(slug);
  if (!job) return;
  job.status = "error";
  job.error = error;
  job.finishedAt = Date.now();
  job.emitter.emit("update", { type: "error", error });
}

export function serializeJob(job: ProcessingJob) {
  return {
    slug: job.slug,
    status: job.status,
    log: job.log,
    progress: job.progress,
    initialWithPreview: job.initialWithPreview,
    error: job.error,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}

export function getAllJobs() {
  return Array.from(jobs.values()).map(serializeJob);
}
