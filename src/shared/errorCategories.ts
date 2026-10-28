/*
 * Purpose: sort the errors in `serverErrors` into categories for /admin/errors, and give each
 * kind of error a fingerprint so the same error seen by many visitors counts as one type
 * (used for the "new error" email and for grouping in the admin page).
 */

export const ERROR_CATEGORIES = [
  "chunk",
  "network",
  "hydration",
  "image",
  "slow-load",
  "qr",
  "not-found",
  "promise",
  "js",
  "server",
] as const;

export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

export const ERROR_CATEGORY_LABELS: Record<ErrorCategory, string> = {
  chunk: "Fișier JS neîncărcat (după deploy)",
  network: "Rețea / API",
  hydration: "Hidratare React (SSR)",
  image: "Imagini",
  "slow-load": "Încărcare lentă",
  qr: "QR Moments",
  "not-found": "404",
  promise: "Promise nerezolvat",
  js: "Eroare JavaScript",
  server: "Server",
};

/** Errors the visitor's browser causes, not our code: extensions, in-app browsers, bots. */
const NOISE_PATTERNS = [
  /chrome-extension:\/\//,
  /moz-extension:\/\//,
  /safari(-web)?-extension:\/\//,
  /Extension context invalidated/,
  /^Script error\.?$/m,
  /ResizeObserver loop/,
  /instantSearchSDKJSBridgeClearHighlight/,
  /__gCrWeb/,
  // Crypto-wallet scripts injected by the browser (Brave on iPhone); the site never uses it.
  /window\.ethereum/,
  // Facebook / Instagram in-app browser (Android): its own logger scripts (iabjs://) fail when
  // the app closes the page — "Error invoking postMessage: Java object is gone".
  /iabjs:\/\//,
  /Java object is gone/,
];

export function isNoiseError(message: string, stack = ""): boolean {
  const combined = `${message}\n${stack}`;
  // A JS file of an older deploy (owner, 2026-10-28: not the site's fault, do not show it) — the
  // visitor's page reloads itself once (ChunkErrorBoundary in App.tsx).
  return NOISE_PATTERNS.some((pattern) => pattern.test(combined)) || isChunkLoadError(combined);
}

/**
 * A JS file of an older deploy is gone (the page was open while we deployed). Each browser words
 * it differently: Chrome "Failed to fetch dynamically imported module", Safari "Importing a module
 * script failed.", Firefox "error loading dynamically imported module".
 */
export function isChunkLoadError(text: string): boolean {
  return /Loading (CSS )?chunk|dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError/i.test(text);
}

export function categorizeError(input: { message: string; stack?: string; page?: string; source?: string }): ErrorCategory {
  const message = input.message ?? "";
  const stack = input.stack ?? "";
  const page = input.page ?? "";
  if (input.source === "server") return "server";
  if (message.startsWith("[404]")) return "not-found";
  const text = `${message}\n${stack}`;
  // Before "qr": a page left open over a deploy fails the same way on a QR page — it is not an upload problem.
  if (isChunkLoadError(text)) return "chunk";
  if (message.startsWith("[QR DEBUG]") || page.startsWith("/qr-moments/")) return "qr";
  if (message.startsWith("[SLOW LOAD]")) return "slow-load";
  if (message.startsWith("[IMAGE LOAD FAILED]")) return "image";
  if (/Minified React error #(418|419|421|422|423|425)|hydrat/i.test(text)) return "hydration";
  if (/Failed to fetch|NetworkError|Load failed|network error|ERR_NETWORK|timeout/i.test(message)) return "network";
  if (message.startsWith("Unhandled Promise Rejection")) return "promise";
  return "js";
}

/**
 * The same error from different visitors gives the same fingerprint: numbers, ids, hashes
 * and URLs are blanked, and the page is reduced to its first path segment.
 */
export function errorFingerprint(category: ErrorCategory, message: string, page = ""): string {
  const normalized = message
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/[0-9a-f]{8,}/gi, "<id>")
    .replace(/\d+/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  const section = page.split("/").filter(Boolean)[0] ?? "";
  return `${category}|/${section}|${normalized}`;
}
