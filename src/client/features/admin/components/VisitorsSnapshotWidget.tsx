import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useAuth from "../auth/useAuth";
import type { ContactStats } from "../../../../shared/contactStats";
import { visitDay } from "../../../../shared/liveVisits";

const RANGE_DAYS = 3;

type Response = ContactStats & { error?: string; alsoFrom?: Record<string, ContactStats> };

interface Snapshot {
  visitors: number;
  adsVisitors: number;
  availability: number;
  availabilityChecks: number;
}

const toSnapshot = (stats: ContactStats): Snapshot => ({
  visitors: stats.visitors,
  adsVisitors: stats.bySource.google_ads?.visitors ?? 0,
  availability: stats.totals.availability.visitors,
  availabilityChecks: stats.totals.availability.clicks,
});

function Column({ label, data }: { label: string; data: Snapshot }) {
  const rate = data.visitors ? Math.round((data.availability / data.visitors) * 100) : 0;
  return (
    <div className="min-w-0 p-5">
      <p className="text-neutral-500 text-[11px] uppercase tracking-wider">{label}</p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-white text-4xl font-light tabular-nums">{data.visitors}</span>
        <span className="text-neutral-400 text-sm">{data.visitors === 1 ? "vizitator" : "vizitatori"}</span>
      </div>
      {data.adsVisitors > 0 && (
        <p className="text-neutral-500 text-xs mt-1">din care {data.adsVisitors} din Google Ads</p>
      )}
      <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-2.5">
        <div className="flex items-baseline gap-2">
          <span className="text-emerald-300 text-2xl font-light tabular-nums">{data.availability}</span>
          <span className="text-emerald-200/80 text-sm">
            {data.availability === 1 ? "persoană a verificat" : "persoane au verificat"} disponibilitatea
          </span>
        </div>
        <p className="text-emerald-200/50 text-xs mt-0.5">
          {data.visitors > 0 ? `${rate}% din vizitatori` : "—"}
          {data.availabilityChecks > data.availability && ` · ${data.availabilityChecks} verificări`}
        </p>
      </div>
    </div>
  );
}

export default function VisitorsSnapshotWidget() {
  const { auth } = useAuth();
  const [data, setData] = useState<{ today: Snapshot; range: Snapshot } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!auth.accessToken) return;
    const controller = new AbortController();
    const today = visitDay();
    // One read covers both columns: the 3-day range, plus today via `also`.
    const params = new URLSearchParams({
      from: visitDay(Date.now() - (RANGE_DAYS - 1) * 86_400_000),
      to: today,
      also: today,
    });
    fetch(`/api/admin/analytics/live/contact-stats?${params}`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d: Response) => {
        if (d.error || !d.alsoFrom?.[today]) { setFailed(true); return; }
        setData({ today: toSnapshot(d.alsoFrom[today]), range: toSnapshot(d) });
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [auth.accessToken]);

  if (failed) return null;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
        <span className="text-white text-sm font-medium">Vizitatori site</span>
        <Link to="/admin/statistici-contact" className="text-xs text-violet-400 hover:text-violet-300 whitespace-nowrap">
          Statistici →
        </Link>
      </div>
      {data === null ? (
        <p className="px-5 py-6 text-neutral-500 text-sm">Se încarcă…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-neutral-800">
          <Column label="Azi" data={data.today} />
          <Column label={`Ultimele ${RANGE_DAYS} zile`} data={data.range} />
        </div>
      )}
    </div>
  );
}
