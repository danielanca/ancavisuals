import { CONFIGURATOR_PRICE_FIELDS, isValidConfiguratorPrice, type PriceBook } from "./configuratorPrices";
import { startingPriceKey, STARTING_PRICE_TYPES, type StartingPriceKey, type StartingPrices } from "./startingPrices";

// Seasonal prices, edited in /admin/preturi (Firestore `settings/startingPrices.seasons`).
// A season is a set of months with a percentage per event type; the percentage applies to
// every price of that event (starting price, services, extras). Months in no season keep
// the standard prices. No seasons = the standard prices all year.

export const SEASONAL_EVENT_TYPES = [
  { key: "nunta", label: "Nuntă" },
  { key: "botez", label: "Botez" },
  { key: "majorat", label: "Majorat" },
] as const;

export type SeasonalEventKey = (typeof SEASONAL_EVENT_TYPES)[number]["key"];

export const MONTH_LABELS = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];
export const MONTH_SHORT = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "noi", "dec"];

export const MAX_SEASONS = 6;
export const MIN_SEASON_PERCENT = -50;
export const MAX_SEASON_PERCENT = 100;
export const MAX_SEASON_NAME = 30;

export interface PriceSeason {
  id: string;
  name: string;
  /** 1–12. A month belongs to at most one season. */
  months: number[];
  /** Whole percent per event type, e.g. 20 = +20 %, -15 = −15 %. */
  percent: Record<SeasonalEventKey, number>;
  /** Index in the admin's season colors; stays with the season when others are removed. */
  color: number;
}

const isSeasonalKey = (key: string): key is SeasonalEventKey => SEASONAL_EVENT_TYPES.some((t) => t.key === key);

export const isValidSeasonPercent = (value: unknown): boolean =>
  Number.isInteger(value) && (value as number) >= MIN_SEASON_PERCENT && (value as number) <= MAX_SEASON_PERCENT;

/** Why the seasons can't be saved, or null. Used by the PUT route and the admin form. */
export function seasonsError(raw: unknown): string | null {
  if (!Array.isArray(raw)) return "Sezoanele trebuie să fie o listă.";
  if (raw.length > MAX_SEASONS) return `Maximum ${MAX_SEASONS} sezoane.`;
  const used = new Set<number>();
  for (const item of raw) {
    const season = (item ?? {}) as Partial<PriceSeason>;
    const name = typeof season.name === "string" ? season.name.trim() : "";
    if (!name || name.length > MAX_SEASON_NAME) return `Fiecare sezon are nevoie de un nume (maximum ${MAX_SEASON_NAME} caractere).`;
    if (!Array.isArray(season.months)) return `Sezonul „${name}” nu are lunile setate.`;
    for (const month of season.months) {
      if (!Number.isInteger(month) || month < 1 || month > 12) return `Sezonul „${name}” are o lună invalidă.`;
      if (used.has(month)) return `${MONTH_LABELS[month - 1]} apare în mai multe sezoane.`;
      used.add(month);
    }
    for (const { key, label } of SEASONAL_EVENT_TYPES) {
      if (!isValidSeasonPercent(season.percent?.[key])) {
        return `Sezonul „${name}”, ${label}: procentul trebuie să fie întreg, între ${MIN_SEASON_PERCENT}% și +${MAX_SEASON_PERCENT}%.`;
      }
    }
  }
  return null;
}

/** Stored data → seasons; drops anything malformed instead of failing the public pages. */
export function normalizeSeasons(raw: unknown): PriceSeason[] {
  if (!Array.isArray(raw)) return [];
  const used = new Set<number>();
  const seasons: PriceSeason[] = [];
  for (const item of raw.slice(0, MAX_SEASONS)) {
    const source = (item ?? {}) as Record<string, unknown>;
    const name = typeof source.name === "string" ? source.name.trim().slice(0, MAX_SEASON_NAME) : "";
    if (!name) continue;
    const months = (Array.isArray(source.months) ? source.months : [])
      .map(Number)
      .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12 && !used.has(m));
    months.forEach((m) => used.add(m));
    const rawPercent = (source.percent ?? {}) as Record<string, unknown>;
    const percent = Object.fromEntries(
      SEASONAL_EVENT_TYPES.map(({ key }) => [key, isValidSeasonPercent(Number(rawPercent[key])) ? Number(rawPercent[key]) : 0]),
    ) as Record<SeasonalEventKey, number>;
    const color = Number(source.color);
    seasons.push({
      id: typeof source.id === "string" && source.id ? source.id.slice(0, 40) : `s${seasons.length + 1}`,
      name,
      months: [...new Set(months)].sort((a, b) => a - b),
      percent,
      color: Number.isInteger(color) && color >= 0 && color < MAX_SEASONS ? color : seasons.length,
    });
  }
  return seasons;
}

