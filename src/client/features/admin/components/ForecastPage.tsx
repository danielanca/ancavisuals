import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { ClientEvent, AdminSettings, YearTarget } from "../types";
import AncaLoader from "../../../components/UI/AncaLoader";
import Redacted from "./Redacted";

// ── Settings defaults / normalize (same shape as Dashboard/GoalDetailPage) ──

const DEFAULT_SETTINGS: AdminSettings = {
  goals: {
    sixMonths: { targetRevenue: 15000, startDate: "2026-04-01", endDate: "2026-09-30" },
    oneYear: { targetRevenue: 30000, startDate: "2026-01-01", endDate: "2026-12-31" },
  },
  currency: "EUR",
  exchangeRate: 5.0,
  bankDetails: { beneficiaryName: "", iban: "" },
  bankProfiles: [],
  yearlyTargets: {},
};

function normalizeSettings(settingsData: Partial<AdminSettings>): AdminSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...settingsData,
    goals: { ...DEFAULT_SETTINGS.goals, ...settingsData.goals },
    bankDetails: { ...DEFAULT_SETTINGS.bankDetails, ...settingsData.bankDetails },
    yearlyTargets: { ...DEFAULT_SETTINGS.yearlyTargets, ...settingsData.yearlyTargets },
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

const BOOKED_STATUSES = new Set(["confirmat", "finalizat"]);
const PIPELINE_STATUSES = new Set(["lead", "tentativ"]);
const FUTURE_YEARS_SHOWN = 5; // anul curent + 4 ani următori, mereu vizibili

const formatEUR = (amount: number) =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);

const formatDate = (date: Date) =>
  date.toLocaleDateString("ro-RO", { day: "numeric", month: "long" });

function getEventYear(event: ClientEvent): number | null {
  return event.eventDate ? new Date(event.eventDate).getFullYear() : null;
}

export function buildForecastYears(events: ClientEvent[], currentYear: number): number[] {
  const base: number[] = [];
  for (let i = 0; i < FUTURE_YEARS_SHOWN; i++) base.push(currentYear + i);

  const extra = new Set<number>();
  for (const event of events) {
    if (!BOOKED_STATUSES.has(event.status)) continue;
    const year = getEventYear(event);
    if (year !== null && year > base[base.length - 1]) extra.add(year);
  }

  return [...base, ...Array.from(extra).sort((a, b) => a - b)];
}

interface YearStats {
  year: number;
  booked: ClientEvent[];
  finalizate: ClientEvent[];
  confirmate: ClientEvent[];
  pipeline: ClientEvent[];
  withContract: number;
  totalPrimit: number;
  totalRezervat: number;
  totalRealizat: number;
}

export function computeYearStats(events: ClientEvent[], year: number): YearStats {
  const yearEvents = events.filter((e) => getEventYear(e) === year);
  const booked = yearEvents
    .filter((e) => BOOKED_STATUSES.has(e.status))
    .sort((a, b) => new Date(a.eventDate!).getTime() - new Date(b.eventDate!).getTime());
  const finalizate = booked.filter((e) => e.status === "finalizat");
  const confirmate = booked.filter((e) => e.status === "confirmat");
  const pipeline = yearEvents.filter((e) => PIPELINE_STATUSES.has(e.status));
  const withContract = booked.filter((e) => !!e.contractId).length;
  const totalPrimit = finalizate.reduce((s, e) => s + e.pricing.total, 0);
  const totalRezervat = confirmate.reduce((s, e) => s + e.pricing.total, 0);

  return {
    year,
    booked,
    finalizate,
    confirmate,
    pipeline,
    withContract,
    totalPrimit,
    totalRezervat,
    totalRealizat: totalPrimit + totalRezervat,
  };
}

// ── Page ─────────────────────────────────────────────────────────────────

