import React, { useEffect, useMemo, useRef, useState } from "react";
import { addDays, type ClientTask, type TaskPriority } from "./taskStats";
import {
  DAY_MIN,
  DEFAULT_DURATION_MIN,
  MAX_DURATION_MIN,
  SNAP_MIN,
  absoluteStart,
  blockState,
  clockLabel,
  dayOffset,
  formatDuration,
  layoutBlocks,
  relativeDayName,
  snap,
  visibleRange,
  whenLabel,
} from "./timeline";

const PX_PER_HOUR = 96;
const PX_PER_MIN = PX_PER_HOUR / 60;
const RULER_HEIGHT = 40;
const LANE_HEIGHT = 52;
const LANE_GAP = 6;

// Clase complete ca Tailwind să le includă în build.
const BLOCK_COLORS: Record<TaskPriority, string> = {
  urgent: "bg-red-500/25 border-red-500/70",
  high: "bg-orange-500/25 border-orange-500/70",
  medium: "bg-yellow-400/20 border-yellow-400/70",
  normal: "bg-sky-500/20 border-sky-500/70",
  low: "bg-emerald-500/20 border-emerald-500/70",
};

interface DragState {
  id: string;
  mode: "move" | "resize";
  originX: number;
  originStart: number;
  originDuration: number;
  moved: boolean;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function dayHeading(today: string, offset: number): string {
  const [y, m, d] = addDays(today, offset).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("ro-RO", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return `${capitalize(relativeDayName(offset))} · ${date}`;
}

/**
 * Timeline orizontal: azi + mâine (și ieri, dacă un bloc de ieri încă e în desfășurare după miezul nopții).
 * Timpul e în minute absolute față de azi 00:00.
 */
export default function TodayTimeline({
  tasks,
  today,
  now,
  onSchedule,
  onUnschedule,
  onComplete,
  onExternalDragOver,
}: {
  /** Taskuri programate pe ore (plannedFor + scheduledStart), deschise sau făcute azi. */
  tasks: ClientTask[];
  today: string;
  /** Minutul curent al zilei de azi (București). */
  now: number;
  /** `start` e minut absolut față de azi 00:00. */
  onSchedule: (id: string, start: number, durationMin: number) => void;
  onUnschedule: (id: string) => void;
  onComplete: (id: string) => void;
  /** Anunță pagina că un task din listă e tras deasupra timeline-ului (nu e reordonare). */
  onExternalDragOver: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [preview, setPreview] = useState<{ id: string; start: number; duration: number } | null>(null);
  const [ghost, setGhost] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const blocks = useMemo(
    () =>
      tasks
        .filter((task) => task.scheduledStart && task.plannedFor)
        .map((task) => {
          const isPreview = preview?.id === task.id;
          const start = isPreview ? preview.start : absoluteStart(task.plannedFor!, task.scheduledStart!, today);
          const duration = isPreview ? preview.duration : task.durationMin ?? DEFAULT_DURATION_MIN;
          return { id: task.id, task, start, end: start + duration };
        })
        // Blocurile terminate de mai bine de o zi nu mai încarcă timeline-ul (rămân în listă ca „Rămas din…”).
        .filter((block) => block.end > now - DAY_MIN),
    [tasks, preview, today, now],
  );
  const laidOut = useMemo(() => layoutBlocks(blocks), [blocks]);
  const range = visibleRange(blocks, now);
  const width = (range.end - range.start) * PX_PER_MIN;
  const xOf = (minute: number) => (minute - range.start) * PX_PER_MIN;
  const nowLeft = xOf(now);
  const laneCount = Math.max(1, ...laidOut.map((block) => block.lanes));
  const tracksHeight = laneCount * (LANE_HEIGHT + LANE_GAP) + LANE_GAP;
  const firstDay = dayOffset(range.start);
  const lastDay = dayOffset(range.end - 1);
  const dayOffsets = Array.from({ length: lastDay - firstDay + 1 }, (_, i) => firstDay + i);

  // La deschidere, derulează la ora curentă (cu o oră de context în stânga).
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, nowLeft - PX_PER_HOUR);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedBlock = blocks.find((block) => block.id === selectedId) ?? null;
  const active = blocks.find((block) => !isDone(block.task) && block.start <= now && now < block.end);
  const next = blocks
    .filter((block) => !isDone(block.task) && block.start > now)
    .sort((a, b) => a.start - b.start)[0];
  const remainingToday = blocks
    .filter((block) => !isDone(block.task))
    .reduce((sum, block) => sum + Math.max(0, Math.min(block.end, DAY_MIN) - Math.max(block.start, now)), 0);

  function minutesAtClientX(clientX: number): number {
    const rect = gridRef.current!.getBoundingClientRect();
    return range.start + (clientX - rect.left) / PX_PER_MIN;
  }

  function scrollToDay(offset: number) {
    const target = offset === 0 ? now - 60 : offset * DAY_MIN + 8 * 60;
    scrollRef.current?.scrollTo({ left: Math.max(0, xOf(target) - 24), behavior: "smooth" });
  }

  function startPointerDrag(event: React.PointerEvent, id: string, mode: DragState["mode"], start: number, duration: number) {
    if (event.button !== 0) return;
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    dragRef.current = { id, mode, originX: event.clientX, originStart: start, originDuration: duration, moved: false };
  }

  function onPointerMove(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.originX;
    if (!drag.moved && Math.abs(dx) < 4) return;
    drag.moved = true;
    const delta = snap(dx / PX_PER_MIN);
    if (drag.mode === "move") {
      setPreview({ id: drag.id, start: Math.max(-DAY_MIN, drag.originStart + delta), duration: drag.originDuration });
    } else {
      const duration = Math.max(SNAP_MIN, Math.min(MAX_DURATION_MIN, drag.originDuration + delta));
      setPreview({ id: drag.id, start: drag.originStart, duration });
    }
  }

  function onPointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (!drag.moved) {
      setSelectedId((current) => (current === drag.id ? null : drag.id));
      return;
    }
    if (preview && preview.id === drag.id) onSchedule(drag.id, preview.start, preview.duration);
    // Preview-ul rămâne până vine actualizarea optimistă, ca blocul să nu sară înapoi o clipă.
    setTimeout(() => setPreview(null), 0);
  }

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/60" aria-label="Timeline">
      <header className="px-4 pt-3 pb-2 border-b border-neutral-800 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Timeline</p>
          <div className="flex items-center gap-1 text-xs">
            {dayOffsets.map((offset) => (
              <button
                key={offset}
                type="button"
                onClick={() => scrollToDay(offset)}
                className="rounded-md px-2 py-0.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
              >
                {capitalize(relativeDayName(offset))}
              </button>
            ))}
            <span className="ml-2 text-sm tabular-nums text-red-300">{clockLabel(now)}</span>
          </div>
        </div>
        <p className="text-sm">
          {active ? (
            <>
              <span className="text-white">Acum: {active.task.title}</span>{" "}
              <span className="text-neutral-400">
                · mai ai {formatDuration(active.end - now)}
                {active.end > DAY_MIN && ` (până ${whenLabel(active.end)})`}
              </span>
            </>
          ) : next ? (
            <span className="text-neutral-300">
              Liber. Urmează <span className="text-white">{next.task.title}</span>{" "}
              {next.start >= DAY_MIN ? whenLabel(next.start) : `în ${formatDuration(next.start - now)}`}
            </span>
          ) : blocks.length ? (
            <span className="text-neutral-400">Nimic programat mai departe.</span>
          ) : (
            <span className="text-neutral-400">Trage numărul unui task din listă pe o oră ca să-ți planifici ziua (sau folosește „⏰ Oră”).</span>
          )}
        </p>
        {remainingToday > 0 && <p className="text-xs text-neutral-500">Rămas de lucru azi: {formatDuration(remainingToday)}</p>}
      </header>

      <div ref={scrollRef} className="overflow-x-auto" style={{ scrollbarColor: "#404040 transparent" }}>
        <div
          ref={gridRef}
          className="relative mx-5 mb-3"
          style={{ width, height: RULER_HEIGHT + tracksHeight }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            onExternalDragOver();
            setGhost(snap(minutesAtClientX(event.clientX)));
          }}
          onDragLeave={() => setGhost(null)}
          onDrop={(event) => {
            event.preventDefault();
            const id = event.dataTransfer.getData("text/plain");
            const task = tasks.find((candidate) => candidate.id === id);
            const at = snap(minutesAtClientX(event.clientX));
            setGhost(null);
            if (id) onSchedule(id, at, task?.durationMin ?? DEFAULT_DURATION_MIN);
          }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { dragRef.current = null; setPreview(null); }}
        >
          {/* Rigla: ore pline + jumătăți; miezul nopții e marcat puternic, cu numele zilei. */}
          {Array.from({ length: (range.end - range.start) / 60 + 1 }, (_, i) => {
            const minute = range.start + i * 60;
            const midnight = minute % DAY_MIN === 0;
            return (
              <div
                key={minute}
                className={`absolute bottom-0 border-l ${midnight ? "border-violet-500/60" : "border-neutral-800"}`}
                style={{ left: i * PX_PER_HOUR, top: midnight ? 0 : RULER_HEIGHT - 4 }}
              >
                {!midnight && (
                  <span className="absolute -translate-x-1/2 text-[10px] tabular-nums text-neutral-500" style={{ top: -14 }}>
                    {clockLabel(minute)}
                  </span>
                )}
              </div>
            );
          })}
          {Array.from({ length: (range.end - range.start) / 60 }, (_, i) => (
            <div
              key={`h${i}`}
              className="absolute bottom-0 border-l border-dashed border-neutral-800/50"
              style={{ left: i * PX_PER_HOUR + PX_PER_HOUR / 2, top: RULER_HEIGHT }}
            />
          ))}
          {dayOffsets.map((offset) => (
            <span
              key={`day${offset}`}
              className={`absolute top-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium ${
                offset === 0 ? "bg-violet-500/20 text-violet-200" : "bg-neutral-800 text-neutral-300"
              }`}
              style={{ left: Math.max(0, xOf(offset * DAY_MIN)) + 4 }}
            >
              {dayHeading(today, offset)}
            </span>
          ))}

