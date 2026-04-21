import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AncaLoader from "../../../components/UI/AncaLoader";

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
}

interface Stats {
  today: { visitors: number };
  week: { visitors: number };
  month: { visitors: number };
  halfYear: { visitors: number };
  year: { visitors: number };
  topPages: { page: string; count: number }[];
  topCountries: { country: string; count: number }[];
}

interface SessionEntry {
  sessionId: string;
  pages: { page: string; timestamp: string }[];
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
    day: "2-digit", month: "short",
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

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate();
}

function groupByVisitors(visits: Visit[]): Visitor[] {
  const visitorMap = new Map<string, Visitor>();
  const sessionMap = new Map<string, SessionEntry>();

  // Build sessions first
  for (const v of visits) {
    const sid = v.sessionId || v.id;
    if (!sessionMap.has(sid)) {
      sessionMap.set(sid, { sessionId: sid, pages: [], firstSeen: v.timestamp, lastSeen: v.timestamp });
    }
    const s = sessionMap.get(sid)!;
    s.pages.push({ page: v.page, timestamp: v.timestamp });
    if (v.timestamp < s.firstSeen) s.firstSeen = v.timestamp;
    if (v.timestamp > s.lastSeen) s.lastSeen = v.timestamp;
  }

  // Sort pages within each session
  for (const s of sessionMap.values()) {
    s.pages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  // Group sessions by visitorId (fallback to sessionId if no visitorId)
  for (const v of visits) {
    const vid = v.visitorId || v.sessionId;
    const sid = v.sessionId || v.id;
    if (!visitorMap.has(vid)) {
      visitorMap.set(vid, {
        visitorId: vid,
        isNew: v.isNew,
        ip: v.ip,
        city: v.city,
        country: v.country,
        org: v.org,
        userAgent: v.userAgent,
        sessions: [],
        firstSeen: v.timestamp,
        lastSeen: v.timestamp,
        returnedToday: false,
      });
    }
    const visitor = visitorMap.get(vid)!;
    const session = sessionMap.get(sid)!;
    if (!visitor.sessions.find((s) => s.sessionId === sid)) {
      visitor.sessions.push(session);
    }
    if (v.timestamp < visitor.firstSeen) visitor.firstSeen = v.timestamp;
    if (v.timestamp > visitor.lastSeen) visitor.lastSeen = v.timestamp;
  }

  const today = new Date().toISOString();
  for (const visitor of visitorMap.values()) {
    visitor.sessions.sort((a, b) => a.firstSeen.localeCompare(b.firstSeen));
    // Returned today = has more than 1 session and at least 2 of them are today
    const todaySessions = visitor.sessions.filter((s) => isSameDay(s.firstSeen, today));
    visitor.returnedToday = todaySessions.length > 1;
  }

  return Array.from(visitorMap.values()).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
      <p className="text-neutral-500 text-xs uppercase tracking-wider mb-2">{label}</p>
      <p className="text-white text-2xl font-light">{value}</p>
      <p className="text-neutral-700 text-[10px] mt-1">vizitatori unici</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  const visitors = useMemo(() => groupByVisitors(visits), [visits]);

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
            <p className="text-neutral-500 text-sm mt-1">{visitors.length} vizitatori unici</p>
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

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            <StatCard label="Azi" value={stats.today.visitors} />
            <StatCard label="7 zile" value={stats.week.visitors} />
            <StatCard label="30 zile" value={stats.month.visitors} />
            <StatCard label="6 luni" value={stats.halfYear.visitors} />
            <StatCard label="1 an" value={stats.year.visitors} />
          </div>
        )}

        {/* Top pages + countries */}
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

        {/* Visitor feed */}
        {visitors.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-neutral-500 text-sm">Niciun vizitator înregistrat.</p>
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
                  {/* Visitor header */}
                  <button
                    onClick={() => toggleExpanded(visitor.visitorId)}
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
                        <span className="text-white text-sm font-medium">
                          {location || visitor.ip || "Locație necunoscută"}
                        </span>
                        {/* Badges */}
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

                    {/* Time + chevron */}
                    <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                      <span className="text-neutral-400 text-xs">{timeAgo(visitor.lastSeen)}</span>
                      <svg
                        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round"
                        className={`text-neutral-600 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </button>

                  {/* Timeline expandat */}
                  {isOpen && (
                    <div className="border-t border-neutral-800 px-4 py-4 space-y-5">
                      {visitor.sessions.map((session, si) => (
                        <div key={session.sessionId}>
                          {/* Session label dacă sunt mai multe */}
                          {visitor.sessions.length > 1 && (
                            <p className="text-neutral-600 text-[10px] uppercase tracking-wider mb-2">
                              Vizita {si + 1} · {formatTime(session.firstSeen)}
                              {session.pages.length > 1 && ` · ${formatDuration(session.firstSeen, session.lastSeen)}`}
                            </p>
                          )}

                          {/* Timeline pagini */}
                          <div className="relative pl-4">
                            {/* Linie verticală */}
                            <div className="absolute left-[5px] top-2 bottom-2 w-px bg-neutral-800" />

                            <div className="space-y-3">
                              {session.pages.map((p, i) => (
                                <div key={i} className="relative flex items-start gap-3">
                                  <div className="absolute -left-[11px] top-[5px] w-2 h-2 rounded-full bg-violet-500/60 border border-violet-500 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-neutral-200 text-xs font-mono">{p.page}</span>
                                  </div>
                                  <span className="text-neutral-600 text-xs flex-shrink-0">{formatTime(p.timestamp)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Footer info */}
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
  );
}
