import { DEFAULT_STARTING_PRICES, normalizeStartingPrices, type StartingPrices } from "./startingPrices";

// Every other price of the /oferta/olx configurator (the starting prices are in
// startingPrices.ts). Edited in /admin/preturi (Firestore
// `settings/startingPrices.configurator`); these defaults apply until then.
export const CONFIGURATOR_PRICE_FIELDS = [
  { key: "nunta_foto", group: "Nuntă", label: "Doar foto", defaultPrice: 650 },
  { key: "nunta_video", group: "Nuntă", label: "Doar video", defaultPrice: 550 },
  { key: "album_nunta_retro", group: "Nuntă", label: "Album · cutie retro", defaultPrice: 60 },
  { key: "album_nunta_fotocarte", group: "Nuntă", label: "Album · fotocarte", defaultPrice: 100 },
  { key: "botez_foto_video", group: "Botez", label: "Foto + Video", defaultPrice: 370 },
  { key: "majorat_video", group: "Majorat", label: "Doar video", defaultPrice: 200 },
  { key: "majorat_foto_video", group: "Majorat", label: "Foto + Video", defaultPrice: 300 },
  { key: "corporate_base", group: "Corporate", label: "Primele 2 ore (minim)", defaultPrice: 100 },
  { key: "corporate_extra_hour", group: "Corporate", label: "Fiecare oră în plus", defaultPrice: 55 },
  { key: "fotocabina", group: "Extra", label: "Fotocabină / Oglindă foto", defaultPrice: 250 },
  { key: "videobooth", group: "Extra", label: "Videobooth 360", defaultPrice: 250 },
  { key: "album", group: "Extra", label: "Album foto (botez, majorat)", defaultPrice: 40 },
  { key: "guests_200_500", group: "Extra", label: "Fotocabină: supliment 200–500 invitați", defaultPrice: 30 },
  { key: "guests_500_plus", group: "Extra", label: "Fotocabină: supliment peste 500 invitați", defaultPrice: 60 },
] as const;

export type ConfiguratorPriceKey = (typeof CONFIGURATOR_PRICE_FIELDS)[number]["key"];
export type ConfiguratorPrices = Record<ConfiguratorPriceKey, number>;

export const DEFAULT_CONFIGURATOR_PRICES = Object.fromEntries(
  CONFIGURATOR_PRICE_FIELDS.map(({ key, defaultPrice }) => [key, defaultPrice]),
) as ConfiguratorPrices;

/** 0 is allowed here (a free extra, no supplement); starting prices must stay positive. */
export const isValidConfiguratorPrice = (value: unknown): boolean =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 100_000;

/** Keeps known keys with whole, sane amounts; anything else falls back to the default. */
export function normalizeConfiguratorPrices(raw: unknown): ConfiguratorPrices {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const result = { ...DEFAULT_CONFIGURATOR_PRICES };
  for (const { key } of CONFIGURATOR_PRICE_FIELDS) {
    const value = Number(source[key]);
    if (source[key] !== undefined && source[key] !== null && source[key] !== "" && isValidConfiguratorPrice(value)) result[key] = value;
  }
  return result;
}

/** Everything the configurator prices with: starting prices + the fields above (no shared keys). */
export type PriceBook = StartingPrices & ConfiguratorPrices;

export const DEFAULT_PRICE_BOOK: PriceBook = { ...DEFAULT_STARTING_PRICES, ...DEFAULT_CONFIGURATOR_PRICES };

export const toPriceBook = (prices: unknown, configurator: unknown): PriceBook => ({
  ...normalizeStartingPrices(prices),
  ...normalizeConfiguratorPrices(configurator),
});
