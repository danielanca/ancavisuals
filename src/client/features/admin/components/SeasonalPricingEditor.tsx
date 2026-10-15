import React, { useEffect, useMemo, useState } from "react";
import type { StartingPrices } from "../../../../shared/pricing/startingPrices";
import { CONFIGURATOR_PRICE_FIELDS, type ConfiguratorPriceKey, type ConfiguratorPrices } from "../../../../shared/pricing/configuratorPrices";
import {
  MAX_SEASON_NAME,
  MAX_SEASON_PERCENT,
  MAX_SEASONS,
  MIN_SEASON_PERCENT,
  MONTH_LABELS,
  MONTH_SHORT,
  SEASON_TEMPLATE,
  SEASONAL_EVENT_TYPES,
  applySeasonPercent,
  seasonForMonth,
  type PriceSeason,
  type SeasonalEventKey,
} from "../../../../shared/pricing/seasonalPricing";

// Categorical colors validated for the dark admin surface (fixed order, never cycled).
// A season keeps its color index, and its name is always written next to it.
export const SEASON_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#9085e9"];
const STANDARD_COLOR = "#525252";

const formatEuro = (amount: number) => `${amount.toLocaleString("ro-RO")} €`;
const formatPercent = (percent: number) => (percent > 0 ? `+${percent}%` : percent < 0 ? `−${Math.abs(percent)}%` : "0%");

// Which configurator prices each event uses (the "Extra" group is shared; the wedding album has its own fields).
const EVENT_FIELDS: Record<SeasonalEventKey, ConfiguratorPriceKey[]> = {
  nunta: ["nunta_foto", "nunta_video", "album_nunta_retro", "album_nunta_fotocarte", "fotocabina", "videobooth", "guests_200_500", "guests_500_plus"],
  botez: ["botez_foto_video", "album", "fotocabina", "videobooth"],
  majorat: ["majorat_video", "majorat_foto_video", "album", "fotocabina", "videobooth"],
};
const STARTING_SERVICE: Record<SeasonalEventKey, string> = {
  nunta: "Foto + Video (preț de pornire)",
  botez: "Doar foto (preț de pornire)",
  majorat: "Doar foto (preț de pornire)",
};
const fieldLabel = (key: ConfiguratorPriceKey) => CONFIGURATOR_PRICE_FIELDS.find((f) => f.key === key)!.label;

function nextSeason(seasons: PriceSeason[]): PriceSeason {
  const usedColors = new Set(seasons.map((s) => s.color));
  const color = SEASON_COLORS.findIndex((_, i) => !usedColors.has(i));
  return {
    id: `s${Date.now().toString(36)}`,
    name: `Sezon ${seasons.length + 1}`,
    months: [],
    percent: { nunta: 0, botez: 0, majorat: 0 },
    color: color === -1 ? 0 : color,
  };
}

