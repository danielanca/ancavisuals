import { describe, expect, test } from "vitest";
import { DEFAULT_PRICE_BOOK } from "src/shared/pricing/configuratorPrices";
import { DEFAULT_STARTING_PRICES } from "src/shared/pricing/startingPrices";
import { buildQuote } from "src/shared/pricing/eventConfigurator";
import {
  SEASON_TEMPLATE,
  applySeasonPercent,
  monthOfIsoDate,
  pricesVaryByMonth,
  seasonPercent,
  seasonalPriceBook,
  seasonalStartingPrice,
  seasonsError,
  datePricesError,
  dateFixedPrices,
  isWeekendIsoDate,
  normalizeDatePrices,
  priceDependsOnDate,
  pricePercent,
  type DatePrice,
  type PriceSeason,
} from "src/shared/pricing/seasonalPricing";

const seasons: PriceSeason[] = [
  { id: "low", name: "Extrasezon", months: [1, 2, 3], percent: { nunta: -15, botez: 0, majorat: -10 }, color: 0 },
  { id: "peak", name: "Vârf", months: [8, 9], percent: { nunta: 20, botez: 10, majorat: 0 }, color: 1 },
];

describe("seasonal pricing", () => {
  test("a March wedding and an August wedding get different prices; other months stay standard", () => {
    expect(seasonalStartingPrice("Nuntă", DEFAULT_STARTING_PRICES, seasons, "2027-03-14")).toBe(810);
    expect(seasonalStartingPrice("Nuntă", DEFAULT_STARTING_PRICES, seasons, "2027-08-15")).toBe(1140);
    expect(seasonalStartingPrice("Nuntă", DEFAULT_STARTING_PRICES, seasons, "2027-05-10")).toBe(950);
    expect(seasonalStartingPrice("Botez", DEFAULT_STARTING_PRICES, seasons, "2027-09-01")).toBe(275);
  });

  test("without a date the lowest month is used, so 'de la' is never higher than a real date", () => {
    expect(seasonPercent(seasons, "nunta", null)).toBe(-15);
    expect(seasonPercent(seasons, "botez", null)).toBe(0);
    expect(seasonalStartingPrice("Nuntă", DEFAULT_STARTING_PRICES, seasons, null)).toBe(810);
  });

  test("events without seasons (cununie, corporate/alt) never change", () => {
    expect(seasonPercent(seasons, "alt", 8)).toBe(0);
    expect(seasonalStartingPrice("Cununie civilă", DEFAULT_STARTING_PRICES, seasons, "2027-08-15")).toBe(DEFAULT_STARTING_PRICES.cununie);
    expect(seasonalPriceBook(DEFAULT_PRICE_BOOK, seasons, "alt", 8)).toBe(DEFAULT_PRICE_BOOK);
  });

  test("rounds to 5 €, keeps free extras free and 0% untouched", () => {
    expect(applySeasonPercent(55, 20)).toBe(65);
    expect(applySeasonPercent(0, 20)).toBe(0);
    expect(applySeasonPercent(333, 0)).toBe(333);
  });

  test("the whole configurator quote follows the season, extras included", () => {
    const selection = { event: "nunta" as const, service: "foto_video" as const, extras: ["videobooth" as const], guestTier: 0 };
    const standard = buildQuote(selection, DEFAULT_PRICE_BOOK).total;
    const august = buildQuote(selection, seasonalPriceBook(DEFAULT_PRICE_BOOK, seasons, "nunta", 8)).total;
    expect(standard).toBe(950 + 250);
    expect(august).toBe(1140 + 300);
  });

  test("detects whether the date matters and reads months from ISO dates", () => {
    expect(pricesVaryByMonth(seasons, "nunta")).toBe(true);
    expect(pricesVaryByMonth([], "nunta")).toBe(false);
    expect(monthOfIsoDate("2027-08-08")).toBe(8);
    expect(monthOfIsoDate("")).toBeNull();
  });

  test("the admin template is valid", () => {
    expect(seasonsError(SEASON_TEMPLATE)).toBeNull();
  });
});

