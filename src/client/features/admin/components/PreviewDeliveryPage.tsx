/*
 * Purpose: "Livrare preview & tag Instagram" — every confirmed event after its date goes through
 * two steps: ① send the preview (within PREVIEW_DEADLINE_DAYS), ② the client tags us on Instagram.
 * Grouped by what to do next: late previews, previews to send, waiting for the tag, done.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../auth/useAuth";
import AncaLoader from "../../../components/UI/AncaLoader";
import Breadcrumb from "./Breadcrumb";
import type { ClientEvent, EventDelivery } from "../types";
import { PREVIEW_DEADLINE_DAYS } from "../types";
import { deadlineLabel, deliveryBoard, type DeliveryRow, type DeliveryStage } from "./previewDelivery";

const fmtDay = (date: Date, withYear = false) =>
  date.toLocaleDateString("ro-RO", { weekday: "short", day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
const fmtShort = (date: Date) => date.toLocaleDateString("ro-RO", { day: "numeric", month: "short" });

const SECTIONS: { stage: DeliveryStage; title: string; hint: string; tone: string; dot: string }[] = [
  { stage: "late", title: "Preview întârziat", hint: "Termenul de 3 zile a trecut — trimite-l cât mai repede.", tone: "text-red-400", dot: "bg-red-500" },
  { stage: "preview", title: "De trimis preview", hint: "În termen. Cele mai apropiate de termen sunt primele.", tone: "text-amber-400", dot: "bg-amber-500" },
  { stage: "tag", title: "Așteaptă tag Instagram", hint: "Preview trimis — cere clientului să te eticheteze.", tone: "text-violet-300", dot: "bg-violet-500" },
];

function eventTitle(event: ClientEvent) {
  const type = event.type === "Altele" && event.typeLabel ? event.typeLabel : event.type;
  return { name: event.client?.fullName || "Client fără nume", type };
}

export default function PreviewDeliveryPage() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<ClientEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [doneOpen, setDoneOpen] = useState(false);
  const authHeader = useMemo(() => ({ Authorization: `Bearer ${auth.accessToken}` }), [auth.accessToken]);

  useEffect(() => {
    fetch("/api/admin/events", { headers: authHeader })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        setEvents((data.events ?? []).map((e: ClientEvent & { eventDate: string | null; createdAt: string }) => ({
          ...e,
          eventDate: e.eventDate ? new Date(e.eventDate) : null,
          createdAt: new Date(e.createdAt),
        })));
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [authHeader]);

  /**
   * Marks / unmarks steps; the card moves to its new group right away and back if saving fails.
   * A step already done keeps its original date (so "Rezolvă tot" does not rewrite when the preview went out).
   */
  const setSteps = async (event: ClientEvent, steps: { previewSent?: boolean; instagramTagged?: boolean }) => {
    const now = new Date().toISOString();
    const previous = event.delivery;
    const delivery: EventDelivery = { ...previous };
    if (steps.previewSent !== undefined) {
      delivery.previewSent = steps.previewSent;
      delivery.previewSentAt = steps.previewSent ? (previous?.previewSent ? previous.previewSentAt : now) : undefined;
    }
    if (steps.instagramTagged !== undefined) {
      delivery.instagramTagged = steps.instagramTagged;
      delivery.instagramTaggedAt = steps.instagramTagged ? (previous?.instagramTagged ? previous.instagramTaggedAt : now) : undefined;
    }
    setSaveError(null);
    setSavingId(event.id);
    setEvents((current) => current.map((e) => (e.id === event.id ? { ...e, delivery } : e)));
    try {
      const response = await fetch(`/api/admin/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ delivery }),
      });
      if (!response.ok) throw new Error(String(response.status));
    } catch {
      setEvents((current) => current.map((e) => (e.id === event.id ? { ...e, delivery: previous } : e)));
      setSaveError(`Nu am putut salva pentru ${eventTitle(event).name}. Încearcă din nou.`);
    } finally {
      setSavingId(null);
    }
  };

  const [today] = useState(() => new Date());
  const board = useMemo(() => deliveryBoard(events, today), [events, today]);

  if (loading) return <AncaLoader />;

  const openEvent = (event: ClientEvent) => navigate(`/admin?event=${event.id}`);
  const todo = board.late.length + board.preview.length + board.tag.length;

  const renderCard = (row: DeliveryRow) => {
    const { event, stage } = row;
    const { name, type } = eventTitle(event);
    const saving = savingId === event.id;
    const ago = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - row.eventDay.getTime()) / 86_400_000);
    const late = stage === "late";

    return (
      <article key={event.id} className={`rounded-xl border bg-neutral-900 p-4 ${late ? "border-red-500/40" : "border-neutral-800"}`}>
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-white">{name}</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              {type} · {fmtDay(row.eventDay)} · {ago === 0 ? "azi" : ago === 1 ? "ieri" : `acum ${ago} zile`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => setSteps(event, { previewSent: true, instagramTagged: true })}
              title="Bifează preview-ul și tag-ul Instagram — evenimentul trece la Predate"
              className="rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
            >
              ✓✓ Rezolvă tot
            </button>
            <button type="button" onClick={() => openEvent(event)} className="text-xs text-neutral-500 transition-colors hover:text-white">
              Deschide →
            </button>
          </div>
        </header>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {/* ① Preview */}
          {stage === "late" || stage === "preview" ? (
            <div className={`rounded-lg border p-3 ${late ? "border-red-500/30 bg-red-500/5" : "border-amber-500/25 bg-amber-500/5"}`}>
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">① Preview</p>
              <p className={`mt-1 text-sm font-medium ${late ? "text-red-300" : "text-amber-200"}`}>{deadlineLabel(row.daysLeft)}</p>
              <p className="text-xs text-neutral-500">Termen: {fmtDay(row.deadline)}</p>
              <button
                type="button"
                disabled={saving}
                onClick={() => setSteps(event, { previewSent: true })}
                className="mt-3 w-full rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black transition-colors hover:bg-neutral-200 disabled:opacity-50"
              >
                ✓ Am trimis preview-ul
              </button>
            </div>
          ) : (
            <DoneStep
              title="① Preview"
              text={row.previewSentAt ? `Trimis ${fmtDay(row.previewSentAt)}` : "Trimis"}
              disabled={saving}
              onUndo={() => setSteps(event, { previewSent: false })}
            />
          )}

          {/* ② Tag Instagram */}
          {stage === "tag" ? (
            <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">② Tag Instagram</p>
              <p className="mt-1 text-sm font-medium text-violet-200">
                {row.waitingTagDays === null || row.waitingTagDays === 0 ? "Așteaptă tag" : `Așteaptă de ${row.waitingTagDays === 1 ? "o zi" : `${row.waitingTagDays} zile`}`}
              </p>
              <p className="text-xs text-neutral-500">Verifică pe Instagram dacă te-a etichetat.</p>
              <button
                type="button"
                disabled={saving}
                onClick={() => setSteps(event, { instagramTagged: true })}
                className="mt-3 w-full rounded-lg border border-violet-400/50 px-3 py-2 text-xs font-semibold text-violet-100 transition-colors hover:bg-violet-500/15 disabled:opacity-50"
              >
                📸 M-a etichetat
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-neutral-800 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-600">② Tag Instagram</p>
              <p className="mt-1 text-sm text-neutral-600">Vine după preview</p>
            </div>
          )}
        </div>
        {saving && <p className="mt-2 text-[11px] text-neutral-500" role="status">Se salvează…</p>}
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-950 p-4 text-white sm:p-6">
      <div className="mx-auto max-w-4xl">
        <Breadcrumb />

        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white">Livrare preview & tag Instagram</h1>
          <p className="mt-1 text-sm text-neutral-500">
            ① Trimite preview-ul în {PREVIEW_DEADLINE_DAYS} zile de la eveniment. ② Apoi cere clientului să te eticheteze pe Instagram.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[...SECTIONS, { stage: "done" as const, title: "Predate", tone: "text-emerald-400", dot: "bg-emerald-500" }].map(({ stage, title, tone, dot }) => (
            <a
              key={stage}
              href={`#delivery-${stage}`}
              onClick={stage === "done" ? () => setDoneOpen(true) : undefined}
              className="rounded-xl border border-neutral-800 bg-neutral-900 p-3 transition-colors hover:border-neutral-600"
            >
              <span className="flex items-center gap-1.5 text-[11px] text-neutral-500"><span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{title}</span>
              <span className={`mt-1 block text-2xl font-bold ${board[stage].length ? tone : "text-neutral-700"}`}>{board[stage].length}</span>
            </a>
          ))}
        </div>

        {loadError && <p role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">Nu am putut încărca evenimentele. Reîncarcă pagina.</p>}
        {saveError && <p role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{saveError}</p>}

        {todo === 0 && !loadError && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 py-14 text-center">
            <p className="text-sm text-neutral-300">Totul e livrat. 🎉</p>
            <p className="mt-1 text-xs text-neutral-600">Evenimentele noi apar aici din ziua de după eveniment.</p>
          </div>
        )}

        <div className="space-y-8">
          {SECTIONS.filter(({ stage }) => board[stage].length > 0).map(({ stage, title, hint, tone, dot }) => (
            <section key={stage} id={`delivery-${stage}`} aria-labelledby={`delivery-${stage}-title`}>
              <div className="mb-3">
                <h2 id={`delivery-${stage}-title`} className={`flex items-center gap-2 text-sm font-semibold ${tone}`}>
                  <span className={`h-2 w-2 rounded-full ${dot}`} />{title} · {board[stage].length}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-600">{hint}</p>
              </div>
              <div className="space-y-3">{board[stage].map(renderCard)}</div>
            </section>
          ))}

          {board.done.length > 0 && (
            <section id="delivery-done" className="rounded-xl border border-neutral-800 bg-neutral-900/60">
              <button
                type="button"
                onClick={() => setDoneOpen((v) => !v)}
                aria-expanded={doneOpen}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />Predate · {board.done.length}
                </span>
                <span className="text-xs text-neutral-600">{doneOpen ? "Ascunde ▲" : "Arată ▼"}</span>
              </button>
              {doneOpen && (
                <ul className="max-h-96 divide-y divide-neutral-800/60 overflow-y-auto border-t border-neutral-800">
                  {board.done.map((row) => {
                    const { name, type } = eventTitle(row.event);
                    return (
                      <li key={row.event.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                        <button type="button" onClick={() => openEvent(row.event)} className="min-w-0 text-left">
                          <span className="block truncate text-sm text-neutral-200">{name}</span>
                          <span className="text-[11px] text-neutral-600">{type} · {fmtDay(row.eventDay, true)}</span>
                        </button>
                        <span className="text-[11px] text-neutral-500">
                          🖼️ {row.previewSentAt ? fmtShort(row.previewSentAt) : "trimis"} · 📸 {row.taggedAt ? fmtShort(row.taggedAt) : "etichetat"}
                          <button
                            type="button"
                            disabled={savingId === row.event.id}
                            onClick={() => setSteps(row.event, { instagramTagged: false })}
                            className="ml-3 text-neutral-600 underline-offset-2 hover:text-neutral-300 hover:underline disabled:opacity-50"
                          >
                            anulează tag
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function DoneStep({ title, text, disabled, onUndo }: { title: string; text: string; disabled: boolean; onUndo: () => void }) {
  return (
    <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">{title}</p>
      <p className="mt-1 text-sm font-medium text-emerald-300">✓ {text}</p>
      <button type="button" disabled={disabled} onClick={onUndo} className="mt-1 text-[11px] text-neutral-600 hover:text-neutral-300 disabled:opacity-50">
        anulează
      </button>
    </div>
  );
}
