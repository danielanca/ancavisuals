import React from "react";
import { useNavigate } from "react-router-dom";
import type { ClientEvent } from "../types";

interface Props {
  events: ClientEvent[];
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
  if (done) return <span className="text-emerald-400 text-[11px]">✓</span>;
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

const DeliveryDeadlineOverview: React.FC<Props> = ({ events }) => {
  const navigate = useNavigate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const PAST_STATUSES = new Set(["confirmat", "finalizat"]);
  const infos = events
    .filter((event) => PAST_STATUSES.has(event.status) && event.eventDate && new Date(event.eventDate) < today)
    .map((event) => computeDeadlineInfo(event, today))
    .filter((info): info is DeadlineInfo => info !== null && !info.allDone)
    .sort((a, b) => a.urgencyScore - b.urgencyScore);

  if (infos.length === 0) return null;

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

    return (
      <button
        key={event.id}
        type="button"
        onClick={() => navigate(`/admin?event=${event.id}`)}
        className="w-full text-left px-4 py-3 hover:bg-neutral-800/60 transition-colors border-b border-neutral-800/60 last:border-b-0"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-white text-sm font-medium truncate">{name}</span>
              <span className="text-neutral-600 text-[11px] shrink-0">{dateStr} · {type}</span>
            </div>
            <div className="space-y-1.5">
              {!photoDone && (
                <div className="flex items-center gap-2">
                  <span className="text-neutral-500 text-[11px] w-10 shrink-0">📷 foto</span>
                  <div className="flex-1 h-1 rounded-full bg-neutral-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor(photoRemaining, photoDone)}`}
                      style={{ width: `${photoProgress * 100}%` }}
                    />
                  </div>
                  {urgencyBadge(photoRemaining, photoDone)}
                </div>
              )}
              {!videoDone && (
                <div className="flex items-center gap-2">
                  <span className="text-neutral-500 text-[11px] w-10 shrink-0">🎬 video</span>
                  <div className="flex-1 h-1 rounded-full bg-neutral-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor(videoRemaining, videoDone)}`}
                      style={{ width: `${videoProgress * 100}%` }}
                    />
                  </div>
                  {urgencyBadge(videoRemaining, videoDone)}
                </div>
              )}
            </div>
          </div>
        </div>
      </button>
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
          <span className="text-[11px] text-neutral-600">{infos.length} de procesat</span>
        </div>
      </div>

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
    </div>
  );
};

export default DeliveryDeadlineOverview;
