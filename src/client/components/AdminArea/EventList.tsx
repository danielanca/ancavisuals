import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ClientEvent } from "../../types/admin";
import EventCard from "./EventCard";

interface EventListProps {
  events: ClientEvent[];
  onAddEvent: () => void;
  onEventUpdated?: (id: string, updated: Partial<ClientEvent>) => void;
}

const MONTHS_RO = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

export function groupByMonth(events: ClientEvent[], ascending: boolean): Map<string, ClientEvent[]> {
  const map = new Map<string, ClientEvent[]>();

  const sorted = [...events].sort((a, b) => {
    const diff = new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
    return ascending ? diff : -diff;
  });

  for (const event of sorted) {
    const date = new Date(event.eventDate);
    const key = `${MONTHS_RO[date.getMonth()].toUpperCase()} ${date.getFullYear()}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(event);
  }

  return map;
}

export const PAST_STATUSES = new Set(["confirmat", "finalizat"]);

export function partitionEvents(events: ClientEvent[], today: Date, currentYear: number) {
  const yearEvents = events.filter((e) => new Date(e.eventDate).getFullYear() === currentYear);
  const upcoming = yearEvents.filter((e) => new Date(e.eventDate) >= today);
  const past = yearEvents.filter(
    (e) => new Date(e.eventDate) < today && PAST_STATUSES.has(e.status),
  );
  return { yearEvents, upcoming, past };
}

const EventList: React.FC<EventListProps> = ({ events, onAddEvent, onEventUpdated }) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"viitor" | "trecut">("viitor");
  const [allCollapsed, setAllCollapsed] = useState(false);
  // key to force remount of all cards when toggling all
  const [collapseKey, setCollapseKey] = useState(0);

  const currentYear = new Date().getFullYear();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { upcoming, past } = partitionEvents(events, today, currentYear);

  const active = tab === "viitor" ? upcoming : past;
  const grouped = groupByMonth(active, tab === "viitor");

  const handleToggleAll = () => {
    setAllCollapsed(c => !c);
    setCollapseKey(k => k + 1);
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-medium hover:bg-neutral-200 transition-colors"
          >
            <span className="text-base leading-none">+</span>
            Adaugă
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-800/60 rounded-xl p-1 mb-6">
        <button
          onClick={() => setTab("viitor")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors ${
            tab === "viitor"
              ? "bg-neutral-900 text-white shadow"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          Viitoare
          {upcoming.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${tab === "viitor" ? "bg-emerald-500/20 text-emerald-400" : "bg-neutral-700 text-neutral-500"}`}>
              {upcoming.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("trecut")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors ${
            tab === "trecut"
              ? "bg-neutral-900 text-white shadow"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          Trecute
          {past.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${tab === "trecut" ? "bg-neutral-600 text-neutral-300" : "bg-neutral-700 text-neutral-500"}`}>
              {past.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {grouped.size === 0 ? (
        <div className="text-center py-12">
          {tab === "viitor" ? (
            <>
              <p className="text-neutral-500 text-sm">Niciun eveniment viitor în {currentYear}.</p>
              <button
                onClick={onAddEvent}
                className="mt-4 text-xs text-neutral-400 underline underline-offset-4 hover:text-white transition-colors"
              >
                Adaugă primul eveniment
              </button>
            </>
          ) : (
            <p className="text-neutral-500 text-sm">Niciun eveniment finalizat în {currentYear}.</p>
          )}
        </div>
      ) : (
        <>
          {/* Collapse all toggle */}
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

          <div className={`space-y-8 ${tab === "trecut" ? "opacity-70" : ""}`}>
            {renderGroup(grouped)}
          </div>
        </>
      )}
    </div>
  );
};

export default EventList;
