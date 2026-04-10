/*
 * Purpose: covers booked-date loading, range expansion, caching and safe fallback
 * behavior when the booked-dates storage file is unavailable.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

type MockFileData = {
  updatedAt?: string;
  dates: Array<
    | { date: string; status?: string }
    | { startDate: string; endDate: string; status?: string }
  >;
};

const loadBookedDatesModule = async (fileData: MockFileData | Error) => {
  const downloadMock = vi.fn();
  const fileMock = vi.fn(() => ({ download: downloadMock }));
  const bucketMock = vi.fn(() => ({ file: fileMock }));
  const firestoreMock = vi.fn();

  if (fileData instanceof Error) {
    downloadMock.mockRejectedValue(fileData);
  } else {
    downloadMock.mockResolvedValue([Buffer.from(JSON.stringify(fileData), "utf8")]);
  }

  vi.doMock("firebase-admin/storage", () => ({
    getStorage: () => ({
      bucket: bucketMock,
    }),
  }));

  vi.doMock("../../../server/firestoreInit", () => ({
    firestore: firestoreMock,
  }));

  vi.doMock("../../../server/constants/firebase", () => ({
    FIREBASE_STORAGE_BUCKET: "test-bucket",
    BOOKED_DATES_FILE_PATH: "ancavisuals/bookedDates/bookedDates.json",
  }));

  const module = await import("../../../server/utils/bookedDates");

  return { module, downloadMock, fileMock, bucketMock, firestoreMock };
};

describe("bookedDates utils", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("loads single dates and expands date ranges into individual keys", async () => {
    const { module, downloadMock, fileMock, bucketMock, firestoreMock } = await loadBookedDatesModule({
      dates: [
        { date: "2026-05-16" },
        { startDate: "2026-05-20", endDate: "2026-05-22" },
      ],
    });

    await expect(module.loadBookedDates()).resolves.toEqual(
      new Set(["2026-05-16", "2026-05-20", "2026-05-21", "2026-05-22"]),
    );

    expect(firestoreMock).toHaveBeenCalledOnce();
    expect(bucketMock).toHaveBeenCalledWith("test-bucket");
    expect(fileMock).toHaveBeenCalledWith("ancavisuals/bookedDates/bookedDates.json");
    expect(downloadMock).toHaveBeenCalledOnce();
  });

  test("ignores invalid range dates", async () => {
    const { module } = await loadBookedDatesModule({
      dates: [
        { startDate: "bad-date", endDate: "2026-05-22" },
        { startDate: "2026-05-24", endDate: "also-bad" },
        { date: "2026-05-30" },
      ],
    });

    await expect(module.loadBookedDates()).resolves.toEqual(new Set(["2026-05-30"]));
  });

  test("checks bookings by string and Date inputs", async () => {
    const { module } = await loadBookedDatesModule({
      dates: [{ date: "2026-06-01" }],
    });

    await expect(module.isDateBooked("2026-06-01")).resolves.toBe(true);
    await expect(module.isDateBooked(new Date("2026-06-01T12:00:00Z"))).resolves.toBe(true);
    await expect(module.isDateBooked("2026-06-02")).resolves.toBe(false);
  });

  test("caches loaded dates to avoid repeated storage downloads", async () => {
    const { module, downloadMock } = await loadBookedDatesModule({
      dates: [{ date: "2026-07-10" }],
    });

    await module.loadBookedDates();
    await module.loadBookedDates();

    expect(downloadMock).toHaveBeenCalledOnce();
  });

  test("returns an empty set when the storage file cannot be loaded", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { module } = await loadBookedDatesModule(new Error("storage offline"));

    await expect(module.loadBookedDates()).resolves.toEqual(new Set());
    await expect(module.isDateBooked("2026-08-01")).resolves.toBe(false);
    expect(consoleError).toHaveBeenCalled();
  });
});
