import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../auth/useAuth";
import AncaLoader from "../../../components/UI/AncaLoader";
import type { ClientEvent, EventProgress, EventProgressStatus } from "../types";
import { PROGRESS_STEPS } from "../types";

function countDone(progress: EventProgress | undefined): number {
  if (!progress) return 0;
  return PROGRESS_STEPS.filter((s) => progress[s.key]?.status === "done").length;
}

function hasBlocked(progress: EventProgress | undefined): boolean {
  if (!progress) return false;
  return PROGRESS_STEPS.some((s) => progress[s.key]?.status === "blocked");
}

function getOverallStatus(progress: EventProgress | undefined): EventProgressStatus | "none" {
  if (!progress) return "none";
  if (hasBlocked(progress)) return "blocked";
  const done = countDone(progress);
  if (done === PROGRESS_STEPS.length) return "done";
  if (done > 0 || PROGRESS_STEPS.some((s) => progress[s.key]?.status === "in_progress")) return "in_progress";
  return "not_started";
}

const STATUS_COLOR: Record<string, string> = {
  done: "text-emerald-400",
  in_progress: "text-blue-400",
  blocked: "text-red-400",
  not_started: "text-neutral-500",
  none: "text-neutral-600",
};

const STATUS_BG: Record<string, string> = {
  done: "bg-emerald-500",
  in_progress: "bg-blue-500",
  blocked: "bg-red-500",
  not_started: "bg-neutral-700",
  none: "bg-neutral-800",
};

export default function ProgressListPage() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<ClientEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBlocked, setFilterBlocked] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/events", { headers: { Authorization: `Bearer ${auth.accessToken}` } })
      .then((r) => r.json())
      .then((data) => {
        const mapped: ClientEvent[] = (data.events ?? [])
          .filter((e: ClientEvent & { status: string }) => e.status !== "lead" && e.status !== "anulat")
          .map((e: ClientEvent & { eventDate: string | null; createdAt: string }) => ({
            ...e,
            eventDate: e.eventDate ? new Date(e.eventDate) : null,
            createdAt: new Date(e.createdAt),
          }))
          .sort((a: ClientEvent, b: ClientEvent) => {
            const aDate = a.eventDate?.getTime() ?? 0;
            const bDate = b.eventDate?.getTime() ?? 0;
            return bDate - aDate;
          });
        setEvents(mapped);
      })
      .finally(() => setLoading(false));
  }, [auth.accessToken]);

  const filtered = events.filter((event) => {
    if (filterBlocked && !hasBlocked(event.progress)) return false;
    if (search) {
      const q = search.toLowerCase();
      return event.client.fullName.toLowerCase().includes(q) || (event.typeLabel ?? event.type)?.toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) return <AncaLoader />;

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="max-w-4xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-white">Progres Evenimente</h1>
            <p className="text-sm text-neutral-500 mt-0.5">{filtered.length} evenimente</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-5">
          <input
            type="text"
            placeholder="Caută client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-neutral-600"
          />
          <button
            onClick={() => setFilterBlocked((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
              filterBlocked
                ? "bg-red-500/15 border-red-500/30 text-red-400"
                : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${filterBlocked ? "bg-red-400" : "bg-neutral-600"}`} />
            Blocate
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {(["none", "in_progress", "blocked", "done"] as const).map((status) => {
            const count = events.filter((e) => getOverallStatus(e.progress) === status).length;
            const labels: Record<string, string> = { none: "Neînceput", in_progress: "În lucru", blocked: "Blocate", done: "Finalizate" };
            return (
              <div key={status} className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-center">
                <div className={`text-2xl font-bold ${STATUS_COLOR[status]}`}>{count}</div>
                <div className="text-xs text-neutral-500 mt-0.5">{labels[status]}</div>
              </div>
            );
          })}
        </div>

        {/* List */}
        <div className="space-y-2">
          {filtered.map((event) => {
            const done = countDone(event.progress);
            const pct = Math.round((done / PROGRESS_STEPS.length) * 100);
            const overall = getOverallStatus(event.progress);
            const blocked = hasBlocked(event.progress);

            return (
              <div
                key={event.id}
                onClick={() => navigate(`/admin/progress/${event.id}`)}
                className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 cursor-pointer hover:border-neutral-700 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-white font-medium text-sm">{event.client.fullName}</span>
                    <span className="text-neutral-500 text-xs ml-2">
                      {event.typeLabel ?? event.type}
                      {event.eventDate && ` · ${new Date(event.eventDate).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" })}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {blocked && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                        Blocat
                      </span>
                    )}
                    <span className={`text-xs font-medium ${STATUS_COLOR[overall]}`}>{done}/{PROGRESS_STEPS.length}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-600">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all ${blocked ? "bg-red-500" : overall === "done" ? "bg-emerald-500" : "bg-blue-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Step pills */}
                <div className="flex items-center gap-1 flex-wrap">
                  {PROGRESS_STEPS.map((step) => {
                    const status = event.progress?.[step.key]?.status ?? "not_started";
                    return (
                      <span
                        key={step.key}
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          status === "done" ? "bg-emerald-500/15 text-emerald-400" :
                          status === "in_progress" ? "bg-blue-500/15 text-blue-400" :
                          status === "blocked" ? "bg-red-500/15 text-red-400" :
                          "bg-neutral-800 text-neutral-600"
                        }`}
                      >
                        {step.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-neutral-500 text-sm">
              {filterBlocked ? "Niciun eveniment blocat." : "Niciun eveniment găsit."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
