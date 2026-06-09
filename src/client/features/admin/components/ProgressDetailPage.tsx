import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useAuth from "../auth/useAuth";
import AncaLoader from "../../../components/UI/AncaLoader";
import type { ClientEvent, EventProgress, EventProgressStatus } from "../types";
import { PROGRESS_STEPS, PROGRESS_STATUS_LABELS } from "../types";

const STATUS_ORDER: EventProgressStatus[] = ["not_started", "in_progress", "done", "blocked"];

const STATUS_STYLES: Record<EventProgressStatus, { bg: string; border: string; text: string; dot: string }> = {
  not_started: { bg: "bg-neutral-900", border: "border-neutral-800", text: "text-neutral-500", dot: "bg-neutral-700" },
  in_progress:  { bg: "bg-blue-500/10",  border: "border-blue-500/25",  text: "text-blue-400",   dot: "bg-blue-500" },
  done:         { bg: "bg-emerald-500/10", border: "border-emerald-500/25", text: "text-emerald-400", dot: "bg-emerald-500" },
  blocked:      { bg: "bg-red-500/10",   border: "border-red-500/25",   text: "text-red-400",    dot: "bg-red-500" },
};

const STATUS_ICONS: Record<EventProgressStatus, React.ReactNode> = {
  not_started: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
  in_progress: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  done: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  blocked: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
};

export default function ProgressDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<ClientEvent | null>(null);
  const [progress, setProgress] = useState<EventProgress>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    fetch(`/api/admin/events/${eventId}`, { headers: { Authorization: `Bearer ${auth.accessToken}` } })
      .then((r) => r.json())
      .then((data: ClientEvent & { eventDate: string | null; createdAt: string }) => {
        const mapped: ClientEvent = {
          ...data,
          eventDate: data.eventDate ? new Date(data.eventDate) : null,
          createdAt: new Date(data.createdAt),
        };
        setEvent(mapped);
        setProgress(data.progress ?? {});
      })
      .finally(() => setLoading(false));
  }, [auth.accessToken, eventId]);

  const cycleStatus = useCallback(async (key: keyof EventProgress) => {
    const current = progress[key]?.status ?? "not_started";
    const nextIndex = (STATUS_ORDER.indexOf(current) + 1) % STATUS_ORDER.length;
    const next = STATUS_ORDER[nextIndex];

    const updated = { ...progress, [key]: { status: next } };
    setProgress(updated);
    setSaving(key);

    try {
      await fetch(`/api/admin/events/${eventId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${auth.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ [`progress.${key}.status`]: next }),
      });
    } catch {
      setProgress(progress);
    } finally {
      setSaving(null);
    }
  }, [auth.accessToken, eventId, progress]);

  if (loading) return <AncaLoader />;
  if (!event) return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-500 text-sm">Eveniment negăsit</div>;

  const done = PROGRESS_STEPS.filter((s) => progress[s.key]?.status === "done").length;
  const pct = Math.round((done / PROGRESS_STEPS.length) * 100);
  const hasBlocked = PROGRESS_STEPS.some((s) => progress[s.key]?.status === "blocked");

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <button
          onClick={() => navigate("/admin/progress")}
          className="flex items-center gap-1.5 text-neutral-500 hover:text-white text-sm transition-colors mb-5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Înapoi la progres
        </button>

        <div className="mb-6">
          <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Progres eveniment</p>
          <h1 className="text-white text-2xl font-light">{event.client.fullName}</h1>
          <p className="text-neutral-400 text-sm mt-0.5">
            {event.typeLabel ?? event.type}
            {event.eventDate && ` · ${new Date(event.eventDate).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })}`}
          </p>
        </div>

        {/* Overall progress */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-neutral-400">Progres general</span>
            <span className={`text-sm font-semibold ${hasBlocked ? "text-red-400" : pct === 100 ? "text-emerald-400" : "text-blue-400"}`}>
              {done}/{PROGRESS_STEPS.length} · {pct}%
            </span>
          </div>
          <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${hasBlocked ? "bg-red-500" : pct === 100 ? "bg-emerald-500" : "bg-blue-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {event.albumSlug && (
            <div className="mt-3 pt-3 border-t border-neutral-800 flex items-center justify-between">
              <span className="text-xs text-neutral-500">Link client</span>
              <a
                href={`/album/${event.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-violet-400 hover:text-violet-300 font-mono"
              >
                /album/{event.id}
              </a>
            </div>
          )}
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {PROGRESS_STEPS.map((step) => {
            const status = progress[step.key]?.status ?? "not_started";
            const styles = STATUS_STYLES[status];
            const isSaving = saving === step.key;

            return (
              <button
                key={step.key}
                onClick={() => cycleStatus(step.key)}
                disabled={isSaving}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left ${styles.bg} ${styles.border} hover:brightness-110 active:scale-[0.99]`}
              >
                <div className="flex items-center gap-3">
                  <span className={styles.text}>{STATUS_ICONS[status]}</span>
                  <div>
                    <p className="text-white text-sm font-medium">{step.label}</p>
                    <p className={`text-xs mt-0.5 ${styles.text}`}>{PROGRESS_STATUS_LABELS[status]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isSaving ? (
                    <svg className="animate-spin text-neutral-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-600">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-neutral-600 text-center mt-4">Click pe un pas pentru a schimba statusul</p>
      </div>
    </div>
  );
}