          {/* Timpul deja trecut e ușor estompat. */}
          <div
            className="absolute left-0 bottom-0 bg-neutral-950/50 pointer-events-none"
            style={{ top: RULER_HEIGHT, width: Math.max(0, Math.min(width, nowLeft)) }}
          />

          {ghost !== null && (
            <div
              className="absolute rounded-md border-2 border-dashed border-violet-400/70 bg-violet-500/10 pointer-events-none"
              style={{ left: xOf(ghost), width: DEFAULT_DURATION_MIN * PX_PER_MIN, top: RULER_HEIGHT + LANE_GAP, bottom: LANE_GAP }}
            >
              <span className="absolute left-1.5 top-1 whitespace-nowrap text-[11px] text-violet-200">{whenLabel(ghost)}</span>
            </div>
          )}

          {laidOut.map((block) => {
            const done = isDone(block.task);
            const { state, elapsed } = blockState(block, now, done);
            const blockWidth = Math.max(24, (block.end - block.start) * PX_PER_MIN);
            const top = RULER_HEIGHT + LANE_GAP + block.lane * (LANE_HEIGHT + LANE_GAP);
            const selected = selectedId === block.id;
            const sameDay = dayOffset(block.end - 1) === dayOffset(block.start);
            const span = `${whenLabel(block.start)}–${sameDay ? clockLabel(block.end) : whenLabel(block.end)}`;
            return (
              <div
                key={block.id}
                role="button"
                tabIndex={0}
                aria-label={`${block.task.title}, ${span}`}
                title={`${block.task.title} · ${span} (${formatDuration(block.end - block.start)})`}
                onPointerDown={(event) => startPointerDrag(event, block.id, "move", block.start, block.end - block.start)}
                onKeyDown={(event) => { if (event.key === "Enter") setSelectedId(selected ? null : block.id); }}
                className={`absolute overflow-hidden rounded-md border text-left select-none touch-none cursor-grab active:cursor-grabbing ${
                  done ? "bg-neutral-800/60 border-neutral-700 opacity-60" : BLOCK_COLORS[block.task.priority] ?? BLOCK_COLORS.normal
                } ${state === "active" ? "ring-2 ring-white/70" : ""} ${state === "overrun" ? "border-red-500 border-2" : ""} ${
                  selected ? "z-20 shadow-lg shadow-black/50" : "z-10"
                }`}
                style={{ left: xOf(block.start), width: blockWidth, top, height: LANE_HEIGHT }}
              >
                {/* Partea din bloc peste care a trecut deja timpul (crește de la stânga la dreapta). */}
                {elapsed > 0 && !done && (
                  <div
                    className={`absolute inset-y-0 left-0 pointer-events-none ${state === "overrun" ? "bg-red-500/20" : "bg-white/15"}`}
                    style={{ width: `${elapsed * 100}%` }}
                  />
                )}
                <div className="relative px-2 py-1 pr-3">
                  <p className={`truncate text-xs font-medium ${done ? "line-through text-neutral-400" : "text-white"}`}>{block.task.title}</p>
                  <p className="truncate text-[10px] text-neutral-300/80 tabular-nums">
                    {span}
                    {state === "active" && ` · mai ai ${formatDuration(block.end - now)}`}
                    {state === "overrun" && " · timpul a trecut"}
                    {state === "done" && " · ✓ făcut"}
                  </p>
                </div>
                {!done && (
                  <div
                    onPointerDown={(event) => startPointerDrag(event, block.id, "resize", block.start, block.end - block.start)}
                    className="absolute inset-y-0 right-0 w-2 cursor-ew-resize flex items-center"
                    title="Trage ca să schimbi durata (poate trece și în ziua următoare)"
                  >
                    <div className="h-5 w-0.5 rounded bg-white/40" />
                  </div>
                )}
              </div>
            );
          })}

