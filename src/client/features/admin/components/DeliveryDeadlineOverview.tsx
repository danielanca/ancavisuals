import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ClientEvent, EventDelivery } from "../types";

interface Props {
  events: ClientEvent[];
  onEventUpdated?: (id: string, updated: Partial<ClientEvent>) => void;
}

const PHOTO_DAYS = 30;
const VIDEO_DAYS = 60;

interface DeadlineInfo {
  event: ClientEvent;
  daysElapsed: number;
  photoRemaining: number;
  videoRemaining: number;
  photoDone: boolean;
  videoDone: boolean;
  urgencyScore: number;
  allDone: boolean;
}

function computeDeadlineInfo(event: ClientEvent, today: Date): DeadlineInfo | null {
  if (!event.eventDate) return null;
  const eventDateMs = new Date(new Date(event.eventDate).setHours(0, 0, 0, 0)).getTime();
  const daysElapsed = Math.floor((today.getTime() - eventDateMs) / 86400000);
  if (daysElapsed < 0) return null;

  const photoDone = event.delivery?.allPhotosEdited === true;
  const videoDone = event.delivery?.longVideoEdited === true;
  const photoRemaining = PHOTO_DAYS - daysElapsed;
  const videoRemaining = VIDEO_DAYS - daysElapsed;
  const urgencyScore = Math.min(
    photoDone ? Infinity : photoRemaining,
    videoDone ? Infinity : videoRemaining,
  );
  const allDone = photoDone && videoDone;

  return { event, daysElapsed, photoRemaining, videoRemaining, photoDone, videoDone, urgencyScore, allDone };
}

function urgencyBadge(remaining: number, done: boolean): React.ReactNode {
  if (done) return null;
  if (remaining < 0) return (
    <span className="text-red-400 text-[11px] font-semibold">−{Math.abs(remaining)}z</span>
  );
  if (remaining === 0) return <span className="text-orange-400 text-[11px] font-semibold">azi!</span>;
  return <span className={`text-[11px] ${remaining <= 6 ? "text-orange-400" : remaining <= 15 ? "text-amber-400" : "text-neutral-500"}`}>{remaining}z</span>;
}

function barColor(remaining: number, done: boolean): string {
  if (done) return "bg-emerald-500";
  if (remaining < 0) return "bg-red-500";
  if (remaining <= 6) return "bg-orange-500";
  if (remaining <= 15) return "bg-amber-500";
  return "bg-emerald-500";
}