/** Typed as text so "-" and "" can be typed on the way to a number; commits only whole numbers. */
function PercentInput({ value, onChange, disabled, label }: { value: number; onChange: (v: number) => void; disabled?: boolean; label: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { if (Number(text) !== value) setText(String(value)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const step = (delta: number) => onChange(Math.min(MAX_SEASON_PERCENT, Math.max(MIN_SEASON_PERCENT, value + delta)));
  const invalid = !/^-?\d+$/.test(text.trim()) || Number(text) < MIN_SEASON_PERCENT || Number(text) > MAX_SEASON_PERCENT;
  return (
    <span className="flex items-center gap-1">
      <button type="button" disabled={disabled || value <= MIN_SEASON_PERCENT} onClick={() => step(-5)} aria-label={`${label}: scade cu 5%`}
        className="h-8 w-8 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 disabled:opacity-30">−</button>
      <span className="relative">
        <input
          inputMode="numeric"
          value={text}
          disabled={disabled}
          aria-label={`${label} (procent)`}
          aria-invalid={invalid}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            if (/^-?\d+$/.test(e.target.value.trim()) && n >= MIN_SEASON_PERCENT && n <= MAX_SEASON_PERCENT) onChange(n);
          }}
          onBlur={() => setText(String(value))}
          className={`h-8 w-16 rounded-lg bg-neutral-800 pr-6 text-right text-sm tabular-nums text-white outline-none focus:ring-1 ${invalid ? "ring-1 ring-red-500" : "focus:ring-neutral-500"}`}
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-neutral-500">%</span>
      </span>
      <button type="button" disabled={disabled || value >= MAX_SEASON_PERCENT} onClick={() => step(5)} aria-label={`${label}: crește cu 5%`}
        className="h-8 w-8 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 disabled:opacity-30">+</button>
    </span>
  );
}

interface Props {
  seasons: PriceSeason[];
  onChange: (seasons: PriceSeason[]) => void;
  startingPrices: StartingPrices;
  configuratorPrices: ConfiguratorPrices;
  disabled?: boolean;
}

export default function SeasonalPricingEditor({ seasons, onChange, startingPrices, configuratorPrices, disabled }: Props) {
  const [preview, setPreview] = useState<SeasonalEventKey>("nunta");
  const [brushId, setBrushId] = useState<string | null>(seasons[0]?.id ?? null);
  const [showAll, setShowAll] = useState(false);
  const brush = seasons.find((s) => s.id === brushId) ?? null;
  useEffect(() => { if (!brush && seasons.length) setBrushId(seasons[0].id); }, [brush, seasons]);

  const update = (id: string, patch: Partial<PriceSeason>) => onChange(seasons.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const remove = (id: string) => onChange(seasons.filter((s) => s.id !== id));
  const add = () => {
    const season = nextSeason(seasons);
    onChange([...seasons, season]);
    setBrushId(season.id);
  };

  /** Puts the month in the season (taking it out of any other); again = back to standard prices. */
  const toggleMonth = (seasonId: string, month: number) => {
    const owner = seasonForMonth(seasons, month);
    onChange(seasons.map((s) => {
      if (s.id === seasonId) {
        return { ...s, months: owner?.id === seasonId ? s.months.filter((m) => m !== month) : [...s.months, month].sort((a, b) => a - b) };
      }
      return s.id === owner?.id ? { ...s, months: s.months.filter((m) => m !== month) } : s;
    }));
  };

  const base = startingPrices[preview];
  const monthly = useMemo(() => MONTH_LABELS.map((_, i) => {
    const season = seasonForMonth(seasons, i + 1);
    const percent = season?.percent[preview] ?? 0;
    return { month: i + 1, season, percent, price: applySeasonPercent(base, percent) };
  }), [seasons, preview, base]);
  const maxPrice = Math.max(...monthly.map((m) => m.price), 1);
  const minPrice = Math.min(...monthly.map((m) => m.price));
  const standardMonths = monthly.filter((m) => !m.season).length;
  const previewLabel = SEASONAL_EVENT_TYPES.find((t) => t.key === preview)!.label;

  return (
    <section className="space-y-5" aria-labelledby="seasons-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="seasons-title" className="text-white text-lg font-light tracking-tight">Prețuri pe sezoane</h2>
          <p className="text-neutral-500 text-sm mt-1 max-w-xl">
            Procentul unui sezon se aplică la toate prețurile evenimentului (pachet, servicii, extra-uri), rotunjit la 5 €. Lunile fără sezon păstrează prețurile standard de mai sus.
          </p>
        </div>
        <div role="tablist" aria-label="Previzualizare pentru" className="flex rounded-lg bg-neutral-900 p-1 border border-neutral-800">
          {SEASONAL_EVENT_TYPES.map(({ key, label }) => (
            <button key={key} type="button" role="tab" aria-selected={preview === key} onClick={() => setPreview(key)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${preview === key ? "bg-white text-neutral-950" : "text-neutral-400 hover:text-white"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Anul pe luni: înălțimea = prețul de pornire în luna respectivă, culoarea = sezonul. */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-neutral-300">
            {previewLabel} · preț de pornire pe luni
            <span className="ml-2 text-neutral-500 tabular-nums">{minPrice === maxPrice ? formatEuro(minPrice) : `${formatEuro(minPrice)} – ${formatEuro(maxPrice)}`}</span>
          </p>
          {brush ? (
            <p className="text-xs text-neutral-400">
              Apasă pe o lună ca s-o pui în{" "}
              <span className="inline-flex items-center gap-1 font-medium text-neutral-200">
                <span className="h-2 w-2 rounded-full" style={{ background: SEASON_COLORS[brush.color] }} />{brush.name}
              </span>
              ; încă o dată = preț standard.
            </p>
          ) : (
            <p className="text-xs text-neutral-500">Adaugă un sezon ca să poți alege lunile.</p>
          )}
        </div>
        <div className="mt-4 grid grid-cols-6 gap-x-1.5 gap-y-4 sm:grid-cols-12">
          {monthly.map(({ month, season, percent, price }) => {
            const inBrush = brush && season?.id === brush.id;
            return (
              <button
                key={month}
                type="button"
                disabled={disabled || !brush}
                onClick={() => brush && toggleMonth(brush.id, month)}
                aria-pressed={!!inBrush}
                aria-label={`${MONTH_LABELS[month - 1]}: ${season ? `${season.name}, ${formatPercent(percent)}` : "preț standard"}, ${formatEuro(price)}`}
                className={`group relative flex flex-col items-center rounded-lg px-0.5 pb-1.5 pt-1 transition-colors enabled:hover:bg-neutral-800/70 disabled:cursor-default ${inBrush ? "bg-neutral-800/60" : ""}`}
              >
                <span className="text-[11px] tabular-nums text-neutral-300">{price.toLocaleString("ro-RO")}</span>
                <span className="mt-1 flex h-24 w-full items-end justify-center">
                  <span
                    className="w-full max-w-[28px] rounded-t transition-all duration-300"
                    style={{ height: `${Math.max(6, (price / maxPrice) * 100)}%`, background: season ? SEASON_COLORS[season.color] : STANDARD_COLOR }}
                  />
                </span>
                <span className={`mt-1.5 text-xs ${inBrush ? "text-white font-medium" : "text-neutral-400"}`}>{MONTH_SHORT[month - 1]}</span>
                <span className="text-[10px] tabular-nums text-neutral-500">{season ? formatPercent(percent) : "—"}</span>
                <span role="tooltip" className="pointer-events-none absolute -top-2 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-left text-xs text-neutral-200 shadow-lg group-hover:block group-focus-visible:block">
                  <span className="block font-medium capitalize">{MONTH_LABELS[month - 1]}</span>
                  <span className="block text-neutral-400">{season ? `${season.name} · ${formatPercent(percent)}` : "Preț standard"}</span>
                  <span className="block tabular-nums">{previewLabel}: {formatEuro(price)}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-neutral-800 pt-3 text-xs text-neutral-400">
          {seasons.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SEASON_COLORS[s.color] }} />
              {s.name} <span className="tabular-nums text-neutral-500">{formatPercent(s.percent[preview])}</span>
            </span>
          ))}
          {standardMonths > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STANDARD_COLOR }} />
              Standard <span className="text-neutral-500">({standardMonths} {standardMonths === 1 ? "lună" : "luni"})</span>
            </span>
          )}
        </div>
      </div>

      {seasons.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-700 p-6 text-center">
          <p className="text-neutral-300 text-sm">Încă nu ai sezoane — prețurile sunt aceleași tot anul.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" disabled={disabled} onClick={() => { onChange(SEASON_TEMPLATE.map((s) => ({ ...s, months: [...s.months], percent: { ...s.percent } }))); setBrushId(SEASON_TEMPLATE[0].id); }}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-950 disabled:opacity-40">
              Pornește cu un șablon
            </button>
            <button type="button" disabled={disabled} onClick={add} className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800 disabled:opacity-40">
              + Sezon gol
            </button>
          </div>
          <p className="mt-3 text-xs text-neutral-500">Șablon: Extrasezon (ian–mar, noi–dec) nuntă −15%, Sezon mediu (apr, mai, oct) 0%, Vârf (iun–sep) nuntă +20%, botez/majorat +10%. Îl modifici după cum vrei.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {seasons.map((season) => {
            const active = season.id === brush?.id;
            return (
              <div key={season.id} className={`rounded-xl border bg-neutral-900 p-4 transition-colors ${active ? "border-neutral-500" : "border-neutral-800"}`}
                style={{ boxShadow: `inset 3px 0 0 ${SEASON_COLORS[season.color]}` }}>
                <div className="flex items-center gap-2">
                  <input
                    value={season.name}
                    maxLength={MAX_SEASON_NAME}
                    disabled={disabled}
                    onChange={(e) => update(season.id, { name: e.target.value })}
                    aria-label="Numele sezonului"
                    className={`min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 text-base text-white outline-none hover:bg-neutral-800 focus:bg-neutral-800 ${season.name.trim() ? "" : "ring-1 ring-red-500"}`}
                  />
                  <button type="button" onClick={() => setBrushId(season.id)} aria-pressed={active}
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-xs ${active ? "bg-white text-neutral-950" : "border border-neutral-700 text-neutral-300 hover:bg-neutral-800"}`}>
                    {active ? "Alegi lunile" : "Alege lunile"}
                  </button>
                  <button type="button" disabled={disabled} onClick={() => remove(season.id)} aria-label={`Șterge sezonul ${season.name}`}
                    className="shrink-0 rounded-lg px-2 py-1 text-neutral-500 hover:bg-red-500/10 hover:text-red-300">✕</button>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {MONTH_SHORT.map((label, i) => {
                    const month = i + 1;
                    const owner = seasonForMonth(seasons, month);
                    const mine = owner?.id === season.id;
                    return (
                      <button key={month} type="button" disabled={disabled}
                        onClick={() => toggleMonth(season.id, month)}
                        aria-pressed={mine}
                        title={owner && !mine ? `Acum în „${owner.name}” — apasă ca s-o muți aici` : undefined}
                        className={`rounded-md px-2 py-1 text-xs transition-colors ${mine ? "text-white" : owner ? "text-neutral-600 line-through decoration-neutral-700" : "text-neutral-400 bg-neutral-800/60 hover:bg-neutral-800"}`}
                        style={mine ? { background: SEASON_COLORS[season.color] } : undefined}>
                        {label}
                      </button>
                    );
                  })}
                </div>
                {season.months.length === 0 && <p className="mt-2 text-xs text-amber-300/80">Nicio lună — sezonul nu se aplică încă.</p>}

                <div className="mt-4 space-y-2">
                  {SEASONAL_EVENT_TYPES.map(({ key, label }) => {
                    const percent = season.percent[key];
                    return (
                      <div key={key} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1.5 ${key === "nunta" ? "bg-neutral-800/50" : ""}`}>
                        <span className={`text-sm ${key === "nunta" ? "text-white" : "text-neutral-300"}`}>{label}</span>
                        <span className="flex items-center gap-3">
                          <span className="text-xs tabular-nums text-neutral-500">
                            {formatEuro(startingPrices[key])} → <span className={percent ? "text-neutral-100" : ""}>{formatEuro(applySeasonPercent(startingPrices[key], percent))}</span>
                          </span>
                          <PercentInput value={percent} disabled={disabled} label={`${season.name}, ${label}`}
                            onChange={(value) => update(season.id, { percent: { ...season.percent, [key]: value } })} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {seasons.length < MAX_SEASONS && (
            <button type="button" disabled={disabled} onClick={add}
              className="min-h-[120px] rounded-xl border border-dashed border-neutral-700 text-sm text-neutral-400 hover:border-neutral-500 hover:text-white disabled:opacity-40">
              + Sezon nou
            </button>
          )}
        </div>
      )}

      {seasons.length > 0 && (
        <div className="rounded-xl border border-neutral-800">
          <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-neutral-300 hover:text-white">
            Toate prețurile pentru {previewLabel.toLowerCase()} în fiecare sezon
            <span className="text-neutral-500">{showAll ? "▴" : "▾"}</span>
          </button>
          {showAll && (
            <div className="overflow-x-auto border-t border-neutral-800">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-neutral-500">
                    <th className="px-4 py-2 font-normal">Preț</th>
                    <th className="px-3 py-2 text-right font-normal">Standard</th>
                    {seasons.map((s) => (
                      <th key={s.id} className="px-3 py-2 text-right font-normal">
                        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SEASON_COLORS[s.color] }} />{s.name}</span>
                        <span className="block tabular-nums">{formatPercent(s.percent[preview])}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/70">
                  {[{ key: "start", label: STARTING_SERVICE[preview], price: startingPrices[preview] },
                    ...EVENT_FIELDS[preview].map((key) => ({ key, label: fieldLabel(key), price: configuratorPrices[key] }))].map((row) => (
                    <tr key={row.key}>
                      <td className="px-4 py-2 text-neutral-300">{row.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-neutral-400">{formatEuro(row.price)}</td>
                      {seasons.map((s) => (
                        <td key={s.id} className="px-3 py-2 text-right tabular-nums text-neutral-100">{formatEuro(applySeasonPercent(row.price, s.percent[preview]))}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
