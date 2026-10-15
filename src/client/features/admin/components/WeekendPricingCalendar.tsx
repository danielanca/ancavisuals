import React, { useEffect, useMemo, useState } from "react";
import useAuth from "../auth/useAuth";
import type { StartingPrices } from "../../../../shared/pricing/startingPrices";
import {
  applySeasonPercent,
  DATE_PRICE_EVENT_TYPES,
  MAX_SEASON_PERCENT,
  MIN_SEASON_PERCENT,
  seasonForMonth,
  seasonPercent,
  type DatePrice,
  type DatePriceEventKey,
  type PriceSeason,
} from "../../../../shared/pricing/seasonalPricing";
import type { CheckedDateStats, DateSearcher } from "../../../../shared/contactStats";
import { SOURCE_LABEL } from "./ContactStatsPage";
import { visitDay } from "../../../../shared/liveVisits";

const MONTHS = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];
const WEEKDAYS = ["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"];
const DEMAND_DAYS = 90;
const MONTHS_AHEAD = 30;

type Percent = Record<DatePriceEventKey, number>;
type Demand = { people: number; booked: number; searchers: DateSearcher[] };

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const clampPercent = (n: number) => Math.max(MIN_SEASON_PERCENT, Math.min(MAX_SEASON_PERCENT, Math.round(n)));
const signed = (n: number) => (n > 0 ? `+${n}%` : `${n}%`);
const euro = (n: number) => `${n.toLocaleString("ro-RO")} €`;
const shortDay = (day: string) => `${Number(day.slice(8))} ${MONTHS[Number(day.slice(5, 7)) - 1].slice(0, 3).toLowerCase()}`;

