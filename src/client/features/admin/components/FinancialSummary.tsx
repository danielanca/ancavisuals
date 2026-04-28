import React, { useState } from "react";
import type { ClientEvent } from "../types";
import Redacted from "./Redacted";

interface Props {
  events: ClientEvent[];
}

const formatEUR = (n: number) =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const formatDate = (d: Date) =>
  d.toLocaleDateString("ro-RO", { day: "numeric", month: "short" });

type FinancialRow = {
  event: ClientEvent;
  amount: number;
  kind: "full" | "advance" | "remaining";
};

const FinancialSummary: React.FC<Props> = ({ events }) => {
  const [expanded, setExpanded] = useState(false);
  const year = new Date().getFullYear();

  const relevant = events.filter((e) => {
    if (e.status !== "confirmat" && e.status !== "finalizat") return false;
    if (!e.eventDate) return false;
    return new Date(e.eventDate).getFullYear() === year;
  });

  if (relevant.length === 0) return null;

  const finalizateCount = relevant.filter((e) => e.status === "finalizat").length;
  const confirmateCount = relevant.filter((e) => e.status === "confirmat").length;

  const totalAn = relevant.reduce((s, e) => s + (e.pricing?.total ?? 0), 0);
  const receivedRows = relevant
    .reduce<FinancialRow[]>((rows, event) => {
      if (event.status === "finalizat" && event.pricing.total > 0) {
        rows.push({ event, amount: event.pricing.total, kind: "full" });
      }
      if (event.status === "confirmat" && event.pricing.advancePaid && event.pricing.advanceAmount > 0) {
        rows.push({ event, amount: event.pricing.advanceAmount, kind: "advance" });
      }
      return rows;
    }, [])
    .sort((a, b) => new Date(a.event.eventDate!).getTime() - new Date(b.event.eventDate!).getTime());

  const upcomingRows = relevant
    .reduce<FinancialRow[]>((rows, event) => {
      if (event.status !== "confirmat") return rows;
      if (!event.pricing.advancePaid && event.pricing.advanceAmount > 0) {
        rows.push({ event, amount: event.pricing.advanceAmount, kind: "advance" });
      }
      if (event.pricing.remainingAmount > 0) {
        rows.push({ event, amount: event.pricing.remainingAmount, kind: "remaining" });
      }
      return rows;
    }, [])
    .sort((a, b) => new Date(a.event.eventDate!).getTime() - new Date(b.event.eventDate!).getTime());

  const incasat = receivedRows.reduce((sum, row) => sum + row.amount, 0);
  const urmeaza = upcomingRows.reduce((sum, row) => sum + row.amount, 0);
  const collectedPct = totalAn > 0 ? Math.round((incasat / totalAn) * 100) : 0;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Situație financiară</p>
          <h3 className="text-white font-medium text-sm">{year} · {relevant.length} evenimente confirmate/finalizate</h3>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              {finalizateCount} finalizate
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              {confirmateCount} de terminat
            </span>
          </div>
        </div>
      </div>

      {/* Progress collected / total */}
      <div>
        <p className="text-xs text-neutral-500 uppercase tracking-widest mb-2">Progres încasare</p>
        <div className="flex items-end justify-between mb-1.5">
          <div>
            <span className="text-white text-xl font-light"><Redacted>{formatEUR(incasat)}</Redacted></span>
            <span className="text-neutral-500 text-xs ml-2">încasat</span>
          </div>
          <span className="text-neutral-400 text-sm">din <Redacted>{formatEUR(totalAn)}</Redacted></span>
        </div>
        <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-amber-400 transition-all duration-500"
            style={{ width: `${collectedPct}%` }}
          />
        </div>
        <p className="text-neutral-500 text-xs mt-1.5">{collectedPct}% din totalul contractat pe {year}</p>
      </div>

      {/* Sumarul rapid */}
      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-neutral-800">
        <div className="bg-neutral-800/50 rounded-xl px-4 py-3">
          <p className="text-xs text-neutral-500 mb-1">Bani primiți</p>
          <p className="text-emerald-400 font-semibold"><Redacted>{formatEUR(incasat)}</Redacted></p>
        </div>
        <div className="bg-neutral-800/50 rounded-xl px-4 py-3">
          <p className="text-xs text-neutral-500 mb-1">Urmează să primești</p>
          <p className="text-amber-400 font-semibold"><Redacted>{formatEUR(urmeaza)}</Redacted></p>
        </div>
      </div>

      {/* Lista evenimente */}
      {(receivedRows.length > 0 || upcomingRows.length > 0) && (
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
            <div className="space-y-4">
              {receivedRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <h4 className="text-emerald-400 text-xs font-medium uppercase tracking-wider">
                      Bani primiți — <Redacted>{formatEUR(incasat)}</Redacted>
                    </h4>
                  </div>
                  <div className="space-y-1">
                    {receivedRows.map((row) => (
                      <FinancialSummaryRow key={`${row.event.id}-${row.kind}-received`} row={row} variant="received" />
                    ))}
                  </div>
                </div>
              )}

              {upcomingRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400 shrink-0" />
                    <h4 className="text-amber-400 text-xs font-medium uppercase tracking-wider">
                      Urmează să primești — <Redacted>{formatEUR(urmeaza)}</Redacted>
                    </h4>
                  </div>
                  <div className="space-y-1">
                    {upcomingRows.map((row) => (
                      <FinancialSummaryRow key={`${row.event.id}-${row.kind}-upcoming`} row={row} variant="upcoming" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const FinancialSummaryRow: React.FC<{ row: FinancialRow; variant: "received" | "upcoming" }> = ({ row, variant }) => {
  const { event, amount, kind } = row;
  const toneClass = variant === "received" ? "text-emerald-400" : "text-amber-400";
  const amountClass = variant === "received" ? "text-emerald-400" : "text-white";

  const label =
    kind === "full"
      ? "Eveniment finalizat"
      : kind === "advance"
        ? variant === "received"
          ? "Avans primit"
          : "Avans neîncasat"
        : "Rest de primit";

  return (
    <div className="flex items-center justify-between py-2 border-b border-neutral-800/60 last:border-0">
      <div className="min-w-0">
        <p className="text-white text-xs font-medium truncate"><Redacted>{event.client.fullName}</Redacted></p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-neutral-500 text-xs">
            {event.eventDate ? formatDate(new Date(event.eventDate)) : ""}
          </span>
          <span className={`text-xs ${toneClass}`}>{label}</span>
        </div>
      </div>
      <span className={`text-sm font-semibold shrink-0 ml-3 ${amountClass}`}>
        <Redacted>{formatEUR(amount)}</Redacted>
      </span>
    </div>
  );
};

export default FinancialSummary;
