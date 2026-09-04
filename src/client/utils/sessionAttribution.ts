import { isBrowser } from "./functions";

const LANDING_KEY = "av_landing_meta";

export interface LandingMeta {
  landingPath: string;
  referrer: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  keyword?: string;
}

/**
 * Captures the first page + referrer/UTM/query the visitor arrived with, once
 * per browser session. Client-side navigation doesn't reset document.referrer,
 * but a hard refresh later in the session would — so we snapshot it here.
 */
export function captureLandingMeta(): void {
  if (!isBrowser()) return;
  try {
    if (sessionStorage.getItem(LANDING_KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const meta: LandingMeta = {
      landingPath: window.location.pathname + window.location.search,
      referrer: document.referrer || "direct",
      utmSource: params.get("utm_source")?.trim() || undefined,
      utmMedium: params.get("utm_medium")?.trim() || undefined,
      utmCampaign: params.get("utm_campaign")?.trim() || undefined,
      utmTerm: params.get("utm_term")?.trim() || undefined,
      keyword: params.get("q")?.trim() || params.get("query")?.trim() || undefined,
    };
    sessionStorage.setItem(LANDING_KEY, JSON.stringify(meta));
  } catch {
    // sessionStorage unavailable — silently skip
  }
}

export function getLandingMeta(): LandingMeta | null {
  if (!isBrowser()) return null;
  try {
    const stored = sessionStorage.getItem(LANDING_KEY);
    return stored ? (JSON.parse(stored) as LandingMeta) : null;
  } catch {
    return null;
  }
}
