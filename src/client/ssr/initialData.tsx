import { createContext, useContext } from "react";

/** Data the server already loaded for this page (see src/server/ssr/initialData.ts). */
export type InitialData = { slug: string; campaign?: Record<string, unknown>; offer?: Record<string, unknown> };

declare global {
  interface Window { __INITIAL_DATA__?: InitialData }
}

export const InitialDataContext = createContext<InitialData | null>(null);

export const useInitialData = () => useContext(InitialDataContext);

/** In the browser: what the server put in the page (read once, at startup). */
export function readInitialData(): InitialData | null {
  return typeof window === "undefined" ? null : window.__INITIAL_DATA__ ?? null;
}
