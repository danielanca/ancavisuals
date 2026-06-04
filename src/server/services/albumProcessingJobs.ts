import { EventEmitter } from "events";

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

const jobs = new Map<string, ProcessingJob>();

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
