/*
 * Purpose: verifies the parseDate helper that converts a Romanian-format
 * date string (dd/mm/yyyy) into an ISO date key used for availability checks.
 */
import { describe, expect, test } from "vitest";
import { parseDate } from "../../../server/routes/assistantChat.routes";

describe("parseDate", () => {
  test("converts a valid dd/mm/yyyy string to ISO format", () => {
    expect(parseDate("15/06/2025")).toBe("2025-06-15");
  });

  test("pads single-digit day and month with zeros", () => {
    expect(parseDate("1/1/2025")).toBe("2025-01-01");
  });

  test("returns null for non-date strings", () => {
    expect(parseDate("hello")).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(parseDate("")).toBeNull();
  });

  test("returns null when year is below minimum (2024)", () => {
    expect(parseDate("10/05/2023")).toBeNull();
  });

  test("accepts year exactly at minimum (2024)", () => {
    expect(parseDate("01/01/2024")).toBe("2024-01-01");
  });

  test("returns null for month 0", () => {
    expect(parseDate("10/00/2025")).toBeNull();
  });

  test("returns null for month 13", () => {
    expect(parseDate("10/13/2025")).toBeNull();
  });

  test("returns null for day 0", () => {
    expect(parseDate("00/06/2025")).toBeNull();
  });

  test("accepts day 31 (boundary — calendar validity not checked)", () => {
    expect(parseDate("31/12/2025")).toBe("2025-12-31");
  });

  test("trims surrounding whitespace before parsing", () => {
    expect(parseDate("  5/3/2026  ")).toBe("2026-03-05");
  });
});
