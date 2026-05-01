import { describe, expect, test } from "vitest";
import { ALBUM_RETENTION_DAYS, computeAlbumRetention, toDate } from "src/server/services/albumRetention.service";

describe("albumRetention.service", () => {
  test("toDate converts YYYY-MM-DD strings", () => {
    const result = toDate("2026-05-03");

    expect(result).toBeInstanceOf(Date);
    expect(result?.getFullYear()).toBe(2026);
    expect(result?.getMonth()).toBe(4);
    expect(result?.getDate()).toBe(3);
  });

  test("toDate converts Firestore timestamp-like objects", () => {
    const result = toDate({ _seconds: 1777766400 });

    expect(result?.toISOString()).toBe("2026-05-03T00:00:00.000Z");
  });

  test("computeAlbumRetention adds 60 days to the event date", () => {
    const retention = computeAlbumRetention(
      new Date("2026-05-03T10:30:00.000Z"),
      new Date("2026-05-10T10:30:00.000Z"),
    );

    expect(retention).not.toBeNull();
    expect(retention?.expiresAt.toISOString()).toBe("2026-07-02T10:30:00.000Z");
    expect(retention?.remainingMs).toBe((ALBUM_RETENTION_DAYS - 7) * 24 * 60 * 60 * 1000);
    expect(retention?.isExpired).toBe(false);
  });

  test("computeAlbumRetention marks expired albums", () => {
    const retention = computeAlbumRetention(
      "2026-01-01T00:00:00.000Z",
      new Date("2026-03-05T00:00:01.000Z"),
    );

    expect(retention?.isExpired).toBe(true);
    expect(retention?.remainingMs).toBeLessThan(0);
  });
});
