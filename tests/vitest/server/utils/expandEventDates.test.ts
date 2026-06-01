/*
 * Purpose: verifies expandEventDates correctly handles single-day events,
 * multi-day ranges, invalid dates, and Firestore Timestamp inputs.
 */
import { describe, expect, test, vi } from "vitest";

const { FakeTimestamp } = vi.hoisted(() => {
  class FakeTimestamp {
    private date: Date;
    constructor(date: Date) { this.date = date; }
    toDate() { return this.date; }
  }
  return { FakeTimestamp };
});

vi.mock("firebase-admin/firestore", () => ({
  Timestamp: FakeTimestamp,
}));

import { expandEventDates } from "src/server/utils/expandEventDates";

describe("expandEventDates", () => {
  test("returns empty array when eventDate is missing", () => {
    expect(expandEventDates({})).toEqual([]);
  });

  test("returns empty array for invalid date string", () => {
    expect(expandEventDates({ eventDate: "not-a-date" })).toEqual([]);
  });

  test("returns single day when only eventDate is present", () => {
    expect(expandEventDates({ eventDate: "2026-07-15" })).toEqual(["2026-07-15"]);
  });

  test("returns single day when eventEndDate equals eventDate", () => {
    expect(expandEventDates({ eventDate: "2026-07-15", eventEndDate: "2026-07-15" })).toEqual(["2026-07-15"]);
  });

  test("returns single day when eventEndDate is before eventDate", () => {
    expect(expandEventDates({ eventDate: "2026-07-15", eventEndDate: "2026-07-10" })).toEqual(["2026-07-15"]);
  });

  test("expands a 3-day range inclusively", () => {
    expect(expandEventDates({ eventDate: "2026-08-01", eventEndDate: "2026-08-03" })).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
    ]);
  });

  test("expands a range that crosses a month boundary", () => {
    expect(expandEventDates({ eventDate: "2026-07-30", eventEndDate: "2026-08-01" })).toEqual([
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
    ]);
  });

  test("accepts Firestore Timestamp for eventDate", () => {
    const ts = new FakeTimestamp(new Date("2026-09-10T00:00:00.000Z"));
    expect(expandEventDates({ eventDate: ts })).toEqual(["2026-09-10"]);
  });

  test("accepts Firestore Timestamp for both dates and expands range", () => {
    const start = new FakeTimestamp(new Date("2026-09-10T00:00:00.000Z"));
    const end = new FakeTimestamp(new Date("2026-09-12T00:00:00.000Z"));
    expect(expandEventDates({ eventDate: start, eventEndDate: end })).toEqual([
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
    ]);
  });

  test("returns empty array when eventDate is null", () => {
    expect(expandEventDates({ eventDate: null })).toEqual([]);
  });
});
