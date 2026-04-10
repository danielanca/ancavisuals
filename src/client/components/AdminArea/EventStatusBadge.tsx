import React from "react";
import type { EventStatus } from "../../types/admin";

const CONFIG: Record<EventStatus, { label: string; bg: string; text: string }> = {
  lead: { label: "Lead", bg: "bg-amber-500/20", text: "text-amber-400" },
  tentativ: { label: "Tentativ", bg: "bg-blue-500/20", text: "text-blue-400" },
  confirmat: { label: "Confirmat", bg: "bg-emerald-500/20", text: "text-emerald-400" },
  finalizat: { label: "Finalizat", bg: "bg-gray-500/20", text: "text-gray-400" },
  anulat: { label: "Anulat", bg: "bg-red-500/20", text: "text-red-400" },
};

const DOT_COLOR: Record<EventStatus, string> = {
  lead: "bg-amber-500",
  tentativ: "bg-blue-500",
  confirmat: "bg-emerald-500",
  finalizat: "bg-gray-500",
  anulat: "bg-red-500",
};

interface EventStatusBadgeProps {
  status: EventStatus;
}

const EventStatusBadge: React.FC<EventStatusBadgeProps> = ({ status }) => {
  const config = CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${DOT_COLOR[status]}`} />
      {config.label}
    </span>
  );
};

export default EventStatusBadge;
