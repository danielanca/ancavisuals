/*
 * Purpose: prices per event year (/admin/preturi) replace the standard prices only for events
 * in that year; other years and an unknown year keep the standard prices.
 */
import { describe, expect, test } from "vitest";
import { DEFAULT_PRICE_BOOK } from "src/shared/pricing/configuratorPrices";
import { DEFAULT_STARTING_PRICES } from "src/shared/pricing/startingPrices";
import { normalizeYearPrices, priceBookForYear, startingPricesForDate, yearOf, yearPricesError } from "src/shared/pricing/yearPricing";

const book2028 = { ...DEFAULT_PRICE_BOOK, nunta: 1150, nunta_foto: 750 };
const years = { 2028: book2028 };

describe("year pricing", () => {
  test("an event in 2028 uses the 2028 book, other years the standard one", () => {
    expect(priceBookForYear(DEFAULT_PRICE_BOOK, years, 2028)).toBe(book2028);
    expect(priceBookForYear(DEFAULT_PRICE_BOOK, years, 2027)).toBe(DEFAULT_PRICE_BOOK);
    expect(priceBookForYear(DEFAULT_PRICE_BOOK, years, null)).toBe(DEFAULT_PRICE_BOOK);
  });

  test("starting prices follow the year of the date", () => {
    expect(startingPricesForDate(DEFAULT_STARTING_PRICES, years, "2028-06-10").nunta).toBe(1150);
    expect(startingPricesForDate(DEFAULT_STARTING_PRICES, years, "2027-06-10")).toBe(DEFAULT_STARTING_PRICES);
    expect(startingPricesForDate(DEFAULT_STARTING_PRICES, years, "")).toBe(DEFAULT_STARTING_PRICES);
  });

  test("yearOf reads dates and plain years", () => {
    expect(yearOf("2028-01-02")).toBe(2028);
    expect(yearOf(2028)).toBe(2028);
    expect(yearOf("bad")).toBeNull();
  });

  test("validation needs a real year and every price", () => {
    expect(yearPricesError(years)).toBeNull();
    expect(yearPricesError({ abc: book2028 })).not.toBeNull();
    expect(yearPricesError({ 2028: { ...book2028, botez: 0 } })).not.toBeNull();
    expect(yearPricesError({ 2028: { ...book2028, fotocabina: 0 } })).toBeNull();
  });

  test("normalize drops bad years and fills missing amounts with the defaults", () => {
    expect(normalizeYearPrices({ 2028: { nunta: 1150 }, nope: {} })).toEqual({ 2028: { ...DEFAULT_PRICE_BOOK, nunta: 1150 } });
    expect(normalizeYearPrices(null)).toEqual({});
  });
});
