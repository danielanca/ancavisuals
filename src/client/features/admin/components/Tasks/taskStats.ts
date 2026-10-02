export type TaskStatus = "todo" | "doing" | "done";
export type TaskPriority = "urgent" | "high" | "medium" | "normal" | "low";

/** Niveluri de prioritate, de la cel mai urgent; `suggestScore` cântărește propunerile pentru azi. */
export const PRIORITY_LEVELS: { value: TaskPriority; label: string; suggestScore: number }[] = [
  { value: "urgent", label: "Urgent", suggestScore: 70 },
  { value: "high", label: "Mare", suggestScore: 40 },
  { value: "medium", label: "Medie", suggestScore: 15 },
  { value: "normal", label: "Normală", suggestScore: 0 },
  { value: "low", label: "Mică", suggestScore: 0 },
];

export function priorityRank(priority: TaskPriority): number {
  const index = PRIORITY_LEVELS.findIndex((level) => level.value === priority);
  return index === -1 ? PRIORITY_LEVELS.length : index;
}

export interface ClientTask {
  id: string;
  title: string;
  notes: string;
  clientName: string;
  eventId: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  /** Termen limită, YYYY-MM-DD */
  dueDate: string | null;
  /** Ziua în care mi-am propus să-l fac, YYYY-MM-DD */
  plannedFor: string | null;
  /** Poziția aleasă manual în lista „Azi” (0 = primul); null = încă neașezat. */
  dayOrder?: number | null;
  /** Ora din timeline-ul zilei planificate, „HH:MM”; null = neprogramat pe ore. */
  scheduledStart?: string | null;
  /** Durata blocului din timeline, în minute. */
  durationMin?: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
}

const DAY_MS = 86_400_000;
const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Bucharest",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Ziua calendaristică (Europe/Bucharest) a unui moment, ca YYYY-MM-DD. */
export function bucharestDay(date: Date | string | number = new Date()): string {
  return dayFormatter.format(new Date(date));
}

