import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { ClientEvent } from "../types";
import EventCard from "./EventCard";
import Redacted from "./Redacted";

const formatEUR = (amount: number) =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);

interface EventListProps {
  events: ClientEvent[];
  targetEventId?: string;
  onAddEvent: () => void;
  onEventUpdated?: (id: string, updated: Partial<ClientEvent>) => void;
  onEventDeleted?: (id: string) => void;
}

const MONTHS_RO = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

export function groupByMonth(events: ClientEvent[], ascending: boolean): Map<string, ClientEvent[]> {
  const map = new Map<string, ClientEvent[]>();

  const sorted = [...events].sort((a, b) => {
    const aTime = a.eventDate ? new Date(a.eventDate).getTime() : 0;
    const bTime = b.eventDate ? new Date(b.eventDate).getTime() : 0;
    return ascending ? aTime - bTime : bTime - aTime;
  });

  for (const event of sorted) {
    if (!event.eventDate) continue;
    const date = new Date(event.eventDate);
    const key = `${MONTHS_RO[date.getMonth()].toUpperCase()} ${date.getFullYear()}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(event);
  }

  return map;
}

export const PAST_STATUSES = new Set(["confirmat", "finalizat"]);

function getEventYear(event: ClientEvent): number | null {
  return event.eventDate ? new Date(event.eventDate).getFullYear() : null;
}

export function partitionEvents(events: ClientEvent[], today: Date, currentYear: number) {
  const yearEvents = events.filter((e) => getEventYear(e) === currentYear);
  const visibleUpcomingYears = [currentYear, currentYear + 1, currentYear + 2];
  const upcoming = events.filter(
    (e) => e.eventDate && new Date(e.eventDate) >= today && PAST_STATUSES.has(e.status),
  );
  const visibleUpcoming = upcoming.filter((e) => {
    const year = getEventYear(e);
    return year !== null && visibleUpcomingYears.includes(year);
  });
  const past = yearEvents.filter(
    (e) =>
      e.eventDate &&
      new Date(e.eventDate) < today &&
      PAST_STATUSES.has(e.status),
  );
  const leads = events.filter((e) => e.status === "lead" || e.status === "tentativ");
  const archived = events.filter((e) => e.status === "anulat");
  return { yearEvents, upcoming: visibleUpcoming, past, leads, archived };
}

type Tab = "leaduri" | "viitor" | "trecut" | "arhiva";
type FiscalFilter = "toate" | "fiscalizate" | "nefiscalizate";

const EventList: React.FC<EventListProps> = ({ events, targetEventId, onAddEvent, onEventUpdated, onEventDeleted }) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("viitor");
  const [fiscalFilter, setFiscalFilter] = useState<FiscalFilter>("toate");
  const [collapsed, setCollapsed] = useState(false);
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [collapseKey, setCollapseKey] = useState(0);
  const [cardStates, setCardStates] = useState<Record<string, boolean>>({});
  const [futureYearSections, setFutureYearSections] = useState<Record<number, boolean>>({});
  const [statesLoaded, setStatesLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/admin/ui-state")
      .then((r) => r.json())
      .then((data) => { if (data.cards && typeof data.cards === "object") setCardStates(data.cards as Record<string, boolean>); })
      .catch(() => {})
      .finally(() => setStatesLoaded(true));
  }, []);

  useEffect(() => {
    if (!statesLoaded || !targetEventId) return;

    const targetEvent = events.find((event) => event.id === targetEventId);
    if (!targetEvent) return;

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const targetDate = targetEvent.eventDate ? new Date(targetEvent.eventDate) : null;
    let nextTab: Tab = "leaduri";

    if (targetEvent.status === "anulat") {
      nextTab = "arhiva";
    } else if (targetEvent.status === "lead" || targetEvent.status === "tentativ") {
      nextTab = "leaduri";
    } else if (targetDate && targetDate < now) {
      nextTab = "trecut";
    } else {
      nextTab = "viitor";
    }

    setTab(nextTab);
    setFiscalFilter("toate");
    setCardStates((prev) => {
      if (prev[targetEventId] === false) return prev;
      const next = { ...prev, [targetEventId]: false };
      persistCardStates(next);
      return next;
    });
    const targetYear = getEventYear(targetEvent);
    if (targetYear && targetYear > currentYear) {
      setFutureYearSections((prev) => ({ ...prev, [targetYear]: false }));
    }
    setCollapseKey((k) => k + 1);

    window.setTimeout(() => {
      const el = document.getElementById(`event-card-${targetEventId}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }, [events, statesLoaded, targetEventId]);

  const persistCardStates = (states: Record<string, boolean>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/admin/ui-state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: states }),
      }).catch(() => {});
    }, 800);
  };

  const handleCardCollapse = (eventId: string, collapsed: boolean) => {
    setCardStates((prev) => {
      const next = { ...prev, [eventId]: collapsed };
      persistCardStates(next);
      return next;
    });
  };

  const currentYear = new Date().getFullYear();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { upcoming, past, leads, archived } = partitionEvents(events, today, currentYear);
  const applyFiscalFilter = (list: ClientEvent[]) =>
    list.filter((event) => {
      if (fiscalFilter === "toate") return true;
      if (fiscalFilter === "fiscalizate") return event.fiscalized === true;
      return event.fiscalized !== true;
    });

  const filteredUpcoming = applyFiscalFilter(upcoming);
  const filteredPast = applyFiscalFilter(past);
  const filteredLeads = applyFiscalFilter(leads);
  const filteredArchived = applyFiscalFilter(archived);
  const futureYears = [currentYear + 1, currentYear + 2];
  const upcomingByYear = new Map<number, ClientEvent[]>(
    [currentYear, ...futureYears].map((year) => [
      year,
      filteredUpcoming.filter((event) => getEventYear(event) === year),
    ]),
  );

  const handleToggleAll = () => {
    const next = !allCollapsed;
    setAllCollapsed(next);
    const newStates = { ...cardStates };
    for (const e of events) { newStates[e.id] = next; }
    setCardStates(newStates);
    persistCardStates(newStates);
    setCollapseKey((k) => k + 1);
  };

  function renderGroup(grouped: Map<string, ClientEvent[]>) {
    return Array.from(grouped.entries()).map(([monthLabel, monthEvents]) => (
      <div key={monthLabel}>
        <p className="text-neutral-500 text-xs tracking-widest uppercase mb-3">{monthLabel}</p>
        <div className="space-y-2">
          {monthEvents.map((event) => (
            <div id={`event-card-${event.id}`} key={`${event.id}-${collapseKey}`}>
              <EventCard
                event={event}
                initialCollapsed={cardStates[event.id] ?? allCollapsed}
                onCollapseChange={(c) => handleCardCollapse(event.id, c)}
                onUpdated={(updated) => onEventUpdated?.(event.id, updated)}
                onDeleted={() => onEventDeleted?.(event.id)}
              />
            </div>
          ))}
        </div>
      </div>
    ));
  }

  function renderYearBlock(year: number, collapsible: boolean) {
    const yearEvents = upcomingByYear.get(year) ?? [];
    const grouped = groupByMonth(yearEvents, true);
    const isCollapsed = futureYearSections[year] ?? true;

    if (!collapsible) {
      return (
        <section key={year} className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-white">Evenimente {year}</h3>
              <p className="text-xs text-neutral-500">{yearEvents.length} programate</p>
            </div>
          </div>
          {grouped.size === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-950/50 px-4 py-5 text-sm text-neutral-500">
              Niciun eveniment viitor confirmat în {year}.
            </div>
          ) : (
            <div className="space-y-8">{renderGroup(grouped)}</div>
          )}
        </section>
      );
    }

    return (
      <section key={year} className="rounded-2xl border border-neutral-800 bg-neutral-950/40">
        <button
          type="button"
          onClick={() => setFutureYearSections((prev) => ({ ...prev, [year]: !isCollapsed }))}
          className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-neutral-900/60"
        >
          <div>
            <h3 className="text-sm font-medium text-white">Evenimente {year}</h3>
            <p className="text-xs text-neutral-500">{yearEvents.length} programate</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-[11px] uppercase tracking-wider text-neutral-400">
              {isCollapsed ? "Închis" : "Deschis"}
            </span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`text-neutral-500 transition-transform ${isCollapsed ? "" : "rotate-180"}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>
        {!isCollapsed && (
          <div className="border-t border-neutral-800 px-4 py-4">
            {grouped.size === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-950/50 px-4 py-5 text-sm text-neutral-500">
                Niciun eveniment viitor confirmat în {year}.
              </div>
            ) : (
              <div className="space-y-8">{renderGroup(grouped)}</div>
            )}
          </div>
        )}
      </section>
    );
  }

  function renderLeads(list: ClientEvent[]) {
    // sort: tentativ first, then lead; within each group sort by createdAt desc
    const sorted = [...list].sort((a, b) => {
      if (a.status === b.status) return b.createdAt.getTime() - a.createdAt.getTime();
      return a.status === "tentativ" ? -1 : 1;
    });
    return (
      <div className="space-y-2">
        {sorted.map((event) => (
          <div id={`event-card-${event.id}`} key={`${event.id}-${collapseKey}`}>
            <EventCard
              event={event}
              initialCollapsed={cardStates[event.id] ?? allCollapsed}
              onCollapseChange={(c) => handleCardCollapse(event.id, c)}
              onUpdated={(updated) => onEventUpdated?.(event.id, updated)}
              onDeleted={() => onEventDeleted?.(event.id)}
            />
          </div>
        ))}
      </div>
    );
  }

  function renderArchive(list: ClientEvent[]) {
    const sorted = [...list].sort((a, b) => {
      const aTime = a.eventDate ? new Date(a.eventDate).getTime() : 0;
      const bTime = b.eventDate ? new Date(b.eventDate).getTime() : 0;
      return bTime - aTime;
    });
    return (
      <div className="space-y-2 opacity-60">
        {sorted.map((event) => (
          <div id={`event-card-${event.id}`} key={`${event.id}-${collapseKey}`}>
            <EventCard
              event={event}
              initialCollapsed={cardStates[event.id] ?? true}
              onCollapseChange={(c) => handleCardCollapse(event.id, c)}
              onUpdated={(updated) => onEventUpdated?.(event.id, updated)}
              onDeleted={() => onEventDeleted?.(event.id)}
            />
          </div>
        ))}
      </div>
    );
  }

  const tabs: { key: Tab; label: string; count: number; color: string }[] = [
    { key: "leaduri", label: "Lead", count: filteredLeads.length, color: "bg-amber-500/20 text-amber-400" },
    { key: "viitor", label: "Viitor", count: filteredUpcoming.length, color: "bg-emerald-500/20 text-emerald-400" },
    { key: "trecut", label: "Trecut", count: filteredPast.length, color: "bg-neutral-600 text-neutral-300" },
  ];

  function renderContent() {
    if (tab === "leaduri") {
      if (filteredLeads.length === 0) {
        return (
          <div className="text-center py-12">
            <p className="text-neutral-500 text-sm">Niciun lead activ.</p>
            <button
              onClick={onAddEvent}
              className="mt-4 text-xs text-neutral-400 underline underline-offset-4 hover:text-white transition-colors"
            >
              Adaugă primul lead
            </button>
          </div>
        );
      }
      return renderLeads(filteredLeads);
    }

    if (tab === "viitor") {
      return (
        <div className="space-y-6">
          {renderYearBlock(currentYear, false)}
          {futureYears.map((year) => renderYearBlock(year, true))}
        </div>
      );
    }

    if (tab === "trecut") {
      const grouped = groupByMonth(filteredPast, false);
      if (grouped.size === 0) {
        return (
          <div className="text-center py-12">
            <p className="text-neutral-500 text-sm">Niciun eveniment finalizat în {currentYear}.</p>
          </div>
        );
      }

      const totalSum = filteredPast.reduce((sum, e) => sum + (e.pricing?.total ?? 0), 0);
      const advanceSum = filteredPast.reduce((sum, e) => sum + (e.pricing?.advanceAmount ?? 0), 0);
      const remainingSum = filteredPast.reduce((sum, e) => sum + (e.pricing?.remainingAmount ?? 0), 0);

      return (
        <>
          <div className="space-y-8 opacity-70">{renderGroup(grouped)}</div>
          <div className="mt-6 rounded-xl border border-neutral-700/60 bg-neutral-800/40 px-5 py-4">
            <p className="text-xs text-neutral-500 uppercase tracking-widest mb-3">Total încasat — {filteredPast.length} evenimente</p>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-wrap gap-6 text-sm text-neutral-400">
                <span>
                  Avans{" "}
                  <Redacted><span className="text-neutral-200 font-medium">{formatEUR(advanceSum)}</span></Redacted>
                </span>
                <span>
                  Rest{" "}
                  <Redacted><span className="text-neutral-200 font-medium">{formatEUR(remainingSum)}</span></Redacted>
                </span>
              </div>
              <div className="text-right">
                <p className="text-xs text-neutral-500 mb-0.5">Total</p>
                <Redacted><p className="text-xl font-semibold text-white">{formatEUR(totalSum)}</p></Redacted>
              </div>
            </div>
          </div>
        </>
      );
    }

    if (tab === "arhiva") {
      if (filteredArchived.length === 0) {
        return (
          <div className="text-center py-12">
            <p className="text-neutral-500 text-sm">Arhiva este goală.</p>
          </div>
        );
      }
      return renderArchive(filteredArchived);
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-5">
          <h2 className="text-white font-medium whitespace-nowrap">Evenimente {currentYear}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/admin/calendar")}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors"
              title="Calendar"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </button>
            <button
              onClick={onAddEvent}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-medium hover:bg-amber-400 transition-colors"
            >
              <span className="text-sm leading-none font-bold">+</span>
              Lead nou
            </button>
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              title={collapsed ? "Extinde lista" : "Restrânge lista"}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-700 text-neutral-500 hover:border-neutral-500 hover:text-white transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
        </div>

        {!collapsed && (
          <>
            <div className="mb-4 flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
              {([
                { key: "toate", label: "Toate" },
                { key: "fiscalizate", label: "Fiscalizate" },
                { key: "nefiscalizate", label: "Nefiscalizate" },
              ] as const).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setFiscalFilter(option.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs whitespace-nowrap flex-shrink-0 transition-colors ${
                    fiscalFilter === option.key
                      ? "border-white bg-white text-black"
                      : "border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-neutral-800/60 rounded-xl p-1 mb-6">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    tab === t.key
                      ? "bg-neutral-900 text-white shadow"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  {t.label}
                  {t.count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-xs ${tab === t.key ? t.color : "bg-neutral-700 text-neutral-500"}`}>
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {!statesLoaded ? (
          <div className="py-8 flex justify-center">
            <svg className="animate-spin text-neutral-600" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity=".25"/><path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
          </div>
        ) : collapsed ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span className="rounded-full border border-neutral-700 px-2 py-1">Lead-uri {filteredLeads.length}</span>
            <span className="rounded-full border border-neutral-700 px-2 py-1">Viitoare {filteredUpcoming.length}</span>
            <span className="rounded-full border border-neutral-700 px-2 py-1">Trecute {filteredPast.length}</span>
            <span className="rounded-full border border-neutral-700 px-2 py-1">Arhivă {filteredArchived.length}</span>
          </div>
        ) : (
          (tab !== "leaduri" && tab !== "arhiva") && (
            <div className="mb-3 flex justify-end">
              <button
                onClick={handleToggleAll}
                className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`transition-transform duration-200 ${allCollapsed ? "rotate-180" : ""}`}
                >
                  <polyline points="18 15 12 9 6 15" />
                </svg>
                {allCollapsed ? "Expandează tot" : "Colapsează tot"}
              </button>
            </div>
          )
        )}
        {!statesLoaded ? null : (
          <div className="mt-2">
            {renderContent()}
          </div>
        )}
      </div>
    </div>
  );
};

export default EventList;
