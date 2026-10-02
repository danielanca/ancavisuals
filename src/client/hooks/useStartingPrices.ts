import { useEffect, useState } from "react";
import { DEFAULT_STARTING_PRICES, normalizeStartingPrices, type StartingPrices } from "../../shared/pricing/startingPrices";

let shared: Promise<StartingPrices> | null = null;

/** Starting prices from /admin/preturi; the defaults show until (or if) the request fails. */
export function useStartingPrices(): StartingPrices {
  const [prices, setPrices] = useState<StartingPrices>(DEFAULT_STARTING_PRICES);
  useEffect(() => {
    let active = true;
    shared ??= fetch("/api/starting-prices")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => normalizeStartingPrices(d?.prices))
      .catch(() => { shared = null; return DEFAULT_STARTING_PRICES; });
    shared.then((p) => { if (active) setPrices(p); });
    return () => { active = false; };
  }, []);
  return prices;
}
