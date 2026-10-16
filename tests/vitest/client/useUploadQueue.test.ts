/*
 * Purpose: the remaining-time estimate of the admin upload queue — the longest current
 * upload's remaining time plus the queued ones in rounds of `concurrency`.
 */
import { describe, expect, it } from "vitest";
import { estimateRemainingMs, type UploadItem } from "src/client/features/admin/components/useUploadQueue";

const item = (status: UploadItem["status"], startedAt?: number): UploadItem => ({ key: Math.random().toString(), label: "x", status, startedAt });

describe("estimateRemainingMs", () => {
  it("adds queued rounds to what the current uploads still need", () => {
    const now = 10_000;
    const items = [item("uploading", now - 2000), item("uploading", now - 1000), item("queued"), item("queued"), item("queued"), item("done")];
    // curentă: 6000 − 1000 = 5000; 3 în coadă la câte 2 = 2 runde × 6000
    expect(estimateRemainingMs(items, 2, 6000, now)).toBe(5000 + 12_000);
  });

  it("never estimates a running upload below a small floor and is zero when idle", () => {
    expect(estimateRemainingMs([item("uploading", 0)], 2, 6000, 60_000)).toBe(900);
    expect(estimateRemainingMs([item("done"), item("error")], 2, 6000, 0)).toBe(0);
  });
});
