/*
 * Purpose: the "eveniment de noapte" rule shared by the signing page, the sign route and
 * the contract PDF. The client must declare at signing whether the event runs past 00:00.
 * Past the reference hour (00:00 when declared "nu", the declared end hour when "da") the
 * provider grants a 25-minute tolerance; after it, every started half hour costs 200 lei.
 */

export type NightEventAnswer = "da" | "nu";

export const NIGHT_TOLERANCE_MINUTES = 25;
export const NIGHT_HALF_HOUR_FEE_RON = 200;
/** A declared night event must end by this hour (the team needs rest before morning events). */
export const NIGHT_LATEST_END = "08:00";

/** Event types where asking "e eveniment de noapte?" makes no sense. */
const NIGHT_EVENT_EXCLUDED_TYPES = new Set(["Ședință foto", "Înmormântare"]);

/** Why the question is asked — shown on the signing page and in the contract. */
export const NIGHT_EVENT_REASON =
  "Fotografii și videografii trebuie să știe din timp dacă evenimentul este de noapte: a doua zi pot avea alt eveniment sau program la locul de muncă și trebuie să se poată pregăti (odihnă, echipă, transport).";

export function nightEventApplies(eventType: unknown): boolean {
  return !NIGHT_EVENT_EXCLUDED_TYPES.has(String(eventType ?? "").trim());
}

export function parseNightEventAnswer(value: unknown): NightEventAnswer | null {
  return value === "da" || value === "nu" ? value : null;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidNightEndTime(value: unknown): value is string {
  return typeof value === "string" && TIME_PATTERN.test(value) && value <= NIGHT_LATEST_END;
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Extra fee in lei for an event that actually ended at `actualEnd` (HH:MM, after midnight).
 * Reference = 00:00 for "nu", the declared end time for "da".
 * Ex. ("nu", "00:25") → 0, ("nu", "00:26") → 200, ("nu", "00:55") → 200, ("nu", "00:56") → 400.
 */
export function nightOvertimeFee(answer: NightEventAnswer, actualEnd: string, declaredEnd?: string): number {
  if (!TIME_PATTERN.test(actualEnd)) return 0;
  const reference = answer === "da" && declaredEnd && TIME_PATTERN.test(declaredEnd) ? toMinutes(declaredEnd) : 0;
  const end = toMinutes(actualEnd);
  // Anything later than 08:00 is an evening/day end time (e.g. 23:40), not past midnight.
  if (end > toMinutes(NIGHT_LATEST_END)) return 0;
  const over = end - reference - NIGHT_TOLERANCE_MINUTES;
  if (over <= 0) return 0;
  return Math.ceil(over / 30) * NIGHT_HALF_HOUR_FEE_RON;
}
