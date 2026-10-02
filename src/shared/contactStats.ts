import { eventTypeLabel } from "./eventTypes";
import { visitDay, visitSource, type VisitAttribution, type VisitSource } from "./liveVisits";

export const CONTACT_METRICS = ["whatsapp", "phone_shown", "phone_call", "availability"] as const;
export type ContactMetric = (typeof CONTACT_METRICS)[number];

export interface ContactCount {
  /** Every click, including repeats by the same person. */
  clicks: number;
  /** Distinct browsers (visitorId, or sessionId when it is missing). */
  visitors: number;
}

export type ContactCounts = Record<ContactMetric, ContactCount>;

export interface ContactStats {
  sessions: number;
  visitors: number;
  totals: ContactCounts;
  bySource: Partial<Record<VisitSource, { visitors: number; counts: ContactCounts }>>;
  byDay: { day: string; counts: ContactCounts }[];
  byPage: { page: string; counts: ContactCounts }[];
  /** Availability checks split by event type ("Nuntă", "Botez"…, or "Nespecificat"). */
  availabilityByEventType: { eventType: string; checks: ContactCount }[];
}

export const UNSPECIFIED_EVENT_TYPE = "Nespecificat";

export interface ContactStatsSession {
  sessionId: string;
  visitorId?: string;
  startedAtMs?: number;
  firstSeenAt?: number;
  attribution?: VisitAttribution;
  isGoogleAds?: boolean;
  events?: { name: string; at?: number; page?: string; label?: string; meta?: Record<string, unknown> }[];
}

// "Afișează numărul" is a plain button, so the live tracker records it as element_clicked with its text.
const PHONE_SHOWN_LABEL = /afi[sș]eaz[aă]\s+num[aă]rul/i;

/** Maps one recorded live event to the contact action it represents, if any. */
export function contactMetric(event: { name: string; label?: string; meta?: Record<string, unknown> }): ContactMetric | null {
  switch (event.name) {
    case "whatsapp_clicked": return "whatsapp";
    case "phone_revealed": return "phone_call"; // tap on a tel: link
    case "availability_checked": return "availability";
    case "element_clicked": {
      const text = typeof event.meta?.text === "string" ? event.meta.text : event.label ?? "";
      return PHONE_SHOWN_LABEL.test(text) ? "phone_shown" : null;
    }
    default: return null;
  }
}

const emptyCounts = (): ContactCounts =>
  Object.fromEntries(CONTACT_METRICS.map((m) => [m, { clicks: 0, visitors: 0 }])) as ContactCounts;

/** Clicks plus distinct visitors per metric, tracked by a Set per bucket. */
class Bucket {
  counts = emptyCounts();
  private seen = new Map<ContactMetric, Set<string>>();
  add(metric: ContactMetric, who: string) {
    this.counts[metric].clicks++;
    const set = this.seen.get(metric) ?? new Set<string>();
    if (!set.has(who)) { set.add(who); this.counts[metric].visitors++; }
    this.seen.set(metric, set);
  }
}

const cleanPage = (page: string) => (page || "/").replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";

export function summarizeContactStats(sessions: ContactStatsSession[]): ContactStats {
  const total = new Bucket();
  const sources = new Map<VisitSource, { bucket: Bucket; visitors: Set<string> }>();
  const days = new Map<string, Bucket>();
  const pages = new Map<string, Bucket>();
  const allVisitors = new Set<string>();
  const eventTypes = new Map<string, Bucket>();

  for (const s of sessions) {
    const who = s.visitorId?.trim() || `session:${s.sessionId}`;
    allVisitors.add(who);
    const source = visitSource(s.attribution ?? {}, Boolean(s.isGoogleAds));
    const src = sources.get(source) ?? { bucket: new Bucket(), visitors: new Set<string>() };
    src.visitors.add(who);
    sources.set(source, src);
    const fallbackAt = Number(s.firstSeenAt ?? s.startedAtMs ?? Date.now());
    // The /contact configurator checks the date first and reports the type afterwards.
    const sessionType = [...(s.events ?? [])].reverse()
      .map((e) => (e.name === "event_type_selected" ? eventTypeLabel(e.meta?.eventType) : null))
      .find(Boolean) ?? null;

    for (const event of s.events ?? []) {
      const metric = contactMetric(event);
      if (!metric) continue;
      total.add(metric, who);
      src.bucket.add(metric, who);
      const day = visitDay(Number(event.at ?? fallbackAt));
      if (!days.has(day)) days.set(day, new Bucket());
      days.get(day)!.add(metric, who);
      if (metric === "availability") {
        const type = eventTypeLabel(event.meta?.eventType) ?? sessionType ?? UNSPECIFIED_EVENT_TYPE;
        if (!eventTypes.has(type)) eventTypes.set(type, new Bucket());
        eventTypes.get(type)!.add(metric, who);
      }
      const page = cleanPage(event.page ?? "");
      if (!pages.has(page)) pages.set(page, new Bucket());
      pages.get(page)!.add(metric, who);
    }
  }

  const sum = (c: ContactCounts) => CONTACT_METRICS.reduce((n, m) => n + c[m].clicks, 0);
  return {
    sessions: sessions.length,
    visitors: allVisitors.size,
    totals: total.counts,
    bySource: Object.fromEntries([...sources].map(([k, v]) => [k, { visitors: v.visitors.size, counts: v.bucket.counts }])),
    byDay: [...days].map(([day, b]) => ({ day, counts: b.counts })).sort((a, b) => b.day.localeCompare(a.day)),
    byPage: [...pages].map(([page, b]) => ({ page, counts: b.counts })).sort((a, b) => sum(b.counts) - sum(a.counts)),
    availabilityByEventType: [...eventTypes]
      .map(([eventType, b]) => ({ eventType, checks: b.counts.availability }))
      .sort((a, b) => b.checks.visitors - a.checks.visitors || b.checks.clicks - a.checks.clicks),
  };
}
