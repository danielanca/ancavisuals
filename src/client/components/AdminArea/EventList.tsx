import React from "react";
import type { ClientEvent } from "../../types/admin";
import EventCard from "./EventCard";

interface EventListProps {
  events: ClientEvent[];
  onAddEvent: () => void;
}

const MONTHS_RO = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

function groupByMonth(events: ClientEvent[]): Map<string, ClientEvent[]> {
  const map = new Map<string, ClientEvent[]>();

  const currentYear = new Date().getFullYear();
  const filtered = events.filter((event) => new Date(event.eventDate).getFullYear() === currentYear);

  filtered.sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());

  for (const event of filtered) {
    const date = new Date(event.eventDate);
    const key = `${MONTHS_RO[date.getMonth()].toUpperCase()} ${date.getFullYear()}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(event);
  }

  return map;
}

const EventList: React.FC<EventListProps> = ({ events, onAddEvent }) => {
  const grouped = groupByMonth(events);
  const currentYear = new Date().getFullYear();

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-white font-medium">Evenimente {currentYear}</h2>
        <button
          onClick={onAddEvent}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-medium hover:bg-neutral-200 transition-colors"
        >
          <span className="text-base leading-none">+</span>
          Adaugă
        </button>
      </div>

      {grouped.size === 0 ? (
        <div className="text-center py-12">
          <p className="text-neutral-500 text-sm">Niciun eveniment în {currentYear}.</p>
          <button
            onClick={onAddEvent}
            className="mt-4 text-xs text-neutral-400 underline underline-offset-4 hover:text-white transition-colors"
          >
            Adaugă primul eveniment
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([monthLabel, monthEvents]) => (
            <div key={monthLabel}>
              <p className="text-neutral-500 text-xs tracking-widest uppercase mb-3">{monthLabel}</p>
              <div className="space-y-3">
                {monthEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventList;