/** Adună zile la o zi YYYY-MM-DD (aritmetică pe calendar, fără fus orar). */
export function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + delta * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const toUtc = (day: string) => {
    const [y, m, d] = day.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

export const isOpen = (task: ClientTask) => task.status !== "done";

/** Ordinea automată: în lucru, apoi prioritate, apoi termen. */
export function sortTasks(tasks: ClientTask[]): ClientTask[] {
  return [...tasks].sort((a, b) => {
    if (a.status !== b.status) return a.status === "doing" ? -1 : b.status === "doing" ? 1 : 0;
    if (a.priority !== b.priority) return priorityRank(a.priority) - priorityRank(b.priority);
    return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  });
}

/**
 * Ordinea din „Azi”: taskurile încă neașezate manual apar sus (ordine automată), ca să le vezi și să le
 * pui la locul lor; sub ele, cele așezate, în ordinea aleasă.
 */
export function sortForToday(tasks: ClientTask[]): ClientTask[] {
  const unplaced = sortTasks(tasks.filter((task) => typeof task.dayOrder !== "number"));
  const placed = tasks
    .filter((task) => typeof task.dayOrder === "number")
    .sort((a, b) => (a.dayOrder as number) - (b.dayOrder as number));
  return [...unplaced, ...placed];
}

/** Mută elementul de la `from` la `to` și întoarce noua listă. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Ce intră în „Azi”: planificate pentru azi sau rămase din zilele trecute, plus termenele de azi/depășite. */
export function isForToday(task: ClientTask, today: string): boolean {
  if (!isOpen(task)) return false;
  if (task.plannedFor && task.plannedFor <= today) return true;
  return Boolean(task.dueDate && task.dueDate <= today);
}

export interface TaskSuggestion {
  task: ClientTask;
  score: number;
  reason: string;
}

/** Propune ce merită pus pe azi dintre taskurile deschise care nu sunt deja în „Azi”. */
export function suggestForToday(tasks: ClientTask[], today: string, limit = 5): TaskSuggestion[] {
  const suggestions: TaskSuggestion[] = [];
  for (const task of tasks) {
    if (!isOpen(task) || isForToday(task, today)) continue;
    let score = 0;
    const reasons: string[] = [];
    if (task.dueDate) {
      const daysLeft = daysBetween(today, task.dueDate);
      if (daysLeft <= 3) {
        score += 60 - daysLeft * 10;
        reasons.push(daysLeft === 1 ? "termen mâine" : `termen în ${daysLeft} zile`);
      }
    }
    if (task.status === "doing") {
      score += 30;
      reasons.push("deja început");
    }
    const level = PRIORITY_LEVELS.find((entry) => entry.value === task.priority);
    if (level && level.suggestScore > 0) {
      score += level.suggestScore;
      reasons.push(level.value === "urgent" ? "urgent" : `prioritate ${level.label.toLowerCase()}`);
    }
    if (score === 0 && task.createdAt) {
      const age = daysBetween(bucharestDay(task.createdAt), today);
      if (age >= 7) {
        score += Math.min(age, 25);
        reasons.push(`așteaptă de ${age} zile`);
      }
    }
    if (score > 0) suggestions.push({ task, score, reason: reasons.join(" · ") });
  }
  return suggestions.sort((a, b) => b.score - a.score).slice(0, limit);
}

export interface DayCount {
  day: string;
  done: number;
  created: number;
}

export type ProgressTrend = "progres" | "stagnare" | "scadere";

export interface ProgressStats {
  days: DayCount[];
  doneToday: number;
  doneThisWeek: number;
  donePrevWeek: number;
  createdThisWeek: number;
  backlogNow: number;
  backlogWeekAgo: number;
  overdue: number;
  streak: number;
  trend: ProgressTrend;
}

/** Statistici de progres pe ultimele `windowDays` zile, calculate din createdAt/completedAt. */
export function computeProgress(tasks: ClientTask[], today: string, windowDays = 14): ProgressStats {
  const doneByDay = new Map<string, number>();
  const createdByDay = new Map<string, number>();
  for (const task of tasks) {
    if (task.completedAt && task.status === "done") {
      const day = bucharestDay(task.completedAt);
      doneByDay.set(day, (doneByDay.get(day) ?? 0) + 1);
    }
    if (task.createdAt) {
      const day = bucharestDay(task.createdAt);
      createdByDay.set(day, (createdByDay.get(day) ?? 0) + 1);
    }
  }

  const days: DayCount[] = [];
  for (let offset = windowDays - 1; offset >= 0; offset--) {
    const day = addDays(today, -offset);
    days.push({ day, done: doneByDay.get(day) ?? 0, created: createdByDay.get(day) ?? 0 });
  }

  const sumRange = (map: Map<string, number>, fromOffset: number, toOffset: number) => {
    let total = 0;
    for (let offset = fromOffset; offset <= toOffset; offset++) total += map.get(addDays(today, -offset)) ?? 0;
    return total;
  };

  const weekAgo = addDays(today, -7);
  const backlogWeekAgo = tasks.filter((task) => {
    const created = task.createdAt ? bucharestDay(task.createdAt) : null;
    if (!created || created > weekAgo) return false;
    const completed = task.status === "done" && task.completedAt ? bucharestDay(task.completedAt) : null;
    return !completed || completed > weekAgo;
  }).length;

  let streak = 0;
  // Ziua de azi nu rupe seria cât timp încă e în desfășurare.
  for (let offset = (doneByDay.get(today) ?? 0) > 0 ? 0 : 1; ; offset++) {
    if ((doneByDay.get(addDays(today, -offset)) ?? 0) === 0) break;
    streak++;
  }

  const backlogNow = tasks.filter(isOpen).length;
  const doneThisWeek = sumRange(doneByDay, 0, 6);
  const createdThisWeek = sumRange(createdByDay, 0, 6);
  const trend: ProgressTrend =
    backlogNow < backlogWeekAgo || (backlogNow === backlogWeekAgo && doneThisWeek > 0)
      ? "progres"
      : backlogNow > backlogWeekAgo
        ? "scadere"
        : "stagnare";

  return {
    days,
    doneToday: doneByDay.get(today) ?? 0,
    doneThisWeek,
    donePrevWeek: sumRange(doneByDay, 7, 13),
    createdThisWeek,
    backlogNow,
    backlogWeekAgo,
    overdue: tasks.filter((task) => isOpen(task) && task.dueDate && task.dueDate < today).length,
    streak,
    trend,
  };
}

/** Câte zile în viitor poate fi un eveniment ca să apară la alegerea clientului. */
export const CLIENT_PICKER_LOOKAHEAD_DAYS = 7;

/**
 * Evenimentele la care se lucrează efectiv: trecute, fără dată (lead-uri) sau în următoarea săptămână.
 * Evenimentele mai îndepărtate (ex. nunți din anii următori) nu au încă taskuri și doar aglomerează lista.
 */
export function isEventWorkable(eventDate: Date | string | null | undefined, today: string): boolean {
  if (!eventDate) return true;
  return bucharestDay(eventDate) <= addDays(today, CLIENT_PICKER_LOOKAHEAD_DAYS);
}
