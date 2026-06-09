import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { ClientEvent, AdminSettings } from "../types";
import AncaLoader from "../../../components/UI/AncaLoader";

const DEFAULT_SETTINGS: AdminSettings = {
  goals: {
    sixMonths: { targetRevenue: 15000, startDate: "2026-04-01", endDate: "2026-09-30" },
    oneYear: { targetRevenue: 30000, startDate: "2026-01-01", endDate: "2026-12-31" },
  },
  currency: "EUR",
  exchangeRate: 5.0,
  bankDetails: {
    beneficiaryName: "",
    iban: "",
  },
  bankProfiles: [],
};

function normalizeSettings(settingsData: Partial<AdminSettings>): AdminSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...settingsData,
    goals: {
      ...DEFAULT_SETTINGS.goals,
      ...settingsData.goals,
    },
    bankDetails: {
      ...DEFAULT_SETTINGS.bankDetails,
      ...settingsData.bankDetails,
    },
  };
}

const formatEUR = (amount: number) =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);

const formatDate = (date: Date) =>
  date.toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" });

const GoalDetailPage: React.FC = () => {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const [events, setEvents] = useState<ClientEvent[]>([]);
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/events").then((r) => r.json()),
      fetch("/api/admin/settings").then((r) => r.json()),
    ])
      .then(([eventsData, settingsData]) => {
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
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <AncaLoader />;

  const goalKey = type === "one-year" ? "oneYear" : "sixMonths";
  const goal = settings.goals[goalKey];
  const title = type === "one-year" ? "Goal 1 An" : "Goal Personalizat";

  const start = new Date(goal.startDate).getTime();
  const end = new Date(goal.endDate).getTime();

  const relevantEvents = events
    .filter((e) => {
      if (!e.eventDate) return false;
      const t = new Date(e.eventDate).getTime();
      return t >= start && t <= end && (e.status === "finalizat" || e.status === "confirmat");
    })
    .sort((a, b) => new Date(a.eventDate!).getTime() - new Date(b.eventDate!).getTime());

  const finalizate = relevantEvents.filter((e) => e.status === "finalizat");
  const confirmate = relevantEvents.filter((e) => e.status === "confirmat");

  const totalPrimit = finalizate.reduce((s, e) => s + e.pricing.total, 0);
  const totalRezervat = confirmate.reduce((s, e) => s + e.pricing.total, 0);
  const totalRealizat = totalPrimit + totalRezervat;
  const gap = Math.max(0, goal.targetRevenue - totalRealizat);

  const pctPrimit = Math.min(100, (totalPrimit / goal.targetRevenue) * 100);
  const pctRezervat = Math.min(100 - pctPrimit, (totalRezervat / goal.targetRevenue) * 100);
  const totalPct = Math.min(100, Math.round((totalRealizat / goal.targetRevenue) * 100));

  const periodLabel = `${new Date(goal.startDate).toLocaleDateString("ro-RO", { month: "short", year: "numeric" })} → ${new Date(goal.endDate).toLocaleDateString("ro-RO", { month: "short", year: "numeric" })}`;

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-8">

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

          <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Obiectiv financiar</p>
          <h1 className="text-white text-2xl font-light">{title}</h1>
          <p className="text-neutral-400 text-sm mt-1">{periodLabel}</p>
        </div>

        {/* Progress summary */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-white text-3xl font-light">{formatEUR(totalRealizat)}</span>
              <span className="text-neutral-500 text-sm ml-2">din {formatEUR(goal.targetRevenue)}</span>
            </div>
            <span className="text-neutral-400 text-lg font-light">{totalPct}%</span>
          </div>

          <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden flex">
            <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${pctPrimit}%` }} />
            <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${pctRezervat}%` }} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-neutral-950 rounded-xl p-3 border border-neutral-800">
              <p className="text-xs text-neutral-500 mb-1">Bani primiți</p>
              <p className="text-emerald-400 font-medium">{formatEUR(totalPrimit)}</p>
              <p className="text-neutral-600 text-xs mt-0.5">{finalizate.length} event{finalizate.length !== 1 ? "e" : ""}</p>
            </div>
            <div className="bg-neutral-950 rounded-xl p-3 border border-neutral-800">
              <p className="text-xs text-neutral-500 mb-1">Rezervate</p>
              <p className="text-amber-400 font-medium">{formatEUR(totalRezervat)}</p>
              <p className="text-neutral-600 text-xs mt-0.5">{confirmate.length} event{confirmate.length !== 1 ? "e" : ""}</p>
            </div>
            <div className="bg-neutral-950 rounded-xl p-3 border border-neutral-800">
              <p className="text-xs text-neutral-500 mb-1">Mai trebuie</p>
              <p className={`font-medium ${gap === 0 ? "text-emerald-400" : "text-neutral-300"}`}>{gap === 0 ? "✓ Atins!" : formatEUR(gap)}</p>
              <p className="text-neutral-600 text-xs mt-0.5">până la obiectiv</p>
            </div>
          </div>
        </div>

        {/* Finalizate */}
        {finalizate.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <h2 className="text-emerald-400 text-sm font-medium uppercase tracking-wider">Bani primiți — {formatEUR(totalPrimit)}</h2>
            </div>
            {finalizate.map((event) => (
              <EventRow key={event.id} event={event} variant="received" />
            ))}
          </div>
        )}

        {/* Confirmate */}
        {confirmate.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
              <h2 className="text-amber-400 text-sm font-medium uppercase tracking-wider">Urmează să primești — {formatEUR(totalRezervat)}</h2>
            </div>
            {confirmate.map((event) => (
              <EventRow key={event.id} event={event} variant="upcoming" />
            ))}
          </div>
        )}

        {/* Gap explanation */}
        {gap > 0 && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
            <p className="text-neutral-400 text-sm">
              Mai ai nevoie de{" "}
              <span className="text-white font-medium">{formatEUR(gap)}</span>{" "}
              pentru a atinge obiectivul de {formatEUR(goal.targetRevenue)}.
              {confirmate.length > 0 && (
                <> Dacă toate evenimentele rezervate se finalizează, diferența devine{" "}
                  <span className={`font-medium ${gap - totalRezervat <= 0 ? "text-emerald-400" : "text-white"}`}>
                    {gap - totalRezervat <= 0 ? "0 EUR (obiectiv atins! 🎉)" : formatEUR(gap - totalRezervat)}
                  </span>.
                </>
              )}
            </p>
          </div>
        )}

        {relevantEvents.length === 0 && (
          <div className="text-center py-12">
            <p className="text-neutral-500 text-sm">Niciun eveniment confirmat sau finalizat în această perioadă.</p>
          </div>
        )}

      </div>
    </div>
  );
};

