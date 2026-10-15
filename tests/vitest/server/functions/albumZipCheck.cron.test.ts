import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(), sendEmail: vi.fn(), inbox: vi.fn(), schedule: vi.fn(), get: vi.fn(), set: vi.fn(),
}));

vi.mock("node-fetch", () => ({ default: mocks.fetch }));
vi.mock("node-cron", () => ({ default: { schedule: mocks.schedule } }));
vi.mock("src/server/notifications/mailer", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("src/server/constants/credentials", () => ({ adminUser: { email: "admin@test.com" } }));
vi.mock("src/server/services/activity.service", () => ({ logActivityOnce: mocks.inbox }));
vi.mock("src/server/constants/bunny", () => ({
  buildBunnyDirectoryUrl: (path: string) => `https://storage.test/${path}`,
  getBunnyStorageKey: () => "test-key",
  BUNNY_ACCESS_KEY_HEADER: "AccessKey", BUNNY_PHOTOS_FOLDER: "photos", BUNNY_PREVIEW_FOLDER: "photos_preview",
}));
vi.mock("src/server/firestore", () => ({
  firestore: () => ({ collection: (collection: string) => ({ doc: (slug: string) => ({
    get: () => mocks.get(collection, slug),
    set: (data: unknown) => mocks.set(collection, slug, data),
  }) }) }),
}));


type Entry = { ObjectName: string; IsDirectory: boolean; LastChanged?: string };
const NOW = new Date("2026-10-09T18:00:00Z");
const HOUR = 60 * 60 * 1000;
const photo = (date?: string, name = "photo.jpg"): Entry => ({ ObjectName: name, IsDirectory: false, LastChanged: date });
const directory = (name: string): Entry => ({ ObjectName: name, IsDirectory: true });
const zip = (date: string): Entry => photo(date, "photos.zip");
let listings: Record<string, Entry[]>;
let archived: Record<string, string>;
let notification: { notifiedAt: { toMillis: () => number }; lastPhotoDate: string; state?: string } | undefined;

async function runCheck() {
  // Fresh module per test: the cron also remembers alerts in memory.
  const { startAlbumZipCheckCron } = await import("src/server/cron/albumZipCheck.cron");
  startAlbumZipCheckCron();
  const callback = mocks.schedule.mock.calls.at(-1)![1] as () => Promise<void>;
  await callback();
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  listings = { "": [directory("album")], album: [zip("2026-10-09T16:00:00Z")],
    "album/photos": [photo("2026-10-09T17:40:00Z")],
    "album/photos_preview": [photo("2026-10-09T17:40:00Z", "photo.webp")] };
  archived = {};
  notification = undefined;
  mocks.fetch.mockImplementation(async (url: string) => {
    const entries = listings[url.replace("https://storage.test/", "")];
    return { ok: Boolean(entries), status: entries ? 200 : 404, json: async () => entries ?? [] };
  });
  mocks.get.mockImplementation(async (collection: string) => collection === "settings"
    ? { exists: true, data: () => archived }
    : { exists: Boolean(notification), data: () => notification });
  mocks.set.mockResolvedValue(undefined);
  mocks.sendEmail.mockResolvedValue(undefined);
  mocks.inbox.mockResolvedValue("activity-id");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("album ZIP notification cron", () => {
  test("checks every five minutes and alerts for a photo newer than ZIP after the quiet period", async () => {
    await runCheck();
    expect(mocks.schedule).toHaveBeenCalledWith("*/5 * * * *", expect.any(Function));
    expect(mocks.inbox).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      type: "album_zip", emailSent: false, description: expect.stringContaining("ZIP depășit"),
      metadata: { slug: "album", route: "/admin/album-health?slug=album" },
    }));
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.set).toHaveBeenCalledWith("albumZipNotifications", "album", expect.objectContaining({
      notifiedAt: NOW, lastPhotoDate: "2026-10-09T17:40:00.000Z", state: expect.any(String),
    }));
  });

  test("alerts for today's photos and a ten day old ZIP, after uploads settle", async () => {
    listings.album = [zip("2026-09-29T12:00:00Z")];
    listings["album/photos"] = [photo("2026-10-09T17:59:00Z")];
    await runCheck();
    expect(mocks.inbox).not.toHaveBeenCalled();
    vi.setSystemTime(new Date("2026-10-09T18:14:00Z"));
    await runCheck();
    expect(mocks.inbox).toHaveBeenCalledTimes(1);
    expect(mocks.inbox.mock.calls[0][1].description).toContain("ZIP depășit");
  });

  test("each upload during an hour long batch restarts the quiet period", async () => {
    for (let minute = 0; minute <= 60; minute += 5) {
      const uploadTime = new Date(NOW.getTime() + minute * 60 * 1000);
      vi.setSystemTime(uploadTime);
      listings["album/photos"].push(photo(uploadTime.toISOString(), `photo-${minute}.jpg`));
      await runCheck();
    }
    expect(mocks.inbox).not.toHaveBeenCalled();
    vi.setSystemTime(new Date(NOW.getTime() + 74 * 60 * 1000));
    await runCheck();
    expect(mocks.inbox).not.toHaveBeenCalled();
    vi.setSystemTime(new Date(NOW.getTime() + 75 * 60 * 1000));
    await runCheck();
    expect(mocks.inbox).toHaveBeenCalledTimes(1);
  });

  test("does not alert if compression finishes during the quiet period", async () => {
    listings["album/photos"] = [photo(NOW.toISOString())];
    await runCheck();
    expect(mocks.inbox).not.toHaveBeenCalled();
    listings["album/photos_preview"] = [photo(new Date(NOW.getTime() + 2 * 60 * 1000).toISOString(), "photo.webp")];
    listings.album = [zip(new Date(NOW.getTime() + 4 * 60 * 1000).toISOString())];
    vi.setSystemTime(new Date(NOW.getTime() + 20 * 60 * 1000));
    await runCheck();
    expect(mocks.inbox).not.toHaveBeenCalled();
  });

  test.each(["2026-10-09T17:40:00Z", "2026-10-09T18:00:00Z"])("does not alert for current ZIP %s", async date => {
    listings.album = [zip(date)];
    vi.setSystemTime(new Date(NOW.getTime() + 20 * 60 * 1000));
    await runCheck();
    expect(mocks.inbox).not.toHaveBeenCalled();
  });

  test("compares the newest photo and reports only photos newer than ZIP", async () => {
    listings["album/photos"] = [photo("2026-10-09T15:00:00Z", "old.jpg"), photo("2026-10-09T17:40:00Z", "new.jpg")];
    listings["album/photos_preview"] = [photo("2026-10-09T15:00:00Z", "old.webp"), photo("2026-10-09T17:40:00Z", "new.webp")];
    await runCheck();
    const html = mocks.inbox.mock.calls[0][1].description;
    expect(html).toContain("new.jpg");
    expect(html).not.toContain("old.jpg");
  });

  test("ignores folder timestamps and non-photo files", async () => {
    listings.album = [zip("2026-10-09T18:00:00Z"), { ...directory("photos"), LastChanged: "2026-10-09T19:00:00Z" }];
    listings["album/photos"].push(photo("2026-10-09T19:00:00Z", ".DS_Store"));
    vi.setSystemTime(new Date(NOW.getTime() + 20 * 60 * 1000));
    await runCheck();
    expect(mocks.inbox).not.toHaveBeenCalled();
  });

  test("alerts for missing ZIP after fifteen quiet minutes", async () => {
    listings.album = [];
    vi.setSystemTime(new Date("2026-10-09T17:50:00Z"));
    await runCheck();
    expect(mocks.inbox).not.toHaveBeenCalled();
    vi.setSystemTime(NOW);
    await runCheck();
    expect(mocks.inbox).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ description: expect.stringContaining("Lipsă ZIP") }));
  });

  test.each([[], [photo()], [photo("invalid-date")]])("does not notify without usable photo dates: %j", async entries => {
    listings["album/photos"] = entries;
    await runCheck();
    expect(mocks.inbox).not.toHaveBeenCalled();
  });

  test("accepts ZIP created before previews when it contains the latest originals", async () => {
    listings["album/photos"] = [photo("2026-10-09T14:00:00Z")];
    listings["album/photos_preview"] = [photo("2026-10-09T17:40:00Z", "photo.webp")];
    await runCheck();
    expect(mocks.inbox).not.toHaveBeenCalled();
  });

  test("checks every preview even if the newest preview and ZIP are current", async () => {
    listings["album/photos"] = [photo("2026-10-09T14:00:00Z", "old.jpg"), photo("2026-10-09T15:00:00Z", "new.jpg")];
    listings["album/photos_preview"] = [photo("2026-10-09T13:00:00Z", "old.webp"), photo("2026-10-09T15:10:00Z", "new.webp")];
    listings.album = [zip("2026-10-09T15:20:00Z")];
    await runCheck();
    const html = mocks.inbox.mock.calls[0][1].description;
    expect(html).toContain("Preview depășit: old.jpg");
    expect(html).not.toContain("ZIP depășit");
  });

  test("alerts for missing previews even with a current ZIP", async () => {
    delete listings["album/photos_preview"];
    listings.album = [zip("2026-10-09T17:40:00Z")];
    await runCheck();
    expect(mocks.inbox.mock.calls[0][1].description).toContain("Lipsă preview: photo.jpg");
  });

  test("waits fifteen minutes after the latest preview change", async () => {
    listings["album/photos_preview"] = [photo("2026-10-09T17:59:00Z", "photo.webp")];
    await runCheck();
    expect(mocks.inbox).not.toHaveBeenCalled();
    vi.setSystemTime(new Date("2026-10-09T18:14:00Z"));
    await runCheck();
    expect(mocks.inbox).toHaveBeenCalledTimes(1);
  });

  test("accepts ordered timestamps including equality", async () => {
    listings.album = [zip("2026-10-09T17:40:00Z")];
    await runCheck();
    expect(mocks.inbox).not.toHaveBeenCalled();
  });

  test("a changed problem waits for the daily limit, then alerts once; a resolved one stays quiet", async () => {
    listings.album = [zip("2026-10-09T17:40:00Z")];
    listings["album/photos_preview"] = [];
    await runCheck();
    const data = mocks.set.mock.calls[0][2];
    notification = { ...data, notifiedAt: { toMillis: () => NOW.getTime() } };
    listings["album/photos_preview"] = [photo("2026-10-09T15:00:00Z", "photo.webp")];
    await runCheck();
    expect(mocks.inbox).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date(NOW.getTime() + 25 * HOUR));
    await runCheck();
    expect(mocks.inbox).toHaveBeenCalledTimes(2);
    listings["album/photos_preview"] = [photo("2026-10-09T17:45:00Z", "photo.webp")];
    vi.setSystemTime(new Date(NOW.getTime() + 50 * HOUR));
    await runCheck();
    expect(mocks.inbox).toHaveBeenCalledTimes(2);
  });

  test("checks every five minutes but alerts at most once a day, even if the alert record is not saved", async () => {
    mocks.set.mockRejectedValue(new Error("Firestore unavailable"));
    const { startAlbumZipCheckCron } = await import("src/server/cron/albumZipCheck.cron");
    startAlbumZipCheckCron();
    const callback = mocks.schedule.mock.calls.at(-1)![1] as () => Promise<void>;
    for (let minute = 0; minute < 120; minute += 5) {
      vi.setSystemTime(new Date(NOW.getTime() + minute * 60 * 1000));
      await callback();
    }
    expect(mocks.inbox).toHaveBeenCalledTimes(1);
  });

  test("stays quiet when the alert history cannot be read", async () => {
    mocks.get.mockImplementation(async (collection: string) => {
      if (collection === "settings") return { exists: true, data: () => archived };
      throw new Error("Firestore unavailable");
    });
    await runCheck();
    expect(mocks.inbox).not.toHaveBeenCalled();
  });

  test("does not re-notify when Bunny returns the same files in a different order", async () => {
    listings["album/photos"] = [photo("2026-10-09T17:40:00Z", "b.jpg"), photo("2026-10-09T17:39:00Z", "a.jpg")];
    listings["album/photos_preview"] = [photo("2026-10-09T17:40:00Z", "b.webp")];
    await runCheck();
    expect(mocks.inbox).toHaveBeenCalledTimes(1);
    const firstData = mocks.set.mock.calls[0][2] as { lastPhotoDate: string; state: string };
    notification = { ...firstData, notifiedAt: { toMillis: () => NOW.getTime() } };
    const firstState = notification.state;
    listings["album/photos"] = [photo("2026-10-09T17:39:00Z", "a.jpg"), photo("2026-10-09T17:40:00Z", "b.jpg")];
    listings["album/photos_preview"] = [photo("2026-10-09T17:40:00Z", "b.webp")];
    await runCheck();
    expect(mocks.inbox).toHaveBeenCalledTimes(1);
    expect(notification?.state).toBe(firstState);
  });

  test("a preview listing error is skipped rather than reported as missing previews", async () => {
    const fetchListing = mocks.fetch.getMockImplementation()!;
    mocks.fetch.mockImplementation(async (url: string) => url.endsWith("photos_preview")
      ? { ok: false, status: 503 } : fetchListing(url));
    await runCheck();
    expect(mocks.inbox).not.toHaveBeenCalled();
  });

  test("excludes archived albums and system folders before reading their files", async () => {
    archived = { album: "archived" };
    listings[""]!.push(directory("expenses"), directory("qr-moments"));
    await runCheck();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.inbox).not.toHaveBeenCalled();
  });

  test("suppresses unchanged photos for five days but alerts again for newer photos after a day", async () => {
    notification = { notifiedAt: { toMillis: () => NOW.getTime() - 2 * 24 * HOUR }, lastPhotoDate: "2026-10-09T17:40:00Z" };
    await runCheck();
    expect(mocks.inbox).not.toHaveBeenCalled();
    listings["album/photos"] = [photo("2026-10-09T18:00:00Z")];
    vi.setSystemTime(new Date(NOW.getTime() + 15 * 60 * 1000));
    await runCheck();
    expect(mocks.inbox).toHaveBeenCalledTimes(1);
  });

  test("reminds after the five day cooldown", async () => {
    notification = { notifiedAt: { toMillis: () => NOW.getTime() - 121 * HOUR }, lastPhotoDate: "2026-10-09T17:40:00Z" };
    await runCheck();
    expect(mocks.inbox).toHaveBeenCalledTimes(1);
  });

  test("does not mark notified when the inbox write fails, allowing retry", async () => {
    mocks.inbox.mockRejectedValueOnce(new Error("Firestore unavailable"));
    await runCheck();
    expect(mocks.set).not.toHaveBeenCalled();
    await runCheck();
    expect(mocks.inbox).toHaveBeenCalledTimes(2);
    expect(mocks.set).toHaveBeenCalledTimes(1);
  });

  test.each(["http", "network"])("does not misreport a %s failure as a missing ZIP, and checks other albums", async failure => {
    listings[""].push(directory("other"));
    listings.other = listings.album;
    listings["other/photos"] = listings["album/photos"];
    listings["other/photos_preview"] = listings["album/photos_preview"];
    const fetchListing = mocks.fetch.getMockImplementation()!;
    mocks.fetch.mockImplementation(async (url: string) => {
      if (url === "https://storage.test/album") {
        if (failure === "network") throw new Error("network unavailable");
        return { ok: false, status: 503 };
      }
      return fetchListing(url);
    });
    await runCheck();
    expect(mocks.set).toHaveBeenCalledTimes(1);
    expect(mocks.set.mock.calls[0][1]).toBe("other");
    expect(mocks.inbox.mock.calls[0][1].description).not.toContain("Lipsă ZIP");
  });
});
