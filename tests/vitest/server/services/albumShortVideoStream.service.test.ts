/*
 * Purpose: verifies the album "Video scurt" → Bunny Stream flow (send once, find the video by
 * title, report ready/failed) with an in-memory Firestore doc and a mocked Bunny API.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const docs = new Map<string, Record<string, unknown>>();

function docRef(id: string) {
  return {
    get: async () => ({ exists: docs.has(id), data: () => docs.get(id) }),
    set: async (value: Record<string, unknown>) => { docs.set(id, { ...value }); },
    update: async (value: Record<string, unknown>) => { docs.set(id, { ...docs.get(id), ...value }); },
    delete: async () => { docs.delete(id); },
  };
}

vi.mock("src/server/firestore", () => ({
  firestore: () => ({
    collection: () => ({ doc: docRef }),
    runTransaction: async (fn: (t: unknown) => Promise<unknown>) => fn({
      get: (ref: ReturnType<typeof docRef>) => ref.get(),
      set: (ref: ReturnType<typeof docRef>, value: Record<string, unknown>) => { void ref.set(value); },
    }),
  }),
}));
vi.mock("src/server/utils/signBunnyUrl", () => ({ signBunnyUrl: (path: string) => `https://cdn.test${path}?token=t` }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("albumShortVideoStream", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    docs.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("BUNNY_STREAM_ALBUM_LIBRARY_ID", "42");
    vi.stubEnv("BUNNY_STREAM_ALBUM_API_KEY", "key");
    vi.useFakeTimers({ now: 1_000_000, toFake: ["Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  const load = () => import("src/server/services/albumShortVideoStream.service");

  test("sends the Storage file to Stream once, then plays it when transcoded", async () => {
    const { startShortVideoStream, getShortVideoStream } = await load();
    fetchMock.mockResolvedValueOnce(json({ success: true }));
    await startShortVideoStream("nunta", "teaser.mp4");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://video.bunnycdn.com/library/42/videos/fetch");
    const body = JSON.parse(init.body);
    expect(body.url).toBe("https://cdn.test/nunta/shortvideo/teaser.mp4?token=t");

    // Same file again → no second fetch.
    await startShortVideoStream("nunta", "teaser.mp4");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock
      .mockResolvedValueOnce(json({ items: [{ guid: "other", title: "x" }, { guid: "g1", title: body.title }] }))
      .mockResolvedValueOnce(json({ status: 3 }));
    expect(await getShortVideoStream("nunta", "teaser.mp4")).toEqual({ status: "processing", embedUrl: null });

    vi.setSystemTime(1_000_000 + 31_000);
    fetchMock.mockResolvedValueOnce(json({ status: 4 }));
    const ready = await getShortVideoStream("nunta", "teaser.mp4");
    expect(ready.status).toBe("ready");
    expect(ready.embedUrl).toContain("https://iframe.mediadelivery.net/embed/42/g1");
  });

  test("a failed transcode falls back to the original", async () => {
    const { startShortVideoStream, getShortVideoStream } = await load();
    fetchMock.mockResolvedValueOnce(json({ success: true }));
    await startShortVideoStream("nunta", "teaser.mp4");
    docs.set("nunta", { ...docs.get("nunta"), guid: "g1" });
    fetchMock.mockResolvedValueOnce(json({ status: 5 }));
    expect(await getShortVideoStream("nunta", "teaser.mp4")).toEqual({ status: "failed", embedUrl: null });
  });

  test("a new upload deletes the previous Stream copy", async () => {
    docs.set("nunta", { fileName: "old.mp4", title: "t", guid: "old-guid", status: "ready", requestedAt: 1 });
    const { startShortVideoStream } = await load();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 })).mockResolvedValueOnce(json({ success: true }));
    await startShortVideoStream("nunta", "new.mp4");
    expect(fetchMock.mock.calls[0][0]).toBe("https://video.bunnycdn.com/library/42/videos/old-guid");
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
    expect(docs.get("nunta")).toMatchObject({ fileName: "new.mp4", guid: null, status: "processing" });
  });

  test("a lost fetch does not stay 'processing' forever", async () => {
    const { startShortVideoStream, getShortVideoStream } = await load();
    fetchMock.mockRejectedValueOnce(new Error("network"));
    await startShortVideoStream("nunta", "teaser.mp4");
    expect(docs.get("nunta")).toMatchObject({ status: "failed" });

    docs.set("nunta", { fileName: "b.mp4", title: "album nunta · b.mp4 · 1", guid: null, status: "processing", requestedAt: 1_000_000 });
    vi.setSystemTime(1_000_000 + 3 * 60 * 60_000);
    fetchMock.mockResolvedValueOnce(json({ items: [] }));
    expect(await getShortVideoStream("nunta", "b.mp4")).toEqual({ status: "failed", embedUrl: null });
  });

  test("Stream not configured → null, the page keeps the plain player", async () => {
    vi.stubEnv("BUNNY_STREAM_ALBUM_LIBRARY_ID", "");
    vi.stubEnv("BUNNY_STREAM_LIBRARY_ID", "");
    const { getShortVideoStream } = await load();
    expect(await getShortVideoStream("nunta", "teaser.mp4")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
