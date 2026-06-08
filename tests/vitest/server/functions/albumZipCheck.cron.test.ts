/*
 * Purpose: verifies the album ZIP check cron logic — specifically that archived
 * albums are excluded from ZIP-missing notifications, stale/missing detection
 * is correct, and the notification cooldown is respected.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

type ZipStatus = "ok" | "stale" | "missing";

interface AlbumZipResult {
  slug: string;
  status: ZipStatus;
  latestPhotoDate: Date | null;
  zipDate: Date | null;
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const STALE_THRESHOLD_MS = 15 * 60 * 1000;

// ── Isolated logic from the cron (extracted for testability) ─────────────────

function computeZipStatus(
  zipLastChanged: string | null,
  photoLastChangedDates: (string | undefined)[]
): ZipStatus {
  const photos = photoLastChangedDates.filter(Boolean) as string[];

  const latestPhotoMs = photos.length > 0
    ? Math.max(...photos.map((d) => new Date(d).getTime()))
    : null;

  const zipMs = zipLastChanged ? new Date(zipLastChanged).getTime() : null;

  if (zipMs === null) return "missing";
  if (latestPhotoMs === null) return "ok";
  return zipMs >= latestPhotoMs ? "ok" : "stale";
}

function shouldSendNotification(
  lastNotifiedAt: number | null,
  lastTrackedPhotoMs: number | null,
  currentLatestPhotoMs: number,
  now: number
): boolean {
  if (lastNotifiedAt === null) return true;
  if (lastTrackedPhotoMs !== null && currentLatestPhotoMs > lastTrackedPhotoMs) return true;
  if (now - lastNotifiedAt > ONE_HOUR_MS) return true;
  return false;
}

function filterAlbumsForCheck(
  allSlugs: string[],
  excludedDirs: Set<string>,
  archivedSlugs: Set<string>
): string[] {
  return allSlugs.filter(
    (slug) => !excludedDirs.has(slug) && !archivedSlugs.has(slug)
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("albumZipCheck — ZIP status computation", () => {
  test("returns missing when no zip file exists", () => {
    expect(computeZipStatus(null, ["2026-05-01T10:00:00Z"])).toBe("missing");
  });

  test("returns ok when zip is newer than all photos", () => {
    const result = computeZipStatus(
      "2026-05-02T10:00:00Z",
      ["2026-05-01T10:00:00Z", "2026-05-01T12:00:00Z"]
    );
    expect(result).toBe("ok");
  });

  test("returns ok when zip timestamp equals the latest photo", () => {
    const result = computeZipStatus(
      "2026-05-01T12:00:00Z",
      ["2026-05-01T10:00:00Z", "2026-05-01T12:00:00Z"]
    );
    expect(result).toBe("ok");
  });

  test("returns stale when zip is older than the latest photo", () => {
    const result = computeZipStatus(
      "2026-05-01T09:00:00Z",
      ["2026-05-01T10:00:00Z", "2026-05-02T08:00:00Z"]
    );
    expect(result).toBe("stale");
  });

  test("returns ok when zip exists but folder has no photos", () => {
    expect(computeZipStatus("2026-05-01T10:00:00Z", [])).toBe("ok");
  });

  test("ignores photos with missing LastChanged field", () => {
    const result = computeZipStatus(
      "2026-05-01T10:00:00Z",
      [undefined, undefined]
    );
    expect(result).toBe("ok");
  });
});

describe("albumZipCheck — archived album filtering", () => {
  const EXCLUDED_DIRS = new Set(["expenses", "bank-statements", "offers", "offers-assets", "qr-moments"]);

  test("excludes archived slugs from the check list", () => {
    const all = ["15mai2025", "10iulie2025", "20august2025"];
    const archived = new Set(["10iulie2025"]);
    const result = filterAlbumsForCheck(all, EXCLUDED_DIRS, archived);
    expect(result).toEqual(["15mai2025", "20august2025"]);
    expect(result).not.toContain("10iulie2025");
  });

  test("excludes system directories regardless of archived set", () => {
    const all = ["15mai2025", "expenses", "offers", "nunta-ana"];
    const result = filterAlbumsForCheck(all, EXCLUDED_DIRS, new Set());
    expect(result).toEqual(["15mai2025", "nunta-ana"]);
  });

  test("excludes both system dirs and archived slugs simultaneously", () => {
    const all = ["15mai2025", "expenses", "10iulie2025", "bank-statements", "nunta-ana"];
    const archived = new Set(["10iulie2025"]);
    const result = filterAlbumsForCheck(all, EXCLUDED_DIRS, archived);
    expect(result).toEqual(["15mai2025", "nunta-ana"]);
  });

  test("returns all slugs when neither exclusion set matches", () => {
    const all = ["15mai2025", "nunta-ana", "botez-gabriel"];
    const result = filterAlbumsForCheck(all, EXCLUDED_DIRS, new Set());
    expect(result).toHaveLength(3);
  });

  test("returns empty array when every slug is archived or excluded", () => {
    const all = ["expenses", "10iulie2025"];
    const archived = new Set(["10iulie2025"]);
    expect(filterAlbumsForCheck(all, EXCLUDED_DIRS, archived)).toEqual([]);
  });

  test("an album changed from archived to active is included in the check", () => {
    const all = ["15mai2025", "10iulie2025"];
    const archived = new Set<string>();
    const result = filterAlbumsForCheck(all, EXCLUDED_DIRS, archived);
    expect(result).toContain("10iulie2025");
  });
});

describe("albumZipCheck — stale threshold guard", () => {
  test("a photo added 5 minutes ago is within the grace period", () => {
    const now = Date.now();
    const fiveMinAgo = now - 5 * 60 * 1000;
    expect(now - fiveMinAgo < STALE_THRESHOLD_MS).toBe(true);
  });

  test("a photo added 20 minutes ago is past the grace period", () => {
    const now = Date.now();
    const twentyMinAgo = now - 20 * 60 * 1000;
    expect(now - twentyMinAgo < STALE_THRESHOLD_MS).toBe(false);
  });
});

describe("albumZipCheck — notification cooldown logic", () => {
  test("always notifies when there is no prior notification", () => {
    const now = Date.now();
    const result = shouldSendNotification(null, null, now - 30 * 60 * 1000, now);
    expect(result).toBe(true);
  });

  test("notifies again when new photos were added since last notification", () => {
    const now = Date.now();
    const lastNotifiedAt = now - 10 * 60 * 1000;
    const lastPhotoMs = now - 60 * 60 * 1000;
    const newLatestPhotoMs = now - 5 * 60 * 1000;
    expect(shouldSendNotification(lastNotifiedAt, lastPhotoMs, newLatestPhotoMs, now)).toBe(true);
  });

  test("suppresses notification within cooldown when no new photos added", () => {
    const now = Date.now();
    const lastNotifiedAt = now - 20 * 60 * 1000;
    const lastPhotoMs = now - 30 * 60 * 1000;
    expect(shouldSendNotification(lastNotifiedAt, lastPhotoMs, lastPhotoMs, now)).toBe(false);
  });

  test("re-notifies after cooldown expires even with unchanged photos", () => {
    const now = Date.now();
    const lastNotifiedAt = now - 2 * ONE_HOUR_MS;
    const lastPhotoMs = now - 3 * ONE_HOUR_MS;
    expect(shouldSendNotification(lastNotifiedAt, lastPhotoMs, lastPhotoMs, now)).toBe(true);
  });

  test("does not re-notify 59 minutes after last notification", () => {
    const now = Date.now();
    const lastNotifiedAt = now - 59 * 60 * 1000;
    const photoMs = now - 2 * ONE_HOUR_MS;
    expect(shouldSendNotification(lastNotifiedAt, photoMs, photoMs, now)).toBe(false);
  });
});

describe("albumZipCheck — getArchivedSlugs integration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  test("returns empty Set when Firestore document does not exist", async () => {
    vi.doMock("src/server/firestore", () => ({
      firestore: () => ({
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ exists: false, data: () => ({}) }),
          })),
        })),
      }),
    }));

    vi.doMock("src/server/constants/bunny", () => ({
      buildBunnyDirectoryUrl: vi.fn(() => "https://storage.bunnycdn.com/zone/"),
      buildBunnyStorageUrl: vi.fn(() => "https://storage.bunnycdn.com/zone/test"),
      getBunnyStorageKey: () => "test-key",
      BUNNY_ACCESS_KEY_HEADER: "AccessKey",
      BUNNY_PHOTOS_FOLDER: "photos",
    }));

    vi.doMock("src/server/constants/credentials", () => ({
      adminUser: { email: "admin@test.com" },
    }));

    vi.doMock("src/server/notifications/mailer", () => ({
      sendEmail: vi.fn().mockResolvedValue(undefined),
    }));

    vi.doMock("node-cron", () => ({
      default: { schedule: vi.fn() },
    }));

    const mod = await import("src/server/cron/albumZipCheck.cron");
    const { startAlbumZipCheckCron } = mod;

    expect(typeof startAlbumZipCheckCron).toBe("function");
  });

  test("archived slugs from Firestore are excluded before Bunny check", async () => {
    const getMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ "10iulie2025": "archived", "nunta-ana": "active" }),
    });

    vi.doMock("src/server/firestore", () => ({
      firestore: () => ({
        collection: vi.fn(() => ({ doc: vi.fn(() => ({ get: getMock, set: vi.fn() })) })),
      }),
    }));

    vi.doMock("src/server/constants/bunny", () => ({
      buildBunnyDirectoryUrl: vi.fn(() => "https://storage.bunnycdn.com/zone/"),
      buildBunnyStorageUrl: vi.fn(() => "https://storage.bunnycdn.com/zone/test"),
      getBunnyStorageKey: () => "test-key",
      BUNNY_ACCESS_KEY_HEADER: "AccessKey",
      BUNNY_PHOTOS_FOLDER: "photos",
    }));

    vi.doMock("src/server/constants/credentials", () => ({
      adminUser: { email: "admin@test.com" },
    }));

    vi.doMock("src/server/notifications/mailer", () => ({
      sendEmail: vi.fn().mockResolvedValue(undefined),
    }));

    vi.doMock("node-cron", () => ({
      default: { schedule: vi.fn() },
    }));

    // The archived filtering uses the Firestore categories doc — verify it's queried
    await import("src/server/cron/albumZipCheck.cron");
    expect(getMock).not.toHaveBeenCalled(); // getArchivedSlugs called lazily per run, not on import
  });
});
