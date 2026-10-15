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
  /** Availability check results per traffic source: date free, already booked, or result not recorded. */
  availabilityOutcomeBySource: { source: VisitSource; outcomes: Record<AvailabilityOutcome, ContactCount> }[];
  /** Every event date people checked, most searched first. */
  checkedDates: CheckedDateStats[];
  /** Checked event dates grouped by calendar month, January to December. */
  checkedMonths: CheckedMonthStats[];
}

/** Checks of one date (or month): distinct people and checks, split by result. */
export interface OutcomeCounts {
  total: ContactCount;
  free: ContactCount;
  booked: ContactCount;
}

export interface CheckedDateStats {
  /** Event date that was checked, YYYY-MM-DD. */
  dateKey: string;
  all: OutcomeCounts;
  googleAds: OutcomeCounts;
  /** One entry per person (browser) who checked this date, so repeat checks by the same person are visible. Most recent first. */
  searchers: DateSearcher[];
}

export interface DateSearcher {
  /** Days the person checked this date (YYYY-MM-DD, Europe/Bucharest), oldest first. */
  days: string[];
  /** Every check, including repeats on the same day. */
  checks: number;
  source: VisitSource;
  /** True when at least one check reported the date as already booked. */
  sawBooked: boolean;
}

export interface CheckedMonthStats {
  /** Calendar month of the checked event date, 1–12 (all years together, like price seasons). */
  month: number;
  all: OutcomeCounts;
  googleAds: OutcomeCounts;
}

export const AVAILABILITY_OUTCOMES = ["free", "booked", "unknown"] as const;
export type AvailabilityOutcome = (typeof AVAILABILITY_OUTCOMES)[number];

function availabilityOutcome(meta: Record<string, unknown> | undefined): AvailabilityOutcome {
  if (meta?.available === true) return "free";
  if (meta?.available === false) return "booked";
  return "unknown";
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

/** Distinct people + checks per result for one date or month, overall and from Google Ads. */
class OutcomeTally {
  private parts = { total: new Tally(), free: new Tally(), booked: new Tally() };
  private ads = { total: new Tally(), free: new Tally(), booked: new Tally() };
  add(outcome: AvailabilityOutcome, who: string, isAds: boolean) {
    for (const group of isAds ? [this.parts, this.ads] : [this.parts]) {
      group.total.add(who);
      if (outcome !== "unknown") group[outcome].add(who);
    }
  }
  private static counts(g: { total: Tally; free: Tally; booked: Tally }): OutcomeCounts {
    return { total: g.total.count(), free: g.free.count(), booked: g.booked.count() };
  }
  all() { return OutcomeTally.counts(this.parts); }
  googleAds() { return OutcomeTally.counts(this.ads); }
}

class Tally {
  private clicks = 0;
  private who = new Set<string>();
  add(id: string) { this.clicks++; this.who.add(id); }
  count(): ContactCount { return { clicks: this.clicks, visitors: this.who.size }; }
}

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

const cleanPage = (page: string) => (page || "/").replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";

export function summarizeContactStats(sessions: ContactStatsSession[]): ContactStats {
  const total = new Bucket();
  const sources = new Map<VisitSource, { bucket: Bucket; visitors: Set<string> }>();
  const days = new Map<string, Bucket>();
  const pages = new Map<string, Bucket>();
  const allVisitors = new Set<string>();
  const eventTypes = new Map<string, Bucket>();
  const outcomes = new Map<VisitSource, Map<AvailabilityOutcome, Bucket>>();
  const checkedDates = new Map<string, OutcomeTally>();
  const checkedMonths = new Map<number, OutcomeTally>();
  const searchers = new Map<string, Map<string, DateSearcher & { lastAt: number }>>();

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
        const bySource = outcomes.get(source) ?? new Map<AvailabilityOutcome, Bucket>();
        const outcome = availabilityOutcome(event.meta);
        if (!bySource.has(outcome)) bySource.set(outcome, new Bucket());
        bySource.get(outcome)!.add(metric, who);
        outcomes.set(source, bySource);
        const dateKey = typeof event.meta?.dateKey === "string" ? event.meta.dateKey : "";
        const match = DATE_KEY.exec(dateKey);
        if (match) {
          const isAds = source === "google_ads";
          if (!checkedDates.has(dateKey)) checkedDates.set(dateKey, new OutcomeTally());
          checkedDates.get(dateKey)!.add(outcome, who, isAds);
          const people = searchers.get(dateKey) ?? new Map<string, DateSearcher & { lastAt: number }>();
          const person = people.get(who) ?? { days: [], checks: 0, source, sawBooked: false, lastAt: 0 };
          if (!person.days.includes(day)) person.days.push(day);
          person.checks += 1;
          person.sawBooked ||= outcome === "booked";
          person.lastAt = Math.max(person.lastAt, Number(event.at ?? fallbackAt));
          people.set(who, person);
          searchers.set(dateKey, people);
          const month = Number(match[2]);
          if (!checkedMonths.has(month)) checkedMonths.set(month, new OutcomeTally());
          checkedMonths.get(month)!.add(outcome, who, isAds);
        }
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
    availabilityOutcomeBySource: [...outcomes]
      .map(([source, m]) => ({
        source,
        outcomes: Object.fromEntries(AVAILABILITY_OUTCOMES.map((o) => [o, m.get(o)?.counts.availability ?? { clicks: 0, visitors: 0 }])) as Record<AvailabilityOutcome, ContactCount>,
      }))
      .sort((a, b) => (a.source === "google_ads" ? -1 : b.source === "google_ads" ? 1 : a.source.localeCompare(b.source))),
    checkedDates: [...checkedDates]
      .map(([dateKey, t]) => ({
        dateKey,
        all: t.all(),
        googleAds: t.googleAds(),
        searchers: [...(searchers.get(dateKey)?.values() ?? [])]
          .sort((a, b) => b.lastAt - a.lastAt)
          .map(({ lastAt: _lastAt, ...p }) => ({ ...p, days: [...p.days].sort() })),
      }))
      .sort((a, b) => b.all.total.visitors - a.all.total.visitors || b.all.total.clicks - a.all.total.clicks || a.dateKey.localeCompare(b.dateKey)),
    checkedMonths: [...checkedMonths]
      .map(([month, t]) => ({ month, all: t.all(), googleAds: t.googleAds() }))
      .sort((a, b) => a.month - b.month),
  };
}
