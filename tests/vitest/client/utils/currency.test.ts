/*
 * Purpose: covers EUR conversion logic used in the admin event creation form.
 */
import { describe, expect, test } from "vitest";
import { convertToEur, parseAmount } from "src/client/utils/currency";

describe("parseAmount", () => {
  test("parses a plain number string", () => {
    expect(parseAmount("1500")).toBe(1500);
  });

  test("treats comma as decimal separator", () => {
    expect(parseAmount("1500,50")).toBe(1500.5);
  });

  test("parses decimal with dot", () => {
    expect(parseAmount("99.99")).toBe(99.99);
  });

  test("returns NaN for empty string", () => {
    expect(parseAmount("")).toBeNaN();
  });
});

describe("convertToEur", () => {
  test("returns the same value when currency is EUR", () => {
    expect(convertToEur(1500, "EUR", 5)).toBe(1500);
  });

  test("converts RON to EUR using the given exchange rate", () => {
    expect(convertToEur(7650, "RON", 5.1)).toBe(1500);
  });

  test("rounds to 2 decimal places", () => {
    expect(convertToEur(100, "RON", 3)).toBe(33.33);
  });

  test("returns null for zero amount", () => {
    expect(convertToEur(0, "RON", 5)).toBeNull();
  });

  test("returns null for negative amount", () => {
    expect(convertToEur(-100, "RON", 5)).toBeNull();
  });

  test("returns null for NaN amount", () => {
    expect(convertToEur(NaN, "RON", 5)).toBeNull();
  });

  test("returns null when exchange rate is zero", () => {
    expect(convertToEur(1000, "RON", 0)).toBeNull();
  });

  test("returns null when exchange rate is negative", () => {
    expect(convertToEur(1000, "RON", -5)).toBeNull();
  });

  test("returns null when exchange rate is NaN", () => {
    expect(convertToEur(1000, "RON", NaN)).toBeNull();
  });
});
