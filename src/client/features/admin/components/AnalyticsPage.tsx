import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AncaLoader from "../../../components/UI/AncaLoader";

interface Visit {
  id: string;
  sessionId: string;
  page: string;
  referrer: string;
  timestamp: string;
  ip: string;
  userAgent: string;
  city: string;
  region: string;
  country: string;
  org: string;
}

interface Stats {
  today: { pageviews: number; sessions: number };
  week: { pageviews: number; sessions: number };
  topPages: { page: string; count: number }[];
  topCountries: { country: string; count: number }[];
}

interface Session {
  sessionId: string;
  ip: string;
  city: string;
  country: string;
  org: string;
  userAgent: string;
  pages: { page: string; timestamp: string }[];
  firstSeen: string;
  lastSeen: string;
}

function parseDevice(ua: string): string {
  if (!ua) return "Necunoscut";
  const mobile = /android|iphone|ipad|mobile/i.test(ua);
  if (/chrome/i.test(ua)) return mobile ? "Chrome Mobile" : "Chrome";
  if (/firefox/i.test(ua)) return mobile ? "Firefox Mobile" : "Firefox";
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return mobile ? "Safari Mobile" : "Safari";
  if (/edg/i.test(ua)) return "Edge";
  return mobile ? "Mobile" : "Desktop";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "acum";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}z`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("ro-RO", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDuration(first: string, last: string): string {
  const ms = new Date(last).getTime() - new Date(first).getTime();
  if (ms < 60000) return "< 1 min";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
}

function groupBySessions(visits: Visit[]): Session[] {
  const map = new Map<string, Session>();
  for (const v of visits) {
    if (!map.has(v.sessionId)) {
      map.set(v.sessionId, {
        sessionId: v.sessionId,
        ip: v.ip,
        city: v.city,
        country: v.country,
        org: v.org,
        userAgent: v.userAgent,
        pages: [],
        firstSeen: v.timestamp,
        lastSeen: v.timestamp,
      });
    }
    const s = map.get(v.sessionId)!;
    s.pages.push({ page: v.page, timestamp: v.timestamp });
    if (v.timestamp < s.firstSeen) s.firstSeen = v.timestamp;
    if (v.timestamp > s.lastSeen) s.lastSeen = v.timestamp;
  }
  for (const s of map.values()) {
    s.pages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }
  return Array.from(map.values()).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
      <p className="text-neutral-500 text-xs uppercase tracking-wider mb-2">{label}</p>
      <p className="text-white text-3xl font-light">{value}</p>
      {sub && <p className="text-neutral-600 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filterPage, setFilterPage] = useState("all");

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/analytics/visits?limit=1000").then((r) => r.json()),
      fetch("/api/admin/analytics/stats").then((r) => r.json()),
    ])
      .then(([visitsData, statsData]) => {
        setVisits(visitsData.visits ?? []);
        setStats(statsData);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const sessions = useMemo(() => groupBySessions(visits), [visits]);

  const filteredSessions = useMemo(() => {
    if (filterPage === "all") return sessions;
    return sessions.filter((s) => s.pages.some((p) => p.page === filterPage));
  }, [sessions, filterPage]);

  const topPagesForFilter = stats?.topPages.slice(0, 8) ?? [];

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (loading) return <AncaLoader />;

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
            <p className="text-neutral-500 text-sm mt-1">{sessions.length} sesiuni înregistrate</p>
          </div>
          <button
            onClick={load}
            className="p-2 rounded-lg border border-neutral-800 text-neutral-500 hover:text-white hover:border-neutral-600 transition-colors"
            title="Reîncarcă"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Azi — vizite" value={stats.today.pageviews} />
            <StatCard label="Azi — sesiuni" value={stats.today.sessions} />
            <StatCard label="7 zile — vizite" value={stats.week.pageviews} />
            <StatCard label="7 zile — sesiuni" value={stats.week.sessions} />
          </div>
        )}

        {/* Top pages + top countries */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
              <p className="text-neutral-400 text-xs uppercase tracking-wider mb-3">Top Pagini (7 zile)</p>
              <div className="space-y-2">
                {stats.topPages.map(({ page, count }) => (
                  <div key={page} className="flex items-center gap-2">
                    <span className="text-neutral-300 text-xs font-mono truncate flex-1">{page}</span>
                    <span className="text-violet-400 text-xs font-semibold flex-shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
              <p className="text-neutral-400 text-xs uppercase tracking-wider mb-3">Top Țări (7 zile)</p>
              <div className="space-y-2">
                {stats.topCountries.map(({ country, count }) => (
                  <div key={country} className="flex items-center gap-2">
                    <span className="text-neutral-300 text-xs flex-1">{country || "Necunoscut"}</span>
                    <span className="text-emerald-400 text-xs font-semibold flex-shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filtru pagini */}
        {topPagesForFilter.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterPage("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterPage === "all" ? "bg-violet-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-white"}`}
            >
              Toate
            </button>
            {topPagesForFilter.map(({ page }) => (
              <button
                key={page}
                onClick={() => setFilterPage(page)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${filterPage === page ? "bg-violet-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-white"}`}
              >
                {page}
              </button>
            ))}
          </div>
        )}

        {/* Session feed */}
        {filteredSessions.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-neutral-500 text-sm">Nicio sesiune înregistrată.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSessions.map((s) => {
              const isOpen = expanded.has(s.sessionId);
              const location = [s.city, s.country].filter(Boolean).join(", ");
              const device = parseDevice(s.userAgent);
              const duration = s.pages.length > 1 ? formatDuration(s.firstSeen, s.lastSeen) : null;

              return (
                <div key={s.sessionId} className="rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden">
                  {/* Session header */}
                  <button
                    onClick={() => toggleExpanded(s.sessionId)}
                    className="w-full flex items-start gap-3 p-4 text-left hover:bg-neutral-800/50 transition-colors"
                  >
                    {/* Icon */}
                    <div className="w-8 h-8 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-sm font-mono">{s.ip || "IP necunoscut"}</span>
                        {location && (
                          <>
                            <span className="text-neutral-600 text-xs">·</span>
                            <span className="text-neutral-400 text-xs">{location}</span>
                          </>
                        )}
                        <span className="text-neutral-600 text-xs">·</span>
                        <span className="text-neutral-500 text-xs">{device}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-violet-400 text-xs">{s.pages.length} {s.pages.length === 1 ? "pagină" : "pagini"}</span>
                        {duration && (
                          <>
                            <span className="text-neutral-700 text-xs">·</span>
                            <span className="text-neutral-600 text-xs">{duration}</span>
                          </>
                        )}
                        {s.org && (
                          <>
                            <span className="text-neutral-700 text-xs">·</span>
                            <span className="text-neutral-700 text-xs truncate max-w-[160px]">{s.org}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Time + chevron */}
                    <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                      <span className="text-neutral-400 text-xs">{timeAgo(s.lastSeen)}</span>
                      <svg
                        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round"
                        className={`text-neutral-600 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </button>

                  {/* Pages list */}
                  {isOpen && (
                    <div className="border-t border-neutral-800 px-4 py-3 space-y-1.5">
                      <p className="text-neutral-600 text-xs uppercase tracking-wider mb-2">Pagini vizitate</p>
                      {s.pages.map((p, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-neutral-700 text-xs w-4 text-right flex-shrink-0">{i + 1}</span>
                          <span className="text-neutral-300 text-xs font-mono flex-1">{p.page}</span>
                          <span className="text-neutral-600 text-xs flex-shrink-0">{formatTime(p.timestamp)}</span>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-neutral-800/60 mt-2">
                        <p className="text-neutral-700 text-xs">Prima vizită: {formatTime(s.firstSeen)}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
