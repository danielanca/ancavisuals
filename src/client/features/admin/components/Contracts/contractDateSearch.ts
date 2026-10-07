const MONTHS = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
];

export interface EventDateQuery {
  day: number;
  month: number;
  year?: number;
}

export function parseEventDateQuery(value: string): EventDateQuery | null {
  const text = value.trim().toLocaleLowerCase("ro-RO").replace(/\s+/g, " ");
  const numeric = text.match(/^(\d{1,2})\s*[./-]\s*(\d{1,2})(?:\s*[./-]\s*(\d{4}))?$/);
  const named = text.match(/^(\d{1,2})\s+([a-z]+)\.?\s*(\d{4})?$/);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let day: number;
  let month: number;
  let year: number | undefined;
  if (iso) {
    day = Number(iso[3]); month = Number(iso[2]); year = Number(iso[1]);
  } else if (numeric) {
    day = Number(numeric[1]); month = Number(numeric[2]);
    year = numeric[3] ? Number(numeric[3]) : undefined;
  } else if (named) {
    day = Number(named[1]);
    month = MONTHS.findIndex((name) => name === named[2] || name.slice(0, 3) === named[2]) + 1;
    year = named[3] ? Number(named[3]) : undefined;
  } else {
    return null;
  }
  // Use a leap year when no year is supplied, so 29 February can match.
  const date = new Date(Date.UTC(year ?? 2000, month - 1, day));
  if ((year !== undefined && year < 1000) || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { day, month, year };
}

export function matchesEventDateQuery(dates: string[], query: EventDateQuery): boolean {
  return dates.some((value) => {
    // Preserve the calendar day stored in date-only and ISO timestamp values.
    const date = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
    return !!date && Number(date[3]) === query.day && Number(date[2]) === query.month
      && (query.year === undefined || Number(date[1]) === query.year);
  });
}
