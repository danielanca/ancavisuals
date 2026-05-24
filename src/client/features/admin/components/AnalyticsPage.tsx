import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AncaLoader from "../../../components/UI/AncaLoader";
import useAuth from "../auth/useAuth";

interface Visit {
  id: string;
  sessionId: string;
  visitorId: string;
  isNew: boolean;
  page: string;
  referrer: string;
  timestamp: string;
  ip: string;
  userAgent: string;
  city: string;
  region: string;
  country: string;
  org: string;
  timeSpent?: number;
  scrollDepth?: number;
}

interface Stats {
  today: { visitors: number };
  threeDays: { visitors: number };
  week: { visitors: number };
  month: { visitors: number };
  threeMonths: { visitors: number };
  topPages: { page: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
  topCountries: { country: string; count: number }[];
}

interface PageEntry {
  page: string;
  timestamp: string;
  timeSpent?: number;
  scrollDepth?: number;
}

interface SessionEntry {
  sessionId: string;
  pages: PageEntry[];
  firstSeen: string;
  lastSeen: string;
}

interface Visitor {
  visitorId: string;
  isNew: boolean;
  ip: string;
  city: string;
  country: string;
  org: string;
  userAgent: string;
  sessions: SessionEntry[];
  firstSeen: string;
  lastSeen: string;
  returnedToday: boolean;
}

type PeriodKey = "today" | "3d" | "7d" | "30d" | "90d";

const PERIODS: { key: PeriodKey; label: string; statKey: keyof Stats; days: number }[] = [
  { key: "today", label: "Azi",    statKey: "today",       days: 0  },
  { key: "3d",    label: "3 zile", statKey: "threeDays",   days: 3  },
  { key: "7d",    label: "7 zile", statKey: "week",        days: 7  },
  { key: "30d",   label: "1 lună", statKey: "month",       days: 30 },
  { key: "90d",   label: "3 luni", statKey: "threeMonths", days: 90 },
];

function parseDevice(ua: string): string {
  if (!ua) return "Necunoscut";
  const mobile = /android|iphone|ipad|mobile/i.test(ua);
  if (/chrome/i.test(ua)) return mobile ? "Chrome Mobile" : "Chrome";
  if (/firefox/i.test(ua)) return mobile ? "Firefox Mobile" : "Firefox";
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return mobile ? "Safari Mobile" : "Safari";
  if (/edg/i.test(ua)) return "Edge";
  return mobile ? "Mobile" : "Desktop";
}

function formatVisitTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const hhmm = d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (isToday) return hhmm;
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "short" }) + " · " + hhmm;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("ro-RO", {
    day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function formatDuration(first: string, last: string): string {
  const ms = new Date(last).getTime() - new Date(first).getTime();
  if (ms < 60000) return "< 1 min";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate();
}

function periodCutoff(period: PeriodKey): Date {
  const now = new Date();
  if (period === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  const days = PERIODS.find((p) => p.key === period)!.days;
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  cutoff.setDate(cutoff.getDate() - (days - 1));
  return cutoff;
}

function groupByVisitors(visits: Visit[]): Visitor[] {
  const visitorMap = new Map<string, Visitor>();
  const sessionMap = new Map<string, SessionEntry>();

  for (const visit of visits) {
    const sid = visit.sessionId || visit.id;
    if (!sessionMap.has(sid)) {
      sessionMap.set(sid, { sessionId: sid, pages: [], firstSeen: visit.timestamp, lastSeen: visit.timestamp });
    }
    const session = sessionMap.get(sid)!;
    session.pages.push({ page: visit.page, timestamp: visit.timestamp, timeSpent: visit.timeSpent, scrollDepth: visit.scrollDepth });
    if (visit.timestamp < session.firstSeen) session.firstSeen = visit.timestamp;
    if (visit.timestamp > session.lastSeen) session.lastSeen = visit.timestamp;
  }

  for (const session of sessionMap.values()) {
    session.pages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  for (const visit of visits) {
    const vid = visit.visitorId || visit.sessionId;
    const sid = visit.sessionId || visit.id;
    if (!visitorMap.has(vid)) {
      visitorMap.set(vid, {
        visitorId: vid,
        isNew: visit.isNew,
        ip: visit.ip,
        city: visit.city,
        country: visit.country,
        org: visit.org,
        userAgent: visit.userAgent,
        sessions: [],
        firstSeen: visit.timestamp,
        lastSeen: visit.timestamp,
        returnedToday: false,
      });
    }
    const visitor = visitorMap.get(vid)!;
    const session = sessionMap.get(sid)!;
    if (!visitor.sessions.find((s) => s.sessionId === sid)) {
      visitor.sessions.push(session);
    }
    if (visit.timestamp < visitor.firstSeen) visitor.firstSeen = visit.timestamp;
    if (visit.timestamp > visitor.lastSeen) visitor.lastSeen = visit.timestamp;
  }

  const today = new Date().toISOString();
  for (const visitor of visitorMap.values()) {
    visitor.sessions.sort((a, b) => a.firstSeen.localeCompare(b.firstSeen));
    visitor.returnedToday = visitor.sessions.filter((s) => isSameDay(s.firstSeen, today)).length > 1;
  }

  return Array.from(visitorMap.values()).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [period, setPeriod] = useState<PeriodKey>("7d");
  const [includeLocal, setIncludeLocal] = useState(false);
  const [countryDrill, setCountryDrill] = useState<string | null>(null);

  const load = (token: string, localFlag: boolean) => {
    setLoading(true);
    const headers: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};
    const qs = localFlag ? "?includeLocal=true" : "";
    Promise.all([
      fetch(`/api/admin/analytics/visits?limit=2000${localFlag ? "&includeLocal=true" : ""}`, { headers }).then((r) => r.ok ? r.json() : null),
      fetch(`/api/admin/analytics/stats${qs}`, { headers }).then((r) => r.ok ? r.json() : null),
    ])
      .then(([visitsData, statsData]) => {
        setVisits(visitsData?.visits ?? []);
        setStats(statsData ?? null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (auth.loading) return;
    load(auth.accessToken ?? "", includeLocal);
  }, [auth.loading, auth.accessToken, includeLocal]);

  const cutoff = useMemo(() => periodCutoff(period), [period]);

  const filteredVisits = useMemo(
    () => visits.filter((v) => new Date(v.timestamp) >= cutoff),
    [visits, cutoff],
  );

  const visitors = useMemo(() => groupByVisitors(filteredVisits), [filteredVisits]);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const countryPageBreakdown = useMemo(() => {
    if (!countryDrill) return [];
    const pageCount: Record<string, number> = {};
    visits
      .filter((v) => v.country === countryDrill)
      .forEach((v) => { pageCount[v.page] = (pageCount[v.page] ?? 0) + 1; });
    return Object.entries(pageCount)
      .sort(([, a], [, b]) => b - a)
      .map(([page, count]) => ({ page, count }));
  }, [countryDrill, visits]);

  if (loading) return <AncaLoader />;

  const activePeriod = PERIODS.find((p) => p.key === period)!;
  const activeCount = stats ? (stats[activePeriod.statKey] as { visitors: number }).visitors : 0;

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm">
          <button onClick={() => navigate("/admin")} className="text-neutral-500 hover:text-white transition-colors">
            Dashboard
          </button>
          <span className="text-neutral-700">/</span>
          <span className="text-neutral-300">Analytics</span>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-2xl font-light tracking-tight">Analytics</h1>
            <p className="text-neutral-500 text-sm mt-1">
              {activeCount} vizitatori unici · {activePeriod.label.toLowerCase()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => setIncludeLocal((v) => !v)}
                className={`relative w-9 h-5 rounded-full transition-colors ${includeLocal ? "bg-amber-500" : "bg-neutral-700"}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${includeLocal ? "translate-x-4" : "translate-x-0"}`} />
              </div>
              <span className="text-neutral-500 text-xs">Afișează localhost</span>
            </label>
            <button
            onClick={() => load(auth.accessToken ?? "", includeLocal)}
            className="p-2 rounded-lg border border-neutral-800 text-neutral-500 hover:text-white hover:border-neutral-600 transition-colors"
            title="Reîncarcă"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
          </div>
        </div>

        {/* Period tabs — also stat cards */}
        {stats && (
          <div className="grid grid-cols-5 gap-2">
            {PERIODS.map(({ key, label, statKey }) => {
              const count = (stats[statKey] as { visitors: number }).visitors;
              const isActive = period === key;
              return (
                <button
                  key={key}
                  onClick={() => setPeriod(key)}
                  className={`rounded-xl p-3 text-left border transition-all ${
                    isActive
                      ? "bg-violet-500/10 border-violet-500/40"
                      : "bg-neutral-900 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  <p className={`text-[10px] uppercase tracking-wider mb-1.5 ${isActive ? "text-violet-400" : "text-neutral-500"}`}>
                    {label}
                  </p>
                  <p className={`text-xl font-light ${isActive ? "text-white" : "text-neutral-300"}`}>{count}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Top pages + countries + referrers */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <p className="text-neutral-400 text-[10px] uppercase tracking-wider mb-3">Top pagini · 30 zile</p>
              <div className="space-y-1.5">
                {stats.topPages.slice(0, 8).map(({ page, count }) => (
                  <div key={page} className="flex items-center gap-2">
                    <a
                      href={page}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-300 hover:text-violet-400 text-xs font-mono truncate flex-1 transition-colors"
                      title={page}
                    >
                      {page}
                    </a>
                    <span className="text-violet-400 text-xs font-semibold flex-shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <p className="text-neutral-400 text-[10px] uppercase tracking-wider mb-3">Top țări · 30 zile</p>
              <div className="space-y-1.5">
                {stats.topCountries.map(({ country, count }) => (
                  <button
                    key={country}
                    onClick={() => setCountryDrill(country)}
                    className="w-full flex items-center gap-2 group text-left"
                  >
                    <span className="text-neutral-300 group-hover:text-emerald-400 text-xs flex-1 transition-colors">
                      {country || "Necunoscut"}
                    </span>
                    <span className="text-emerald-400 text-xs font-semibold flex-shrink-0">{count}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-700 group-hover:text-emerald-600 flex-shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <p className="text-neutral-400 text-[10px] uppercase tracking-wider mb-3">Surse trafic · 30 zile</p>
              <div className="space-y-1.5">
                {stats.topReferrers.length === 0 ? (
                  <p className="text-neutral-600 text-xs">Fără trafic extern</p>
                ) : stats.topReferrers.map(({ referrer, count }) => (
                  <div key={referrer} className="flex items-center gap-2">
                    <a
                      href={`https://${referrer}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-300 hover:text-amber-400 text-xs truncate flex-1 transition-colors"
                      title={referrer}
                    >
                      {referrer}
                    </a>
                    <span className="text-amber-400 text-xs font-semibold flex-shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Visitor feed */}
        <div>
          <p className="text-neutral-600 text-xs uppercase tracking-wider mb-3">
            {visitors.length} vizitatori · {activePeriod.label.toLowerCase()}
          </p>

          {visitors.length === 0 ? (
            <div className="text-center py-16 bg-neutral-900 border border-neutral-800 rounded-xl">
              <p className="text-neutral-500 text-sm">Niciun vizitator în perioada selectată.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visitors.map((visitor) => {
                const isOpen = expanded.has(visitor.visitorId);
                const location = [visitor.city, visitor.country].filter(Boolean).join(", ");
                const device = parseDevice(visitor.userAgent);
                const totalPages = visitor.sessions.reduce((acc, s) => acc + s.pages.length, 0);
                const totalDuration = visitor.sessions.length > 0
                  ? formatDuration(visitor.firstSeen, visitor.lastSeen)
                  : null;

                return (
                  <div key={visitor.visitorId} className="rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden">
                    <button
                      onClick={() => toggleExpanded(visitor.visitorId)}
                      className="w-full flex items-start gap-3 p-4 text-left hover:bg-neutral-800/50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white text-sm font-medium">
                            {location || visitor.ip || "Locație necunoscută"}
                          </span>
                          {visitor.isNew ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">nou</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">revenit</span>
                          )}
                          {visitor.returnedToday && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">revenit azi</span>
                          )}
                          <span className="text-neutral-600 text-xs">·</span>
                          <span className="text-neutral-500 text-xs">{device}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-neutral-600 text-xs font-mono">{visitor.ip || "—"}</span>
                          <span className="text-neutral-700 text-xs">·</span>
                          <span className="text-violet-400 text-xs">
                            {visitor.sessions.length > 1
                              ? `${visitor.sessions.length} vizite · ${totalPages} pagini`
                              : `${totalPages} ${totalPages === 1 ? "pagină" : "pagini"}`}
                          </span>
                          {totalDuration && (
                            <>
                              <span className="text-neutral-700 text-xs">·</span>
                              <span className="text-neutral-600 text-xs">{totalDuration}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                        <span className="text-neutral-400 text-xs">{formatVisitTime(visitor.lastSeen)}</span>
                        <svg
                          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          strokeLinecap="round" strokeLinejoin="round"
                          className={`text-neutral-600 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-neutral-800 px-4 py-4 space-y-5">
                        {visitor.sessions.map((session, si) => (
                          <div key={session.sessionId}>
                            {visitor.sessions.length > 1 && (
                              <p className="text-neutral-600 text-[10px] uppercase tracking-wider mb-2">
                                Vizita {si + 1} · {formatTime(session.firstSeen)}
                                {session.pages.length > 1 && ` · ${formatDuration(session.firstSeen, session.lastSeen)}`}
                              </p>
                            )}
                            <div className="relative pl-4">
                              <div className="absolute left-[5px] top-2 bottom-2 w-px bg-neutral-800" />
                              <div className="space-y-3">
                                {session.pages.map((p, i) => (
                                  <div key={i} className="relative flex items-start gap-3">
                                    <div className="absolute -left-[11px] top-[5px] w-2 h-2 rounded-full bg-violet-500/60 border border-violet-500 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <a
                                        href={p.page}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-neutral-200 hover:text-violet-400 text-xs font-mono transition-colors"
                                      >
                                        {p.page}
                                      </a>
                                      {(p.timeSpent != null && p.timeSpent > 0) && (
                                        <span className="flex items-center gap-2 mt-0.5 flex-wrap">
                                          <span className="text-neutral-600 text-[11px]">⏱ {formatSeconds(p.timeSpent)}</span>
                                          {p.scrollDepth != null && p.scrollDepth > 0 && (
                                            <span className="text-neutral-600 text-[11px]">↕ {p.scrollDepth}% scroll</span>
                                          )}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-neutral-600 text-xs flex-shrink-0">{formatTime(p.timestamp)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                        {visitor.org && (
                          <p className="text-neutral-700 text-xs pt-2 border-t border-neutral-800/60">
                            {visitor.org}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Country drill-down modal */}
      {countryDrill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={() => setCountryDrill(null)}
        >
          <div
            className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-md max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-white font-semibold text-lg">{countryDrill}</p>
                <p className="text-neutral-500 text-xs mt-0.5">
                  {countryPageBreakdown.reduce((s, r) => s + r.count, 0)} vizite · toate perioadele
                </p>
              </div>
              <button
                onClick={() => setCountryDrill(null)}
                className="text-neutral-600 hover:text-white transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-1">
              {countryPageBreakdown.map(({ page, count }) => (
                <div key={page} className="flex items-center gap-3 py-2 border-b border-neutral-800/60">
                  <a
                    href={page}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-300 hover:text-emerald-400 text-xs font-mono truncate flex-1 transition-colors"
                    title={page}
                  >
                    {page}
                  </a>
                  <span className="text-emerald-400 text-xs font-semibold flex-shrink-0">{count}</span>
                  <span className="text-neutral-600 text-xs flex-shrink-0">
                    {count === 1 ? "vizită" : "vizite"}
                  </span>
                </div>
              ))}
              {countryPageBreakdown.length === 0 && (
                <p className="text-neutral-600 text-sm text-center py-8">Nicio vizită găsită.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
