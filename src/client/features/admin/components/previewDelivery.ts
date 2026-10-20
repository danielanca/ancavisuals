/*
 * Purpose: the "Livrare preview & tag Instagram" board logic, kept out of the page so it can be
 * tested. Each event goes through two steps: 1) preview sent (deadline: PREVIEW_DEADLINE_DAYS
 * after the event), 2) the client tagged us on Instagram (only asked for once the preview is out).
 */
import type { ClientEvent } from "../types";
import { PREVIEW_DEADLINE_DAYS } from "../types";

export type DeliveryStage = "late" | "preview" | "tag" | "done";

export interface DeliveryRow {
  event: ClientEvent;
  stage: DeliveryStage;
  /** Local midnight of the event day and of the preview deadline. */
  eventDay: Date;
  deadline: Date;
  /** Days left until the deadline (negative = days late); only meaningful before the preview is sent. */
  daysLeft: number;
  previewSentAt: Date | null;
  taggedAt: Date | null;
  /** Days since the preview went out, while waiting for the tag. */
  waitingTagDays: number | null;
}

const DAY_MS = 86_400_000;
const ACTIVE_STATUSES = new Set(["confirmat", "finalizat"]);

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const daysBetween = (from: Date, to: Date) => Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
const parseDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function deliveryRow(event: ClientEvent, today: Date): DeliveryRow | null {
  if (!event.eventDate || !ACTIVE_STATUSES.has(event.status)) return null;
  const eventDay = startOfDay(new Date(event.eventDate));
  if (daysBetween(eventDay, today) < 0) return null;

  const deadline = new Date(eventDay.getTime() + PREVIEW_DEADLINE_DAYS * DAY_MS);
  const previewSent = event.delivery?.previewSent === true;
  const tagged = event.delivery?.instagramTagged === true;
  const previewSentAt = previewSent ? parseDate(event.delivery?.previewSentAt) : null;
  const daysLeft = daysBetween(today, deadline);
  const stage: DeliveryStage = previewSent && tagged ? "done" : previewSent ? "tag" : daysLeft < 0 ? "late" : "preview";

  return {
    event,
    stage,
    eventDay,
    deadline,
    daysLeft,
    previewSentAt,
    taggedAt: tagged ? parseDate(event.delivery?.instagramTaggedAt) : null,
    waitingTagDays: stage === "tag" && previewSentAt ? daysBetween(previewSentAt, today) : null,
  };
}

export type DeliveryBoard = Record<DeliveryStage, DeliveryRow[]>;

/** Most urgent first in each group; finished ones newest first. */
export function deliveryBoard(events: ClientEvent[], today: Date): DeliveryBoard {
  const board: DeliveryBoard = { late: [], preview: [], tag: [], done: [] };
  for (const event of events) {
    const row = deliveryRow(event, today);
    if (row) board[row.stage].push(row);
  }
  board.late.sort((a, b) => a.daysLeft - b.daysLeft);
  board.preview.sort((a, b) => a.daysLeft - b.daysLeft);
  board.tag.sort((a, b) => (b.waitingTagDays ?? 0) - (a.waitingTagDays ?? 0));
  board.done.sort((a, b) => b.eventDay.getTime() - a.eventDay.getTime());
  return board;
}

/** "mai ai 2 zile" / "termenul e azi" / "întârziat 3 zile". */
export function deadlineLabel(daysLeft: number): string {
  if (daysLeft > 1) return `mai ai ${daysLeft} zile`;
  if (daysLeft === 1) return "mai ai o zi";
  if (daysLeft === 0) return "termenul e azi";
  return daysLeft === -1 ? "întârziat o zi" : `întârziat ${-daysLeft} zile`;
}
