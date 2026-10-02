import React, { useEffect, useState } from "react";

interface ConsentRow {
  day: string;
  shown: number;
  acceptAll: number;
  denyAll: number;
  save: number;
  saveMarketingOn: number;
  saveMarketingOff: number;
}

const RANGES = [7, 30, 90] as const;

function pct(part: number, total: number): string {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : "—";
}

export function sumConsentRows(rows: ConsentRow[]) {
  const t = rows.reduce(
    (acc, r) => ({
      shown: acc.shown + r.shown,
      acceptAll: acc.acceptAll + r.acceptAll,
      denyAll: acc.denyAll + r.denyAll,
      save: acc.save + r.save,
      saveMarketingOn: acc.saveMarketingOn + r.saveMarketingOn,
      saveMarketingOff: acc.saveMarketingOff + r.saveMarketingOff,
    }),
    { shown: 0, acceptAll: 0, denyAll: 0, save: 0, saveMarketingOn: 0, saveMarketingOff: 0 }
  );
  const decided = t.acceptAll + t.denyAll + t.save;
  // The banner can be reopened from the privacy button, so clamp at 0.
  const ignored = Math.max(t.shown - decided, 0);
  return { ...t, decided, ignored };
}

export default function ConsentStatsCard({ token }: { token: string }) {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [rows, setRows] = useState<ConsentRow[] | null>(null);

  useEffect(() => {
    setRows(null);
    fetch(`/api/admin/analytics/consent?days=${days}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setRows(data?.rows ?? []))
      .catch(() => setRows([]));
  }, [days, token]);

  const t = sumConsentRows(rows ?? []);
  const items = [
    { label: "Accept all", value: t.acceptAll, color: "text-emerald-400" },
    { label: "Deny", value: t.denyAll, color: "text-rose-400" },
    { label: "Setări → Save", value: t.save, color: "text-amber-400" },
    { label: "Ignorat", value: t.ignored, color: "text-neutral-400" },
  ];

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <p className="text-neutral-400 text-[10px] uppercase tracking-wider">
          Banner cookies · afișat {t.shown}×
        </p>
        <div className="flex gap-1">
          {RANGES.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                days === d ? "border-violet-500/40 text-violet-300 bg-violet-500/10" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {d}z
            </button>
          ))}
        </div>
      </div>

      {rows === null ? (
        <p className="text-neutral-600 text-xs">Se încarcă…</p>
      ) : t.shown === 0 && t.decided === 0 ? (
        <p className="text-neutral-600 text-xs">Încă nu sunt date pentru perioada aleasă.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {items.map(({ label, value, color }) => (
              <div key={label} className="rounded-lg bg-neutral-950/50 border border-neutral-800 p-2.5">
                <p className="text-neutral-500 text-[10px] uppercase tracking-wider mb-1">{label}</p>
                <p className={`text-lg font-light ${color}`}>
                  {value} <span className="text-neutral-500 text-xs">{pct(value, t.shown)}</span>
                </p>
              </div>
            ))}
          </div>
          {t.save > 0 && (
            <p className="text-neutral-500 text-[11px] mt-2">
              Din „Save”: marketing pornit {t.saveMarketingOn}, oprit {t.saveMarketingOff}.
            </p>
          )}
          <p className="text-neutral-600 text-[11px] mt-1">
            Pot ajunge în retargeting: {t.acceptAll + t.saveMarketingOn} ({pct(t.acceptAll + t.saveMarketingOn, t.shown)} din afișări). Procentele sunt din afișările bannerului.
          </p>
        </>
      )}
    </div>
  );
}
