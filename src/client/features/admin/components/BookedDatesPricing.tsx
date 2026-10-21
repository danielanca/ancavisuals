import React, { useEffect, useMemo, useState } from "react";
import type { PriceBook } from "../../../../shared/pricing/configuratorPrices";
import {
  FIXED_PRICE_FIELDS,
  monthOfIsoDate,
  seasonalPriceBook,
  type DatePrice,
  type PriceSeason,
} from "../../../../shared/pricing/seasonalPricing";
import { visitDay } from "../../../../shared/liveVisits";

type BookedEntry = {
  date: string;
  eventId: string;
  clientName: string;
  eventType: string;
  total: number | null;
  excludeFromCalendar: boolean;
};

const GROUPS = [...new Set(FIXED_PRICE_FIELDS.map((f) => f.group))];
// Season percent that applies to each group's prices; the others show the standard price.
const GROUP_EVENT: Record<string, string> = { Nuntă: "nunta", Botez: "botez", Majorat: "majorat" };

const euro = (n: number) => `${n.toLocaleString("ro-RO")} €`;
const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
/** "Octombrie 2026" — the heading above each month's dates. */
const monthHeading = (iso: string) => {
  const label = new Date(`${iso}T12:00:00Z`).toLocaleDateString("ro-RO", { month: "long", year: "numeric", timeZone: "UTC" });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

/** Exact prices per service for one date; empty = the normal price (season + weekend percent). */
function FixedPriceEditor({
  date, entry, datePrices, onChange, seasons, book, disabled,
}: {
  date: string;
  entry: DatePrice | undefined;
  datePrices: DatePrice[];
  onChange: (next: DatePrice[]) => void;
  seasons: PriceSeason[];
  book: PriceBook;
  disabled?: boolean;
}) {
  const fixed = entry?.fixed ?? {};
  // Normal price of the date = everything except this date's fixed amounts.
  const normalDates = useMemo(() => datePrices.map(({ fixed: _fixed, ...rest }) => rest), [datePrices]);
  const month = monthOfIsoDate(date);
  const normal = (group: string) => (GROUP_EVENT[group]
    ? seasonalPriceBook(book, seasons, GROUP_EVENT[group], month, date, normalDates)
    : book);

  const setFixed = (key: keyof PriceBook, raw: string) => {
    const nextFixed: Partial<PriceBook> = { ...fixed };
    if (raw.trim() === "") delete nextFixed[key];
    else nextFixed[key] = Number(raw);
    const base = entry ?? { date, percent: { nunta: 0, botez: 0 } };
    const hasFixed = Object.keys(nextFixed).length > 0;
    const keep = hasFixed || base.percent.nunta !== 0 || base.percent.botez !== 0;
    const rest = datePrices.filter((d) => d.date !== date);
    const updated: DatePrice[] = keep ? [{ date, percent: base.percent, ...(hasFixed ? { fixed: nextFixed } : {}) }] : [];
    onChange([...rest, ...updated].sort((a, b) => a.date.localeCompare(b.date)));
  };

  return (
    <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-950/10 p-3">
      <p className="text-neutral-400 text-xs">
        Scrie prețul exact pentru {longDate(date)}. Câmp gol = prețul obișnuit al zilei (în gri). Sezonul și procentul de weekend nu se mai adaugă peste un preț fix.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {GROUPS.map((group) => {
          const normalBook = normal(group);
          return (
            <div key={group}>
              <p className="mb-1 text-[11px] uppercase tracking-[0.2em] text-neutral-500">{group}</p>
              <div className="rounded-lg border border-neutral-800 divide-y divide-neutral-800">
                {FIXED_PRICE_FIELDS.filter((f) => f.group === group).map(({ key, label }) => (
                  <label key={key} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="text-neutral-300 text-xs">{label}</span>
                    <span className="flex items-center gap-1.5">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={5}
                        disabled={disabled}
                        value={fixed[key] ?? ""}
                        placeholder={String(normalBook[key])}
                        onChange={(e) => setFixed(key, e.target.value)}
                        className={`w-24 rounded-lg px-2 py-1.5 text-sm text-right tabular-nums ${fixed[key] !== undefined ? "bg-emerald-900/40 text-white" : "bg-neutral-800 text-white placeholder:text-neutral-600"}`}
                      />
                      <span className="text-neutral-500 text-xs">€</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {Object.keys(fixed).length > 0 && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(
            datePrices.flatMap((d) => {
              if (d.date !== date) return [d];
              return d.percent.nunta || d.percent.botez ? [{ date: d.date, percent: d.percent }] : [];
            }),
          )}
          className="px-3 py-1.5 rounded-lg bg-neutral-800 text-red-300 text-xs"
        >
          Șterge prețurile fixe ale zilei
        </button>
      )}
    </div>
  );
}

/**
 * Booked dates from now on: who booked them and for how much, a switch that shows a date
 * free again in the public availability check only (the event stays in the CRM), and exact
 * per-service prices for that date. Fixed prices can be put on any other date too.
 */
export default function BookedDatesPricing({
  datePrices, onChange, seasons, book, disabled,
}: {
  datePrices: DatePrice[];
  onChange: (next: DatePrice[]) => void;
  seasons: PriceSeason[];
  book: PriceBook;
  disabled?: boolean;
}) {
  const today = visitDay();
  const [booked, setBooked] = useState<BookedEntry[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [busyEvent, setBusyEvent] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");

  useEffect(() => {
    fetch("/api/admin/booked-dates")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { dates?: BookedEntry[] }) => setBooked(d.dates ?? []))
      .catch(() => setLoadError(true));
  }, []);

  const byDate = useMemo(() => new Map(datePrices.map((d) => [d.date, d])), [datePrices]);
  const bookedByDate = useMemo(() => {
    const map = new Map<string, BookedEntry[]>();
    for (const entry of booked ?? []) {
      if (entry.date < today) continue;
      map.set(entry.date, [...(map.get(entry.date) ?? []), entry]);
    }
    return new Map([...map].sort(([a], [b]) => a.localeCompare(b)));
  }, [booked, today]);
  const daysPerEvent = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of booked ?? []) counts.set(entry.eventId, (counts.get(entry.eventId) ?? 0) + 1);
    return counts;
  }, [booked]);
  const otherFixedDates = datePrices
    .filter((d) => d.date >= today && d.fixed && Object.keys(d.fixed).length > 0 && !bookedByDate.has(d.date))
    .map((d) => d.date);
  if (open && !bookedByDate.has(open) && !otherFixedDates.includes(open)) otherFixedDates.push(open);
  otherFixedDates.sort();

  const toggleAvailability = async (entry: BookedEntry) => {
    setBusyEvent(entry.eventId);
    setToggleError(null);
    const excludeFromCalendar = !entry.excludeFromCalendar;
    try {
      const res = await fetch(`/api/admin/events/${entry.eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excludeFromCalendar }),
      });
      if (!res.ok) throw new Error();
      setBooked((list) => (list ?? []).map((b) => (b.eventId === entry.eventId ? { ...b, excludeFromCalendar } : b)));
    } catch {
      setToggleError("Nu s-a putut schimba disponibilitatea. Încearcă din nou.");
    } finally {
      setBusyEvent(null);
    }
  };

  const fixedCount = (date: string) => Object.keys(byDate.get(date)?.fixed ?? {}).length;
  const editor = (date: string) => (
    <FixedPriceEditor
      date={date}
      entry={byDate.get(date)}
      datePrices={datePrices}
      onChange={onChange}
      seasons={seasons}
      book={book}
      disabled={disabled}
    />
  );

  return (
    <section id="date-ocupate" className="space-y-4 scroll-mt-6">
      <div>
        <h2 className="text-white text-lg font-light tracking-tight">Date ocupate și prețuri fixe</h2>
        <p className="text-neutral-500 text-sm mt-1">
          Datele deja rezervate, de azi încolo. „Fă disponibilă din nou” arată data liberă doar la verificarea disponibilității
          (site, chatbot) — evenimentul și contractul rămân neschimbate. Pune apoi prețul exact pe fiecare serviciu pentru acea zi.
        </p>
      </div>

      {toggleError && <p className="text-red-400 text-sm">{toggleError}</p>}
      {loadError && <p className="text-red-400 text-sm">Nu s-au putut încărca datele ocupate.</p>}
      {!booked && !loadError && <p className="text-neutral-500 text-sm">Se încarcă…</p>}
      {booked && bookedByDate.size === 0 && <p className="text-neutral-500 text-sm">Nicio dată ocupată de azi încolo.</p>}

      <div className="space-y-2">
        {[...bookedByDate].map(([date, entries], index, all) => {
          const offered = entries.every((e) => e.excludeFromCalendar);
          const count = fixedCount(date);
          // The dates are sorted: a new month starts when its yyyy-mm differs from the previous date's.
          const newMonth = index === 0 || all[index - 1][0].slice(0, 7) !== date.slice(0, 7);
          return (
            <React.Fragment key={date}>
            {newMonth && (
              <h3 className={`text-neutral-300 text-sm font-medium uppercase tracking-[0.15em] border-b border-neutral-800 pb-1.5 ${index === 0 ? "" : "pt-4"}`}>
                {monthHeading(date)}
              </h3>
            )}
            <div className={`rounded-xl border p-3 space-y-3 ${offered ? "border-emerald-500/40 bg-emerald-950/10" : "border-neutral-800 bg-neutral-900/30"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium first-letter:uppercase">{longDate(date)}</p>
                  {entries.map((e) => (
                    <p key={e.eventId} className="text-neutral-400 text-xs mt-0.5">
                      {[e.eventType, e.clientName, e.total ? euro(e.total) : null].filter(Boolean).join(" · ")}
                      {(daysPerEvent.get(e.eventId) ?? 1) > 1 && <span className="text-neutral-600"> · eveniment pe {daysPerEvent.get(e.eventId)} zile</span>}
                    </p>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${offered ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
                    {offered ? "Apare liberă pe site" : "Ocupată"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpen(open === date ? null : date)}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-200 text-xs hover:text-white"
                  >
                    {count > 0 ? `Prețuri fixe (${count})` : "Setează prețuri"}
                  </button>
                  {entries.map((e) => (
                    <button
                      key={e.eventId}
                      type="button"
                      disabled={busyEvent === e.eventId}
                      onClick={() => void toggleAvailability(e)}
                      className={`px-3 py-1.5 rounded-lg text-xs disabled:opacity-40 ${e.excludeFromCalendar ? "bg-neutral-800 text-neutral-300" : "bg-emerald-700 text-white"}`}
                      title={(daysPerEvent.get(e.eventId) ?? 1) > 1 ? "Se aplică tuturor zilelor evenimentului" : undefined}
                    >
                      {e.excludeFromCalendar ? "Marchează din nou ocupată" : "Fă disponibilă din nou"}
                      {entries.length > 1 ? ` (${e.clientName || e.eventType})` : ""}
                    </button>
                  ))}
                </div>
              </div>
              {open === date && editor(date)}
            </div>
            </React.Fragment>
          );
        })}
      </div>

      <div className="space-y-2 pt-2">
        <p className="text-neutral-400 text-xs uppercase tracking-wider">Prețuri fixe pe alte date</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            min={today}
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="bg-neutral-800 text-white rounded-lg px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={!newDate || newDate < today}
            onClick={() => { setOpen(newDate); setNewDate(""); }}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-200 text-xs disabled:opacity-40"
          >
            Setează prețuri pe această dată
          </button>
        </div>
        {otherFixedDates.map((date) => (
          <div key={date} className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-white text-sm first-letter:uppercase">{longDate(date)}</p>
              <button
                type="button"
                onClick={() => setOpen(open === date ? null : date)}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-200 text-xs"
              >
                {open === date ? "Închide" : `Prețuri fixe (${fixedCount(date)})`}
              </button>
            </div>
            {open === date && editor(date)}
          </div>
        ))}
        <p className="text-neutral-600 text-xs">Prețurile se păstrează abia după „Salvează” de jos. Butonul de disponibilitate se aplică imediat.</p>
      </div>
    </section>
  );
}