          {now >= range.start && now <= range.end && (
            <div className="absolute bottom-0 z-30 pointer-events-none" style={{ left: nowLeft, top: RULER_HEIGHT - 6 }}>
              <div className="absolute -left-[5px] top-0 h-2.5 w-2.5 rounded-full bg-red-500" />
              <div className="absolute left-0 top-0 bottom-0 w-0.5 -translate-x-1/4 bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
            </div>
          )}
        </div>
      </div>

      {/* Acțiunile pentru blocul selectat stau sub timeline, ca să încapă și pe blocurile scurte. */}
      {selectedBlock && (
        <div className="flex flex-wrap items-center gap-2 border-t border-neutral-800 px-4 py-2 text-xs">
          <span className="min-w-0 truncate text-neutral-300">
            {selectedBlock.task.title} · {whenLabel(selectedBlock.start)} → {whenLabel(selectedBlock.end)} (
            {formatDuration(selectedBlock.end - selectedBlock.start)})
          </span>
          <span className="ml-auto flex gap-2">
            {!isDone(selectedBlock.task) && (
              <button type="button" onClick={() => onComplete(selectedBlock.id)} className="rounded-md bg-emerald-600 px-2.5 py-1 font-medium text-white">
                ✓ Gata
              </button>
            )}
            <button
              type="button"
              onClick={() => { setSelectedId(null); onUnschedule(selectedBlock.id); }}
              className="rounded-md bg-neutral-700 px-2.5 py-1 text-white"
            >
              ✕ Scoate din timeline
            </button>
            <button type="button" onClick={() => setSelectedId(null)} className="px-1.5 text-neutral-400 hover:text-white">
              Închide
            </button>
          </span>
        </div>
      )}
    </section>
  );
}

function isDone(task: ClientTask): boolean {
  return task.status === "done";
}