/** A starting point for the admin: low season in winter, peak in summer. */
export const SEASON_TEMPLATE: PriceSeason[] = [
  { id: "extrasezon", name: "Extrasezon", months: [1, 2, 3, 11, 12], percent: { nunta: -15, botez: 0, majorat: 0 }, color: 0 },
  { id: "mediu", name: "Sezon mediu", months: [4, 5, 10], percent: { nunta: 0, botez: 0, majorat: 0 }, color: 2 },
  { id: "varf", name: "Vârf de sezon", months: [6, 7, 8, 9], percent: { nunta: 20, botez: 10, majorat: 10 }, color: 1 },
];

export const seasonForMonth = (seasons: PriceSeason[], month: number): PriceSeason | undefined =>
  seasons.find((s) => s.months.includes(month));

/**
 * The percentage for an event in a month (1–12). Without a month: the lowest of the year,
 * so "de la" never promises less than any date can get.
 */
export function seasonPercent(seasons: PriceSeason[], eventKey: string, month: number | null | undefined): number {
  if (!isSeasonalKey(eventKey)) return 0;
  if (month) return seasonForMonth(seasons, month)?.percent[eventKey] ?? 0;
  return Math.min(...MONTH_LABELS.map((_, i) => seasonForMonth(seasons, i + 1)?.percent[eventKey] ?? 0));
}

/** Seasonal amounts are rounded to 5 €; 0 € (free) stays free and 0 % leaves the price untouched. */
export function applySeasonPercent(price: number, percent: number): number {
  if (!percent || price === 0) return price;
  return Math.max(5, Math.round((price * (100 + percent)) / 100 / 5) * 5);
}

/**
 * Every price of the book adjusted for `eventKey` in `month` (null = the lowest month).
 * With an exact `isoDate`, a special weekend price for that date is added on top of the season.
 */
export function seasonalPriceBook(
  book: PriceBook,
  seasons: PriceSeason[],
  eventKey: string,
  month: number | null | undefined,
  isoDate: string | null = null,
  dates: DatePrice[] = [],
): PriceBook {
  const percent = pricePercent(seasons, dates, eventKey, isoDate, month);
  const seasonal = percent
    ? Object.fromEntries(Object.entries(book).map(([key, price]) => [key, applySeasonPercent(price, percent)])) as PriceBook
    : book;
  const fixed = dateFixedPrices(dates, isoDate);
  return Object.keys(fixed).length ? { ...seasonal, ...fixed } : seasonal;
}

/** Month (1–12) of a YYYY-MM-DD date, or null. */
export function monthOfIsoDate(isoDate: string | null | undefined): number | null {
  const match = /^\d{4}-(\d{2})-\d{2}$/.exec(isoDate ?? "");
  const month = match ? Number(match[1]) : NaN;
  return month >= 1 && month <= 12 ? month : null;
}

/** "Pachetele încep de la X €" for an event type (label like "Nuntă") on a date (YYYY-MM-DD). */
export function seasonalStartingPrice(
  eventType: unknown,
  prices: StartingPrices,
  seasons: PriceSeason[],
  isoDate?: string | null,
  dates: DatePrice[] = [],
): number {
  const key: StartingPriceKey = startingPriceKey(eventType);
  const fixed = dateFixedPrices(dates, isoDate)[key];
  if (fixed !== undefined) return fixed;
  return applySeasonPercent(prices[key], pricePercent(seasons, dates, key, isoDate ?? null));
}

/** True when the event's prices differ between months, i.e. a date changes the price. */
export const pricesVaryByMonth = (seasons: PriceSeason[], eventKey: string): boolean =>
  isSeasonalKey(eventKey) && new Set(MONTH_LABELS.map((_, i) => seasonPercent(seasons, eventKey, i + 1))).size > 1;

// Special prices for single dates, edited in /admin/preturi (Firestore
// `settings/startingPrices.datePrices`). Two kinds, both optional per date:
// - percent (weekends only): added on top of the month's season — August +20 % and a
//   +10 % date = +30 % for that date;
// - fixed (any date, e.g. an already booked one offered again): exact amounts per service
//   that replace the season and percent for that service on that date only.

