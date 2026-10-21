import React, { useEffect, useMemo, useState } from "react";
import useAuth from "../auth/useAuth";
import Breadcrumb from "./Breadcrumb";
import {
  DEFAULT_STARTING_PRICES,
  normalizeStartingPrices,
  STARTING_PRICE_TYPES,
  type StartingPriceKey,
} from "../../../../shared/pricing/startingPrices";
import {
  CONFIGURATOR_PRICE_FIELDS,
  DEFAULT_CONFIGURATOR_PRICES,
  isValidConfiguratorPrice,
  normalizeConfiguratorPrices,
  type ConfiguratorPriceKey,
  type ConfiguratorPrices,
} from "../../../../shared/pricing/configuratorPrices";
import {
  datePricesError,
  normalizeDatePrices,
  normalizeSeasons,
  seasonsError,
  type DatePrice,
  type PriceSeason,
} from "../../../../shared/pricing/seasonalPricing";
import { MAX_PRICE_YEARS, normalizeYearPrices, yearPricesError, type YearPrices } from "../../../../shared/pricing/yearPricing";
import SeasonalPricingEditor from "./SeasonalPricingEditor";
import WeekendPricingCalendar from "./WeekendPricingCalendar";
import BookedDatesPricing from "./BookedDatesPricing";

type Draft = Record<StartingPriceKey, string>;
type ConfiguratorDraft = Record<ConfiguratorPriceKey, string>;
type YearDraft = { starting: Draft; configurator: ConfiguratorDraft };

const toDraft = (prices: Record<StartingPriceKey, number>): Draft =>
  Object.fromEntries(STARTING_PRICE_TYPES.map(({ key }) => [key, String(prices[key])])) as Draft;
const toConfiguratorDraft = (prices: ConfiguratorPrices): ConfiguratorDraft =>
  Object.fromEntries(CONFIGURATOR_PRICE_FIELDS.map(({ key }) => [key, String(prices[key])])) as ConfiguratorDraft;

const toYearDrafts = (yearPrices: YearPrices): Record<string, YearDraft> =>
  Object.fromEntries(Object.entries(yearPrices).map(([year, book]) => [year, { starting: toDraft(book), configurator: toConfiguratorDraft(book) }]));

const startingInvalid = (d: Draft) => STARTING_PRICE_TYPES.some(({ key }) => {
  const value = Number(d[key]);
  return !Number.isInteger(value) || value <= 0 || value > 100_000;
});
const configuratorInvalid = (d: ConfiguratorDraft) =>
  CONFIGURATOR_PRICE_FIELDS.some(({ key }) => d[key].trim() === "" || !isValidConfiguratorPrice(Number(d[key])));
const toNumbers = <K extends string>(d: Record<K, string>) =>
  Object.fromEntries(Object.entries(d).map(([key, value]) => [key, Number(value)])) as Record<K, number>;

// The owner already has a client for 2028: that year starts as a copy of the standard prices.
const SUGGESTED_YEAR = "2028";
const CURRENT_YEAR = new Date().getFullYear();

const CONFIGURATOR_GROUPS = [...new Set(CONFIGURATOR_PRICE_FIELDS.map((f) => f.group))];
// The service each event's starting price already covers (shown as a reminder in its group).
const STARTING_NOTE: Partial<Record<string, string>> = {
  Nuntă: "Foto + Video = prețul de pornire „Nuntă”",
  Botez: "Doar foto = prețul de pornire „Botez”",
  Majorat: "Doar foto = prețul de pornire „Majorat”",
};

const INPUT_CLASS = "w-28 bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm text-right tabular-nums";