describe("special weekend date prices", () => {
  // 2027-08-14 is a Saturday, 2027-08-15 a Sunday, 2027-08-13 a Friday.
  const dates: DatePrice[] = [{ date: "2027-08-14", percent: { nunta: 10, botez: 0 } }];

  test("only real Saturdays and Sundays", () => {
    expect(isWeekendIsoDate("2027-08-14")).toBe(true);
    expect(isWeekendIsoDate("2027-08-15")).toBe(true);
    expect(isWeekendIsoDate("2027-08-13")).toBe(false);
    expect(isWeekendIsoDate("2027-02-30")).toBe(false);
    expect(datePricesError([{ date: "2027-08-13", percent: { nunta: 10, botez: 0 } }])).toMatch(/sâmbete și duminici/);
    expect(datePricesError(dates)).toBeNull();
  });

  test("the date's percent is added on top of its month's season, only on that date and event", () => {
    expect(pricePercent(seasons, dates, "nunta", "2027-08-14")).toBe(30);
    expect(seasonalStartingPrice("Nuntă", DEFAULT_STARTING_PRICES, seasons, "2027-08-14", dates)).toBe(1235);
    expect(seasonalStartingPrice("Nuntă", DEFAULT_STARTING_PRICES, seasons, "2027-08-15", dates)).toBe(1140);
    expect(seasonalStartingPrice("Botez", DEFAULT_STARTING_PRICES, seasons, "2027-08-14", dates)).toBe(275);
    expect(seasonalStartingPrice("Majorat", DEFAULT_STARTING_PRICES, seasons, "2027-08-14", dates)).toBe(DEFAULT_STARTING_PRICES.majorat);
    expect(seasonalPriceBook(DEFAULT_PRICE_BOOK, seasons, "nunta", 8, "2027-08-14", dates).nunta).toBe(1235);
  });

  test("without a day, the price stays 'de la' the cheapest still possible", () => {
    // August without a day: 2027-08-14 costs more, the rest of August is +20 % → lowest is +20 %, but it now varies.
    expect(pricePercent(seasons, dates, "nunta", null, 8)).toBe(20);
    expect(priceDependsOnDate(seasons, dates, "nunta", null, 8)).toBe(true);
    expect(priceDependsOnDate(seasons, [], "nunta", null, 8)).toBe(false);
    expect(priceDependsOnDate(seasons, dates, "nunta", "2027-08-14", 8)).toBe(false);
    const cheaper: DatePrice[] = [{ date: "2027-08-14", percent: { nunta: -30, botez: 0 } }];
    expect(pricePercent(seasons, cheaper, "nunta", null, 8)).toBe(-10);
  });

  test("normalize drops weekdays, duplicates and dates without a change, and sorts", () => {
    expect(normalizeDatePrices([
      { date: "2027-08-15", percent: { nunta: 5, botez: 5 } },
      { date: "2027-08-13", percent: { nunta: 5, botez: 0 } },
      { date: "2027-08-14", percent: { nunta: 10, botez: 0 } },
      { date: "2027-08-14", percent: { nunta: 99, botez: 0 } },
      { date: "2027-08-21", percent: { nunta: 0, botez: 0 } },
      null,
    ])).toEqual([
      { date: "2027-08-14", percent: { nunta: 10, botez: 0 } },
      { date: "2027-08-15", percent: { nunta: 5, botez: 5 } },
    ]);
  });
});

describe("fixed prices on a date (e.g. a booked date offered again)", () => {
  // 2027-08-14 is a Saturday in the +20 % peak; 2027-08-11 a Wednesday.
  const dates: DatePrice[] = [
    { date: "2027-08-14", percent: { nunta: 10, botez: 0 }, fixed: { nunta: 1600, fotocabina: 400 } },
    { date: "2027-08-11", percent: { nunta: 0, botez: 0 }, fixed: { botez: 500 } },
  ];

  test("a fixed price replaces season and weekend percent for that service, on that date only", () => {
    const book = seasonalPriceBook(DEFAULT_PRICE_BOOK, seasons, "nunta", 8, "2027-08-14", dates);
    expect(book.nunta).toBe(1600);
    expect(book.fotocabina).toBe(400);
    // Services without a fixed price keep season + date percent (+30 %).
    expect(book.nunta_foto).toBe(applySeasonPercent(DEFAULT_PRICE_BOOK.nunta_foto, 30));
    expect(seasonalStartingPrice("Nuntă", DEFAULT_STARTING_PRICES, seasons, "2027-08-14", dates)).toBe(1600);
    expect(seasonalStartingPrice("Nuntă", DEFAULT_STARTING_PRICES, seasons, "2027-08-21", dates)).toBe(1140);
  });

  test("fixed prices work on weekdays too", () => {
    expect(datePricesError(dates)).toBeNull();
    expect(seasonalStartingPrice("Botez", DEFAULT_STARTING_PRICES, seasons, "2027-08-11", dates)).toBe(500);
    expect(dateFixedPrices(dates, "2027-08-12")).toEqual({});
  });

  test("validation rejects unknown services, non-integers and a free starting price", () => {
    expect(datePricesError([{ date: "2027-08-11", percent: { nunta: 0, botez: 0 }, fixed: { nunta: 0 } }])).toMatch(/mai mare ca 0/);
    expect(datePricesError([{ date: "2027-08-11", percent: { nunta: 0, botez: 0 }, fixed: { nunta: 10.5 } }])).toMatch(/întreg/);
    expect(datePricesError([{ date: "2027-08-11", percent: { nunta: 0, botez: 0 }, fixed: { bogus: 5 } as never }])).toMatch(/necunoscut/);
    // A free extra is fine.
    expect(datePricesError([{ date: "2027-08-11", percent: { nunta: 0, botez: 0 }, fixed: { fotocabina: 0 } }])).toBeNull();
  });

  test("normalize keeps weekday dates with fixed prices, drops their percent and junk keys", () => {
    expect(normalizeDatePrices([
      { date: "2027-08-11", percent: { nunta: 10, botez: 0 }, fixed: { botez: "500", bogus: 1, nunta: "" } },
      { date: "2027-08-12", percent: { nunta: 0, botez: 0 }, fixed: {} },
    ])).toEqual([{ date: "2027-08-11", percent: { nunta: 0, botez: 0 }, fixed: { botez: 500 } }]);
  });
});
