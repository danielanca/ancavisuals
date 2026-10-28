// Time left for each step of the album upload (originals → WebP previews → photos.zip), from the
// upload speed measured on the originals already sent. Before a step starts it is a guess from
// that speed; once it runs, its own measured pace replaces the guess.

/** A 1.000 px WebP preview: ~200 KB, ~0.5 s to decode the camera JPEG and encode it. */
const PREVIEW_BYTES = 200_000;
const PREVIEW_CPU_SECONDS = 0.5;
/** Reading the originals back into the ZIP on this computer (JPEGs don't compress, so it's mostly disk). */
const ZIP_BUILD_BYTES_PER_SECOND = 120 * 1024 ** 2;

export interface UploadPace {
  /** Bytes and seconds measured since the step started (this run only). */
  bytes: number;
  seconds: number;
}

export interface EstimateInput {
  concurrency: number;
  /** Upload speed source: originals sent in this run (or the ZIP upload once it runs). */
  uploadPace: UploadPace | null;
  originalsRemainingBytes: number;
  previewsRemaining: number;
  /** Previews done in this run and the seconds it took, once the step has started. */
  previewPace: { done: number; seconds: number } | null;
  /** photos.zip ≈ the originals' total size. */
  zipBytes: number;
  zip: { stage: "idle" | "building" | "uploading" | "verifying" | "done" | "other"; done: number; total: number; seconds: number };
}

export interface Estimate {
  /** Bytes per second; null until enough has been sent to measure. */
  bytesPerSecond: number | null;
  originals: number | null;
  previews: number | null;
  zip: number | null;
  total: number | null;
}

/** Enough data for a speed that doesn't jump around: 5 s and 10 MB sent. */
export function measuredSpeed(pace: UploadPace | null): number | null {
  if (!pace || pace.seconds < 5 || pace.bytes < 10 * 1024 ** 2) return null;
  return pace.bytes / pace.seconds;
}

export function estimateAlbumUpload(input: EstimateInput): Estimate {
  const speed = measuredSpeed(input.uploadPace);
  if (!speed) return { bytesPerSecond: null, originals: null, previews: null, zip: null, total: null };

  const originals = input.originalsRemainingBytes / speed;

  const previewSecondsEach = input.previewPace && input.previewPace.done >= 5
    ? input.previewPace.seconds / input.previewPace.done
    : (PREVIEW_CPU_SECONDS + PREVIEW_BYTES / speed) / Math.max(1, input.concurrency);
  const previews = input.previewsRemaining * previewSecondsEach;

  const { zip: z } = input;
  let zip: number;
  if (z.stage === "done") zip = 0;
  else if (z.stage === "verifying") zip = 10;
  else if (z.stage === "uploading") {
    const zipSpeed = z.seconds >= 5 && z.done > 0 ? z.done / z.seconds : speed;
    zip = (z.total - z.done) / zipSpeed + 10;
  } else if (z.stage === "building") {
    const buildSpeed = z.seconds >= 3 && z.done > 0 ? z.done / z.seconds : ZIP_BUILD_BYTES_PER_SECOND;
    zip = (z.total - z.done) / buildSpeed + z.total / speed + 10;
  } else zip = input.zipBytes / ZIP_BUILD_BYTES_PER_SECOND + input.zipBytes / speed + 10;

  return { bytesPerSecond: speed, originals, previews, zip, total: originals + previews + zip };
}

/** "sub 1 min", "12 min", "1 h 05 min". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return "sub 1 min";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

/** "48 Mbps" — the unit internet plans are sold in. */
export function formatSpeed(bytesPerSecond: number): string {
  return `${Math.round((bytesPerSecond * 8) / 1_000_000).toLocaleString("ro-RO")} Mbps`;
}
