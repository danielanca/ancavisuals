import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AncaLoader from "../UI/AncaLoader";
import Breadcrumb from "./Breadcrumb";

interface BookedEntry {
  date?: string;
  startDate?: string;
  endDate?: string;
  note?: string;
}

function expandEntries(entries: BookedEntry[]): Set<string> {
  const set = new Set<string>();
  for (const entry of entries) {
    if (entry.date) {
      set.add(entry.date);
    } else if (entry.startDate && entry.endDate) {
      const cur = new Date(entry.startDate);
      const end = new Date(entry.endDate);
      while (cur <= end) {
        set.add(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
    }
  }
  return set;
}

const MONTHS = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];
const DAYS = ["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"];

function MonthCalendar({
  year, month, bookedSet, onDateClick,
}: {
  year: number;
  month: number;
  bookedSet: Set<string>;
  onDateClick: (date: string) => void;
}) {
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-4">
      <h3 className="text-white text-sm font-semibold text-center mb-3 tracking-wide uppercase">
        {MONTHS[month]} {year}
      </h3>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-neutral-500 text-xs text-center font-medium py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const booked = bookedSet.has(dateKey);
          const isToday = dateKey === today;
          return booked ? (
            <div
              key={i}
              title="Rezervat"
              className="text-xs text-center rounded-lg py-1.5 font-medium select-none bg-red-500 text-white"
            >
              {day}
            </div>
          ) : (
            <button
              key={i}
              type="button"
              title="Adaugă eveniment"
              onClick={() => onDateClick(dateKey)}
              className={[
                "text-xs text-center rounded-lg py-1.5 font-medium transition-colors",
                isToday
                  ? "bg-amber-400 text-black hover:bg-amber-300"
                  : "text-neutral-300 hover:bg-emerald-500/20 hover:text-emerald-300",
              ].join(" ")}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function BookedCalendar() {
  const navigate = useNavigate();
  const [bookedSet, setBookedSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const MIN_YEAR = 2023;
  const MAX_YEAR = 2030;
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    // noindex
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  useEffect(() => {
    fetch("/api/admin/booked-dates")
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setBookedSet(expandEntries(data.dates));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-160 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-6">

        <Breadcrumb />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-white text-lg font-semibold tracking-tight">Calendar rezervări</h1>
            <p className="text-neutral-500 text-xs mt-0.5">Zilele marcate cu roșu sunt deja rezervate</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setYear(y => Math.max(MIN_YEAR, y - 1))}
              disabled={year <= MIN_YEAR}
              className="w-8 h-8 rounded-full border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500 flex items-center justify-center transition-colors text-lg disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ‹
            </button>
            <span className="text-white font-semibold w-12 text-center text-sm">{year}</span>
            <button
              onClick={() => setYear(y => Math.min(MAX_YEAR, y + 1))}
              disabled={year >= MAX_YEAR}
              className="w-8 h-8 rounded-full border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500 flex items-center justify-center transition-colors text-lg disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ›
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-4 mb-6 text-xs text-neutral-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> Rezervat
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> Azi
          </span>
        </div>

        {loading && <AncaLoader variant="inline" />}
        {error && <p className="text-red-400 text-sm text-center py-4">Eroare: {error}</p>}
        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 12 }, (_, m) => (
              <MonthCalendar
              key={m}
              year={year}
              month={m}
              bookedSet={bookedSet}
              onDateClick={(date) => navigate("/admin/create-event", { state: { date } })}
            />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
