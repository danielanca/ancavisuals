import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Goal, ClientEvent } from "../types";

interface GoalUpdate {
  targetRevenue: number;
  startDate: string;
  endDate: string;
}

interface GoalCardProps {
  title: string;
  goal: Goal;
  events: ClientEvent[];
  editableRange?: boolean;
  detailRoute?: string;
  onGoalUpdate?: (updates: GoalUpdate) => void;
}

function computeRevenueSplit(
  events: ClientEvent[],
  startDate: string,
  endDate: string,
): { received: number; upcoming: number } {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();

  let received = 0;
  let upcoming = 0;

  for (const event of events) {
    if (!event.eventDate) continue;
    const date = new Date(event.eventDate).getTime();
    if (date < start || date > end) continue;
    if (event.status === "finalizat") received += event.pricing.total;
    else if (event.status === "confirmat") upcoming += event.pricing.total;
  }

  return { received, upcoming };
}

const GoalCard: React.FC<GoalCardProps> = ({ title, goal, events, editableRange, detailRoute, onGoalUpdate }) => {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(goal.targetRevenue));
  const [startDate, setStartDate] = useState(goal.startDate);
  const [endDate, setEndDate] = useState(goal.endDate);
  const [saving, setSaving] = useState(false);

  const { received, upcoming } = computeRevenueSplit(events, goal.startDate, goal.endDate);
  const revenueRealized = received + upcoming;
  const pctReceived = Math.min(100, (received / goal.targetRevenue) * 100);
  const pctUpcoming = Math.min(100 - pctReceived, (upcoming / goal.targetRevenue) * 100);
  const percentage = Math.min(100, Math.round((revenueRealized / goal.targetRevenue) * 100));

  const now = Date.now();
  const start = new Date(goal.startDate).getTime();
  const end = new Date(goal.endDate).getTime();
  const totalDays = (end - start) / 86400000;
  const daysPassed = Math.max(0, (now - start) / 86400000);
  const timeProgress = Math.min(1, daysPassed / totalDays);
  const revenueProgress = revenueRealized / goal.targetRevenue;

  const onTrack = revenueProgress >= timeProgress - 0.1;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ro-RO", { month: "short", year: "numeric" });
  };

  const formatEUR = (amount: number) =>
    new Intl.NumberFormat("ro-RO", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);

  const openEdit = () => {
    setInputValue(String(goal.targetRevenue));
    setStartDate(goal.startDate);
    setEndDate(goal.endDate);
    setEditing(true);
  };

  const handleSave = async () => {
    const parsed = parseInt(inputValue.replace(/\D/g, ""), 10);
    if (!parsed || parsed <= 0) return;
    if (editableRange && (!startDate || !endDate || endDate <= startDate)) return;
    setSaving(true);
    await onGoalUpdate?.({
      targetRevenue: parsed,
      startDate: editableRange ? startDate : goal.startDate,
      endDate: editableRange ? endDate : goal.endDate,
    });
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Obiectiv</p>
          <h3 className="text-white font-medium text-sm">{title}</h3>
          <p className="text-neutral-500 text-xs mt-0.5">
            {formatDate(goal.startDate)} → {formatDate(goal.endDate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <button
              onClick={openEdit}
              title="Editează"
              className="text-neutral-600 hover:text-neutral-300 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
          <span className="text-2xl">{onTrack ? "✅" : "⚠️"}</span>
        </div>
      </div>

      {editing && (
        <div className="flex flex-col gap-3 pt-1 border-t border-neutral-800">
          {/* Target EUR */}
          <div className="flex items-center gap-2">
            <span className="text-neutral-500 text-xs w-16 shrink-0">Target</span>
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
              className="flex-1 bg-neutral-800 text-white text-sm border border-neutral-600 rounded-lg px-2 py-1.5 outline-none focus:border-neutral-400 text-right"
              autoFocus
            />
            <span className="text-neutral-400 text-xs">EUR</span>
          </div>

          {/* Date range — only for editableRange cards */}
          {editableRange && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-neutral-500 text-xs w-16 shrink-0">De la</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="flex-1 bg-neutral-800 text-white text-sm border border-neutral-600 rounded-lg px-2 py-1.5 outline-none focus:border-neutral-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-neutral-500 text-xs w-16 shrink-0">Până la</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="flex-1 bg-neutral-800 text-white text-sm border border-neutral-600 rounded-lg px-2 py-1.5 outline-none focus:border-neutral-400"
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-neutral-200 disabled:opacity-50 transition-colors"
            >
              {saving ? "Se salvează..." : "Salvează"}
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-400 text-xs hover:border-neutral-500 transition-colors"
            >
              Anulează
            </button>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-end justify-between mb-1.5">
          <span className="text-white text-xl font-light">{formatEUR(revenueRealized)}</span>
          {!editing && (
            <span className="text-neutral-400 text-sm">din {formatEUR(goal.targetRevenue)}</span>
          )}
        </div>

        {/* Progress bar — green = received, amber = upcoming confirmed */}
        <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${pctReceived}%` }}
          />
          <div
            className="h-full bg-amber-400 transition-all duration-500"
            style={{ width: `${pctUpcoming}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-3">
            {received > 0 && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                {formatEUR(received)} primit
              </span>
            )}
            {upcoming > 0 && (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
                {formatEUR(upcoming)} rezervat
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-neutral-400 text-xs">{percentage}%</span>
            {detailRoute && (
              <button
                onClick={() => navigate(detailRoute)}
                className="text-xs text-neutral-500 hover:text-white transition-colors"
              >
                → Detalii
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoalCard;
