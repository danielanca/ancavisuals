export interface ReferralVisit {
  id: string;
  sessionId: string;
  visitorId: string;
  timestamp: string;
  page: string;
  referrer: string;
  utmSource?: string;
}

export function normalizeTrafficSource(value: string): string {
  const text = value.trim().toLowerCase();
  try {
    return new URL(text.includes("://") ? text : `https://${text}`).hostname.replace(/^www\./, "");
  } catch { return text; }
}

function externalSource(visit: ReferralVisit): string {
  if (visit.utmSource?.trim()) {
    const source = normalizeTrafficSource(visit.utmSource);
    return source === "direct" ? "" : source;
  }
  try {
    const url = new URL(visit.referrer);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    const host = normalizeTrafficSource(url.hostname);
    return host === "ancavisuals.ro" || host.endsWith(".ancavisuals.ro") || host === "localhost" ? "" : host;
  } catch { return ""; }
}

/** Attribute a session once using its earliest recorded page; include all its pages in the selected period. */
export function referralTraffic(visits: ReferralVisit[], cutoff: Date) {
  const sessions = new Map<string, ReferralVisit[]>();
  for (const visit of visits) {
    const key = visit.sessionId || visit.id;
    const pages = sessions.get(key) ?? [];
    pages.push(visit);
    sessions.set(key, pages);
  }
  const sources = new Map<string, { source: string; visitors: Set<string>; sessions: number; pageViews: number; pages: Map<string, number> }>();
  for (const [sessionId, visitsInSession] of sessions) {
    const ordered = [...visitsInSession].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const source = externalSource(ordered[0]);
    const pages = ordered.filter((visit) => new Date(visit.timestamp) >= cutoff);
    if (!source || !pages.length) continue;
    const row = sources.get(source) ?? { source, visitors: new Set<string>(), sessions: 0, pageViews: 0, pages: new Map<string, number>() };
    row.visitors.add(ordered[0].visitorId || sessionId);
    row.sessions++;
    row.pageViews += pages.length;
    for (const page of pages) row.pages.set(page.page, (row.pages.get(page.page) ?? 0) + 1);
    sources.set(source, row);
  }
  return [...sources.values()].map((row) => ({
    source: row.source,
    visitors: row.visitors.size,
    sessions: row.sessions,
    pageViews: row.pageViews,
    pages: [...row.pages].map(([page, count]) => ({ page, count })).sort((a, b) => b.count - a.count || a.page.localeCompare(b.page)),
  })).sort((a, b) => b.visitors - a.visitors || b.sessions - a.sessions || a.source.localeCompare(b.source));
}
