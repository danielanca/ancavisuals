import React from "react";
import type { Goal, ClientEvent } from "../types";

interface GoalCardProps {
  title: string;
  goal: Goal;
  events: ClientEvent[];
}

function computeRevenueRealized(events: ClientEvent[], startDate: string, endDate: string): number {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();

  return events
    .filter((event) => {
      if (event.status !== "confirmat" && event.status !== "finalizat") return false;
      const date = new Date(event.eventDate).getTime();
      return date >= start && date <= end;
    })
    .reduce((sum, event) => sum + event.pricing.total, 0);
}

const GoalCard: React.FC<GoalCardProps> = ({ title, goal, events }) => {
  const revenueRealized = computeRevenueRealized(events, goal.startDate, goal.endDate);
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
        <span className="text-2xl">{onTrack ? "✅" : "⚠️"}</span>
      </div>

      <div>
        <div className="flex items-end justify-between mb-1.5">
          <span className="text-white text-xl font-light">{formatEUR(revenueRealized)}</span>
          <span className="text-neutral-400 text-sm">din {formatEUR(goal.targetRevenue)}</span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${onTrack ? "bg-emerald-500" : "bg-amber-500"}`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-1.5">
          <span className={`text-xs font-medium ${onTrack ? "text-emerald-400" : "text-amber-400"}`}>
            {onTrack ? "Pe track" : "Ușor în urmă"}
          </span>
          <span className="text-neutral-400 text-xs">{percentage}%</span>
        </div>
      </div>
    </div>
  );
};

export default GoalCard;