export const DATE_PRICE_EVENT_TYPES = SEASONAL_EVENT_TYPES.filter((t) => t.key === "nunta" || t.key === "botez");
export type DatePriceEventKey = "nunta" | "botez";
export const MAX_DATE_PRICES = 200;

export interface DatePrice {
  /** YYYY-MM-DD. A Saturday or Sunday unless the date only has fixed prices. */
  date: string;
  /** Whole percent added to the season, per event type (0 = no change). */
  percent: Record<DatePriceEventKey, number>;
  /** Exact amounts for this date; services left out keep their normal price. */
  fixed?: Partial<PriceBook>;
}

/** Every price that can be fixed on a date, grouped like the configurator in /admin/preturi. */
export const FIXED_PRICE_FIELDS: { key: keyof PriceBook; group: string; label: string }[] = [
  { key: "nunta", group: "Nuntă", label: "Foto + Video" },
  ...CONFIGURATOR_PRICE_FIELDS.filter((f) => f.group === "Nuntă").map(({ key, group, label }) => ({ key, group, label })),
  { key: "botez", group: "Botez", label: "Doar foto" },
  ...CONFIGURATOR_PRICE_FIELDS.filter((f) => f.group === "Botez").map(({ key, group, label }) => ({ key, group, label })),
  { key: "majorat", group: "Majorat", label: "Doar foto" },
  ...CONFIGURATOR_PRICE_FIELDS.filter((f) => f.group === "Majorat").map(({ key, group, label }) => ({ key, group, label })),
  { key: "cununie", group: "Alte evenimente", label: "Cununie civilă" },
  { key: "alt", group: "Alte evenimente", label: "Alt eveniment" },
  ...CONFIGURATOR_PRICE_FIELDS.filter((f) => f.group === "Corporate" || f.group === "Extra").map(({ key, group, label }) => ({ key, group, label })),
];

const STARTING_KEYS = new Set<string>(STARTING_PRICE_TYPES.map((t) => t.key));
const FIXED_KEYS = new Set<string>(FIXED_PRICE_FIELDS.map((f) => f.key));

/** Starting prices must stay positive; configurator prices may be 0 (free). */
const isValidFixedPrice = (key: string, value: unknown): boolean =>
  isValidConfiguratorPrice(value) && (!STARTING_KEYS.has(key) || (value as number) > 0);

function cleanFixed(raw: unknown): Partial<PriceBook> {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(
    Object.entries(source)
      .filter(([key, value]) => FIXED_KEYS.has(key) && value !== null && value !== "" && isValidFixedPrice(key, Number(value)))
      .map(([key, value]) => [key, Number(value)]),
  ) as Partial<PriceBook>;
}

/** The fixed prices of one date (empty when it has none). */
export function dateFixedPrices(dates: DatePrice[], isoDate: string | null | undefined): Partial<PriceBook> {
  if (!isoDate) return {};
  return dates.find((d) => d.date === isoDate)?.fixed ?? {};
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date written YYYY-MM-DD. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const day = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === value;
}