const DeliveryDeadlineOverview: React.FC<Props> = ({ events, onEventUpdated }) => {
  const navigate = useNavigate();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const toggleDelivery = async (event: ClientEvent, key: keyof EventDelivery, e: React.SyntheticEvent) => {
    e.stopPropagation();
    const updated: EventDelivery = { ...event.delivery, [key]: !event.delivery?.[key] };
    setSavingId(event.id);
    onEventUpdated?.(event.id, { delivery: updated });
    try {
      await fetch(`/api/admin/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery: updated }),
      });
    } finally {
      setSavingId(null);
    }
  };

  const PAST_STATUSES = new Set(["confirmat", "finalizat"]);
  const allInfos = events
    .filter((event) => PAST_STATUSES.has(event.status) && event.eventDate && new Date(event.eventDate) < today)
    .map((event) => computeDeadlineInfo(event, today))
    .filter((info): info is DeadlineInfo => info !== null);

  const infos = allInfos.filter((info) => !info.allDone).sort((a, b) => a.urgencyScore - b.urgencyScore);
  const archived = allInfos.filter((info) => info.allDone).sort((a, b) => {
    const aDate = a.event.eventDate ? new Date(a.event.eventDate).getTime() : 0;
    const bDate = b.event.eventDate ? new Date(b.event.eventDate).getTime() : 0;
    return bDate - aDate;
  });

  if (infos.length === 0 && archived.length === 0) return null;

  const overdue = infos.filter((info) => info.urgencyScore < 0);
  const inProgress = infos.filter((info) => info.urgencyScore >= 0);

  const renderRow = (info: DeadlineInfo) => {
    const { event, daysElapsed, photoRemaining, videoRemaining, photoDone, videoDone } = info;
    const name = event.client?.fullName || "—";
    const dateStr = event.eventDate
      ? new Date(event.eventDate).toLocaleDateString("ro-RO", { day: "numeric", month: "short" })
      : "—";
    const type = event.type === "Altele" && event.typeLabel ? event.typeLabel : event.type;

    const photoProgress = Math.min(daysElapsed / PHOTO_DAYS, 1);
    const videoProgress = Math.min(daysElapsed / VIDEO_DAYS, 1);
    const saving = savingId === event.id;

    return (
      <div
        key={event.id}
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/admin?event=${event.id}`)}
        onKeyDown={(e) => { if (e.key === "Enter") navigate(`/admin?event=${event.id}`); }}
        className="w-full text-left px-4 py-3 hover:bg-neutral-800/60 transition-colors border-b border-neutral-800/60 last:border-b-0 cursor-pointer"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-white text-sm font-medium truncate">{name}</span>
              <span className="text-neutral-600 text-[11px] shrink-0">{dateStr} · {type}</span>
              {saving && <span className="text-neutral-600 text-[10px]">se salvează...</span>}
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={photoDone}
                  onChange={(e) => toggleDelivery(event, "allPhotosEdited", e)}
                  className="w-3.5 h-3.5 accent-emerald-500 cursor-pointer shrink-0"
                />
                <span className="text-neutral-500 text-[11px] w-10 shrink-0">📷 foto</span>
                {!photoDone && (
                  <div className="flex-1 h-1 rounded-full bg-neutral-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor(photoRemaining, photoDone)}`}
                      style={{ width: `${photoProgress * 100}%` }}
                    />
                  </div>
                )}
                {urgencyBadge(photoRemaining, photoDone)}
              </label>
              <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={videoDone}
                  onChange={(e) => toggleDelivery(event, "longVideoEdited", e)}
                  className="w-3.5 h-3.5 accent-emerald-500 cursor-pointer shrink-0"
                />
                <span className="text-neutral-500 text-[11px] w-10 shrink-0">🎬 video</span>
                {!videoDone && (
                  <div className="flex-1 h-1 rounded-full bg-neutral-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor(videoRemaining, videoDone)}`}
                      style={{ width: `${videoProgress * 100}%` }}
                    />
                  </div>
                )}
                {urgencyBadge(videoRemaining, videoDone)}
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderArchiveRow = (info: DeadlineInfo) => {
    const { event } = info;
    const name = event.client?.fullName || "—";
    const dateStr = event.eventDate
      ? new Date(event.eventDate).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" })
      : "—";
    const type = event.type === "Altele" && event.typeLabel ? event.typeLabel : event.type;

    return (
      <div
        key={event.id}
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/admin?event=${event.id}`)}
        onKeyDown={(e) => { if (e.key === "Enter") navigate(`/admin?event=${event.id}`); }}
        className="w-full text-left px-4 py-2.5 hover:bg-neutral-800/60 transition-colors border-b border-neutral-800/40 last:border-b-0 cursor-pointer flex items-center justify-between gap-3"
      >
        <div className="min-w-0 flex items-center gap-2">
          <span className="text-emerald-400 text-[11px] shrink-0">✓</span>
          <span className="text-neutral-300 text-sm truncate">{name}</span>
          <span className="text-neutral-600 text-[11px] shrink-0">{dateStr} · {type}</span>
        </div>
        <button
          type="button"
          onClick={(e) => toggleDelivery(event, "allPhotosEdited", e)}
          className="text-[10px] text-neutral-600 hover:text-neutral-400 shrink-0"
          title="Scoate din arhivă (marchează foto ca neterminat)"
        >
          anulează
        </button>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
        <div>
          <h3 className="text-white text-sm font-medium">Deadline procesare</h3>
          <p className="text-neutral-500 text-xs mt-0.5">Foto 30 zile · Video 60 zile de la eveniment</p>
        </div>
        <div className="flex items-center gap-2">
          {overdue.length > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20 font-medium">
              {overdue.length} depășit{overdue.length !== 1 ? "e" : ""}
            </span>
          )}
          {infos.length > 0 && <span className="text-[11px] text-neutral-600">{infos.length} de procesat</span>}
        </div>
      </div>

      {infos.length > 0 && (
        <div className="divide-y divide-neutral-800/40">
          {overdue.length > 0 && (
            <>
              <div className="px-4 py-2 bg-red-500/5">
                <span className="text-[10px] text-red-400/70 uppercase tracking-widest font-medium">Depășite</span>
              </div>
              {overdue.map(renderRow)}
            </>
          )}
          {inProgress.length > 0 && (
            <>
              {overdue.length > 0 && (
                <div className="px-4 py-2 bg-neutral-800/30">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-medium">În termen</span>
                </div>
              )}
              {inProgress.map(renderRow)}
            </>
          )}
        </div>
      )}

      {archived.length > 0 && (
        <div className="border-t border-neutral-800">
          <button
            type="button"
            onClick={() => setArchiveOpen((v) => !v)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-neutral-800/40 transition-colors"
          >
            <span className="text-[11px] text-neutral-500 uppercase tracking-widest font-medium">
              Arhivă livrări finalizate · {archived.length}
            </span>
            <span className="text-neutral-600 text-xs">{archiveOpen ? "▲" : "▼"}</span>
          </button>
          {archiveOpen && (
            <div className="divide-y divide-neutral-800/30 max-h-72 overflow-y-auto">
              {archived.map(renderArchiveRow)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DeliveryDeadlineOverview;
