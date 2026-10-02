import React, { useCallback, useEffect, useMemo, useState } from "react";
import useAuth from "../../auth/useAuth";
import Breadcrumb from "../Breadcrumb";
import DictateField from "./DictateButton";
import TodayTimeline from "./TodayTimeline";
import {
  DAY_MIN,
  DEFAULT_DURATION_MIN,
  DURATION_OPTIONS,
  absoluteStart,
  bucharestMinutes,
  clockLabel,
  dayOffset,
  formatDuration,
  fromMinutes,
  relativeDayName,
  splitAbsolute,
  toMinutes,
  whenLabel,
} from "./timeline";
import type { ClientEvent } from "../../types";
import {
  type ClientTask,
  type ProgressStats,
  type TaskPriority,
  addDays,
  bucharestDay,
  computeProgress,
  isEventWorkable,
  isForToday,
  isOpen,
  moveItem,
  PRIORITY_LEVELS,
  sortForToday,
  sortTasks,
  suggestForToday,
} from "./taskStats";

type Tab = "azi" | "deschise" | "facute";

interface EventOption {
  id: string;
  label: string;
  clientName: string;
}

// Clase complete (nu construite dinamic) ca Tailwind să le includă în build.
const PRIORITY_STYLES: Record<TaskPriority, { dot: string; chip: string; border: string; active: string }> = {
  urgent: { dot: "bg-red-500", chip: "bg-red-500/15 text-red-300", border: "border-l-red-500", active: "border-red-500 bg-red-500/20 text-red-200" },
  high: { dot: "bg-orange-500", chip: "bg-orange-500/15 text-orange-300", border: "border-l-orange-500", active: "border-orange-500 bg-orange-500/20 text-orange-200" },
  medium: { dot: "bg-yellow-400", chip: "bg-yellow-400/15 text-yellow-200", border: "border-l-yellow-400", active: "border-yellow-400 bg-yellow-400/20 text-yellow-100" },
  normal: { dot: "bg-sky-500", chip: "bg-sky-500/15 text-sky-300", border: "border-l-sky-500", active: "border-sky-500 bg-sky-500/20 text-sky-200" },
  low: { dot: "bg-emerald-500", chip: "bg-emerald-500/15 text-emerald-300", border: "border-l-emerald-500", active: "border-emerald-500 bg-emerald-500/20 text-emerald-200" },
};

function priorityLabel(priority: TaskPriority): string {
  return PRIORITY_LEVELS.find((level) => level.value === priority)?.label ?? priority;
}

