/*
 * Purpose: deleting the album's short video must make the next album load see it gone — the
 * invalidation waits for the Firestore copy to be dropped, and a load already running with the old
 * listing does not write that stale album back into the cache.
 */
import { beforeEach, expect, test, vi } from "vitest";

const cacheDocs = new Map<string, Record<string, unknown>>();
let shortVideos: { ObjectName: string }[] = [];
let holdListing = false;
let releaseListing: (() => void) | null = null;

vi.mock("src/server/firestore", () => ({
  firestore: () => ({
    collection: () => ({
      doc: (id: string) => ({
        get: async () => ({ exists: cacheDocs.has(id), data: () => cacheDocs.get(id) }),
        set: async (value: Record<string, unknown>) => { cacheDocs.set(id, { ...value, indexedAt: { toMillis: () => Date.now() } }); },
        delete: async () => { await Promise.resolve(); cacheDocs.delete(id); },
      }),
    }),
  }),
}));
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => null } }));
vi.mock("src/server/utils/signBunnyUrl", () => ({ signBunnyUrl: (path: string) => `https://cdn.test${path}` }));
vi.mock("src/server/services/bunny.service", () => ({
  checkFileExists: async () => false,
  listFiles: async (path: string) => {
    if (!path.endsWith("/shortvideo")) return [];
    const snapshot = shortVideos;
    if (!holdListing) return snapshot;
    await new Promise<void>((resolve) => { releaseListing = resolve; });
    return snapshot;
  },
}));

beforeEach(() => {
  cacheDocs.clear();
  shortVideos = [{ ObjectName: "film.mp4" }];
  holdListing = false;
  releaseListing = null;
  vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
});

test("after invalidation the next load no longer sees the deleted short video", async () => {
  const { loadAlbum, invalidateAlbumCache } = await import("src/server/services/album.service");
  expect((await loadAlbum("a1"))?.shortvideo).toContain("film.mp4");
  await vi.waitFor(() => expect(cacheDocs.has("a1")).toBe(true));

  shortVideos = [];
  await invalidateAlbumCache("a1");
  expect(cacheDocs.has("a1")).toBe(false);
  expect((await loadAlbum("a1"))?.shortvideo).toBeNull();
});

test("a load that started before the delete does not cache the stale album", async () => {
  const { loadAlbum, invalidateAlbumCache } = await import("src/server/services/album.service");
  holdListing = true;
  const inFlight = loadAlbum("a2");
  await vi.waitFor(() => expect(releaseListing).not.toBeNull());

  shortVideos = [];
  await invalidateAlbumCache("a2");
  holdListing = false;
  releaseListing!();
  expect((await inFlight)?.shortvideo).toContain("film.mp4");

  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(cacheDocs.has("a2")).toBe(false);
  expect((await loadAlbum("a2"))?.shortvideo).toBeNull();
});
