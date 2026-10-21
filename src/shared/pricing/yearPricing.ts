import { CONFIGURATOR_PRICE_FIELDS, isValidConfiguratorPrice, toPriceBook, type PriceBook } from "./configuratorPrices";
import { normalizeStartingPrices, STARTING_PRICE_TYPES, type StartingPrices } from "./startingPrices";

// Prices per year of the EVENT, edited in /admin/preturi (Firestore
// `settings/startingPrices.yearPrices`): e.g. weddings in 2028 cost more. A year has a complete
// price book (starting prices + configurator) that replaces the standard one for events in that
// year; seasons and special dates still apply on top. Years without their own prices = standard.

export const MAX_PRICE_YEARS = 10;
export type YearPrices = Record<string, PriceBook>;

const BOOK_KEYS = [...STARTING_PRICE_TYPES.map((t) => t.key), ...CONFIGURATOR_PRICE_FIELDS.map((f) => f.key)] as (keyof PriceBook)[];
const STARTING_KEYS = new Set<string>(STARTING_PRICE_TYPES.map((t) => t.key));

export const isPriceYear = (value: unknown): boolean => {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2024 && year <= 2100;
};

/** Year of a YYYY-MM-DD date (or a plain year number), or null. */
export function yearOf(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return isPriceYear(value) ? value : null;
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(value ?? "");
  return match && isPriceYear(match[1]) ? Number(match[1]) : null;
}

/** The price book for events in `year`: that year's prices, otherwise the standard ones. */
export function priceBookForYear(standard: PriceBook, yearPrices: YearPrices, year: number | null | undefined): PriceBook {
  return (year && yearPrices[String(year)]) || standard;
}

/** The starting prices ("de la") for an event on `isoDate`: that year's, otherwise `standard`. */
export function startingPricesForDate(standard: StartingPrices, yearPrices: YearPrices, isoDate: string | null | undefined): StartingPrices {
  const book = yearPrices[String(yearOf(isoDate))];
  return book ? normalizeStartingPrices(book) : standard;
}

/** Why the year prices can't be saved, or null. Used by the PUT route and the admin form. */
export function yearPricesError(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "Prețurile pe ani trebuie să fie un obiect.";
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > MAX_PRICE_YEARS) return `Maximum ${MAX_PRICE_YEARS} ani cu prețuri proprii.`;
  for (const [year, book] of entries) {
    if (!isPriceYear(year)) return `An invalid: ${year}.`;
    const source = (book ?? {}) as Record<string, unknown>;
    for (const key of BOOK_KEYS) {
      const value = source[key];
      const ok = value !== undefined && value !== null && value !== "" && isValidConfiguratorPrice(Number(value))
        && (!STARTING_KEYS.has(key) || Number(value) > 0);
      if (!ok) return `${year}: preț invalid (${labelOf(key)}).`;
    }
  }
  return null;
}

/** Stored data → year prices; drops invalid years, missing amounts fall back to the defaults. */
export function normalizeYearPrices(raw: unknown): YearPrices {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const years = Object.keys(raw as Record<string, unknown>).filter(isPriceYear).sort().slice(0, MAX_PRICE_YEARS);
  return Object.fromEntries(years.map((year) => {
    const book = ((raw as Record<string, unknown>)[year] ?? {}) as Record<string, unknown>;
    return [year, toPriceBook(book, book)];
  }));
}

function labelOf(key: string): string {
  const starting = STARTING_PRICE_TYPES.find((t) => t.key === key);
  if (starting) return `${starting.label} · pornire`;
  const field = CONFIGURATOR_PRICE_FIELDS.find((f) => f.key === key);
  return field ? `${field.group} · ${field.label}` : key;
}
