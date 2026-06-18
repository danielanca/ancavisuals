import React, { useEffect, useState } from "react";
import type { ClientEvent } from "../types";
import NextEventChecklist from "./NextEventChecklist";

interface Props {
  events: ClientEvent[];
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

const SOON_DAYS_WINDOW = 4;

function getUpcomingEvents(events: ClientEvent[]): ClientEvent[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return events
    .filter((e) => {
      if (e.status === "anulat" || e.status === "lead") return false;
      if (!e.eventDate) return false;
      const date = new Date(e.eventDate);
      date.setHours(0, 0, 0, 0);
      return date >= now;
    })
    .sort((a, b) => new Date(a.eventDate!).getTime() - new Date(b.eventDate!).getTime());
}

function calcTimeLeft(eventDate: Date): TimeLeft {
  // Countdown to 00:00 of the event day
  const target = new Date(eventDate);
  target.setHours(0, 0, 0, 0);

  const total = target.getTime() - Date.now();

  if (total <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };

  return {
    total,
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / (1000 * 60)) % 60),
    seconds: Math.floor((total / 1000) % 60),
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// TODO: remove mock event
const MOCK_EVENT: ClientEvent = {
  id: "mock-28-iunie",
  type: "Botez",
  status: "confirmat",
  fiscalized: false,
  createdAt: new Date(),
  eventDate: new Date("2026-06-28T00:00:00"),
  client: { fullName: "Mock — Botez Test", phone: "", email: "" },
  services: [{ name: "Fotografie", price: 0 }],
  pricing: { total: 0, advanceAmount: 0, advancePaid: false, remainingAmount: 0 },
};

export default function NextEventCountdown({ events }: Props) {
  const allUpcoming = getUpcomingEvents([...events, MOCK_EVENT]);
  const nextEvent = allUpcoming[0] ?? null;

  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(
    nextEvent ? calcTimeLeft(new Date(nextEvent.eventDate!)) : null
  );
  const [checklistOpen, setChecklistOpen] = useState(false);

  useEffect(() => {
    if (!nextEvent?.eventDate) return;
    const tick = () => setTimeLeft(calcTimeLeft(new Date(nextEvent.eventDate!)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextEvent?.id, nextEvent?.eventDate]);

  if (!nextEvent || !timeLeft) return null;

  const eventDate = new Date(nextEvent.eventDate!);
  const isToday = timeLeft.total <= 0;
  const isTomorrow = timeLeft.days === 0 && timeLeft.total > 0;

  const formattedDate = eventDate.toLocaleDateString("ro-RO", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // Events within SOON_DAYS_WINDOW days, excluding the primary one
  const soonEvents = allUpcoming.slice(1).filter((e) => {
    const daysUntil = Math.floor(
      (new Date(e.eventDate!).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000
    );
    return daysUntil <= SOON_DAYS_WINDOW;
  });

  return (
    <div style={{
      background: "linear-gradient(135deg, #071a0f 0%, #0a2015 100%)",
      border: "1px solid #14532d",
      borderRadius: 16,
      padding: "20px 24px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background glow */}
      <div style={{
        position: "absolute", top: -40, right: -40,
        width: 160, height: 160, borderRadius: "50%",
        background: "radial-gradient(circle, #16a34a22, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Label */}
      <p style={{ fontSize: 10, color: "#4ade80", letterSpacing: "0.18em", textTransform: "uppercase", margin: "0 0 8px", fontWeight: 600, opacity: 0.7 }}>
        Următorul eveniment
      </p>

      {/* Event name + date */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 17, fontWeight: 700, color: "#f0fff4", margin: "0 0 3px" }}>
          {nextEvent.client?.fullName || nextEvent.typeLabel || nextEvent.type}
        </p>
        <p style={{ fontSize: 12, color: "#4ade80", margin: 0, textTransform: "capitalize", opacity: 0.8 }}>
          {formattedDate}
        </p>
      </div>

      {isToday ? (
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <span style={{ fontSize: 28 }}>🎉</span>
          <p style={{ color: "#4ade80", fontSize: 18, fontWeight: 700, margin: "6px 0 0" }}>Azi e evenimentul!</p>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
          {[
            { value: timeLeft.days, label: "zile" },
            { value: timeLeft.hours, label: "ore" },
            { value: timeLeft.minutes, label: "min" },
            { value: timeLeft.seconds, label: "sec" },
          ].map(({ value, label }, i) => (
            <React.Fragment key={label}>
              {i > 0 && (
                <div style={{ display: "flex", alignItems: "center", paddingBottom: 18 }}>
                  <span style={{ color: "#16a34a", fontSize: 22, fontWeight: 300, lineHeight: 1 }}>:</span>
                </div>
              )}
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{
                  background: "#052e16",
                  border: "1px solid #166534",
                  borderRadius: 10,
                  padding: "10px 4px 8px",
                  minWidth: 0,
                }}>
                  <span style={{
                    display: "block",
                    fontSize: value >= 100 ? 28 : 38,
                    fontWeight: 800,
                    fontVariantNumeric: "tabular-nums",
                    color: "#ffffff",
                    lineHeight: 1,
                    letterSpacing: "-0.02em",
                    fontFamily: "monospace",
                  }}>
                    {pad(value)}
                  </span>
                </div>
                <span style={{ fontSize: 9, color: "#4ade80", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginTop: 5, fontWeight: 600, opacity: 0.6 }}>
                  {label}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}

      {isTomorrow && (
        <p style={{ fontSize: 11, color: "#4ade80", margin: "12px 0 0", fontWeight: 600 }}>
          ⚡ Mâine!
        </p>
      )}

      {/* Checklist toggle button */}
      <div style={{ marginTop: 16, borderTop: "1px solid #14532d", paddingTop: 12 }}>
        <button
          type="button"
          onClick={() => setChecklistOpen((open) => !open)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: checklistOpen ? "#052e16" : "transparent",
            border: "1px solid #166534",
            borderRadius: 8,
            padding: "8px 14px",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 11 12 14 22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            <span style={{ fontSize: 10, color: "#4ade80", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Checklist echipamente
            </span>
          </div>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ opacity: 0.6, transform: checklistOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {checklistOpen && (
        <div style={{ marginTop: 8 }}>
          <NextEventChecklist events={events} />
        </div>
      )}

      {soonEvents.length > 0 && (
        <div style={{ marginTop: 12, borderTop: "1px solid #14532d", paddingTop: 12 }}>
          <p style={{ fontSize: 9, color: "#4ade80", letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 8px", fontWeight: 600, opacity: 0.5 }}>
            Urmează în curând
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {soonEvents.map((event) => {
              const daysUntil = Math.floor(
                (new Date(event.eventDate!).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000
              );
              const label = daysUntil === 0 ? "Azi" : daysUntil === 1 ? "Mâine" : `în ${daysUntil} zile`;
              const shortDate = new Date(event.eventDate!).toLocaleDateString("ro-RO", { weekday: "short", day: "numeric", month: "short" });
              return (
                <div key={event.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80", opacity: 0.5, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#d1fae5", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {event.client?.fullName || event.typeLabel || event.type}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: "#4ade80", opacity: 0.6 }}>{shortDate}</span>
                    <span style={{ fontSize: 10, color: "#052e16", background: "#4ade80", borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>
                      {label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
