// Historical EUR/USD → RON reference rates from the National Bank of Romania (BNR),
// used instead of a manually-entered flat rate so fiscal reports and dashboard totals
// reflect the actual rate on each invoice/expense date rather than a single guess.
const BNR_YEAR_FEED = (year: number) => `https://curs.bnr.ro/files/xml/years/nbrfxrates${year}.xml`;

type Currency = "EUR" | "USD";
type DateRates = Partial<Record<Currency, number>>;

const CURRENT_YEAR_CACHE_TTL_MS = 60 * 60 * 1000; // BNR publishes once/day after 13:00 — hourly refresh is plenty

const yearCache = new Map<number, { rates: Map<string, DateRates>; fetchedAt: number }>();

export class BnrRateError extends Error {}

function parseYearXml(xml: string): Map<string, DateRates> {
  const rates = new Map<string, DateRates>();
  const cubeRe = /<Cube date="(\d{4}-\d{2}-\d{2})">(.*?)<\/Cube>/gs;
  let cubeMatch: RegExpExecArray | null;
  while ((cubeMatch = cubeRe.exec(xml))) {
    const [, date, body] = cubeMatch;
    const entry: DateRates = {};
    const eur = body.match(/<Rate currency="EUR"[^>]*>([\d.]+)<\/Rate>/);
    const usd = body.match(/<Rate currency="USD"[^>]*>([\d.]+)<\/Rate>/);
    if (eur) entry.EUR = Number(eur[1]);
    if (usd) entry.USD = Number(usd[1]);
    rates.set(date, entry);
  }
  return rates;
}

async function fetchYearRates(year: number): Promise<Map<string, DateRates>> {
  const isCurrentYear = year === new Date().getUTCFullYear();
  const cached = yearCache.get(year);
  if (cached && (!isCurrentYear || Date.now() - cached.fetchedAt < CURRENT_YEAR_CACHE_TTL_MS)) {
    return cached.rates;
  }

  const res = await fetch(BNR_YEAR_FEED(year));
  if (!res.ok) throw new BnrRateError(`BNR feed HTTP ${res.status} for year ${year}`);
  const rates = parseYearXml(await res.text());
  yearCache.set(year, { rates, fetchedAt: Date.now() });
  return rates;
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Looks up the BNR reference rate for `currency` on `date`, walking back up to 10 days
// to cover weekends/bank holidays when no rate was published for the exact date.
export async function getBnrRate(date: Date, currency: Currency): Promise<number> {
  const cursor = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  for (let i = 0; i < 10; i++) {
    const rates = await fetchYearRates(cursor.getUTCFullYear());
    const rate = rates.get(toISODate(cursor))?.[currency];
    if (rate !== undefined) return rate;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  throw new BnrRateError(`No BNR rate found for ${currency} near ${toISODate(date)}`);
}

// Full EUR/RON rate table for a calendar year, keyed by ISO date — used to convert a
// whole year of invoices/expenses without one round trip per item.
export async function getBnrYearRates(year: number, currency: Currency): Promise<Record<string, number>> {
  const rates = await fetchYearRates(year);
  const out: Record<string, number> = {};
  for (const [date, entry] of rates) {
    if (entry[currency] !== undefined) out[date] = entry[currency]!;
  }
  return out;
}
