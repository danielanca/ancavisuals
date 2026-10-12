import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(), sendEmail: vi.fn(), schedule: vi.fn(), get: vi.fn(), set: vi.fn(),
}));

vi.mock("node-fetch", () => ({ default: mocks.fetch }));
vi.mock("node-cron", () => ({ default: { schedule: mocks.schedule } }));
vi.mock("src/server/notifications/mailer", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("src/server/constants/credentials", () => ({ adminUser: { email: "admin@test.com" } }));
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

import { startAlbumZipCheckCron } from "src/server/cron/albumZipCheck.cron";

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
  startAlbumZipCheckCron();
  const callback = mocks.schedule.mock.calls.at(-1)![1] as () => Promise<void>;
  await callback();
}

beforeEach(() => {
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
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("album ZIP notification cron", () => {
  test("checks every five minutes and alerts for a photo newer than ZIP after the quiet period", async () => {
    await runCheck();
    expect(mocks.schedule).toHaveBeenCalledWith("*/5 * * * *", expect.any(Function));
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "admin@test.com", html: expect.stringContaining("ZIP depășit"),
    }));
    expect(mocks.set).toHaveBeenCalledWith("albumZipNotifications", "album", expect.objectContaining({
      notifiedAt: NOW, lastPhotoDate: "2026-10-09T17:40:00.000Z", state: expect.any(String),
    }));
  });

  test("alerts for today's photos and a ten day old ZIP, after uploads settle", async () => {
    listings.album = [zip("2026-09-29T12:00:00Z")];
    listings["album/photos"] = [photo("2026-10-09T17:59:00Z")];
    await runCheck();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    vi.setSystemTime(new Date("2026-10-09T18:14:00Z"));
    await runCheck();
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmail.mock.calls[0][0].html).toContain("ZIP depășit");
  });

  test("each upload during an hour long batch restarts the quiet period", async () => {
    for (let minute = 0; minute <= 60; minute += 5) {
      const uploadTime = new Date(NOW.getTime() + minute * 60 * 1000);
      vi.setSystemTime(uploadTime);
      listings["album/photos"].push(photo(uploadTime.toISOString(), `photo-${minute}.jpg`));
      await runCheck();
    }
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    vi.setSystemTime(new Date(NOW.getTime() + 74 * 60 * 1000));
    await runCheck();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    vi.setSystemTime(new Date(NOW.getTime() + 75 * 60 * 1000));
    await runCheck();
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  test("does not alert if compression finishes during the quiet period", async () => {
    listings["album/photos"] = [photo(NOW.toISOString())];
    await runCheck();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    listings["album/photos_preview"] = [photo(new Date(NOW.getTime() + 2 * 60 * 1000).toISOString(), "photo.webp")];
    listings.album = [zip(new Date(NOW.getTime() + 4 * 60 * 1000).toISOString())];
    vi.setSystemTime(new Date(NOW.getTime() + 20 * 60 * 1000));
    await runCheck();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  test.each(["2026-10-09T17:40:00Z", "2026-10-09T18:00:00Z"])("does not alert for current ZIP %s", async date => {
    listings.album = [zip(date)];
    vi.setSystemTime(new Date(NOW.getTime() + 20 * 60 * 1000));
    await runCheck();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  test("compares the newest photo and reports only photos newer than ZIP", async () => {
    listings["album/photos"] = [photo("2026-10-09T15:00:00Z", "old.jpg"), photo("2026-10-09T17:40:00Z", "new.jpg")];
    listings["album/photos_preview"] = [photo("2026-10-09T15:00:00Z", "old.webp"), photo("2026-10-09T17:40:00Z", "new.webp")];
    await runCheck();
    const html = mocks.sendEmail.mock.calls[0][0].html;
    expect(html).toContain("new.jpg");
    expect(html).not.toContain("old.jpg");
  });

  test("ignores folder timestamps and non-photo files", async () => {
    listings.album = [zip("2026-10-09T18:00:00Z"), { ...directory("photos"), LastChanged: "2026-10-09T19:00:00Z" }];
    listings["album/photos"].push(photo("2026-10-09T19:00:00Z", ".DS_Store"));
    vi.setSystemTime(new Date(NOW.getTime() + 20 * 60 * 1000));
    await runCheck();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  test("alerts for missing ZIP after fifteen quiet minutes", async () => {
    listings.album = [];
    vi.setSystemTime(new Date("2026-10-09T17:50:00Z"));
    await runCheck();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    vi.setSystemTime(NOW);
    await runCheck();
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ html: expect.stringContaining("Lipsă ZIP") }));
  });

  test.each([[], [photo()], [photo("invalid-date")]])("does not notify without usable photo dates: %j", async entries => {
    listings["album/photos"] = entries;
    await runCheck();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  test("alerts when ZIP is newer than photos but older than previews", async () => {
    listings["album/photos"] = [photo("2026-10-09T14:00:00Z")];
    listings["album/photos_preview"] = [photo("2026-10-09T17:40:00Z", "photo.webp")];
    await runCheck();
    expect(mocks.sendEmail.mock.calls[0][0].html).toContain("ZIP depășit");
  });

  test("checks every preview even if the newest preview and ZIP are current", async () => {
    listings["album/photos"] = [photo("2026-10-09T14:00:00Z", "old.jpg"), photo("2026-10-09T15:00:00Z", "new.jpg")];
    listings["album/photos_preview"] = [photo("2026-10-09T13:00:00Z", "old.webp"), photo("2026-10-09T15:10:00Z", "new.webp")];
    listings.album = [zip("2026-10-09T15:20:00Z")];
    await runCheck();
    const html = mocks.sendEmail.mock.calls[0][0].html;
    expect(html).toContain("Preview depășit: old.jpg");
    expect(html).not.toContain("ZIP depășit");
  });

  test("alerts for missing previews even with a current ZIP", async () => {
    delete listings["album/photos_preview"];
    listings.album = [zip("2026-10-09T17:40:00Z")];
    await runCheck();
    expect(mocks.sendEmail.mock.calls[0][0].html).toContain("Lipsă preview: photo.jpg");
  });

  test("waits fifteen minutes after the latest preview change", async () => {
    listings["album/photos_preview"] = [photo("2026-10-09T17:59:00Z", "photo.webp")];
    await runCheck();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    vi.setSystemTime(new Date("2026-10-09T18:14:00Z"));
    await runCheck();
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  test("accepts ordered timestamps including equality", async () => {
    listings.album = [zip("2026-10-09T17:40:00Z")];
    await runCheck();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  test("new preview problems bypass cooldown once, then unchanged state is suppressed", async () => {
    listings.album = [zip("2026-10-09T17:40:00Z")];
    listings["album/photos_preview"] = [];
    await runCheck();
    const data = mocks.set.mock.calls[0][2];
    notification = { ...data, notifiedAt: { toMillis: () => NOW.getTime() } };
    await runCheck();
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    listings["album/photos_preview"] = [photo("2026-10-09T17:45:00Z", "photo.webp")];
    await runCheck();
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
    expect(mocks.sendEmail.mock.calls[1][0].html).toContain("ZIP depășit");
  });

  test("a preview listing error is skipped rather than reported as missing previews", async () => {
    const fetchListing = mocks.fetch.getMockImplementation()!;
    mocks.fetch.mockImplementation(async (url: string) => url.endsWith("photos_preview")
      ? { ok: false, status: 503 } : fetchListing(url));
    await runCheck();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  test("excludes archived albums and system folders before reading their files", async () => {
    archived = { album: "archived" };
    listings[""]!.push(directory("expenses"), directory("qr-moments"));
    await runCheck();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  test("suppresses unchanged photos for five days but alerts again for newer photos", async () => {
    notification = { notifiedAt: { toMillis: () => NOW.getTime() - HOUR }, lastPhotoDate: "2026-10-09T17:40:00Z" };
    await runCheck();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    listings["album/photos"] = [photo("2026-10-09T18:00:00Z")];
    vi.setSystemTime(new Date(NOW.getTime() + 15 * 60 * 1000));
    await runCheck();
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  test("reminds after the five day cooldown", async () => {
    notification = { notifiedAt: { toMillis: () => NOW.getTime() - 121 * HOUR }, lastPhotoDate: "2026-10-09T17:40:00Z" };
    await runCheck();
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  test("does not mark notified when sending fails, allowing retry", async () => {
    mocks.sendEmail.mockRejectedValueOnce(new Error("SMTP unavailable"));
    await runCheck();
    expect(mocks.set).not.toHaveBeenCalled();
    await runCheck();
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
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
    expect(mocks.sendEmail.mock.calls[0][0].html).not.toContain("Lipsă ZIP");
  });
});
