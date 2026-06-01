import React, { useEffect, useState } from "react";
import type { ClientEvent } from "../types";

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

function getNextEvent(events: ClientEvent[]): ClientEvent | null {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // compare from start of today

  return events
    .filter((e) => {
      if (e.status === "anulat" || e.status === "lead") return false;
      if (!e.eventDate) return false;
      const date = new Date(e.eventDate);
      date.setHours(0, 0, 0, 0);
      return date >= now;
    })
    .sort((a, b) => new Date(a.eventDate!).getTime() - new Date(b.eventDate!).getTime())[0] ?? null;
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

export default function NextEventCountdown({ events }: Props) {
  const nextEvent = getNextEvent(events);
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(
    nextEvent ? calcTimeLeft(new Date(nextEvent.eventDate!)) : null
  );

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

  return (
    <div style={{
      background: "linear-gradient(135deg, #0d0a1f 0%, #130f28 100%)",
      border: "1px solid #2d1f5e",
      borderRadius: 16,
      padding: "20px 24px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background glow */}
      <div style={{
        position: "absolute", top: -40, right: -40,
        width: 160, height: 160, borderRadius: "50%",
        background: "radial-gradient(circle, #7c3aed22, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Label */}
      <p style={{ fontSize: 10, color: "#6d4fc2", letterSpacing: "0.18em", textTransform: "uppercase", margin: "0 0 8px", fontWeight: 600 }}>
        Următorul eveniment
      </p>

      {/* Event name + date */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 17, fontWeight: 700, color: "#f0ecff", margin: "0 0 3px" }}>
          {nextEvent.client?.fullName || nextEvent.typeLabel || nextEvent.type}
        </p>
        <p style={{ fontSize: 12, color: "#6d4fc2", margin: 0, textTransform: "capitalize" }}>
          {formattedDate}
        </p>
      </div>

      {isToday ? (
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <span style={{ fontSize: 28 }}>🎉</span>
          <p style={{ color: "#a78bfa", fontSize: 18, fontWeight: 700, margin: "6px 0 0" }}>Azi e evenimentul!</p>
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
                  <span style={{ color: "#7c5fc0", fontSize: 22, fontWeight: 300, lineHeight: 1 }}>:</span>
                </div>
              )}
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{
                  background: "#1e1240",
                  border: "1px solid #4a2d9e",
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
                <span style={{ fontSize: 9, color: "#ffffff", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginTop: 5, fontWeight: 600, opacity: 0.6 }}>
                  {label}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}

      {isTomorrow && (
        <p style={{ fontSize: 11, color: "#7c3aed", margin: "12px 0 0", fontWeight: 600 }}>
          ⚡ Mâine!
        </p>
      )}
    </div>
  );
}
