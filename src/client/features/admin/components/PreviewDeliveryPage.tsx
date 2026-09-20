import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../auth/useAuth";
import AncaLoader from "../../../components/UI/AncaLoader";
import Breadcrumb from "./Breadcrumb";
import type { ClientEvent, EventDelivery } from "../types";
import { PREVIEW_DEADLINE_DAYS } from "../types";

interface RowInfo {
  event: ClientEvent;
  daysElapsed: number;
  remaining: number;
  previewDone: boolean;
  igDone: boolean;
  urgencyScore: number;
}

function computeRowInfo(event: ClientEvent, today: Date): RowInfo | null {
  if (!event.eventDate) return null;
  const eventDateMs = new Date(new Date(event.eventDate).setHours(0, 0, 0, 0)).getTime();
  const daysElapsed = Math.floor((today.getTime() - eventDateMs) / 86400000);
  if (daysElapsed < 0) return null;

  const previewDone = event.delivery?.previewSent === true;
  const igDone = event.delivery?.instagramTagged === true;
  const remaining = PREVIEW_DEADLINE_DAYS - daysElapsed;
  const urgencyScore = previewDone && igDone ? Infinity : previewDone ? remaining + 1000 : remaining;

  return { event, daysElapsed, remaining, previewDone, igDone, urgencyScore };
}

function urgencyBadge(remaining: number, done: boolean): React.ReactNode {
  if (done) return null;
  if (remaining < 0) return <span className="text-red-400 text-[11px] font-semibold">−{Math.abs(remaining)}z</span>;
  if (remaining === 0) return <span className="text-orange-400 text-[11px] font-semibold">azi!</span>;
  return <span className={`text-[11px] ${remaining <= 1 ? "text-orange-400" : "text-amber-400"}`}>{remaining}z</span>;
}

function barColor(remaining: number, done: boolean): string {
  if (done) return "bg-emerald-500";
  if (remaining < 0) return "bg-red-500";
  if (remaining <= 1) return "bg-orange-500";
  return "bg-amber-500";
}

export default function PreviewDeliveryPage() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<ClientEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const authHeader = React.useMemo(() => ({ Authorization: `Bearer ${auth.accessToken}` }), [auth.accessToken]);

  useEffect(() => {
    fetch("/api/admin/events", { headers: authHeader })
      .then((r) => r.json())
      .then((data) => {
        const mapped: ClientEvent[] = (data.events ?? []).map((e: ClientEvent & { eventDate: string | null; createdAt: string }) => ({
          ...e,
          eventDate: e.eventDate ? new Date(e.eventDate) : null,
          createdAt: new Date(e.createdAt),
        }));
        setEvents(mapped);
      })
      .finally(() => setLoading(false));
  }, [authHeader]);

  const toggleDelivery = async (event: ClientEvent, key: keyof EventDelivery) => {
    const now = new Date().toISOString();
    const updated: EventDelivery = {
      ...event.delivery,
      [key]: !event.delivery?.[key],
      ...(key === "previewSent" ? { previewSentAt: !event.delivery?.previewSent ? now : undefined } : {}),
      ...(key === "instagramTagged" ? { instagramTaggedAt: !event.delivery?.instagramTagged ? now : undefined } : {}),
    };
    setSavingId(event.id);
    setEvents((current) => current.map((e) => (e.id === event.id ? { ...e, delivery: updated } : e)));
    try {
      await fetch(`/api/admin/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ delivery: updated }),
      });
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <AncaLoader />;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const PAST_STATUSES = new Set(["confirmat", "finalizat"]);
  const allInfos = events
    .filter((event) => PAST_STATUSES.has(event.status))
    .map((event) => computeRowInfo(event, today))
    .filter((info): info is RowInfo => info !== null);

  const infos = allInfos.filter((info) => !(info.previewDone && info.igDone)).sort((a, b) => a.urgencyScore - b.urgencyScore);
  const archived = allInfos.filter((info) => info.previewDone && info.igDone).sort((a, b) => {
    const aDate = a.event.eventDate ? new Date(a.event.eventDate).getTime() : 0;
    const bDate = b.event.eventDate ? new Date(b.event.eventDate).getTime() : 0;
    return bDate - aDate;
  });

  const overdue = infos.filter((info) => !info.previewDone && info.remaining < 0);
  const inProgress = infos.filter((info) => !overdue.includes(info));

  const renderRow = (info: RowInfo) => {
    const { event, daysElapsed, remaining, previewDone, igDone } = info;
    const name = event.client?.fullName || "—";
    const dateStr = event.eventDate
      ? new Date(event.eventDate).toLocaleDateString("ro-RO", { day: "numeric", month: "short" })
      : "—";
    const type = event.type === "Altele" && event.typeLabel ? event.typeLabel : event.type;
    const previewProgress = Math.min(daysElapsed / PREVIEW_DEADLINE_DAYS, 1);
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
                  checked={previewDone}
                  onChange={() => toggleDelivery(event, "previewSent")}
                  className="w-3.5 h-3.5 accent-emerald-500 cursor-pointer shrink-0"
                />
                <span className="text-neutral-500 text-[11px] w-20 shrink-0">🖼️ preview</span>
                {!previewDone && (
                  <div className="flex-1 h-1 rounded-full bg-neutral-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor(remaining, previewDone)}`}
                      style={{ width: `${previewProgress * 100}%` }}
                    />
                  </div>
                )}
                {urgencyBadge(remaining, previewDone)}
              </label>
              <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={igDone}
                  onChange={() => toggleDelivery(event, "instagramTagged")}
                  className="w-3.5 h-3.5 accent-emerald-500 cursor-pointer shrink-0"
                />
                <span className="text-neutral-500 text-[11px] w-20 shrink-0">📸 tag IG</span>
                {!igDone && <span className="text-neutral-700 text-[11px]">neconfirmat</span>}
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderArchiveRow = (info: RowInfo) => {
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
          onClick={(e) => { e.stopPropagation(); toggleDelivery(event, "previewSent"); }}
          className="text-[10px] text-neutral-600 hover:text-neutral-400 shrink-0"
          title="Scoate din arhivă (marchează preview ca netrimis)"
        >
          anulează
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <Breadcrumb />

        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white">Livrare preview & tag Instagram</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Preview-urile trebuie trimise în {PREVIEW_DEADLINE_DAYS} zile de la eveniment. Bifează manual când ai trimis preview-ul și când clientul te-a etichetat pe Instagram.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-red-400">{overdue.length}</div>
            <div className="text-xs text-neutral-500 mt-0.5">Depășite</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-amber-400">{inProgress.length}</div>
            <div className="text-xs text-neutral-500 mt-0.5">În termen</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-emerald-400">{archived.length}</div>
            <div className="text-xs text-neutral-500 mt-0.5">Finalizate</div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 overflow-hidden">
          {infos.length > 0 ? (
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
          ) : (
            <div className="text-center py-16 text-neutral-500 text-sm">Nimic de livrat momentan.</div>
          )}

          {archived.length > 0 && (
            <div className="border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setArchiveOpen((v) => !v)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-neutral-800/40 transition-colors"
              >
                <span className="text-[11px] text-neutral-500 uppercase tracking-widest font-medium">
                  Arhivă finalizate · {archived.length}
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
      </div>
    </div>
  );
}