export default function StartingPricesPage() {
  const { auth } = useAuth();
  const [draft, setDraft] = useState<Draft>(toDraft(DEFAULT_STARTING_PRICES));
  const [configuratorDraft, setConfiguratorDraft] = useState<ConfiguratorDraft>(toConfiguratorDraft(DEFAULT_CONFIGURATOR_PRICES));
  const [seasons, setSeasons] = useState<PriceSeason[]>([]);
  const [datePrices, setDatePrices] = useState<DatePrice[]>([]);
  // Prices per event year; null = the standard prices (every year without its own).
  const [yearDrafts, setYearDrafts] = useState<Record<string, YearDraft>>({});
  const [unsavedYears, setUnsavedYears] = useState<string[]>([]);
  const [activeYear, setActiveYear] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/starting-prices", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setDraft(toDraft(normalizeStartingPrices(d?.prices)));
        setConfiguratorDraft(toConfiguratorDraft(normalizeConfiguratorPrices(d?.configurator)));
        setSeasons(normalizeSeasons(d?.seasons));
        setDatePrices(normalizeDatePrices(d?.datePrices));
        const years = toYearDrafts(normalizeYearPrices(d?.yearPrices));
        if (!years[SUGGESTED_YEAR] && Number(SUGGESTED_YEAR) >= CURRENT_YEAR) {
          years[SUGGESTED_YEAR] = { starting: toDraft(normalizeStartingPrices(d?.prices)), configurator: toConfiguratorDraft(normalizeConfiguratorPrices(d?.configurator)) };
          setUnsavedYears([SUGGESTED_YEAR]);
        }
        setYearDrafts(years);
      })
      .catch(() => setMessage({ ok: false, text: "Nu s-au putut încărca prețurile — se afișează valorile implicite." }))
      .finally(() => setLoading(false));
  }, []);

  // Opened from /admin/statistici-contact → jump to the weekend calendar once it is rendered.
  useEffect(() => {
    if (!loading && ["#preturi-pe-date", "#date-ocupate"].includes(window.location.hash)) document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, [loading]);

  const invalid = startingInvalid(draft) || configuratorInvalid(configuratorDraft)
    || Object.values(yearDrafts).some((y) => startingInvalid(y.starting) || configuratorInvalid(y.configurator));

  // The inputs below edit the standard prices or, with a year tab open, that year's prices.
  const shownStarting = activeYear ? yearDrafts[activeYear].starting : draft;
  const shownConfigurator = activeYear ? yearDrafts[activeYear].configurator : configuratorDraft;
  const setStarting = (key: StartingPriceKey, value: string) => activeYear
    ? setYearDrafts((y) => ({ ...y, [activeYear]: { ...y[activeYear], starting: { ...y[activeYear].starting, [key]: value } } }))
    : setDraft((d) => ({ ...d, [key]: value }));
  const setConfigurator = (key: ConfiguratorPriceKey, value: string) => activeYear
    ? setYearDrafts((y) => ({ ...y, [activeYear]: { ...y[activeYear], configurator: { ...y[activeYear].configurator, [key]: value } } }))
    : setConfiguratorDraft((d) => ({ ...d, [key]: value }));
  const yearOptions = Array.from({ length: 6 }, (_, i) => String(CURRENT_YEAR + i)).filter((year) => !yearDrafts[year]);
  const addYear = (year: string) => {
    setYearDrafts((y) => ({ ...y, [year]: { starting: { ...draft }, configurator: { ...configuratorDraft } } }));
    setUnsavedYears((u) => [...u, year]);
    setActiveYear(year);
  };
  const removeYear = (year: string) => {
    setYearDrafts(({ [year]: _removed, ...rest }) => rest);
    setActiveYear(null);
  };

  const yearPricesPayload = () => Object.fromEntries(Object.entries(yearDrafts).map(([year, y]) => [year, { ...toNumbers(y.starting), ...toNumbers(y.configurator) }]));
  const seasonsProblem = seasonsError(seasons) ?? datePricesError(datePrices) ?? (invalid ? null : yearPricesError(yearPricesPayload()));
  // Live preview for the seasons, from what is typed now (invalid fields fall back to the defaults).
  const previewStarting = useMemo(() => normalizeStartingPrices(Object.fromEntries(STARTING_PRICE_TYPES.map(({ key }) => [key, Number(draft[key])]))), [draft]);
  const previewConfigurator = useMemo(() => normalizeConfiguratorPrices(Object.fromEntries(CONFIGURATOR_PRICE_FIELDS.map(({ key }) => [key, configuratorDraft[key]]))), [configuratorDraft]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const prices = Object.fromEntries(STARTING_PRICE_TYPES.map(({ key }) => [key, Number(draft[key])]));
      const configurator = Object.fromEntries(CONFIGURATOR_PRICE_FIELDS.map(({ key }) => [key, Number(configuratorDraft[key])]));
      const res = await fetch("/api/admin/starting-prices", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ prices, configurator, seasons: seasons.map((season) => ({ ...season, name: season.name.trim() })), datePrices, yearPrices: yearPricesPayload() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Nu s-au putut salva prețurile.");
      setDraft(toDraft(normalizeStartingPrices(data.prices)));
      setConfiguratorDraft(toConfiguratorDraft(normalizeConfiguratorPrices(data.configurator)));
      setSeasons(normalizeSeasons(data.seasons));
      setDatePrices(normalizeDatePrices(data.datePrices));
      setYearDrafts(toYearDrafts(normalizeYearPrices(data.yearPrices)));
      setUnsavedYears([]);
      setMessage({ ok: true, text: "Salvat. Site-ul folosește noile prețuri în cel mult un minut." });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Nu s-au putut salva prețurile." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <Breadcrumb />

        <div>
          <h1 className="text-white text-2xl font-light tracking-tight">Prețuri de pornire</h1>
          <p className="text-neutral-500 text-sm mt-1">
            „Pachetele foto-video încep de la …” — apare după „Verifică disponibilitatea” pe landing-uri (/oferta/…) și pe /bio, și e folosit de chatbot. Configuratorul de preț de pe /oferta/olx pornește tot de la aceste valori.
          </p>
        </div>

        <div id="preturi-pe-ani" className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Prețuri pe ani (anul evenimentului)</p>
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Anul prețurilor">
            {[null, ...Object.keys(yearDrafts).sort()].map((year) => (
              <button
                key={year ?? "standard"}
                type="button"
                role="tab"
                aria-selected={activeYear === year}
                onClick={() => setActiveYear(year)}
                className={`px-3 py-1.5 text-sm border ${activeYear === year ? "border-white bg-white text-black" : "border-neutral-700 text-neutral-300 hover:border-neutral-500"}`}
              >
                {year ?? "Standard"}{year && unsavedYears.includes(year) ? " •" : ""}
              </button>
            ))}
            {yearOptions.length > 0 && Object.keys(yearDrafts).length < MAX_PRICE_YEARS && (
              <select
                aria-label="Adaugă un an"
                value=""
                disabled={loading}
                onChange={(e) => e.target.value && addYear(e.target.value)}
                className="bg-neutral-900 border border-neutral-700 text-neutral-300 text-sm px-2 py-1.5"
              >
                <option value="">+ Adaugă an</option>
                {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            )}
          </div>
          <p className="text-neutral-500 text-xs">
            {activeYear
              ? <>Prețurile de mai jos se aplică evenimentelor din <strong className="text-neutral-300">{activeYear}</strong> (pornire + configurator). Sezoanele și prețurile pe date se aplică în continuare peste ele.
                  {unsavedYears.includes(activeYear) && " Copiate din prețurile standard — modifică-le și apasă Salvează."}{" "}
                  <button type="button" onClick={() => removeYear(activeYear)} className="text-red-400 underline underline-offset-2">Șterge prețurile pentru {activeYear}</button>
                </>
              : "Prețurile standard se aplică oricărui an care nu are prețuri proprii (și când vizitatorul nu a ales încă anul)."}
          </p>
        </div>

        <div className="max-w-xl rounded-xl border border-neutral-800 divide-y divide-neutral-800">
          {STARTING_PRICE_TYPES.map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="text-neutral-200 text-sm">{label}</span>
              <span className="flex items-center gap-2">
                <span className="text-neutral-500 text-sm">de la</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  disabled={loading}
                  value={shownStarting[key]}
                  onChange={(e) => setStarting(key, e.target.value)}
                  className={INPUT_CLASS}
                />
                <span className="text-neutral-500 text-sm">€</span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-neutral-600 text-xs">Orice alt tip de eveniment (logodnă, aniversare…) folosește prețul de la „Alt eveniment”.</p>

        <div className="pt-4">
          <h2 className="text-white text-lg font-light tracking-tight">Configurator de preț{activeYear ? ` · ${activeYear}` : ""}</h2>
          <p className="text-neutral-500 text-sm mt-1">
            Restul prețurilor din „Află prețul” de pe /oferta/olx. 0 € = gratuit / fără supliment.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
        {CONFIGURATOR_GROUPS.map((group) => (
          <div key={group}>
            <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-neutral-500">{group}</p>
            <div className="rounded-xl border border-neutral-800 divide-y divide-neutral-800">
              {STARTING_NOTE[group] && <p className="px-4 py-2.5 text-xs text-neutral-500">{STARTING_NOTE[group]}</p>}
              {CONFIGURATOR_PRICE_FIELDS.filter((f) => f.group === group).map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="text-neutral-200 text-sm">{label}</span>
                  <span className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      disabled={loading}
                      value={shownConfigurator[key]}
                      onChange={(e) => setConfigurator(key, e.target.value)}
                      className={INPUT_CLASS}
                    />
                    <span className="text-neutral-500 text-sm">€</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
        </div>

        <div className="pt-6 border-t border-neutral-800">
          <SeasonalPricingEditor
            seasons={seasons}
            onChange={setSeasons}
            startingPrices={previewStarting}
            configuratorPrices={previewConfigurator}
            disabled={loading}
          />
        </div>

        <div className="pt-6 border-t border-neutral-800">
          <WeekendPricingCalendar
            datePrices={datePrices}
            onChange={setDatePrices}
            seasons={seasons}
            startingPrices={previewStarting}
            disabled={loading}
          />
        </div>

        <div className="pt-6 border-t border-neutral-800">
          <BookedDatesPricing
            datePrices={datePrices}
            onChange={setDatePrices}
            seasons={seasons}
            book={{ ...previewStarting, ...previewConfigurator }}
            disabled={loading}
          />
        </div>

        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-neutral-800 bg-neutral-950/95 px-4 py-3 backdrop-blur">
          <button
            onClick={() => void save()}
            disabled={loading || saving || invalid || !!seasonsProblem}
            className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium disabled:opacity-40"
          >
            {saving ? "Se salvează…" : "Salvează"}
          </button>
          {invalid && <span className="text-amber-400 text-xs">Fiecare preț trebuie să fie un număr întreg (prețurile de pornire mai mari ca 0).</span>}
          {!invalid && seasonsProblem && <span className="text-amber-400 text-xs">{seasonsProblem}</span>}
          {message && <span role="status" className={`text-sm ${message.ok ? "text-green-400" : "text-red-400"}`}>{message.text}</span>}
        </div>
      </div>
    </div>
  );
}
