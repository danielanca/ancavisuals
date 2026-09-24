export const LIVE_TIMEOUT_MS = 75_000;
export const LIVE_IDLE_MS = 60_000;
export const VISITS_TIME_ZONE = "Europe/Bucharest";

export function visitDay(timestamp = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: VISITS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(timestamp);
}

/** Local midnight boundaries, including Romania's 23/25-hour DST days. */
export function visitDayBounds(day: string): { start: number; end: number } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("invalid_date");
  const utc = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(utc) || new Date(utc).toISOString().slice(0, 10) !== day) throw new Error("invalid_date");
  const midnight = (target: number) => {
    let guess = target;
    for (let i = 0; i < 3; i++) {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: VISITS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
      }).formatToParts(guess);
      const n = (key: string) => Number(parts.find((p) => p.type === key)?.value);
      const local = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
      guess += target - local;
    }
    return guess;
  };
  return { start: midnight(utc), end: midnight(utc + 86_400_000) };
}

export interface VisitPresence {
  firstSeenAt: number;
  lastSeenAt: number;
  lastEventAt: number;
  endedAt: number | null;
  idle: boolean;
  visibility?: "visible" | "hidden";
  durationSeconds?: number;
}

export function visitStatus(s: VisitPresence, now = Date.now()): "active" | "idle" | "hidden" | "ended" {
  if (s.endedAt || now - s.lastSeenAt > LIVE_TIMEOUT_MS) return "ended";
  if (s.visibility === "hidden") return "hidden";
  return s.idle || now - s.lastEventAt > LIVE_IDLE_MS ? "idle" : "active";
}

/** Elapsed observed session time, never an estimate of attention or reading time. */
export function observedDuration(s: VisitPresence): number {
  if (s.endedAt && Number.isFinite(s.durationSeconds)) return Math.max(0, s.durationSeconds ?? 0);
  return Math.max(0, Math.round((s.lastSeenAt - s.firstSeenAt) / 1000));
}

export type VisitSource = "google_ads" | "organic" | "instagram" | "facebook" | "tiktok" | "ai" | "referral" | "direct";
export interface VisitAttribution {
  gclid?: string; wbraid?: string; gbraid?: string; gadSource?: string;
  utmSource?: string; utmMedium?: string; utmCampaign?: string; referrer?: string; landingPath?: string;
}
const sourceHost = (value: string) => value === "instagram.com" || value.endsWith(".instagram.com") ? "instagram"
  : value === "facebook.com" || value.endsWith(".facebook.com") || value === "fb.com" ? "facebook"
  : value === "tiktok.com" || value.endsWith(".tiktok.com") ? "tiktok"
  : /^(chatgpt\.com|chat\.openai\.com|claude\.ai|gemini\.google\.com|perplexity\.ai|grok\.com|copilot\.microsoft\.com)$/.test(value) ? "ai"
  : /^(www\.)?(google\.(com|ro|[a-z]{2}|co\.[a-z]{2})|bing\.com|search\.yahoo\.com|duckduckgo\.com|ecosia\.org)$/.test(value) ? "organic" : null;

/** Explicit campaign attribution wins over the referrer. Page content never proves a source. */
export function visitSource(attr: VisitAttribution, legacyGoogleAds = false): VisitSource {
  const src = (attr.utmSource ?? "").trim().toLowerCase();
  const med = (attr.utmMedium ?? "").trim().toLowerCase();
  if (attr.gclid || attr.wbraid || attr.gbraid || legacyGoogleAds ||
    (["google", "adwords"].includes(src) && ["cpc", "ppc", "paid", "paidsearch", "sem"].includes(med))) return "google_ads";
  if (src) {
    if (["instagram", "ig"].includes(src)) return "instagram";
    if (["facebook", "fb"].includes(src)) return "facebook";
    if (src === "tiktok") return "tiktok";
    if (["chatgpt", "claude", "gemini", "perplexity", "grok", "copilot"].includes(src)) return "ai";
    if (["google", "bing", "yahoo", "duckduckgo"].includes(src) && (!med || med === "organic")) return "organic";
    return sourceHost(src.replace(/^www\./, "")) ?? (src === "direct" ? "direct" : "referral");
  }
  try {
    const host = new URL(attr.referrer ?? "").hostname.toLowerCase().replace(/^www\./, "");
    const known = sourceHost(host);
    if (known) return known;
    if (host !== "ancavisuals.ro" && !host.endsWith(".ancavisuals.ro") && host !== "localhost") return "referral";
  } catch { /* no external referrer */ }
  return "direct";
}

export function isAlbumVisit(session: { currentPage: string; path: { page: string }[]; attribution: VisitAttribution; audience?: string }): boolean {
  return session.audience === "client" || [session.currentPage, session.attribution.landingPath ?? "", ...session.path.map((p) => p.page)]
    .some((page) => /^\/media(?:\/|\?|$)/.test(page));
}

export interface DailyVisitorRecord {
  sessionId: string;
  visitorId?: string;
  firstSeenAt: number;
}

/** Assign one stable number per browser visitor for the selected calendar day. */
export function numberDailyVisitors(records: DailyVisitorRecord[]): Record<string, number> {
  const ordered = [...records].sort((a, b) => a.firstSeenAt - b.firstSeenAt || a.sessionId.localeCompare(b.sessionId));
  const result: Record<string, number> = {};
  const numbers = new Map<string, number>();
  let next = 0;
  for (const record of ordered) {
    const visitorId = record.visitorId?.trim();
    const identity = visitorId ? `visitor:${visitorId}` : `session:${record.sessionId}`;
    if (!numbers.has(identity)) numbers.set(identity, ++next);
    result[`session:${record.sessionId}`] = numbers.get(identity)!;
    if (visitorId) result[`visitor:${visitorId}`] = numbers.get(identity)!;
  }
  return result;
}
