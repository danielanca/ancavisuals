import { Timestamp } from "firebase-admin/firestore";

function toDateString(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Timestamp ? value.toDate() : new Date(value as string);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Expands an event into a list of ISO days (YYYY-MM-DD).
 *  If it has eventEndDate, return all days in the interval inclusively.
 *  Otherwise return a single day (eventDate).
 */
export function expandEventDates(data: Record<string, unknown>): string[] {
  const start = toDateString(data.eventDate);
  if (!start) return [];

  const end = toDateString(data.eventEndDate);
  if (!end || end <= start) return [start];

  const dates: string[] = [];
  const cur = new Date(start);
  const endDate = new Date(end);
  while (cur <= endDate) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}
