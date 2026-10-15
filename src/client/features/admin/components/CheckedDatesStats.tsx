import React, { useState } from "react";
import { Link } from "react-router-dom";
import type { CheckedDateStats, CheckedMonthStats, ContactCount, OutcomeCounts } from "../../../../shared/contactStats";
import { visitDay } from "../../../../shared/liveVisits";

const MONTHS = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];
const STATUS_FILTERS = [
  { key: "all", label: "Toate" },
  { key: "booked", label: "❌ Ocupate" },
  { key: "free", label: "✅ Libere" },
] as const;
const PAGE_SIZE = 30;

type Scope = "all" | "googleAds";
type StatusFilter = (typeof STATUS_FILTERS)[number]["key"];

const formatDate = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("ro-RO", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function People({ count }: { count: ContactCount }) {
  if (!count.clicks) return <span className="text-neutral-700">—</span>;
  return (
    <span className="text-white">
      {count.visitors}
      {count.clicks !== count.visitors && <span className="text-neutral-500 text-xs"> ({count.clicks})</span>}
    </span>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${active ? "bg-violet-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-white"}`}
    >
      {children}
    </button>
  );
}

/** Which event dates (and months) people checked — the demand signal for raising prices. */
export default function CheckedDatesStats({ dates, months }: { dates: CheckedDateStats[]; months: CheckedMonthStats[] }) {
  const [scope, setScope] = useState<Scope>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [showAll, setShowAll] = useState(false);
  const today = visitDay();

  const pick = (row: { all: OutcomeCounts; googleAds: OutcomeCounts }) => row[scope];
  const rows = dates
    .filter((d) => pick(d).total.clicks > 0)
    .filter((d) => status === "all" || pick(d)[status].clicks > 0)
    .sort((a, b) => pick(b).total.visitors - pick(a).total.visitors || pick(b).total.clicks - pick(a).total.clicks || a.dateKey.localeCompare(b.dateKey));
  const visible = showAll ? rows : rows.slice(0, PAGE_SIZE);

  const monthRows = MONTHS.map((name, i) => {
    const m = months.find((x) => x.month === i + 1);
    return { name, counts: m ? pick(m) : null };
  });
  const maxMonth = Math.max(1, ...monthRows.map((m) => m.counts?.total.visitors ?? 0));

  if (dates.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-neutral-400 text-xs uppercase tracking-wider">Ce date caută oamenii</h2>
        <div className="flex gap-2">
          <Pill active={scope === "all"} onClick={() => setScope("all")}>Toate sursele</Pill>
          <Pill active={scope === "googleAds"} onClick={() => setScope("googleAds")}>Doar Google Ads</Pill>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-neutral-300 text-sm">Cele mai căutate luni</p>
          <Link to="/admin/preturi" className="text-violet-400 text-xs hover:text-violet-300">Setează prețuri pe sezoane →</Link>
        </div>
        {monthRows.map(({ name, counts }) => (
          <div key={name} className="flex items-center gap-3 text-xs">
            <span className="w-24 text-neutral-400 shrink-0">{name}</span>
            <div className="flex-1 h-4 rounded bg-neutral-800/60 overflow-hidden flex">
              {counts && (
                <>
                  <div className="h-full bg-red-500/70" style={{ width: `${(counts.booked.visitors / maxMonth) * 100}%` }} />
                  <div className="h-full bg-emerald-500/70" style={{ width: `${(Math.max(0, counts.total.visitors - counts.booked.visitors) / maxMonth) * 100}%` }} />
                </>
              )}
            </div>
            <span className="w-28 text-right tabular-nums text-neutral-300 shrink-0">
              {counts?.total.visitors ? `${counts.total.visitors} pers.` : "—"}
              {counts?.booked.visitors ? <span className="text-red-400"> · {counts.booked.visitors} ocup.</span> : null}
            </span>
          </div>
        ))}
        <p className="text-neutral-600 text-xs pt-1">
          Luna datei verificate (toți anii la un loc, ca sezoanele de preț), nu luna în care s-a făcut verificarea.
          <span className="text-red-400"> Roșu</span> = au dat de o dată ocupată, <span className="text-emerald-400">verde</span> = restul.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-neutral-300 text-sm">Date verificate, cele mai căutate primele</p>
          <div className="flex gap-2">
            {STATUS_FILTERS.map((f) => (
              <Pill key={f.key} active={status === f.key} onClick={() => setStatus(f.key)}>{f.label}</Pill>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-neutral-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-neutral-500 text-xs text-left">
                <th className="px-3 py-2 font-normal">Data evenimentului</th>
                <th className="px-3 py-2 font-normal text-right whitespace-nowrap">Persoane</th>
                <th className="px-3 py-2 font-normal text-right whitespace-nowrap">❌ Era ocupată</th>
                <th className="px-3 py-2 font-normal text-right whitespace-nowrap">✅ Era liberă</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-neutral-600 text-xs">Nicio dată pentru filtrul ales.</td></tr>
              ) : visible.map((d) => {
                const c = pick(d);
                return (
                  <tr key={d.dateKey} className="border-t border-neutral-800/70">
                    <td className="px-3 py-2 text-neutral-300 whitespace-nowrap">
                      {formatDate(d.dateKey)}
                      {d.dateKey < today && <span className="text-neutral-600 text-xs"> · trecută</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums"><People count={c.total} /></td>
                    <td className="px-3 py-2 text-right tabular-nums"><People count={c.booked} /></td>
                    <td className="px-3 py-2 text-right tabular-nums"><People count={c.free} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length > PAGE_SIZE && (
          <button onClick={() => setShowAll((v) => !v)} className="text-violet-400 text-xs hover:text-violet-300">
            {showAll ? "Arată mai puține" : `Arată toate cele ${rows.length} date`}
          </button>
        )}
        <p className="text-neutral-600 text-xs">
          Persoane distincte; în paranteză, numărul de verificări. Intervalul de sus filtrează după ziua în care s-a făcut verificarea.
          O dată poate apărea și ca ocupată, și ca liberă dacă între timp s-a rezervat sau s-a eliberat.
        </p>
      </div>
    </section>
  );
}
