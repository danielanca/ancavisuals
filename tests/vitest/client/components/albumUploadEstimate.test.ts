/*
 * Purpose: the album uploader shows the measured upload speed and the time left for each step
 * (originals → WebP previews → photos.zip).
 */
import { describe, expect, test } from "vitest";
import { estimateAlbumUpload, formatDuration, formatSpeed, measuredSpeed } from "src/client/features/admin/components/albumUploadEstimate";

const MB = 1024 ** 2;
const base = {
  concurrency: 2,
  originalsRemainingBytes: 600 * MB,
  previewsRemaining: 100,
  previewPace: null,
  zipBytes: 1200 * MB,
  zip: { stage: "idle" as const, done: 0, total: 0, seconds: 0 },
};

describe("album upload estimate", () => {
  test("no guess until 5 s and 10 MB have been sent", () => {
    expect(measuredSpeed({ bytes: 50 * MB, seconds: 3 })).toBeNull();
    expect(measuredSpeed({ bytes: 5 * MB, seconds: 30 })).toBeNull();
    expect(estimateAlbumUpload({ ...base, uploadPace: null }).total).toBeNull();
  });

  test("originals left at the measured speed; the ZIP re-uploads about as much as all the originals", () => {
    const estimate = estimateAlbumUpload({ ...base, uploadPace: { bytes: 60 * MB, seconds: 10 } }); // 6 MB/s
    expect(estimate.originals).toBeCloseTo(100);
    expect(estimate.zip).toBeGreaterThan(200); // 1200 MB / 6 MB/s
    expect(estimate.total).toBeCloseTo(estimate.originals! + estimate.previews! + estimate.zip!);
  });

  test("once previews run, their own pace replaces the guess", () => {
    const estimate = estimateAlbumUpload({ ...base, uploadPace: { bytes: 60 * MB, seconds: 10 }, previewPace: { done: 10, seconds: 20 } });
    expect(estimate.previews).toBe(200); // 100 left × 2 s
  });

  test("formats like the people reading it", () => {
    expect(formatDuration(30)).toBe("sub 1 min");
    expect(formatDuration(12 * 60)).toBe("12 min");
    expect(formatDuration(65 * 60)).toBe("1 h 05 min");
    expect(formatSpeed(6_000_000)).toBe("48 Mbps");
  });
});
