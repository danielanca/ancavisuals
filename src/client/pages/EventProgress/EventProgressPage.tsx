import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import type { EventProgress, EventProgressStatus } from "../../features/admin/types";
import { PROGRESS_STEPS, PROGRESS_STATUS_LABELS } from "../../features/admin/types";

const STATUS_STYLES: Record<EventProgressStatus, { ring: string; bg: string; text: string; icon: React.ReactNode }> = {
  not_started: {
    ring: "ring-neutral-700",
    bg: "bg-neutral-800",
    text: "text-neutral-500",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
  },
  in_progress: {
    ring: "ring-blue-500/40",
    bg: "bg-blue-500/15",
    text: "text-blue-400",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  done: {
    ring: "ring-emerald-500/40",
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  blocked: {
    ring: "ring-amber-500/40",
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
};

interface EventData {
  client?: { fullName?: string };
  type?: string;
  typeLabel?: string;
  eventDate?: { toDate?: () => Date } | string | null;
  progress?: EventProgress;
}

export default function EventProgressPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!eventId) { setNotFound(true); setLoading(false); return; }

    const unsub = onSnapshot(doc(db, "adminEvents", eventId), (snapshot) => {
      if (!snapshot.exists()) {
        setNotFound(true);
      } else {
        setEventData(snapshot.data() as EventData);
      }
      setLoading(false);
    }, () => {
      setNotFound(true);
      setLoading(false);
    });

    return unsub;
  }, [eventId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-neutral-700 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !eventData) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-center p-6">
        <div className="w-14 h-14 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-600">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-white font-medium mb-1">Pagina nu a fost găsită</p>
        <p className="text-neutral-500 text-sm">Link-ul evenimentului nu este valid.</p>
      </div>
    );
  }

  const progress = eventData.progress ?? {};
  const visibleSteps = PROGRESS_STEPS.filter((s) => (progress[s.key]?.status ?? "not_started") !== "not_started");
  const done = PROGRESS_STEPS.filter((s) => progress[s.key]?.status === "done").length;
  const total = PROGRESS_STEPS.length;
  const pct = Math.round((done / total) * 100);
  const allDone = done === total;

  const eventDate = eventData.eventDate
    ? typeof (eventData.eventDate as { toDate?: () => Date }).toDate === "function"
      ? (eventData.eventDate as { toDate: () => Date }).toDate()
      : new Date(eventData.eventDate as string)
    : null;

  const clientName = eventData.client?.fullName ?? "";
  const eventType = eventData.typeLabel ?? eventData.type ?? "";

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-sm mx-auto px-5 py-12">

        {/* Brand */}
        <div className="text-center mb-10">
          <p className="text-xs text-neutral-600 uppercase tracking-[0.2em] mb-1">Anca Visuals</p>
          <h1 className="text-xl font-light text-white">{clientName}</h1>
          {eventType && (
            <p className="text-neutral-500 text-sm mt-0.5">
              {eventType}
              {eventDate && ` · ${eventDate.toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })}`}
            </p>
          )}
        </div>

        {/* Progress summary */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-neutral-400">Status livrare</span>
            {allDone ? (
              <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Complet
              </span>
            ) : (
              <span className="text-xs text-neutral-500">{done}/{total} etape</span>
            )}
          </div>
          <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${allDone ? "bg-emerald-500" : "bg-violet-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        {visibleSteps.length > 0 ? (
          <div className="space-y-2">
            {visibleSteps.map((step) => {
              const status = progress[step.key]?.status ?? "not_started";
              const styles = STATUS_STYLES[status];
              return (
                <div
                  key={step.key}
                  className={`flex items-center gap-3 p-4 rounded-xl ring-1 ${styles.ring} ${styles.bg}`}
                >
                  <span className={styles.text}>{styles.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{step.label}</p>
                    <p className={`text-xs mt-0.5 ${styles.text}`}>{PROGRESS_STATUS_LABELS[status]}</p>
                  </div>
                  {status === "done" && (
                    <span className="text-emerald-400 shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10">
            <p className="text-neutral-600 text-sm">Procesarea evenimentului tău este în curs de pregătire.</p>
            <p className="text-neutral-700 text-xs mt-1">Revino în curând pentru actualizări.</p>
          </div>
        )}

        <p className="text-center text-neutral-700 text-xs mt-8">
          Actualizat în timp real · ancavisuals.ro
        </p>
      </div>
    </div>
  );
}