const ForecastPage: React.FC = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<ClientEvent[]>([]);
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedYear, setExpandedYear] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/events").then((r) => r.json()),
      fetch("/api/admin/settings").then((r) => r.json()),
    ])
      .then(([eventsData, settingsData]) => {
        if (eventsData.error) throw new Error(eventsData.error);
        setEvents(
          (eventsData.events ?? []).map((e: ClientEvent & { eventDate: string | null; eventEndDate?: string | null; createdAt: string }) => ({
            ...e,
            eventDate: e.eventDate ? new Date(e.eventDate) : null,
            eventEndDate: e.eventEndDate ? new Date(e.eventEndDate) : null,
            createdAt: new Date(e.createdAt),
          })),
        );
        if (!settingsData.error) setSettings(normalizeSettings(settingsData));
      })
      .catch((fetchError: Error) => setError(fetchError.message))
      .finally(() => setLoading(false));
  }, []);

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => buildForecastYears(events, currentYear), [events, currentYear]);

  const handleTargetSave = async (year: number, target: YearTarget) => {
    const updated: AdminSettings = {
      ...settings,
      yearlyTargets: { ...settings.yearlyTargets, [String(year)]: target },
    };
    setSettings(updated);
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
  };

  if (loading) return <AncaLoader />;

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <p className="text-red-400 text-sm">Eroare: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Back + Header */}
        <div>
          <button
            onClick={() => navigate("/admin")}
            className="flex items-center gap-1.5 text-neutral-500 hover:text-white text-sm transition-colors mb-5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Înapoi la dashboard
          </button>

          <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Proiecție</p>
          <h1 className="text-white text-2xl font-light">Proiecție evenimente</h1>
          <p className="text-neutral-400 text-sm mt-1">
            Câte evenimente ai deja rezervate pe fiecare an și cât venit reprezintă, față de obiectivul tău.
          </p>
        </div>

        {years.map((year) => (
          <YearCard
            key={year}
            stats={computeYearStats(events, year)}
            target={settings.yearlyTargets?.[String(year)] ?? {}}
            isCurrentYear={year === currentYear}
            expanded={expandedYear === year}
            onToggleExpanded={() => setExpandedYear((prev) => (prev === year ? null : year))}
            onSaveTarget={(target) => handleTargetSave(year, target)}
          />
        ))}
      </div>
    </div>
  );
};

// ── Year Card ────────────────────────────────────────────────────────────

interface YearCardProps {
  stats: YearStats;
  target: YearTarget;
  isCurrentYear: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  onSaveTarget: (target: YearTarget) => Promise<void>;
}

