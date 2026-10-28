import { createContext, useContext } from "react";
import type { PriceBook } from "../../shared/pricing/configuratorPrices";

/** Data the server already loaded for this page (see src/server/ssr/initialData.ts). */
// `priceBook`: the /admin/preturi prices, for pages that show them in the first HTML (city pages).
export type InitialData = { slug: string; campaign?: Record<string, unknown>; offer?: Record<string, unknown>; priceBook?: PriceBook };

declare global {
  interface Window { __INITIAL_DATA__?: InitialData }
}

export const InitialDataContext = createContext<InitialData | null>(null);

export const useInitialData = () => useContext(InitialDataContext);

/** In the browser: what the server put in the page (read once, at startup). */
export function readInitialData(): InitialData | null {
  return typeof window === "undefined" ? null : window.__INITIAL_DATA__ ?? null;
}
