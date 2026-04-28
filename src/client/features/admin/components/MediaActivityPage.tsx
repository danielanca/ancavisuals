import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AncaLoader from "../../../components/UI/AncaLoader";
import Breadcrumb from "./Breadcrumb";

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

function parseDevice(userAgent: string): string {
  if (!userAgent) return "Necunoscut";
  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(userAgent);
  if (/chrome/i.test(userAgent)) return isMobile ? "Chrome Mobile" : "Chrome";
  if (/firefox/i.test(userAgent)) return isMobile ? "Firefox Mobile" : "Firefox";
  if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return isMobile ? "Safari Mobile" : "Safari";
  if (/edg/i.test(userAgent)) return "Edge";
  return isMobile ? "Mobile" : "Desktop";
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString("ro-RO", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(timestamp: string): string {
  const elapsed = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "acum câteva secunde";
  if (minutes < 60) return `acum ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `acum ${hours}h`;
  const days = Math.floor(hours / 24);
  return `acum ${days}z`;
}

function loadVisits(onDone: (visits: MediaVisit[]) => void, onFinally: () => void) {
  fetch("/api/admin/media-activity?limit=200")
    .then((response) => response.json())
    .then((data) => onDone(data.visits ?? []))
    .finally(onFinally);
}

export default function MediaActivityPage() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState<MediaVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSlug, setFilterSlug] = useState("all");

  useEffect(() => {
    loadVisits(setVisits, () => setLoading(false));
  }, []);

  function handleReload() {
    setLoading(true);
    loadVisits(setVisits, () => setLoading(false));
  }

  function handleDelete(id: string) {
    fetch(`/api/admin/media-activity/${id}`, { method: "DELETE" })
      .then((response) => response.json())
      .then((data) => {
        if (data.ok) setVisits((previous) => previous.filter((visit) => visit.id !== id));
      });
  }

  const slugs = ["all", ...Array.from(new Set(visits.map((visit) => visit.slug))).sort()];

  const nonLocalVisits = visits.filter((visit) => visit.ip !== "127.0.0.1" && visit.ip !== "::1");
  const filteredVisits = filterSlug === "all" ? nonLocalVisits : nonLocalVisits.filter((visit) => visit.slug === filterSlug);

  if (loading) return <AncaLoader />;

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">

        <Breadcrumb />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-2xl font-light tracking-tight">Activitate Media</h1>
            <p className="text-neutral-500 text-sm mt-1">{nonLocalVisits.length} vizite înregistrate</p>
          </div>
          <button
            onClick={handleReload}
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
          {slugs.map((slug) => (
            <button
              key={slug}
              onClick={() => setFilterSlug(slug)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors font-mono ${
                filterSlug === slug ? "bg-violet-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-white"
              }`}
            >
              {slug === "all" ? "Toate" : slug}
              {slug !== "all" && (
                <span className="ml-1.5 text-neutral-500">
                  {nonLocalVisits.filter((visit) => visit.slug === slug).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Feed */}
        {filteredVisits.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-neutral-500 text-sm">Nicio vizită înregistrată încă.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredVisits.map((visit) => {
              const location = [visit.city, visit.country].filter(Boolean).join(", ");
              const device = parseDevice(visit.userAgent);
              return (
                <div key={visit.id} className="flex items-start gap-3 p-4 rounded-xl bg-neutral-900 border border-neutral-800">
                  <div className="w-8 h-8 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={`/media/${visit.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-violet-400 hover:text-violet-300 font-mono transition-colors"
                      >
                        {visit.slug}
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
                      <span className="text-neutral-600 text-xs font-mono">{visit.ip}</span>
                      {visit.org && <span className="text-neutral-700 text-xs truncate max-w-[180px]">{visit.org}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                    <p className="text-neutral-400 text-xs">{timeAgo(visit.timestamp)}</p>
                    <p className="text-neutral-700 text-xs">{formatTime(visit.timestamp)}</p>
                    <button
                      onClick={() => handleDelete(visit.id)}
                      className="mt-1 text-neutral-600 hover:text-red-400 transition-colors"
                      title="Șterge"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                      </svg>
                    </button>
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