const YearCard: React.FC<YearCardProps> = ({ stats, target, isCurrentYear, expanded, onToggleExpanded, onSaveTarget }) => {
  const [editing, setEditing] = useState(false);
  const [eventsInput, setEventsInput] = useState(target.targetEvents ? String(target.targetEvents) : "");
  const [revenueInput, setRevenueInput] = useState(target.targetRevenue ? String(target.targetRevenue) : "");
  const [saving, setSaving] = useState(false);

  const { booked, finalizate, confirmate, pipeline, withContract, totalPrimit, totalRezervat, totalRealizat } = stats;

  const hasEventsTarget = !!target.targetEvents && target.targetEvents > 0;
  const hasRevenueTarget = !!target.targetRevenue && target.targetRevenue > 0;
  const hasAnyTarget = hasEventsTarget || hasRevenueTarget;

  const eventsPct = hasEventsTarget ? Math.min(100, Math.round((booked.length / target.targetEvents!) * 100)) : null;
  const revenuePctPrimit = hasRevenueTarget ? Math.min(100, (totalPrimit / target.targetRevenue!) * 100) : 0;
  const revenuePctRezervat = hasRevenueTarget ? Math.min(100 - revenuePctPrimit, (totalRezervat / target.targetRevenue!) * 100) : 0;
  const revenuePct = hasRevenueTarget ? Math.min(100, Math.round((totalRealizat / target.targetRevenue!) * 100)) : null;

  const eventsGap = hasEventsTarget ? Math.max(0, target.targetEvents! - booked.length) : null;
  const revenueGap = hasRevenueTarget ? Math.max(0, target.targetRevenue! - totalRealizat) : null;

  const targetsMet = (!hasEventsTarget || eventsGap === 0) && (!hasRevenueTarget || revenueGap === 0);

  const avgPerEventTarget = hasEventsTarget && hasRevenueTarget ? target.targetRevenue! / target.targetEvents! : null;
  const avgPerEventActual = booked.length > 0 ? totalRealizat / booked.length : null;
  const avgPerEventRemaining = eventsGap && eventsGap > 0 && revenueGap !== null ? revenueGap / eventsGap : null;

  const editEvents = parseInt(eventsInput.replace(/\D/g, ""), 10);
  const editRevenue = parseInt(revenueInput.replace(/\D/g, ""), 10);
  const editAvgPerEvent = editEvents > 0 && editRevenue > 0 ? editRevenue / editEvents : null;

  const openEdit = () => {
    setEventsInput(target.targetEvents ? String(target.targetEvents) : "");
    setRevenueInput(target.targetRevenue ? String(target.targetRevenue) : "");
    setEditing(true);
  };

  const handleSave = async () => {
    const targetEvents = eventsInput.trim() ? parseInt(eventsInput.replace(/\D/g, ""), 10) : undefined;
    const targetRevenue = revenueInput.trim() ? parseInt(revenueInput.replace(/\D/g, ""), 10) : undefined;
    setSaving(true);
    await onSaveTarget({
      targetEvents: targetEvents && targetEvents > 0 ? targetEvents : undefined,
      targetRevenue: targetRevenue && targetRevenue > 0 ? targetRevenue : undefined,
    });
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-white text-lg font-medium">{stats.year}</h2>
          {isCurrentYear && (
            <span className="text-[10px] uppercase tracking-wider text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 rounded-full px-2 py-0.5">
              anul curent
            </span>
          )}
          {hasAnyTarget && (
            <span className="text-lg">{targetsMet ? "✅" : "⏳"}</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {!editing && (
            <button onClick={openEdit} className="text-neutral-600 hover:text-neutral-300 transition-colors" title="Editează obiectivul">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
          <button onClick={onToggleExpanded} className="text-xs text-neutral-500 hover:text-white transition-colors">
            {expanded ? "Ascunde evenimentele" : `→ ${booked.length} eveniment${booked.length !== 1 ? "e" : ""}`}
          </button>
        </div>
      </div>

      {/* Edit form */}
      {editing ? (
        <div className="flex flex-col gap-3 pt-1 border-t border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="text-neutral-500 text-xs w-28 shrink-0">Target evenimente</span>
            <input
              type="text"
              inputMode="numeric"
              value={eventsInput}
              onChange={(e) => setEventsInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
              placeholder="ex: 20"
              className="flex-1 bg-neutral-800 text-white text-sm border border-neutral-600 rounded-lg px-2 py-1.5 outline-none focus:border-neutral-400 text-right"
              autoFocus
            />
            <span className="text-neutral-400 text-xs">/ an</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-neutral-500 text-xs w-28 shrink-0">Target sumă</span>
            <input
              type="text"
              inputMode="numeric"
              value={revenueInput}
              onChange={(e) => setRevenueInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
              placeholder="ex: 30000"
              className="flex-1 bg-neutral-800 text-white text-sm border border-neutral-600 rounded-lg px-2 py-1.5 outline-none focus:border-neutral-400 text-right"
            />
            <span className="text-neutral-400 text-xs">EUR</span>
          </div>
          {editAvgPerEvent !== null && (
            <div className="flex items-center justify-between bg-neutral-800/60 rounded-lg px-3 py-2">
              <span className="text-neutral-400 text-xs">Preț mediu / eveniment, ca să atingi targetul</span>
              <span className="text-white text-sm font-medium">≈ {formatEUR(editAvgPerEvent)}</span>
            </div>
          )}
          <p className="text-neutral-600 text-xs">Lasă un câmp gol dacă nu vrei să urmărești acel tip de obiectiv pentru {stats.year}.</p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-neutral-200 disabled:opacity-50 transition-colors"
            >
              {saving ? "Se salvează..." : "Salvează"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-400 text-xs hover:border-neutral-500 transition-colors"
            >
              Anulează
            </button>
          </div>
        </div>
      ) : !hasAnyTarget ? (
        <div className="flex items-center justify-between bg-neutral-950 border border-dashed border-neutral-800 rounded-xl px-4 py-3">
          <p className="text-neutral-500 text-xs">
            {booked.length} eveniment{booked.length !== 1 ? "e" : ""} rezervat{booked.length !== 1 ? "e" : ""} · <Redacted>{formatEUR(totalRealizat)}</Redacted> — fără obiectiv setat
          </p>
          <button onClick={openEdit} className="text-xs text-white underline decoration-neutral-600 hover:decoration-white transition-colors shrink-0">
            Setează target
          </button>
        </div>
      ) : (
        <div className="space-y-4">

          {/* Events progress */}
          {hasEventsTarget && (
            <div className="space-y-1.5">
              <div className="flex items-end justify-between">
                <span className="text-white text-sm">
                  {booked.length} <span className="text-neutral-500">din {target.targetEvents} evenimente</span>
                </span>
                <span className="text-neutral-400 text-xs">{eventsPct}%</span>
              </div>
              <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div className="h-full bg-sky-400 transition-all duration-500" style={{ width: `${eventsPct}%` }} />
              </div>
              {eventsGap !== null && eventsGap > 0 && (
                <p className="text-neutral-500 text-xs">
                  Mai ai nevoie de <span className="text-white">{eventsGap}</span> eveniment{eventsGap !== 1 ? "e" : ""} rezervat{eventsGap !== 1 ? "e" : ""}
                  {pipeline.length > 0 && <> · ai {pipeline.length} lead/tentativ în pipeline pentru {stats.year}</>}.
                </p>
              )}
            </div>
          )}

          {/* Revenue progress */}
          {hasRevenueTarget && (
            <div className="space-y-1.5">
              <div className="flex items-end justify-between">
                <span className="text-white text-sm"><Redacted>{formatEUR(totalRealizat)}</Redacted> <span className="text-neutral-500">din <Redacted>{formatEUR(target.targetRevenue!)}</Redacted></span></span>
                <span className="text-neutral-400 text-xs">{revenuePct}%</span>
              </div>
              <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden flex">
                <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${revenuePctPrimit}%` }} />
                <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${revenuePctRezervat}%` }} />
              </div>
              {revenueGap !== null && revenueGap > 0 && (
                <p className="text-neutral-500 text-xs">
                  Mai ai nevoie de <Redacted>{formatEUR(revenueGap)}</Redacted> pentru a atinge obiectivul.
                </p>
              )}
            </div>
          )}

          {/* Preț mediu / eveniment */}
          {avgPerEventTarget !== null && (
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="bg-neutral-950 rounded-xl p-3 border border-neutral-800">
                <p className="text-xs text-neutral-500 mb-1">Medie țintă</p>
                <p className="text-white font-medium text-sm"><Redacted>{formatEUR(avgPerEventTarget)}</Redacted></p>
                <p className="text-neutral-600 text-xs mt-0.5">per eveniment</p>
              </div>
              <div className="bg-neutral-950 rounded-xl p-3 border border-neutral-800">
                <p className="text-xs text-neutral-500 mb-1">Medie realizată</p>
                <p className="text-neutral-300 font-medium text-sm">{avgPerEventActual !== null ? <Redacted>{formatEUR(avgPerEventActual)}</Redacted> : "—"}</p>
                <p className="text-neutral-600 text-xs mt-0.5">{booked.length} eveniment{booked.length !== 1 ? "e" : ""} rezervat{booked.length !== 1 ? "e" : ""}</p>
              </div>
              <div className="bg-neutral-950 rounded-xl p-3 border border-neutral-800">
                <p className="text-xs text-neutral-500 mb-1">Necesar pt. rest</p>
                <p className={`font-medium text-sm ${avgPerEventRemaining === null ? "text-emerald-400" : "text-amber-400"}`}>
                  {avgPerEventRemaining !== null ? <Redacted>{formatEUR(avgPerEventRemaining)}</Redacted> : "✓ Atins"}
                </p>
                <p className="text-neutral-600 text-xs mt-0.5">{eventsGap && eventsGap > 0 ? `pe fiecare din cele ${eventsGap} rămase` : "target atins"}</p>
              </div>
            </div>
          )}

          {/* Quick stats row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500 pt-1 border-t border-neutral-800">
            <span>{finalizate.length} finalizate</span>
            <span>{confirmate.length} confirmate</span>
            <span>{withContract} cu contract semnat</span>
            {pipeline.length > 0 && <span className="text-neutral-600">{pipeline.length} în pipeline (lead/tentativ)</span>}
          </div>
        </div>
      )}

      {/* Event list */}
      {expanded && (
        <div className="space-y-2 pt-2 border-t border-neutral-800">
          {booked.length === 0 && (
            <p className="text-neutral-600 text-xs py-2">Niciun eveniment rezervat pentru {stats.year} încă.</p>
          )}
          {booked.map((event) => (
            <div key={event.id} className="flex items-center justify-between gap-3 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2">
              <div className="min-w-0">
                <p className="text-white text-sm truncate">{event.client.fullName}</p>
                <p className="text-neutral-500 text-xs mt-0.5">
                  {event.typeLabel || event.type}
                  {event.eventDate && <> · {formatDate(new Date(event.eventDate))}</>}
                  {event.status === "finalizat" && <span className="text-emerald-400"> · finalizat</span>}
                  {event.status === "confirmat" && <span className="text-amber-400"> · confirmat</span>}
                </p>
              </div>
              <span className="text-neutral-300 text-sm shrink-0"><Redacted>{formatEUR(event.pricing.total)}</Redacted></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ForecastPage;