function PriorityPicker({ value, onChange }: { value: TaskPriority; onChange: (value: TaskPriority) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Prioritate">
      {PRIORITY_LEVELS.map((level) => {
        const selected = value === level.value;
        const style = PRIORITY_STYLES[level.value];
        return (
          <button
            key={level.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(level.value)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
              selected ? style.active : "border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500"
            }`}
          >
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${style.dot}`} />
            {level.label}
          </button>
        );
      })}
    </div>
  );
}
const TREND_UI: Record<ProgressStats["trend"], { label: string; detail: string; className: string }> = {
  progres: { label: "▲ Progres", detail: "Rezolvi mai repede decât se adună.", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  stagnare: { label: "■ Stagnare", detail: "Lista a rămas pe loc față de săptămâna trecută.", className: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  scadere: { label: "▼ Rămâi în urmă", detail: "Se adună mai multe taskuri decât închizi.", className: "bg-red-500/15 text-red-300 border-red-500/30" },
};

const inputClass =
  "bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500";

function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("ro-RO", { day: "numeric", month: "short", timeZone: "UTC" });
}

export default function TasksPage() {
  const { auth } = useAuth();
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("azi");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [today, setToday] = useState(() => bucharestDay());
  const [nowMin, setNowMin] = useState(() => bucharestMinutes());

  const headers = useCallback(
    () => ({ "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` }),
    [auth.accessToken],
  );

  useEffect(() => {
    if (!auth.accessToken) return;
    const authHeader = { Authorization: `Bearer ${auth.accessToken}` };
    fetch("/api/admin/tasks", { headers: authHeader })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = (await response.json()) as { tasks: ClientTask[] };
        setTasks(data.tasks ?? []);
      })
      .catch(() => setError("Nu am putut încărca taskurile."))
      .finally(() => setLoading(false));
    fetch("/api/admin/events", { headers: authHeader })
      .then((response) => response.json())
      .then((data: { events?: ClientEvent[] }) => {
        const options = (data.events ?? [])
          .filter((event) => event.status !== "anulat" && event.client?.fullName)
          .filter((event) => isEventWorkable(event.eventDate, bucharestDay()))
          .sort((a, b) => String(b.eventDate ?? "").localeCompare(String(a.eventDate ?? "")))
          .map((event) => {
            const date = event.eventDate ? new Date(event.eventDate).toLocaleDateString("ro-RO") : "fără dată";
            return { id: event.id, clientName: event.client.fullName, label: `${event.client.fullName} — ${event.typeLabel ?? event.type} (${date})` };
          });
        setEvents(options);
      })
      .catch(() => {});
  }, [auth.accessToken]);

  // Pagina poate rămâne deschisă peste miezul nopții.
  useEffect(() => {
    const interval = setInterval(() => {
      setToday(bucharestDay());
      setNowMin(bucharestMinutes());
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  async function createTask(body: Partial<ClientTask>) {
    setError(null);
    const response = await fetch("/api/admin/tasks", { method: "POST", headers: headers(), body: JSON.stringify(body) });
    const data = (await response.json().catch(() => ({}))) as { task?: ClientTask; error?: string };
    if (!response.ok || !data.task) {
      setError(data.error ?? "Nu am putut salva taskul.");
      return false;
    }
    setTasks((prev) => [...prev, data.task!]);
    return true;
  }

  async function updateTask(id: string, patch: Partial<ClientTask>) {
    setError(null);
    const previous = tasks.find((task) => task.id === id);
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...patch } : task)));
    const response = await fetch(`/api/admin/tasks/${id}`, { method: "PATCH", headers: headers(), body: JSON.stringify(patch) });
    const data = (await response.json().catch(() => ({}))) as { task?: ClientTask; error?: string };
    if (!response.ok || !data.task) {
      if (previous) setTasks((prev) => prev.map((task) => (task.id === id ? previous : task)));
      setError(data.error ?? "Nu am putut actualiza taskul.");
      return;
    }
    setTasks((prev) => prev.map((task) => (task.id === id ? data.task! : task)));
  }

  async function reorderToday(from: number, to: number) {
    const ordered = moveItem(todayTasks, from, to);
    if (ordered === todayTasks) return;
    const ids = ordered.map((task) => task.id);
    const previousOrder = new Map(tasks.map((task) => [task.id, task.dayOrder ?? null]));
    setError(null);
    setTasks((prev) => prev.map((task) => (ids.includes(task.id) ? { ...task, dayOrder: ids.indexOf(task.id) } : task)));
    const response = await fetch("/api/admin/tasks/reorder", { method: "POST", headers: headers(), body: JSON.stringify({ ids }) }).catch(() => null);
    if (!response?.ok) {
      setTasks((prev) => prev.map((task) => (previousOrder.has(task.id) ? { ...task, dayOrder: previousOrder.get(task.id) ?? null } : task)));
      setError("Nu am putut salva ordinea.");
    }
  }

  async function deleteTask(id: string) {
    if (!window.confirm("Ștergi acest task? Dispare și din statistici.")) return;
    const response = await fetch(`/api/admin/tasks/${id}`, { method: "DELETE", headers: headers() });
    if (!response.ok) {
      setError("Nu am putut șterge taskul.");
      return;
    }
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }

  const todayTasks = useMemo(() => sortForToday(tasks.filter((task) => isForToday(task, today))), [tasks, today]);
  const openTasks = useMemo(() => tasks.filter(isOpen), [tasks]);
  const doneTasks = useMemo(
    () => tasks.filter((task) => !isOpen(task)).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
    [tasks],
  );
  const doneTodayTasks = useMemo(
    () => doneTasks.filter((task) => task.completedAt && bucharestDay(task.completedAt) === today),
    [doneTasks, today],
  );
  const suggestions = useMemo(() => suggestForToday(tasks, today), [tasks, today]);
  const stats = useMemo(() => computeProgress(tasks, today), [tasks, today]);

  const openByClient = useMemo(() => {
    const groups = new Map<string, ClientTask[]>();
    for (const task of openTasks) {
      const key = task.clientName || "Fără client";
      groups.set(key, [...(groups.get(key) ?? []), task]);
    }
    return [...groups.entries()]
      .map(([client, list]) => [client, sortTasks(list)] as const)
      .sort(([a], [b]) => (a === "Fără client" ? 1 : b === "Fără client" ? -1 : a.localeCompare(b, "ro")));
  }, [openTasks]);

  // Ora din timeline e legată de ziua planificată: `start` e minut absolut față de azi 00:00
  // (poate cădea mâine), deci programarea mută și ziua planificată.
  const scheduleTask = (id: string, start: number | null, durationMin?: number) => {
    if (start === null) return updateTask(id, { scheduledStart: null });
    const { day, time } = splitAbsolute(start, today);
    return updateTask(id, { plannedFor: day, scheduledStart: time, durationMin: durationMin ?? DEFAULT_DURATION_MIN });
  };
  const timelineTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.scheduledStart &&
          task.plannedFor &&
          (isOpen(task) || (task.completedAt !== null && bucharestDay(task.completedAt) === today)),
      ),
    [tasks, today],
  );

  const rowProps = {
    today,
    events,
    editingId,
    onEdit: setEditingId,
    onUpdate: updateTask,
    onDelete: deleteTask,
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <Breadcrumb />

        <div>
          <h1 className="text-2xl font-light tracking-tight">Taskuri clienți</h1>
          <p className="text-sm text-neutral-500 mt-1">Ce ai de făcut, ce ai făcut și ce îți propui azi.</p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
        )}

        <QuickAdd events={events} today={today} onCreate={createTask} />

        {loading ? (
          <p className="text-sm text-neutral-500">Se încarcă…</p>
        ) : (
          <>
            <ProgressPanel stats={stats} today={today} />

            <div className="flex gap-1 border-b border-neutral-800" role="tablist">
              {([
                ["azi", `Azi (${todayTasks.length})`],
                ["deschise", `De făcut (${openTasks.length})`],
                ["facute", `Făcute (${doneTasks.length})`],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors ${
                    tab === key ? "border-violet-500 text-white" : "border-transparent text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "azi" && (
              <div className="space-y-5">
              <div>
                <TodayTimeline
                  tasks={timelineTasks}
                  today={today}
                  now={nowMin}
                  onSchedule={(id, start, duration) => scheduleTask(id, start, duration)}
                  onUnschedule={(id) => scheduleTask(id, null)}
                  onComplete={(id) => updateTask(id, { status: "done" })}
                  onExternalDragOver={() => setDropIndex(null)}
                />
              </div>
              <div className="space-y-5">
                {suggestions.length > 0 && (
                  <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-wide text-violet-300">Propuneri pentru azi</p>
                      <button
                        type="button"
                        onClick={() => suggestions.forEach(({ task }) => updateTask(task.id, { plannedFor: today }))}
                        className="text-xs text-violet-300 hover:text-white"
                      >
                        Adaugă toate
                      </button>
                    </div>
                    {suggestions.map(({ task, reason }) => (
                      <div key={task.id} className="flex items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate">{task.title}</p>
                          <p className="text-xs text-neutral-500 truncate">
                            {task.clientName && `${task.clientName} · `}
                            {reason}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateTask(task.id, { plannedFor: today })}
                          className="shrink-0 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-medium"
                        >
                          + Azi
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {todayTasks.length === 0 ? (
                  <p className="text-sm text-neutral-500">
                    Nimic planificat pentru azi. Adaugă un task nou sau alege din propuneri / „De făcut”.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {todayTasks.length > 1 && (
                      <p className="text-xs text-neutral-500">Ordinea în care le faci azi: mută cu ▲▼ sau trage de număr. Trage numărul pe timeline ca să-i dai o oră.</p>
                    )}
                    {todayTasks.map((task, index) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        {...rowProps}
                        onSchedule={(start, duration) => scheduleTask(task.id, start, duration)}
                        order={{
                          index,
                          total: todayTasks.length,
                          placed: typeof task.dayOrder === "number",
                          onMove: (to) => reorderToday(index, to),
                          dragging: dragIndex === index,
                          dropTarget: dropIndex === index && dragIndex !== null && dragIndex !== index,
                          onDragStart: () => setDragIndex(index),
                          onDragOver: () => setDropIndex(index),
                          onDragEnd: () => {
                            if (dragIndex !== null && dropIndex !== null) reorderToday(dragIndex, dropIndex);
                            setDragIndex(null);
                            setDropIndex(null);
                          },
                        }}
                      />
                    ))}
                  </div>
                )}

                {doneTodayTasks.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-emerald-400">Făcute azi ({doneTodayTasks.length})</p>
                    {doneTodayTasks.map((task) => (
                      <TaskRow key={task.id} task={task} {...rowProps} />
                    ))}
                  </div>
                )}
              </div>
              </div>
            )}

            {tab === "deschise" && (
              <div className="space-y-6">
                {openByClient.length === 0 && <p className="text-sm text-neutral-500">Nu ai taskuri deschise. 🎉</p>}
                {openByClient.map(([client, list]) => (
                  <div key={client} className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-neutral-400">
                      {client} <span className="text-neutral-600">({list.length})</span>
                    </p>
                    {list.map((task) => (
                      <TaskRow key={task.id} task={task} {...rowProps} />
                    ))}
                  </div>
                ))}
              </div>
            )}

            {tab === "facute" && (
              <div className="space-y-2">
                {doneTasks.length === 0 && <p className="text-sm text-neutral-500">Încă nu ai bifat nimic.</p>}
                {doneTasks.slice(0, 100).map((task) => (
                  <TaskRow key={task.id} task={task} {...rowProps} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function QuickAdd({
  events,
  today,
  onCreate,
}: {
  events: EventOption[];
  today: string;
  onCreate: (body: Partial<ClientTask>) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [forToday, setForToday] = useState(true);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const match = events.find((option) => option.label === client || option.clientName === client);
    const ok = await onCreate({
      title,
      clientName: match?.clientName ?? client,
      eventId: match?.id ?? null,
      dueDate: dueDate || null,
      priority,
      plannedFor: forToday ? today : null,
    });
    setSaving(false);
    if (ok) {
      setTitle("");
      setDueDate("");
      setPriority("normal");
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-3">
      <DictateField value={title} onChange={setTitle}>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Ce ai de făcut? ex: Trimite preview-ul, Editează filmul, Sună pentru avans…"
          aria-label="Titlu task"
          className={`${inputClass} w-full`}
        />
      </DictateField>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
        <input
          value={client}
          onChange={(event) => setClient(event.target.value)}
          list="task-client-options"
          placeholder="Client / eveniment (opțional)"
          aria-label="Client"
          className={inputClass}
        />
        <datalist id="task-client-options">
          {events.map((option) => (
            <option key={option.id} value={option.label} />
          ))}
        </datalist>
        <input
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          aria-label="Termen"
          title="Termen limită"
          className={inputClass}
        />
      </div>
      <PriorityPicker value={priority} onChange={setPriority} />
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-neutral-400">
          <input type="checkbox" checked={forToday} onChange={(event) => setForToday(event.target.checked)} />
          Îmi propun să-l fac azi
        </label>
        <button
          type="submit"
          disabled={!title.trim() || saving}
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-sm font-medium"
        >
          {saving ? "Se salvează…" : "Adaugă task"}
        </button>
      </div>
    </form>
  );
}

function ProgressPanel({ stats, today }: { stats: ProgressStats; today: string }) {
  const trend = TREND_UI[stats.trend];
  const weekDelta = stats.doneThisWeek - stats.donePrevWeek;
  const backlogDelta = stats.backlogNow - stats.backlogWeekAgo;
  const maxBar = Math.max(1, ...stats.days.map((day) => Math.max(day.done, day.created)));

  const tiles: { label: string; value: string; hint: string; tone?: string }[] = [
    { label: "Făcute azi", value: String(stats.doneToday), hint: stats.streak > 1 ? `serie: ${stats.streak} zile la rând` : "bifează ceva azi" },
    {
      label: "Făcute în 7 zile",
      value: String(stats.doneThisWeek),
      hint: `${weekDelta >= 0 ? "+" : ""}${weekDelta} față de săpt. trecută`,
      tone: weekDelta > 0 ? "text-emerald-400" : weekDelta < 0 ? "text-red-400" : undefined,
    },
    {
      label: "Rămase deschise",
      value: String(stats.backlogNow),
      hint: `acum 7 zile: ${stats.backlogWeekAgo} (${backlogDelta > 0 ? "+" : ""}${backlogDelta})`,
      tone: backlogDelta < 0 ? "text-emerald-400" : backlogDelta > 0 ? "text-red-400" : undefined,
    },
    {
      label: "Termen depășit",
      value: String(stats.overdue),
      hint: stats.overdue > 0 ? "de rezolvat primele" : "nimic restant",
      tone: stats.overdue > 0 ? "text-red-400" : "text-emerald-400",
    },
  ];

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-4" aria-label="Progres">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`px-3 py-1 rounded-full border text-sm font-medium ${trend.className}`}>{trend.label}</span>
        <span className="text-sm text-neutral-400">
          {trend.detail} Săptămâna asta: {stats.createdThisWeek} adăugate, {stats.doneThisWeek} rezolvate.
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-lg bg-neutral-950/60 border border-neutral-800 p-3">
            <p className="text-[11px] uppercase tracking-wide text-neutral-500">{tile.label}</p>
            <p className="text-2xl font-light mt-1">{tile.value}</p>
            <p className={`text-xs mt-0.5 ${tile.tone ?? "text-neutral-500"}`}>{tile.hint}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-2">
          <span>Ultimele 14 zile</span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500" />rezolvate</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-neutral-600" />adăugate</span>
          </span>
        </div>
        <div className="flex items-end gap-1 h-24">
          {stats.days.map((day) => (
            <div
              key={day.day}
              className="flex-1 h-full flex items-end justify-center gap-px"
              title={`${formatDay(day.day)}: ${day.done} rezolvate, ${day.created} adăugate`}
            >
              <div className="w-1/2 max-w-[10px] rounded-t bg-emerald-500" style={{ height: `${(day.done / maxBar) * 100}%`, minHeight: day.done ? 3 : 0 }} />
              <div className="w-1/2 max-w-[10px] rounded-t bg-neutral-600" style={{ height: `${(day.created / maxBar) * 100}%`, minHeight: day.created ? 3 : 0 }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
          <span>{formatDay(addDays(today, -13))}</span>
          <span>azi</span>
        </div>
      </div>
    </section>
  );
}

function ScheduleEditor({
  start,
  durationMin,
  onSave,
  onClear,
}: {
  /** Minut absolut față de azi 00:00, dacă e deja programat. */
  start: number | null;
  durationMin: number;
  onSave: (start: number, durationMin: number) => void;
  onClear?: () => void;
}) {
  const [day, setDay] = useState(() => (start === null ? 0 : Math.max(0, dayOffset(start))));
  const [time, setTime] = useState(() => (start === null ? fromMinutes(Math.ceil((bucharestMinutes() + 1) / 15) * 15) : clockLabel(start)));
  const [duration, setDuration] = useState(durationMin);
  const options = DURATION_OPTIONS.includes(duration) ? DURATION_OPTIONS : [...DURATION_OPTIONS, duration].sort((a, b) => a - b);
  const dayOptions = [0, 1, 2, ...(day > 2 ? [day] : [])];
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <select value={day} onChange={(e) => setDay(Number(e.target.value))} aria-label="Ziua" className={`${inputClass} py-1`}>
        {dayOptions.map((offset) => (
          <option key={offset} value={offset}>{relativeDayName(offset).charAt(0).toUpperCase() + relativeDayName(offset).slice(1)}</option>
        ))}
      </select>
      <input type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} aria-label="Ora de început" className={`${inputClass} py-1`} />
      <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} aria-label="Durata" className={`${inputClass} py-1`}>
        {options.map((value) => (
          <option key={value} value={value}>{formatDuration(value)}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => time && onSave(day * DAY_MIN + toMinutes(time.slice(0, 5)), duration)}
        disabled={!time}
        className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-xs font-medium"
      >
        Pune pe timeline
      </button>
      {onClear && (
        <button type="button" onClick={onClear} className="px-2 py-1.5 text-xs text-neutral-400 hover:text-white">
          Scoate din timeline
        </button>
      )}
    </div>
  );
}

interface RowOrder {
  index: number;
  total: number;
  placed: boolean;
  onMove: (to: number) => void;
  dragging: boolean;
  dropTarget: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
}

function TaskRow({
  task,
  today,
  events,
  editingId,
  onEdit,
  onUpdate,
  onDelete,
  order,
  onSchedule,
}: {
  task: ClientTask;
  today: string;
  events: EventOption[];
  editingId: string | null;
  onEdit: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<ClientTask>) => void;
  onDelete: (id: string) => void;
  /** Doar în „Azi”: poziția și controalele de reordonare. */
  order?: RowOrder;
  /** Doar în „Azi”: pune taskul pe o oră din timeline (null = scoate). */
  onSchedule?: (start: number | null, durationMin?: number) => void;
}) {
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const scheduledAt = task.plannedFor && task.scheduledStart ? absoluteStart(task.plannedFor, task.scheduledStart, today) : null;
  const scheduledEnd = scheduledAt === null ? null : scheduledAt + (task.durationMin ?? DEFAULT_DURATION_MIN);
  const done = task.status === "done";
  const overdue = !done && task.dueDate !== null && task.dueDate < today;
  const plannedToday = !done && task.plannedFor !== null && task.plannedFor <= today;
  const rolledOver = plannedToday && task.plannedFor! < today;
  const editing = editingId === task.id;

  return (
    <div
      onDragOver={order ? (event) => { event.preventDefault(); order.onDragOver(); } : undefined}
      onDrop={order ? (event) => event.preventDefault() : undefined}
      className={`rounded-xl border border-l-4 p-3 transition-opacity ${
        done ? "border-neutral-800 border-l-neutral-700 bg-neutral-900/30" : `border-neutral-800 bg-neutral-900 ${PRIORITY_STYLES[task.priority]?.border ?? ""}`
      } ${order?.dragging ? "opacity-40" : ""} ${order?.dropTarget ? "ring-2 ring-violet-500/60" : ""}`}
    >
      <div className="flex items-start gap-3">
        {order && (
          <div className="flex shrink-0 flex-col items-center -my-1">
            <button
              type="button"
              onClick={() => order.onMove(order.index - 1)}
              disabled={order.index === 0}
              aria-label="Mută mai sus"
              className="px-1.5 text-xs leading-4 text-neutral-500 hover:text-white disabled:opacity-20"
            >
              ▲
            </button>
            <span
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", task.id);
                order.onDragStart();
              }}
              onDragEnd={order.onDragEnd}
              title={order.placed ? "Trage ca să schimbi ordinea" : "Nou — încă neașezat. Trage-l sau mută-l la locul lui."}
              className={`flex h-6 w-6 cursor-grab items-center justify-center rounded-md text-xs font-semibold active:cursor-grabbing ${
                order.placed ? "bg-neutral-800 text-neutral-200" : "border border-dashed border-violet-400/60 text-violet-300"
              }`}
            >
              {order.index + 1}
            </span>
            <button
              type="button"
              onClick={() => order.onMove(order.index + 1)}
              disabled={order.index === order.total - 1}
              aria-label="Mută mai jos"
              className="px-1.5 text-xs leading-4 text-neutral-500 hover:text-white disabled:opacity-20"
            >
              ▼
            </button>
          </div>
        )}
        <input
          type="checkbox"
          checked={done}
          onChange={() => onUpdate(task.id, { status: done ? "todo" : "done" })}
          aria-label={done ? "Redeschide" : "Marchează ca făcut"}
          className="mt-1 h-4 w-4 accent-emerald-500"
        />
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${done ? "line-through text-neutral-500" : ""}`}>{task.title}</p>
          <div className="flex flex-wrap gap-1.5 mt-1.5 text-[11px]">
            {task.clientName && <span className="px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300">{task.clientName}</span>}
            {task.status === "doing" && <span className="px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300">În lucru</span>}
            {!done && (
              <button
                type="button"
                onClick={() => setPriorityOpen((open) => !open)}
                aria-expanded={priorityOpen}
                title="Schimbă prioritatea"
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full hover:brightness-125 ${PRIORITY_STYLES[task.priority]?.chip ?? "bg-neutral-800 text-neutral-400"}`}
              >
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${PRIORITY_STYLES[task.priority]?.dot ?? "bg-neutral-500"}`} />
                {priorityLabel(task.priority)} ▾
              </button>
            )}
            {task.dueDate && !done && (
              <span className={`px-2 py-0.5 rounded-full ${overdue ? "bg-red-500/15 text-red-300" : "bg-neutral-800 text-neutral-400"}`}>
                {overdue ? "Depășit: " : "Termen: "}
                {formatDay(task.dueDate)}
              </span>
            )}
            {scheduledAt !== null && scheduledEnd !== null && !done && (
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-neutral-200 tabular-nums">
                ⏰ {whenLabel(scheduledAt)}–{dayOffset(scheduledEnd - 1) === dayOffset(scheduledAt) ? clockLabel(scheduledEnd) : whenLabel(scheduledEnd)}
              </span>
            )}
            {rolledOver && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">Rămas din {formatDay(task.plannedFor!)}</span>
            )}
            {done && task.completedAt && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">Făcut {formatDay(bucharestDay(task.completedAt))}</span>
            )}
          </div>
          {priorityOpen && !done && (
            <div className="mt-2">
              <PriorityPicker
                value={task.priority}
                onChange={(priority) => {
                  setPriorityOpen(false);
                  if (priority !== task.priority) onUpdate(task.id, { priority });
                }}
              />
            </div>
          )}
          {scheduleOpen && onSchedule && !done && (
            <ScheduleEditor
              start={scheduledAt}
              durationMin={task.durationMin ?? DEFAULT_DURATION_MIN}
              onSave={(start, duration) => { setScheduleOpen(false); onSchedule(start, duration); }}
              onClear={scheduledAt !== null ? () => { setScheduleOpen(false); onSchedule(null); } : undefined}
            />
          )}
          {task.notes && !editing && <p className="text-xs text-neutral-500 mt-1.5 whitespace-pre-line">{task.notes}</p>}
        </div>
        {!done && (
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            <button
              type="button"
              onClick={() => onUpdate(task.id, { status: task.status === "doing" ? "todo" : "doing" })}
              className="px-2 py-1 rounded-md text-xs text-neutral-400 hover:text-white hover:bg-neutral-800"
            >
              {task.status === "doing" ? "Pauză" : "Încep"}
            </button>
            {onSchedule && (
              <button
                type="button"
                onClick={() => setScheduleOpen((open) => !open)}
                aria-expanded={scheduleOpen}
                className="px-2 py-1 rounded-md text-xs text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                ⏰ Oră
              </button>
            )}
            <button
              type="button"
              onClick={() => onUpdate(task.id, plannedToday && !rolledOver ? { plannedFor: null, scheduledStart: null } : { plannedFor: today })}
              className="px-2 py-1 rounded-md text-xs text-neutral-400 hover:text-white hover:bg-neutral-800"
            >
              {plannedToday && !rolledOver ? "Scoate de azi" : "Pe azi"}
            </button>
            {plannedToday && (
              <button
                type="button"
                onClick={() => onUpdate(task.id, { plannedFor: addDays(today, 1), scheduledStart: null })}
                className="px-2 py-1 rounded-md text-xs text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                Mâine
              </button>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => onEdit(editing ? null : task.id)}
          className="px-2 py-1 rounded-md text-xs text-neutral-500 hover:text-white hover:bg-neutral-800"
        >
          {editing ? "Închide" : "Editează"}
        </button>
      </div>
      {editing && (
        <TaskEditor
          task={task}
          events={events}
          onSave={(patch) => {
            onUpdate(task.id, patch);
            onEdit(null);
          }}
          onDelete={() => onDelete(task.id)}
        />
      )}
    </div>
  );
}

function TaskEditor({
  task,
  events,
  onSave,
  onDelete,
}: {
  task: ClientTask;
  events: EventOption[];
  onSave: (patch: Partial<ClientTask>) => void;
  onDelete: () => void;
}) {
  const [form, setForm] = useState({
    title: task.title,
    notes: task.notes,
    clientName: task.clientName,
    dueDate: task.dueDate ?? "",
    plannedFor: task.plannedFor ?? "",
    priority: task.priority,
  });

  function save() {
    const match = events.find((option) => option.label === form.clientName || option.clientName === form.clientName);
    onSave({
      title: form.title,
      notes: form.notes,
      clientName: match?.clientName ?? form.clientName,
      eventId: match ? match.id : form.clientName === task.clientName ? task.eventId : null,
      dueDate: form.dueDate || null,
      plannedFor: form.plannedFor || null,
      priority: form.priority,
    });
  }

  return (
    <div className="mt-3 pt-3 border-t border-neutral-800 space-y-2">
      <DictateField value={form.title} onChange={(title) => setForm((prev) => ({ ...prev, title }))}>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} aria-label="Titlu" className={`${inputClass} w-full`} />
      </DictateField>
      <DictateField value={form.notes} onChange={(notes) => setForm((prev) => ({ ...prev, notes }))}>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Notițe, detalii, ce s-a discutat cu clientul… (sau apasă microfonul și vorbește)"
          rows={3}
          aria-label="Notițe"
          className={`${inputClass} w-full`}
        />
      </DictateField>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          value={form.clientName}
          onChange={(e) => setForm({ ...form, clientName: e.target.value })}
          list="task-client-options"
          placeholder="Client"
          aria-label="Client"
          className={`${inputClass} sm:col-span-2`}
        />
        <div className="sm:col-span-2">
          <PriorityPicker value={form.priority} onChange={(priority) => setForm({ ...form, priority })} />
        </div>
        <label className="text-xs text-neutral-500 space-y-1">
          <span>Termen limită</span>
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={`${inputClass} w-full`} />
        </label>
        <label className="text-xs text-neutral-500 space-y-1">
          <span>Planificat pentru</span>
          <input type="date" value={form.plannedFor} onChange={(e) => setForm({ ...form, plannedFor: e.target.value })} className={`${inputClass} w-full`} />
        </label>
      </div>
      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={onDelete} className="text-xs text-red-400 hover:text-red-300">
          Șterge
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!form.title.trim()}
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-sm font-medium"
        >
          Salvează
        </button>
      </div>
    </div>
  );
}
