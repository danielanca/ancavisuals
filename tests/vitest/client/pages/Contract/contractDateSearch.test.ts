import { describe, expect, test } from "vitest";
import { matchesEventDateQuery, parseEventDateQuery } from "src/client/features/admin/components/Contracts/contractDateSearch";

describe("contract event date search", () => {
  test.each(["20 ianuarie", "20 IANUARIE", "20 ian.", "20.1", "20/01"])("reads %s without a year", (text) => {
    expect(parseEventDateQuery(text)).toEqual({ day: 20, month: 1 });
  });
  test.each(["20.1.2026", "20 ianuarie 2026", "20/01/2026", "2026-01-20"])("reads %s with a year", (text) => {
    expect(parseEventDateQuery(text)).toEqual({ day: 20, month: 1, year: 2026 });
  });
  test.each(["", "20", "20 luna", "31 aprilie", "0.1.2026", "20.13.2026", "29.2.2026"])("rejects invalid or incomplete input %s", (text) => {
    expect(parseEventDateQuery(text)).toBeNull();
  });
  test("accepts leap day without a year or in a leap year", () => {
    expect(parseEventDateQuery("29 februarie")).toEqual({ day: 29, month: 2 });
    expect(parseEventDateQuery("29.2.2028")).toEqual({ day: 29, month: 2, year: 2028 });
  });
  test("matches any exact event day and respects the optional year", () => {
    const dates = ["2027-01-18", "2027-01-20T00:00:00.000Z"];
    expect(matchesEventDateQuery(dates, { day: 20, month: 1 })).toBe(true);
    expect(matchesEventDateQuery(dates, { day: 20, month: 1, year: 2026 })).toBe(false);
    expect(matchesEventDateQuery(dates, { day: 19, month: 1 })).toBe(false);
    expect(matchesEventDateQuery([""], { day: 20, month: 1 })).toBe(false);
  });
});
