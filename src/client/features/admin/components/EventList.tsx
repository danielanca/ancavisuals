import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ClientEvent } from "../types";
import EventCard from "./EventCard";

interface EventListProps {
  events: ClientEvent[];
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

export function partitionEvents(events: ClientEvent[], today: Date, currentYear: number) {
  const yearEvents = events.filter(
    (e) => e.eventDate && new Date(e.eventDate).getFullYear() === currentYear,
  );
  const upcoming = yearEvents.filter(
    (e) => e.eventDate && new Date(e.eventDate) >= today && PAST_STATUSES.has(e.status),
  );
  const past = yearEvents.filter(
    (e) =>
      e.eventDate &&
      new Date(e.eventDate) < today &&
      PAST_STATUSES.has(e.status),
  );
  const leads = events.filter((e) => e.status === "lead" || e.status === "tentativ");
  const archived = events.filter((e) => e.status === "anulat");
  return { yearEvents, upcoming, past, leads, archived };
}

type Tab = "leaduri" | "viitor" | "trecut" | "arhiva";

const EventList: React.FC<EventListProps> = ({ events, onAddEvent, onEventUpdated, onEventDeleted }) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("viitor");
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [collapseKey, setCollapseKey] = useState(0);

  const currentYear = new Date().getFullYear();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { upcoming, past, leads, archived } = partitionEvents(events, today, currentYear);

  const handleToggleAll = () => {
    setAllCollapsed((c) => !c);
    setCollapseKey((k) => k + 1);
  };

  function renderGroup(grouped: Map<string, ClientEvent[]>) {
    return Array.from(grouped.entries()).map(([monthLabel, monthEvents]) => (
      <div key={monthLabel}>
        <p className="text-neutral-500 text-xs tracking-widest uppercase mb-3">{monthLabel}</p>
        <div className="space-y-2">
          {monthEvents.map((event) => (
            <EventCard
              key={`${event.id}-${collapseKey}`}
              event={event}
              initialCollapsed={allCollapsed}
              onUpdated={(updated) => onEventUpdated?.(event.id, updated)}
            />
          ))}
        </div>
      </div>
    ));
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
          <EventCard
            key={`${event.id}-${collapseKey}`}
            event={event}
            initialCollapsed={allCollapsed}
            onUpdated={(updated) => onEventUpdated?.(event.id, updated)}
          />
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
          <EventCard
            key={`${event.id}-${collapseKey}`}
            event={event}
            initialCollapsed={true}
            onUpdated={(updated) => onEventUpdated?.(event.id, updated)}
            onDeleted={() => onEventDeleted?.(event.id)}
          />
        ))}
      </div>
    );
  }

  const tabs: { key: Tab; label: string; count: number; color: string }[] = [
    { key: "leaduri", label: "Lead-uri", count: leads.length, color: "bg-amber-500/20 text-amber-400" },
    { key: "viitor", label: "Viitoare", count: upcoming.length, color: "bg-emerald-500/20 text-emerald-400" },
    { key: "trecut", label: "Trecute", count: past.length, color: "bg-neutral-600 text-neutral-300" },
    { key: "arhiva", label: "Arhivă", count: archived.length, color: "bg-red-500/20 text-red-400" },
  ];

  function renderContent() {
    if (tab === "leaduri") {
      if (leads.length === 0) {
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
      return renderLeads(leads);
    }

    if (tab === "viitor") {
      const grouped = groupByMonth(upcoming, true);
      if (grouped.size === 0) {
        return (
          <div className="text-center py-12">
            <p className="text-neutral-500 text-sm">Niciun eveniment viitor confirmat în {currentYear}.</p>
          </div>
        );
      }
      return <div className="space-y-8">{renderGroup(grouped)}</div>;
    }

    if (tab === "trecut") {
      const grouped = groupByMonth(past, false);
      if (grouped.size === 0) {
        return (
          <div className="text-center py-12">
            <p className="text-neutral-500 text-sm">Niciun eveniment finalizat în {currentYear}.</p>
          </div>
        );
      }
      return <div className={`space-y-8 opacity-70`}>{renderGroup(grouped)}</div>;
    }

    if (tab === "arhiva") {
      if (archived.length === 0) {
        return (
          <div className="text-center py-12">
            <p className="text-neutral-500 text-sm">Arhiva este goală.</p>
          </div>
        );
      }
      return renderArchive(archived);
    }
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-white font-medium">Evenimente {currentYear}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/admin/calendar")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-400 text-xs hover:border-neutral-500 hover:text-white transition-colors"
            title="Vezi calendarul"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Calendar
          </button>
          <button
            onClick={onAddEvent}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-medium hover:bg-amber-400 transition-colors"
          >
            <span className="text-base leading-none">+</span>
            Lead nou
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-800/60 rounded-xl p-1 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
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

      {/* Content */}
      <>
        {(tab !== "leaduri" && tab !== "arhiva") && (
          <div className="flex justify-end mb-3">
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
        )}
        {renderContent()}
      </>
    </div>
  );
};

export default EventList;
