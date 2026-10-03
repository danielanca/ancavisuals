import { eventTypeLabel } from "../eventTypes";

// "Pachetele încep de la X €" per event type. Edited in /admin/preturi
// (Firestore `settings/startingPrices`); these defaults apply until then.
export const STARTING_PRICE_TYPES = [
  { key: "nunta", label: "Nuntă" },
  { key: "botez", label: "Botez" },
  { key: "majorat", label: "Majorat" },
  { key: "cununie", label: "Cununie civilă" },
  { key: "alt", label: "Alt eveniment" },
] as const;

export type StartingPriceKey = (typeof STARTING_PRICE_TYPES)[number]["key"];
export type StartingPrices = Record<StartingPriceKey, number>;

export const DEFAULT_STARTING_PRICES: StartingPrices = { nunta: 950, botez: 250, majorat: 200, cununie: 150, alt: 150 };

const KEY_BY_LABEL = new Map<string, StartingPriceKey>(STARTING_PRICE_TYPES.map((t) => [t.label, t.key]));

/** Unknown types ("Logodnă", "Aniversare"…) fall under "Alt eveniment". */
export function startingPriceKey(eventType: unknown): StartingPriceKey {
  const label = eventTypeLabel(eventType);
  return (label && KEY_BY_LABEL.get(label)) || "alt";
}

export function startingPriceFor(eventType: unknown, prices: StartingPrices = DEFAULT_STARTING_PRICES): string {
  return `${prices[startingPriceKey(eventType)]} €`;
}

/** Keeps known keys with whole, sane amounts; anything else falls back to the default. */
export function normalizeStartingPrices(raw: unknown): StartingPrices {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const result = { ...DEFAULT_STARTING_PRICES };
  for (const { key } of STARTING_PRICE_TYPES) {
    const value = Number(source[key]);
    if (Number.isInteger(value) && value > 0 && value <= 100_000) result[key] = value;
  }
  return result;
}
