/*
 * Purpose: verifies listFiles, checkFileExists, and checkPreviewExist handle
 * both array and Objects-wrapped Bunny API responses, and degrade gracefully
 * on network errors.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

async function loadBunnyService() {
  vi.doMock("src/server/constants/bunny", () => ({
    BUNNY_ACCESS_KEY_HEADER: "AccessKey",
    BUNNY_PREVIEW_FOLDER: "photos_preview",
    getBunnyStorageZone: () => "test-zone",
    getBunnyStorageKey: () => "test-key",
    buildBunnyDirectoryUrl: (...segments: string[]) =>
      `https://storage.bunnycdn.com/test-zone/${segments.filter(Boolean).join("/")}/`,
  }));

  vi.doMock("dotenv", () => ({ default: { config: vi.fn() } }));

  return import("src/server/services/bunny.service");
}

function okFetch(data: unknown) {
  return Promise.resolve({ ok: true, json: async () => data });
}

function errorFetch() {
  return Promise.resolve({ ok: false });
}

describe("bunny.service", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("listFiles", () => {
    test("returns array when Bunny responds with a plain array", async () => {
      const fetchMock = vi.fn().mockReturnValue(okFetch([{ ObjectName: "photo1.jpg" }, { ObjectName: "photo2.jpg" }]));
      vi.stubGlobal("fetch", fetchMock);
      const { listFiles } = await loadBunnyService();

      const result = await listFiles("nunta-2026/photos");
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ ObjectName: "photo1.jpg" });
    });

    test("extracts Objects array when Bunny wraps response", async () => {
      const fetchMock = vi.fn().mockReturnValue(okFetch({ Objects: [{ ObjectName: "video.mp4" }] }));
      vi.stubGlobal("fetch", fetchMock);
      const { listFiles } = await loadBunnyService();

      const result = await listFiles("nunta-2026/videos");
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ ObjectName: "video.mp4" });
    });

    test("returns empty array when response is not ok", async () => {
      vi.stubGlobal("fetch", vi.fn().mockReturnValue(errorFetch()));
      const { listFiles } = await loadBunnyService();

      expect(await listFiles("missing-dir")).toEqual([]);
    });

    test("returns empty array when Objects is undefined", async () => {
      vi.stubGlobal("fetch", vi.fn().mockReturnValue(okFetch({})));
      const { listFiles } = await loadBunnyService();

      expect(await listFiles("empty-dir")).toEqual([]);
    });
  });

  describe("checkFileExists", () => {
    test("returns true when file is found in the directory", async () => {
      vi.stubGlobal("fetch", vi.fn().mockReturnValue(okFetch([{ ObjectName: "photo1.jpg" }, { ObjectName: "photo2.jpg" }])));
      const { checkFileExists } = await loadBunnyService();

      expect(await checkFileExists("nunta-2026/photos", "photo1.jpg")).toBe(true);
    });

    test("returns false when file is not found", async () => {
      vi.stubGlobal("fetch", vi.fn().mockReturnValue(okFetch([{ ObjectName: "photo1.jpg" }])));
      const { checkFileExists } = await loadBunnyService();

      expect(await checkFileExists("nunta-2026/photos", "missing.jpg")).toBe(false);
    });

    test("returns false when directory fetch fails", async () => {
      vi.stubGlobal("fetch", vi.fn().mockReturnValue(errorFetch()));
      const { checkFileExists } = await loadBunnyService();

      expect(await checkFileExists("nunta-2026/photos", "photo.jpg")).toBe(false);
    });
  });

  describe("checkPreviewExist", () => {
    test("returns true when preview directory has files", async () => {
      vi.stubGlobal("fetch", vi.fn().mockReturnValue(okFetch([{ ObjectName: "preview1.jpg" }])));
      const { checkPreviewExist } = await loadBunnyService();

      expect(await checkPreviewExist("nunta-2026")).toBe(true);
    });

    test("returns false when preview directory is empty", async () => {
      vi.stubGlobal("fetch", vi.fn().mockReturnValue(okFetch([])));
      const { checkPreviewExist } = await loadBunnyService();

      expect(await checkPreviewExist("nunta-2026")).toBe(false);
    });

    test("returns false when response is not ok", async () => {
      vi.stubGlobal("fetch", vi.fn().mockReturnValue(errorFetch()));
      const { checkPreviewExist } = await loadBunnyService();

      expect(await checkPreviewExist("nunta-2026")).toBe(false);
    });

    test("returns false when response is not a plain array (Objects-wrapped)", async () => {
      vi.stubGlobal("fetch", vi.fn().mockReturnValue(okFetch({ Objects: [{ ObjectName: "x.jpg" }] })));
      const { checkPreviewExist } = await loadBunnyService();

      expect(await checkPreviewExist("nunta-2026")).toBe(false);
    });
  });
});
