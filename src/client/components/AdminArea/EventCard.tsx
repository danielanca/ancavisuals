import React from "react";
import type { ClientEvent } from "../../types/admin";
import EventStatusBadge from "./EventStatusBadge";

interface EventCardProps {
  event: ClientEvent;
}

const EventCard: React.FC<EventCardProps> = ({ event }) => {
  if (!event?.client || !event?.pricing) return null;

  const eventDate = new Date(event.eventDate);
  const formattedDate = eventDate.toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const formatEUR = (amount: number) =>
    new Intl.NumberFormat("ro-RO", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <EventStatusBadge status={event.status} />
          <span className="text-neutral-500 text-xs">•</span>
          <span className="text-neutral-300 text-xs font-medium">{event.type}</span>
        </div>
        {event.contractId && (
          <span className="text-neutral-600 text-xs font-mono shrink-0">#{event.contractId}</span>
        )}
      </div>

      <p className="text-white font-medium text-sm mb-3">{event.client.fullName}</p>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-neutral-400">
        <span className="flex items-center gap-1.5">
          <span>📅</span>
          {formattedDate}
        </span>

        <span className="flex items-center gap-1.5">
          <span>💶</span>
          {formatEUR(event.pricing.total)}
        </span>

        <span className="flex items-center gap-1.5">
          <span>{event.pricing.advancePaid ? "✅" : "⏳"}</span>
          {event.pricing.advancePaid
            ? `Avans încasat (${formatEUR(event.pricing.advanceAmount)})`
            : `Avans neîncasat (${formatEUR(event.pricing.advanceAmount)})`}
        </span>
      </div>

      {event.notes && (
        <p className="mt-3 text-neutral-500 text-xs leading-relaxed border-t border-neutral-800 pt-3">
          {event.notes}
        </p>
      )}
    </div>
  );
};

export default EventCard;
