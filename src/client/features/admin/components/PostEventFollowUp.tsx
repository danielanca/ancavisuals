import React, { useState } from "react";
import type { ClientEvent } from "../types";

interface Props {
  events: ClientEvent[];
  onEventUpdated: (id: string, updated: Partial<ClientEvent>) => void;
}

function isPastEvent(event: ClientEvent): boolean {
  const date = event.eventEndDate ?? event.eventDate;
  if (!date) return false;
  return new Date(new Date(date).setHours(23, 59, 59, 999)) < new Date();
}

export default function PostEventFollowUp({ events, onEventUpdated }: Props) {
  const [saving, setSaving] = useState<string | null>(null);

  const pending = events.filter(
    (e) => e.status === "confirmat" && isPastEvent(e),
  );

  if (pending.length === 0) return null;

  const patch = async (
    event: ClientEvent,
    firestoreUpdates: Record<string, unknown>,
    localUpdates: Partial<ClientEvent>,
  ) => {
    setSaving(event.id);
    try {
      await fetch(`/api/admin/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(firestoreUpdates),
      });
      onEventUpdated(event.id, localUpdates);
    } finally {
      setSaving(null);
    }
  };

  const handlePaid = (event: ClientEvent) => {
    const total = event.pricing?.total ?? 0;
    patch(
      event,
      { status: "finalizat", "pricing.advancePaid": true, "pricing.remainingAmount": 0, "pricing.advanceAmount": total },
      { status: "finalizat", pricing: { ...event.pricing, advancePaid: true, remainingAmount: 0, advanceAmount: total, total } },
    );
  };

  const handleCancelled = (event: ClientEvent) => {
    patch(event, { status: "anulat" }, { status: "anulat" });
  };

  const formatDate = (date: Date | null) =>
    date
      ? new Date(date).toLocaleDateString("ro-RO", {
          day: "numeric",
          month: "long",
        })
      : "";

  return (
    <div className="space-y-3">
      {pending.map((event) => {
        const isSaving = saving === event.id;
        const remaining = event.pricing?.remainingAmount ?? 0;
        const date = event.eventEndDate ?? event.eventDate;

        return (
          <div
            key={event.id}
            className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-4"
          >
            <div className="flex items-start gap-3">
              <span className="text-xl leading-none mt-0.5">📸</span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">
                  Cum a fost evenimentul?
                </p>
                <p className="text-amber-400/80 text-xs mt-0.5">
                  {event.client.fullName}
                  {date && (
                    <span className="text-neutral-500"> · {formatDate(date)}</span>
                  )}
                  {remaining > 0 && (
                    <span className="text-neutral-500">
                      {" "}· Rest:{" "}
                      {new Intl.NumberFormat("ro-RO", {
                        style: "currency",
                        currency: "EUR",
                        maximumFractionDigits: 0,
                      }).format(remaining)}
                    </span>
                  )}
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    disabled={isSaving}
                    onClick={() => handlePaid(event)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Am primit banii
                  </button>
                  <button
                    disabled={isSaving}
                    onClick={() => handleCancelled(event)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-medium hover:bg-red-500/25 transition-colors disabled:opacity-40"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    S-a anulat
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
