import React, { useState } from "react";
import type { ClientEvent } from "../types";

interface Props {
  events: ClientEvent[];
}

const formatEUR = (n: number) =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const formatDate = (d: Date) =>
  d.toLocaleDateString("ro-RO", { day: "numeric", month: "short" });

const FinancialSummary: React.FC<Props> = ({ events }) => {
  const [expanded, setExpanded] = useState(false);
  const year = new Date().getFullYear();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const relevant = events.filter((e) => {
    if (e.status !== "confirmat" && e.status !== "finalizat") return false;
    if (!e.eventDate) return false;
    return new Date(e.eventDate).getFullYear() === year;
  });

  if (relevant.length === 0) return null;

  // Bani deja primiți = avansuri marcate încasate
  const incasat = relevant
    .filter((e) => e.pricing?.advancePaid)
    .reduce((s, e) => s + (e.pricing?.advanceAmount ?? 0), 0);

  // Total contractat
  const totalAn = relevant.reduce((s, e) => s + (e.pricing?.total ?? 0), 0);

  // Urmează să primești = evenimente viitoare, ce mai e de primit
  const viitoare = relevant
    .filter((e) => e.eventDate && new Date(e.eventDate) >= today)
    .sort((a, b) => new Date(a.eventDate!).getTime() - new Date(b.eventDate!).getTime())
    .map((e) => {
      const avansRamas = !e.pricing?.advancePaid ? (e.pricing?.advanceAmount ?? 0) : 0;
      const rest = e.pricing?.remainingAmount ?? 0;
      const total = avansRamas + rest;
      return { event: e, avansRamas, rest, total };
    })
    .filter((r) => r.total > 0);

  const urmeaza = viitoare.reduce((s, r) => s + r.total, 0);
  const collectedPct = totalAn > 0 ? Math.round((incasat / totalAn) * 100) : 0;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Situație financiară</p>
          <h3 className="text-white font-medium text-sm">{year} · {relevant.length} evenimente confirmate</h3>
        </div>
      </div>

      {/* Progress încasat / total */}
      <div>
        <div className="flex items-end justify-between mb-1.5">
          <div>
            <span className="text-white text-xl font-light">{formatEUR(incasat)}</span>
            <span className="text-neutral-500 text-xs ml-2">încasat</span>
          </div>
          <span className="text-neutral-400 text-sm">din {formatEUR(totalAn)}</span>
        </div>
        <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${collectedPct}%` }}
          />
        </div>
        <p className="text-neutral-500 text-xs mt-1.5">{collectedPct}% din totalul contractat pe {year}</p>
      </div>

      {/* Sumarul rapid */}
      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-neutral-800">
        <div className="bg-neutral-800/50 rounded-xl px-4 py-3">
          <p className="text-xs text-neutral-500 mb-1">Avans încasat</p>
          <p className="text-emerald-400 font-semibold">{formatEUR(incasat)}</p>
        </div>
        <div className="bg-neutral-800/50 rounded-xl px-4 py-3">
          <p className="text-xs text-neutral-500 mb-1">Urmează să primești</p>
          <p className="text-amber-400 font-semibold">{formatEUR(urmeaza)}</p>
        </div>
      </div>

      {/* Lista evenimente viitoare */}
      {viitoare.length > 0 && (
        <div className="border-t border-neutral-800 pt-3 space-y-1">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-between text-xs text-neutral-500 hover:text-neutral-300 transition-colors pb-2"
          >
            <span className="uppercase tracking-wide font-medium">Detaliu pe evenimente</span>
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {expanded && (
            <div className="space-y-1">
              {viitoare.map(({ event: e, avansRamas, rest }) => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-neutral-800/60 last:border-0">
                  <div className="min-w-0">
                    <p className="text-white text-xs font-medium truncate">{e.client.fullName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-neutral-500 text-xs">
                        {e.eventDate ? formatDate(new Date(e.eventDate)) : ""}
                      </span>
                      {avansRamas > 0 && (
                        <span className="text-amber-400 text-xs">avans {formatEUR(avansRamas)}</span>
                      )}
                      {rest > 0 && (
                        <span className="text-neutral-400 text-xs">rest {formatEUR(rest)}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-white text-sm font-semibold shrink-0 ml-3">
                    {formatEUR(avansRamas + rest)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FinancialSummary;