/** Hover card: who searched the date — one row per person, with the days they searched it. */
function SearchersTooltip({ demand, column, notes }: { demand: Demand; column: number; notes: string[] }) {
  const align = column <= 1 ? "left-0" : column >= 5 ? "right-0" : "left-1/2 -translate-x-1/2";
  return (
    <div className={`pointer-events-none absolute bottom-full mb-1 ${align} z-30 hidden group-hover:block w-64 rounded-lg border border-neutral-700 bg-neutral-950 p-2.5 text-left shadow-xl`}>
      {notes.map((n) => <p key={n} className="text-violet-300 text-[11px] mb-1">{n}</p>)}
      <p className="text-neutral-200 text-xs font-medium mb-1.5">
        {demand.people} {demand.people === 1 ? "persoană a căutat" : "persoane au căutat"} data
      </p>
      <ul className="space-y-1 max-h-56 overflow-y-auto">
        {demand.searchers.map((p, i) => (
          <li key={i} className="text-[11px] leading-snug text-neutral-400">
            <span className="text-neutral-200">Persoana {i + 1}</span> · {SOURCE_LABEL[p.source]}
            <br />
            {p.days.map(shortDay).join(", ")}
            {p.checks > 1 && <span className="text-neutral-500"> ({p.checks} căutări)</span>}
            {p.sawBooked && <span className="text-red-300"> · a văzut-o ocupată</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Weekend-only calendar: a special price (percent on top of the season) per Saturday/Sunday, with search demand per day. */
export default function WeekendPricingCalendar({
  datePrices, onChange, seasons, startingPrices, disabled,
}: {
  datePrices: DatePrice[];
  onChange: (next: DatePrice[]) => void;
  seasons: PriceSeason[];
  startingPrices: StartingPrices;
  disabled?: boolean;
}) {
  const { auth } = useAuth();
  const today = visitDay();
  const [cursor, setCursor] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 }));
  const [selected, setSelected] = useState<string[]>([]);
  const [percent, setPercent] = useState<Percent>({ nunta: 10, botez: 0 });
  const [demand, setDemand] = useState<Map<string, Demand>>(new Map());
  const [booked, setBooked] = useState<Set<string>>(new Set());

  // Confirmed events — the same dates the public site reports as unavailable.
  useEffect(() => {
    fetch("/api/booked-dates")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { dates?: string[] } | null) => setBooked(new Set(d?.dates ?? [])))
      .catch(() => {});
  }, []);

  // How many people checked each date lately (same data as /admin/statistici-contact).
  useEffect(() => {
    if (!auth.accessToken) return;
    const params = new URLSearchParams({ from: visitDay(Date.now() - (DEMAND_DAYS - 1) * 86_400_000), to: visitDay() });
    fetch(`/api/admin/analytics/live/contact-stats?${params}`, { headers: { Authorization: `Bearer ${auth.accessToken}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { checkedDates?: CheckedDateStats[] } | null) => {
        setDemand(new Map((d?.checkedDates ?? []).map((c) => [c.dateKey, { people: c.all.total.visitors, booked: c.all.booked.visitors, searchers: c.searchers ?? [] }])));
      })
      .catch(() => {});
  }, [auth.accessToken]);

  const byDate = useMemo(() => new Map(datePrices.map((d) => [d.date, d])), [datePrices]);
  const maxDemand = Math.max(1, ...[...demand.values()].map((d) => d.people));

  const { year, month } = cursor;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leading = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7; // Monday first
  const cells: (number | null)[] = [...Array(leading).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const weekendDates = cells
    .map((d) => (d ? iso(year, month, d) : null))
    .filter((d): d is string => !!d && d >= today && [0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay()));

  const monthIndex = (y: number, m: number) => y * 12 + m;
  const startIndex = monthIndex(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1);
  const move = (delta: number) => setCursor(({ year: y, month: m }) => {
    const next = Math.min(startIndex + MONTHS_AHEAD, Math.max(startIndex, monthIndex(y, m) + delta));
    return { year: Math.floor(next / 12), month: next % 12 };
  });

  const toggle = (date: string) => setSelected((s) => (s.includes(date) ? s.filter((d) => d !== date) : [...s, date].sort()));
  const select = (day: "sat" | "sun") => {
    const want = day === "sat" ? 6 : 0;
    setSelected((s) => [...new Set([...s, ...weekendDates.filter((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === want)])].sort());
  };

  // Percent edits keep a date's fixed prices (set in „Date ocupate și prețuri fixe”).
  const withPercent = (dates: string[], next: DatePrice["percent"]) => {
    const rest = datePrices.filter((d) => !dates.includes(d.date));
    const updated = dates.flatMap((date) => {
      const fixed = byDate.get(date)?.fixed;
      return next.nunta || next.botez || fixed ? [{ date, percent: { ...next }, ...(fixed ? { fixed } : {}) }] : [];
    });
    onChange([...rest, ...updated].sort((a, b) => a.date.localeCompare(b.date)));
  };
  const apply = () => {
    withPercent(selected, percent);
    setSelected([]);
  };
  const clear = (dates: string[]) => withPercent(dates, { nunta: 0, botez: 0 });

  const startEdit = (date: string) => {
    const existing = byDate.get(date);
    if (existing && selected.length === 0) setPercent({ ...existing.percent });
    toggle(date);
  };

  const hasPercent = (d: DatePrice | undefined) => !!d && (d.percent.nunta !== 0 || d.percent.botez !== 0);
  const upcoming = datePrices.filter((d) => d.date >= today && hasPercent(d));
  const previewDate = selected[0];
  const previewMonth = previewDate ? Number(previewDate.slice(5, 7)) : null;

  return (
    <section id="preturi-pe-date" className="space-y-4 scroll-mt-6">
      <div>
        <h2 className="text-white text-lg font-light tracking-tight">Prețuri pe date (weekend)</h2>
        <p className="text-neutral-500 text-sm mt-1">
          Alege sâmbete sau duminici și pune-le un procent în plus (sau în minus) pentru Nuntă și Botez. Procentul se adaugă peste sezonul lunii:
          august +20% și o dată cu +10% = +30% pentru acea zi. Se aplică la toate prețurile evenimentului, ca la sezoane.
        </p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => move(-1)} disabled={monthIndex(year, month) <= startIndex} className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-sm disabled:opacity-30">‹</button>
          <div className="text-center">
            <p className="text-white text-sm font-medium">{MONTHS[month]} {year}</p>
            <p className="text-neutral-600 text-[11px]">{seasonForMonth(seasons, month + 1)?.name ?? "Fără sezon"} · nuntă {signed(seasonPercent(seasons, "nunta", month + 1))}</p>
          </div>
          <button type="button" onClick={() => move(1)} disabled={monthIndex(year, month) >= startIndex + MONTHS_AHEAD} className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-sm disabled:opacity-30">›</button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={`text-[11px] pb-1 ${i >= 5 ? "text-neutral-300" : "text-neutral-700"}`}>{w}</div>
          ))}
          {cells.map((day, i) => {
            if (!day) return <div key={`e${i}`} />;
            const date = iso(year, month, day);
            const weekend = i % 7 >= 5;
            const past = date < today;
            const isBooked = booked.has(date);
            if (!weekend || past) {
              return (
                <div
                  key={date}
                  title={isBooked ? "Ocupată (eveniment confirmat)" : undefined}
                  className={`aspect-square sm:aspect-auto sm:h-16 rounded-lg flex flex-col items-center justify-start pt-1 gap-0.5 text-xs ${
                    isBooked ? "border border-red-500/40 bg-red-500/10 text-red-300/70" : "text-neutral-800"
                  }`}
                >
                  {day}
                  {isBooked && <span className="text-[10px] leading-none">Ocupat</span>}
                </div>
              );
            }
            const entry = byDate.get(date);
            const special = hasPercent(entry) ? entry : undefined;
            const hasFixed = !!entry?.fixed && Object.keys(entry.fixed).length > 0;
            const d = demand.get(date);
            const isSelected = selected.includes(date);
            const notes = [
              isBooked ? "Ocupată (eveniment confirmat)" : "",
              special ? `Nuntă ${signed(special.percent.nunta)}, Botez ${signed(special.percent.botez)}` : "",
              hasFixed ? "Are prețuri fixe (vezi lista de mai jos)" : "",
            ].filter(Boolean);
            const heat = d ? 0.08 + 0.32 * (d.people / maxDemand) : 0;
            return (
              <button
                key={date}
                type="button"
                disabled={disabled}
                onClick={() => startEdit(date)}
                style={heat && !isSelected && !isBooked ? { backgroundColor: `rgba(245, 158, 11, ${heat})` } : undefined}
                className={`group relative aspect-square sm:aspect-auto sm:h-16 rounded-lg border flex flex-col items-center justify-start pt-1 gap-0.5 transition-colors ${
                  isSelected ? "border-violet-400 bg-violet-600/40" : isBooked ? "border-red-500 bg-red-500/20" : special ? "border-violet-500/60 bg-neutral-800/80" : "border-neutral-700 bg-neutral-800/50 hover:border-neutral-500"
                }`}
                title={d ? undefined : [...notes, "Nicio căutare recentă"].join(" · ")}
              >
                <span className={`text-xs ${isBooked ? "text-red-200 font-semibold" : "text-white"}`}>{day}</span>
                {isBooked && <span className="text-[10px] leading-none text-red-300">Ocupat</span>}
                {special && <span className="text-[10px] leading-none text-violet-300">{signed(special.percent.nunta || special.percent.botez)}</span>}
                {hasFixed && <span className="text-[10px] leading-none text-emerald-300">€ fix</span>}
                {d && <span className="text-[10px] leading-none text-amber-300">🔍{d.people}</span>}
                {d && <SearchersTooltip demand={d} column={i % 7} notes={notes} />}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
          <button type="button" onClick={() => select("sat")} className="px-2 py-1 rounded bg-neutral-800 text-neutral-300 hover:text-white">+ toate sâmbetele din lună</button>
          <button type="button" onClick={() => select("sun")} className="px-2 py-1 rounded bg-neutral-800 text-neutral-300 hover:text-white">+ toate duminicile din lună</button>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm border border-red-500 bg-red-500/20" /> ocupată</span>
          <span>· 🔍 = persoane care au verificat data în ultimele {DEMAND_DAYS} de zile (cu cât e mai portocaliu, cu atât mai căutată)</span>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="rounded-xl border border-violet-500/40 bg-violet-950/20 p-4 space-y-3">
          <p className="text-neutral-200 text-sm">
            {selected.length === 1 ? "1 zi selectată" : `${selected.length} zile selectate`}:{" "}
            <span className="text-neutral-400">{selected.map((d) => `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1].slice(0, 3).toLowerCase()}`).join(", ")}</span>
          </p>
          <div className="flex flex-wrap gap-4">
            {DATE_PRICE_EVENT_TYPES.map(({ key, label }) => {
              const k = key as DatePriceEventKey;
              const total = previewMonth ? seasonPercent(seasons, k, previewMonth) + percent[k] : percent[k];
              return (
                <div key={k} className="space-y-1">
                  <p className="text-neutral-400 text-xs">{label}</p>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setPercent((p) => ({ ...p, [k]: clampPercent(p[k] - 5) }))} className="w-8 h-8 rounded-lg bg-neutral-800 text-white">−</button>
                    <input
                      type="number"
                      step={5}
                      value={percent[k]}
                      onChange={(e) => setPercent((p) => ({ ...p, [k]: clampPercent(Number(e.target.value) || 0) }))}
                      className="w-16 bg-neutral-800 text-white rounded-lg px-2 py-1.5 text-sm text-right tabular-nums"
                    />
                    <span className="text-neutral-500 text-sm">%</span>
                    <button type="button" onClick={() => setPercent((p) => ({ ...p, [k]: clampPercent(p[k] + 5) }))} className="w-8 h-8 rounded-lg bg-neutral-800 text-white">+</button>
                  </div>
                  <p className="text-neutral-500 text-[11px]">
                    de la {euro(startingPrices[k])} → <span className="text-white">{euro(applySeasonPercent(startingPrices[k], total))}</span>
                    {previewMonth && seasonPercent(seasons, k, previewMonth) !== 0 && <span> (sezon {signed(seasonPercent(seasons, k, previewMonth))})</span>}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={apply} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-sm">
              {percent.nunta || percent.botez ? "Aplică" : "Aplică (fără preț special)"}
            </button>
            {selected.some((d) => hasPercent(byDate.get(d))) && (
              <button type="button" onClick={() => { clear(selected); setSelected([]); }} className="px-3 py-1.5 rounded-lg bg-neutral-800 text-red-300 text-sm">Șterge prețul special</button>
            )}
            <button type="button" onClick={() => setSelected([])} className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-sm">Renunță</button>
          </div>
          <p className="text-neutral-600 text-xs">Modificările se păstrează abia după „Salvează” de jos.</p>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-2">
          <p className="text-neutral-400 text-xs uppercase tracking-wider">Date cu preț special ({upcoming.length})</p>
          <div className="flex flex-wrap gap-2">
            {upcoming.map((d) => (
              <span key={d.date} className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/50 px-2.5 py-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setCursor({ year: Number(d.date.slice(0, 4)), month: Number(d.date.slice(5, 7)) - 1 })}
                  className="text-neutral-200 hover:text-white"
                >
                  {new Date(`${d.date}T12:00:00Z`).toLocaleDateString("ro-RO", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
                </button>
                <span className="text-violet-300">N {signed(d.percent.nunta)} · B {signed(d.percent.botez)}</span>
                {demand.get(d.date) && <span className="text-amber-300">🔍{demand.get(d.date)!.people}</span>}
                <button type="button" title="Șterge" disabled={disabled} onClick={() => clear([d.date])} className="text-neutral-500 hover:text-red-400">✕</button>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
