import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AncaLoader from "../../../components/UI/AncaLoader";

interface MediaVisit {
  id: string;
  slug: string;
  timestamp: string;
  ip: string;
  userAgent: string;
  city: string;
  region: string;
  country: string;
  org: string;
}

function parseDevice(ua: string): string {
  if (!ua) return "Necunoscut";
  const mobile = /android|iphone|ipad|ipod|mobile/i.test(ua);
  if (/chrome/i.test(ua)) return mobile ? "Chrome Mobile" : "Chrome";
  if (/firefox/i.test(ua)) return mobile ? "Firefox Mobile" : "Firefox";
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return mobile ? "Safari Mobile" : "Safari";
  if (/edg/i.test(ua)) return "Edge";
  return mobile ? "Mobile" : "Desktop";
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("ro-RO", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "acum câteva secunde";
  if (m < 60) return `acum ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `acum ${h}h`;
  const d = Math.floor(h / 24);
  return `acum ${d}z`;
}

export default function MediaActivityPage() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState<MediaVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSlug, setFilterSlug] = useState("all");

  useEffect(() => {
    fetch("/api/admin/media-activity?limit=200")
      .then((r) => r.json())
      .then((d) => setVisits(d.visits ?? []))
      .finally(() => setLoading(false));
  }, []);

  const slugs = ["all", ...Array.from(new Set(visits.map((v) => v.slug))).sort()];

  const filtered = filterSlug === "all" ? visits : visits.filter((v) => v.slug === filterSlug);

  if (loading) return <AncaLoader />;

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">

        <nav className="flex items-center gap-2 text-sm">
          <button onClick={() => navigate("/admin")} className="text-neutral-500 hover:text-white transition-colors">
            Dashboard
          </button>
          <span className="text-neutral-700">/</span>
          <span className="text-neutral-300">Activitate Media</span>
        </nav>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-2xl font-light tracking-tight">Activitate Media</h1>
            <p className="text-neutral-500 text-sm mt-1">{visits.length} vizite înregistrate</p>
          </div>
          <button
            onClick={() => { setLoading(true); fetch("/api/admin/media-activity?limit=200").then((r) => r.json()).then((d) => setVisits(d.visits ?? [])).finally(() => setLoading(false)); }}
            className="p-2 rounded-lg border border-neutral-800 text-neutral-500 hover:text-white hover:border-neutral-600 transition-colors"
            title="Reîncarcă"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>

        {/* Filtru slug */}
        <div className="flex flex-wrap gap-2">
          {slugs.map((s) => (
            <button
              key={s}
              onClick={() => setFilterSlug(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors font-mono ${
                filterSlug === s ? "bg-violet-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-white"
              }`}
            >
              {s === "all" ? "Toate" : s}
              {s !== "all" && (
                <span className="ml-1.5 text-neutral-500">
                  {visits.filter((v) => v.slug === s).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Feed */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-neutral-500 text-sm">Nicio vizită înregistrată încă.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((v) => {
              const location = [v.city, v.country].filter(Boolean).join(", ");
              const device = parseDevice(v.userAgent);
              return (
                <div key={v.id} className="flex items-start gap-3 p-4 rounded-xl bg-neutral-900 border border-neutral-800">
                  <div className="w-8 h-8 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={`/media/${v.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-violet-400 hover:text-violet-300 font-mono transition-colors"
                      >
                        {v.slug}
                      </a>
                      <span className="text-neutral-600 text-xs">·</span>
                      <span className="text-neutral-500 text-xs">{device}</span>
                      {location && (
                        <>
                          <span className="text-neutral-600 text-xs">·</span>
                          <span className="text-neutral-500 text-xs">{location}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-neutral-600 text-xs font-mono">{v.ip}</span>
                      {v.org && <span className="text-neutral-700 text-xs truncate max-w-[180px]">{v.org}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-neutral-400 text-xs">{timeAgo(v.timestamp)}</p>
                    <p className="text-neutral-700 text-xs mt-0.5">{formatTime(v.timestamp)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
