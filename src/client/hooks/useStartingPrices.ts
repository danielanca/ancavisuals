import { useEffect, useState } from "react";
import { DEFAULT_STARTING_PRICES, normalizeStartingPrices, type StartingPrices } from "../../shared/pricing/startingPrices";
import { DEFAULT_PRICE_BOOK, toPriceBook, type PriceBook } from "../../shared/pricing/configuratorPrices";

let shared: Promise<PriceBook> | null = null;

/** One request per page for everything /admin/preturi edits; the defaults show until (or if) it fails. */
function usePrices<T>(pick: (book: PriceBook) => T, fallback: T): T {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    let active = true;
    shared ??= fetch("/api/starting-prices")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => toPriceBook(d?.prices, d?.configurator))
      .catch(() => { shared = null; return DEFAULT_PRICE_BOOK; });
    shared.then((book) => { if (active) setValue(pick(book)); });
    return () => { active = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return value;
}

/** Starting prices from /admin/preturi. */
export function useStartingPrices(): StartingPrices {
  return usePrices((book) => normalizeStartingPrices(book), DEFAULT_STARTING_PRICES);
}

/** Starting prices + the configurator's prices (/oferta/olx), all from /admin/preturi. */
export function usePriceBook(): PriceBook {
  return usePrices((book) => book, DEFAULT_PRICE_BOOK);
}
