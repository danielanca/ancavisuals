import { useEffect, useState } from "react";
import { DEFAULT_STARTING_PRICES, normalizeStartingPrices, type StartingPrices } from "../../shared/pricing/startingPrices";
import { DEFAULT_PRICE_BOOK, toPriceBook, type PriceBook } from "../../shared/pricing/configuratorPrices";
import { normalizeDatePrices, normalizeSeasons, type DatePrice, type PriceSeason } from "../../shared/pricing/seasonalPricing";
import { normalizeYearPrices, type YearPrices } from "../../shared/pricing/yearPricing";

interface Pricing { book: PriceBook; seasons: PriceSeason[]; datePrices: DatePrice[]; yearPrices: YearPrices }
const DEFAULT_PRICING: Pricing = { book: DEFAULT_PRICE_BOOK, seasons: [], datePrices: [], yearPrices: {} };

let shared: Promise<Pricing> | null = null;

/** One request per page for everything /admin/preturi edits; the defaults show until (or if) it fails. */
function usePrices<T>(pick: (pricing: Pricing) => T, fallback: T): T {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    let active = true;
    shared ??= fetch("/api/starting-prices")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => ({ book: toPriceBook(d?.prices, d?.configurator), seasons: normalizeSeasons(d?.seasons), datePrices: normalizeDatePrices(d?.datePrices), yearPrices: normalizeYearPrices(d?.yearPrices) }))
      .catch(() => { shared = null; return DEFAULT_PRICING; });
    shared.then((pricing) => { if (active) setValue(pick(pricing)); });
    return () => { active = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return value;
}

/** Starting prices from /admin/preturi. */
export function useStartingPrices(): StartingPrices {
  return usePrices(({ book }) => normalizeStartingPrices(book), DEFAULT_STARTING_PRICES);
}

/** Starting prices + the configurator's prices (/oferta/olx), all from /admin/preturi. */
export function usePriceBook(): PriceBook {
  return usePrices(({ book }) => book, DEFAULT_PRICE_BOOK);
}

/** Seasons from /admin/preturi (empty = the same prices all year). */
export function usePriceSeasons(): PriceSeason[] {
  return usePrices(({ seasons }) => seasons, DEFAULT_PRICING.seasons);
}

/** Special weekend prices from the /admin/preturi calendar (added on top of the season). */
export function useDatePrices(): DatePrice[] {
  return usePrices(({ datePrices }) => datePrices, DEFAULT_PRICING.datePrices);
}

/** Prices per event year from /admin/preturi (a year without its own prices uses the standard ones). */
export function useYearPrices(): YearPrices {
  return usePrices(({ yearPrices }) => yearPrices, DEFAULT_PRICING.yearPrices);
}
