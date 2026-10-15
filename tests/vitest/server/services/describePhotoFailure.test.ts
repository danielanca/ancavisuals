/*
 * Purpose: the "Procesare incompletă" email and inbox say WHY a photo was not
 * processed, and flag the failures a retry cannot fix.
 */
import { describe, expect, test, vi } from "vitest";

vi.mock("src/server/firestore", () => ({ firestore: () => ({}) }));

import { describePhotoFailure } from "src/server/services/albumProcessingJobs";

describe("describePhotoFailure", () => {
  test("a truncated JPEG is permanent and asks for a re-upload", () => {
    const failure = describePhotoFailure("convert", new Error("VipsJpeg: premature end of JPEG image"));
    expect(failure.permanent).toBe(true);
    expect(failure.reason).toContain("reîncarcă originalul");
  });

  test("an unreadable format is permanent", () => {
    expect(describePhotoFailure("convert", new Error("Input buffer contains unsupported image format")).permanent).toBe(true);
  });

  test("a deleted original is permanent, other download errors are temporary", () => {
    expect(describePhotoFailure("download", 404).permanent).toBe(true);
    expect(describePhotoFailure("download", 503)).toEqual({ reason: expect.stringContaining("HTTP 503"), permanent: false });
  });

  test("timeouts and upload errors are temporary", () => {
    expect(describePhotoFailure("download", new Error("The operation was aborted due to timeout")).permanent).toBe(false);
    expect(describePhotoFailure("upload", 500).permanent).toBe(false);
  });
});