interface EventRowProps {
  event: ClientEvent;
  variant: "received" | "upcoming";
}

const EventRow: React.FC<EventRowProps> = ({ event, variant }) => {
  const { pricing } = event;
  const isReceived = variant === "received";
  const advancePaid = pricing.advancePaid && pricing.advanceAmount > 0;
  const hasAdvance = pricing.advanceAmount > 0;
  const remaining = Math.max(0, pricing.total - pricing.advanceAmount);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-white font-medium text-sm">{event.client.fullName}</p>
          <p className="text-neutral-500 text-xs mt-0.5">
            {event.typeLabel || event.type}
            {event.eventDate && <> · {formatDate(new Date(event.eventDate))}</>}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`font-semibold text-base ${isReceived ? "text-emerald-400" : "text-white"}`}>
            {formatEUR(pricing.total)}
          </p>
          <p className="text-neutral-500 text-xs mt-0.5">total contract</p>
        </div>
      </div>

      {/* Money breakdown */}
      {isReceived ? (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
          <span className="text-emerald-400 text-sm">✓</span>
          <span className="text-emerald-400 text-xs">Eveniment finalizat — ai primit toată suma de {formatEUR(pricing.total)}</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {hasAdvance ? (
            <>
              <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${advancePaid ? "bg-emerald-500/10 border-emerald-500/20" : "bg-neutral-800 border-neutral-700"}`}>
                <span className={`text-xs ${advancePaid ? "text-emerald-400" : "text-neutral-400"}`}>
                  {advancePaid ? "✓ Avans primit" : "⏳ Avans neîncasat"}
                </span>
                <span className={`text-sm font-medium ${advancePaid ? "text-emerald-400" : "text-neutral-300"}`}>
                  {formatEUR(pricing.advanceAmount)}
                </span>
              </div>
              {remaining > 0 && (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-400/10 border border-amber-400/20">
                  <span className="text-xs text-amber-400">Rest de primit după eveniment</span>
                  <span className="text-sm font-medium text-amber-400">{formatEUR(remaining)}</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-400/10 border border-amber-400/20">
              <span className="text-xs text-amber-400">Urmează să primești după eveniment</span>
              <span className="text-sm font-medium text-amber-400">{formatEUR(pricing.total)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GoalDetailPage;