/** True for a real YYYY-MM-DD that falls on a Saturday or Sunday. */
export function isWeekendIsoDate(value: unknown): value is string {
  if (!isIsoDate(value)) return false;
  const weekday = new Date(`${value}T12:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
}

const isDatePriceKey = (key: string): key is DatePriceEventKey => key === "nunta" || key === "botez";

/** Why the special dates can't be saved, or null. Used by the PUT route and the admin form. */
export function datePricesError(raw: unknown): string | null {
  if (!Array.isArray(raw)) return "Prețurile pe date trebuie să fie o listă.";
  if (raw.length > MAX_DATE_PRICES) return `Maximum ${MAX_DATE_PRICES} date cu preț special.`;
  const seen = new Set<string>();
  for (const item of raw) {
    const entry = (item ?? {}) as Partial<DatePrice>;
    if (!isIsoDate(entry.date)) return "Dată invalidă la prețurile pe date.";
    if (seen.has(entry.date)) return `Data ${entry.date} apare de două ori.`;
    seen.add(entry.date);
    const hasPercent = DATE_PRICE_EVENT_TYPES.some(({ key }) => (entry.percent?.[key as DatePriceEventKey] ?? 0) !== 0);
    if (hasPercent && !isWeekendIsoDate(entry.date)) return "Procentele pe date se pot pune doar pe sâmbete și duminici.";
    for (const { key, label } of DATE_PRICE_EVENT_TYPES) {
      if (!isValidSeasonPercent(entry.percent?.[key as DatePriceEventKey] ?? 0)) {
        return `${entry.date}, ${label}: procentul trebuie să fie întreg, între ${MIN_SEASON_PERCENT}% și +${MAX_SEASON_PERCENT}%.`;
      }
    }
    for (const [key, value] of Object.entries(entry.fixed ?? {})) {
      const field = FIXED_PRICE_FIELDS.find((f) => f.key === key);
      if (!field) return `${entry.date}: serviciu necunoscut (${key}).`;
      if (!isValidFixedPrice(key, value)) {
        return `${entry.date}, ${field.group} · ${field.label}: prețul trebuie să fie un număr întreg${STARTING_KEYS.has(key) ? " mai mare ca 0" : ""}.`;
      }
    }
  }
  return null;
}

/** Stored data → special dates, sorted; drops weekdays, duplicates and dates with no change. */
export function normalizeDatePrices(raw: unknown): DatePrice[] {
  if (!Array.isArray(raw)) return [];
  const byDate = new Map<string, DatePrice>();
  for (const item of raw) {
    const source = (item ?? {}) as Record<string, unknown>;
    if (!isIsoDate(source.date) || byDate.has(source.date)) continue;
    const rawPercent = (source.percent ?? {}) as Record<string, unknown>;
    const percent = Object.fromEntries(
      DATE_PRICE_EVENT_TYPES.map(({ key }) => [key, isWeekendIsoDate(source.date) && isValidSeasonPercent(Number(rawPercent[key])) ? Number(rawPercent[key]) : 0]),
    ) as Record<DatePriceEventKey, number>;
    const fixed = cleanFixed(source.fixed);
    const hasFixed = Object.keys(fixed).length > 0;
    if (percent.nunta || percent.botez || hasFixed) byDate.set(source.date, { date: source.date, percent, ...(hasFixed ? { fixed } : {}) });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(0, MAX_DATE_PRICES);
}

/** The special percent of one date for an event (0 when it has none). */
export function datePercent(dates: DatePrice[], eventKey: string, isoDate: string | null | undefined): number {
  if (!isoDate || !isDatePriceKey(eventKey)) return 0;
  return dates.find((d) => d.date === isoDate)?.percent[eventKey] ?? 0;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Every percent the event can still get: in `month` when given, otherwise all year. */
function possiblePercents(seasons: PriceSeason[], dates: DatePrice[], eventKey: string, month: number | null | undefined): number[] {
  const percents = month
    ? [seasonPercent(seasons, eventKey, month)]
    : MONTH_LABELS.map((_, i) => seasonPercent(seasons, eventKey, i + 1));
  const today = todayIso();
  for (const d of dates) {
    const dMonth = monthOfIsoDate(d.date);
    if (d.date < today || (month && dMonth !== month)) continue;
    percents.push(seasonPercent(seasons, eventKey, dMonth) + datePercent(dates, eventKey, d.date));
  }
  return percents;
}

/**
 * Season + special-date percent for an event. With an exact date: that date's price.
 * Without one: the lowest still possible (in `month`, if known), so "de la" never promises too little.
 */
export function pricePercent(
  seasons: PriceSeason[],
  dates: DatePrice[],
  eventKey: string,
  isoDate: string | null | undefined,
  month: number | null | undefined = monthOfIsoDate(isoDate),
): number {
  if (!isSeasonalKey(eventKey)) return 0;
  if (isoDate && ISO_DATE.test(isoDate)) return seasonPercent(seasons, eventKey, monthOfIsoDate(isoDate)) + datePercent(dates, eventKey, isoDate);
  return Math.min(...possiblePercents(seasons, dates, eventKey, month));
}

/** True while the price still depends on a date not chosen yet (show "de la"). */
export function priceDependsOnDate(
  seasons: PriceSeason[],
  dates: DatePrice[],
  eventKey: string,
  isoDate: string | null | undefined,
  month: number | null | undefined,
): boolean {
  if (!isSeasonalKey(eventKey) || (isoDate && ISO_DATE.test(isoDate))) return false;
  return new Set(possiblePercents(seasons, dates, eventKey, month)).size > 1;
}
