import { addDays, daysBetween } from "./taskStats";

export const SNAP_MIN = 15;
export const DEFAULT_DURATION_MIN = 60;
export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720, 1440, 2880];
export const DAY_MIN = 24 * 60;
/** Un task se poate întinde pe cel mult o săptămână (aceeași limită ca pe server). */
export const MAX_DURATION_MIN = 7 * DAY_MIN;

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Bucharest",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Minutele scurse din ziua curentă la București (0–1439). */
export function bucharestMinutes(date: Date = new Date()): number {
  const [h, m] = timeFormatter.format(date).split(":").map(Number);
  return h * 60 + m;
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

export function snap(minutes: number, step = SNAP_MIN): number {
  return Math.round(minutes / step) * step;
}

export function formatDuration(minutes: number): string {
  const d = Math.floor(minutes / DAY_MIN);
  const h = Math.floor((minutes % DAY_MIN) / 60);
  const m = minutes % 60;
  if (d) return [`${d} ${d === 1 ? "zi" : "zile"}`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(" ");
  if (!h) return `${m} min`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// Pe timeline, timpul e în minute față de azi 00:00: negativ = ieri, peste 1440 = mâine și mai departe.

/** Ora de ceas pentru un minut absolut (trece peste miezul nopții). */
export function clockLabel(absolute: number): string {
  return fromMinutes(((absolute % DAY_MIN) + DAY_MIN) % DAY_MIN);
}

export function dayOffset(absolute: number): number {
  return Math.floor(absolute / DAY_MIN);
}

export function relativeDayName(offset: number): string {
  if (offset === -1) return "ieri";
  if (offset === 0) return "azi";
  if (offset === 1) return "mâine";
  if (offset === 2) return "poimâine";
  return offset < 0 ? `acum ${-offset} zile` : `peste ${offset} zile`;
}

/** „22:00” pentru azi, „mâine 02:00” pentru altă zi. */
export function whenLabel(absolute: number): string {
  const offset = dayOffset(absolute);
  return offset === 0 ? clockLabel(absolute) : `${relativeDayName(offset)} ${clockLabel(absolute)}`;
}

/** Minutul absolut al unui task programat (zi planificată + oră). */
export function absoluteStart(plannedFor: string, scheduledStart: string, today: string): number {
  return daysBetween(today, plannedFor) * DAY_MIN + toMinutes(scheduledStart);
}

/** Inversul lui `absoluteStart`: ziua și ora de salvat pentru un minut absolut. */
export function splitAbsolute(absolute: number, today: string): { day: string; time: string } {
  return { day: addDays(today, dayOffset(absolute)), time: clockLabel(absolute) };
}

export interface TimelineBlock {
  id: string;
  start: number;
  end: number;
}

/** Așază blocurile suprapuse unul lângă altul: fiecare primește o coloană (`lane`) din `lanes` ale grupului său. */
export function layoutBlocks<T extends TimelineBlock>(blocks: T[]): (T & { lane: number; lanes: number })[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end);
  const result: (T & { lane: number; lanes: number })[] = [];
  let cluster: (T & { lane: number; lanes: number })[] = [];
  let clusterEnd = -1;
  let laneEnds: number[] = [];

  const closeCluster = () => {
    const lanes = Math.max(1, laneEnds.length);
    cluster.forEach((block) => { block.lanes = lanes; });
    result.push(...cluster);
    cluster = [];
    laneEnds = [];
  };

  for (const block of sorted) {
    if (cluster.length && block.start >= clusterEnd) closeCluster();
    let lane = laneEnds.findIndex((end) => end <= block.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(block.end);
    } else {
      laneEnds[lane] = block.end;
    }
    cluster.push({ ...block, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, block.end);
  }
  if (cluster.length) closeCluster();
  return result;
}

export type BlockState = "upcoming" | "active" | "overrun" | "done";

/** Starea unui bloc față de ora curentă și cât din el a „trecut” (0–1). */
export function blockState(block: TimelineBlock, now: number, done: boolean): { state: BlockState; elapsed: number } {
  const elapsed = Math.max(0, Math.min(1, (now - block.start) / Math.max(1, block.end - block.start)));
  if (done) return { state: "done", elapsed };
  if (now < block.start) return { state: "upcoming", elapsed: 0 };
  if (now < block.end) return { state: "active", elapsed };
  return { state: "overrun", elapsed: 1 };
}

/**
 * Intervalul afișat, în minute absolute: de la 08:00 azi (sau mai devreme, dacă e nevoie) până la sfârșitul
 * zilei de mâine, ca după miezul nopții să vezi în continuare unde ești; se extinde pentru blocurile mai lungi.
 */
export function visibleRange(blocks: TimelineBlock[], now: number): { start: number; end: number } {
  let start = Math.min(8 * 60, Math.floor((now - 60) / 60) * 60);
  let end = Math.max(2 * DAY_MIN, Math.ceil((now + 6 * 60) / 60) * 60);
  for (const block of blocks) {
    start = Math.min(start, Math.floor(block.start / 60) * 60);
    end = Math.max(end, Math.ceil(block.end / 60) * 60);
  }
  return { start, end };
}
