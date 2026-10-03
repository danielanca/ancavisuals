import type { StartingPriceKey } from "./startingPrices";
import type { ConfiguratorPriceKey, PriceBook } from "./configuratorPrices";

// Rules for the landing configurator (/oferta/olx). No amounts live here: every
// price is a key of the PriceBook edited in /admin/preturi. Each event's "start"
// service costs its starting price, so "Pachetele încep de la X" and the
// configurator never disagree.

export type ConfiguratorEventKey = "nunta" | "botez" | "majorat" | "corporate";
export type ServiceKey = "foto" | "video" | "foto_video";
export type ExtraKey = "fotocabina" | "videobooth" | "album" | "album_nunta";

export interface ConfiguratorEvent {
  key: ConfiguratorEventKey;
  label: string;
  /** Shown under the label in the event switch — instead of a price, so events aren't compared side by side. */
  tagline: string;
  /** Label used by the availability form on the same page. */
  formEventType: string;
  startingKey: StartingPriceKey;
  /** Services offered (a missing key = not offered): "start" = the starting price (preselected), else a price key. */
  services: Partial<Record<ServiceKey, "start" | ConfiguratorPriceKey>>;
  /** Already in every package for this event. */
  included: string[];
  extras: ExtraKey[];
  /** Photo booth asks for the guest count (paper/equipment supplement) — not needed for small events. */
  askGuests: boolean;
  /** Priced by the hour: the base price covers includedHours (the minimum), each extra hour adds the hourly price. */
  hourly?: { baseKey: ConfiguratorPriceKey; extraHourKey: ConfiguratorPriceKey; includedHours: number; maxHours: number };
  /** One of these extras is a gift (the first one the visitor picks); the others are paid. */
  giftOneOf?: ExtraKey[];
  giftNote?: string;
}

export const CONFIGURATOR_EVENTS: ConfiguratorEvent[] = [
  {
    key: "nunta",
    label: "Nuntă",
    tagline: "Ziua cea mare",
    formEventType: "Nuntă",
    startingKey: "nunta",
    // Foto + Video = the starting price (950 €, pachetul Standard de pe /oferta/olx).
    services: { foto_video: "start", foto: "nunta_foto", video: "nunta_video" },
    included: ["QR Code Moments", "Galerie online privată"],
    extras: ["fotocabina", "videobooth", "album_nunta"],
    askGuests: true,
  },
  {
    key: "botez",
    label: "Botez",
    tagline: "Prima sărbătoare",
    formEventType: "Botez",
    startingKey: "botez",
    // Owner, 2026-10-03: botez = foto; video only together with photo (no "doar video").
    services: { foto: "start", foto_video: "botez_foto_video" },
    included: ["Galerie online privată"],
    extras: ["album", "fotocabina", "videobooth"],
    askGuests: false,
  },
  {
    key: "majorat",
    label: "Majorat",
    tagline: "18 ani",
    formEventType: "Majorat",
    startingKey: "majorat",
    services: { foto: "start", video: "majorat_video", foto_video: "majorat_foto_video" },
    included: ["Galerie online privată"],
    extras: ["fotocabina", "videobooth", "album"],
    askGuests: false,
    // Owner, 2026-10-03: at majorate the photo booth OR the videobooth is free — one of them.
    giftOneOf: ["fotocabina", "videobooth"],
    giftNote: "Cadou la majorat: fotocabina sau videobooth-ul, la alegere",
  },
  {
    key: "corporate",
    label: "Corporate",
    tagline: "Pentru firme",
    formEventType: "Alt eveniment",
    startingKey: "alt",
    // Owner, 2026-10-03: a price for the minimum 2 hours, then per extra hour — its own fields, not "Alt eveniment".
    hourly: { baseKey: "corporate_base", extraHourKey: "corporate_extra_hour", includedHours: 2, maxHours: 12 },
    services: { foto: "start" },
    included: ["Galerie online privată", "Livrare rapidă pentru social media"],
    extras: ["fotocabina", "videobooth"],
    askGuests: true,
  },
];

export const SERVICES: { key: ServiceKey; label: string; note: string }[] = [
  { key: "foto", label: "Foto", note: "Fotografii editate, livrate în galerie online" },
  { key: "video", label: "Video", note: "Filmare 4K, highlight + film lung" },
  { key: "foto_video", label: "Foto + Video", note: "Echipa completă — tot ce se întâmplă" },
];

export interface ExtraVariant { label: string; priceKey: ConfiguratorPriceKey }

export const EXTRAS: Record<ExtraKey, { label: string; note: string; priceKey: ConfiguratorPriceKey; variants?: ExtraVariant[] }> = {
  fotocabina: { label: "Fotocabină / Oglindă foto", note: "Poze printate pe loc pentru invitați", priceKey: "fotocabina" },
  videobooth: { label: "Videobooth 360", note: "Clipuri video 360° cu invitații, gata de trimis pe telefon", priceKey: "videobooth" },
  album: { label: "Album foto", note: "100 de poze pe hârtie foto premium", priceKey: "album" },
  // Owner, 2026-10-03: at weddings the album is a retro box or a photo book.
  album_nunta: {
    label: "Album foto",
    note: "Amintirile voastre, de ținut în mână",
    priceKey: "album_nunta_retro",
    variants: [
      { label: "Cutie retro", priceKey: "album_nunta_retro" },
      { label: "Fotocarte", priceKey: "album_nunta_fotocarte" },
    ],
  },
};

/** Photo booth supplement for paper and equipment; the first tier is included. */
export const GUEST_TIERS: { label: string; priceKey?: ConfiguratorPriceKey }[] = [
  { label: "Sub 200 persoane" },
  { label: "200 – 500 persoane", priceKey: "guests_200_500" },
  { label: "Peste 500 persoane", priceKey: "guests_500_plus" },
];

export const guestTierPrice = (index: number, book: PriceBook): number => {
  const key = GUEST_TIERS[index]?.priceKey;
  return key ? book[key] : 0;
};

/** The extra's price; with variants, the picked one (the first by default, also the "de la" price). */
export function extraPrice(key: ExtraKey, book: PriceBook, variant = 0): number {
  const extra = EXTRAS[key];
  return book[(extra.variants?.[variant] ?? extra.variants?.[0] ?? extra).priceKey];
}

export function hourlyRates(event: ConfiguratorEvent, book: PriceBook) {
  if (!event.hourly) return undefined;
  const { baseKey, extraHourKey, includedHours, maxHours } = event.hourly;
  return { basePrice: book[baseKey], extraHour: book[extraHourKey], includedHours, maxHours };
}

export interface ConfiguratorSelection {
  event: ConfiguratorEventKey;
  service: ServiceKey;
  extras: ExtraKey[];
  /** Index in GUEST_TIERS — only matters with the photo booth. */
  guestTier: number;
  /** Only for hourly events; clamped to includedHours..maxHours. */
  hours?: number;
  /** Index in the album's variants (album_nunta); defaults to the first. */
  albumVariant?: number;
}

export interface QuoteLine {
  label: string;
  amount: number;
  /** Shown struck through (e.g. the free photo booth promo). */
  waived?: boolean;
}

export function eventByKey(key: string | null | undefined): ConfiguratorEvent | undefined {
  return CONFIGURATOR_EVENTS.find((e) => e.key === key);
}

export function servicesFor(event: ConfiguratorEvent) {
  return SERVICES.filter((s) => event.services[s.key] !== undefined);
}

/** The "de la" price: the hourly minimum, or the starting price from /admin/preturi. */
export function eventStartPrice(event: ConfiguratorEvent, book: PriceBook): number {
  return event.hourly ? book[event.hourly.baseKey] : book[event.startingKey];
}

export function clampHours(event: ConfiguratorEvent, hours: number | undefined): number {
  if (!event.hourly) return 0;
  const { includedHours, maxHours } = event.hourly;
  return Math.min(maxHours, Math.max(includedHours, Math.round(hours ?? includedHours)));
}

export function servicePrice(event: ConfiguratorEvent, service: ServiceKey, book: PriceBook, hours?: number): number {
  const priced = event.services[service] ?? "start";
  const base = priced === "start" ? eventStartPrice(event, book) : book[priced];
  const extraHours = event.hourly ? clampHours(event, hours) - event.hourly.includedHours : 0;
  return base + (event.hourly ? extraHours * book[event.hourly.extraHourKey] : 0);
}

/** The "start" service is preselected: the first total people see is the advertised "de la" price. */
export function defaultService(event: ConfiguratorEvent): ServiceKey {
  return servicesFor(event).find((s) => event.services[s.key] === "start")?.key ?? servicesFor(event)[0].key;
}

/** The extra that is free right now: the photo booth during the wedding promo, or the event's gift. */
export function giftedExtra(
  event: ConfiguratorEvent,
  extras: ExtraKey[],
  options: { photoboothFree?: boolean } = {},
): ExtraKey | undefined {
  if (options.photoboothFree && event.extras.includes("fotocabina") && extras.includes("fotocabina")) return "fotocabina";
  // `extras` is in pick order — the gift stays on whichever the visitor turned on first.
  return extras.find((k) => event.giftOneOf?.includes(k));
}

export function buildQuote(
  selection: ConfiguratorSelection,
  book: PriceBook,
  options: { photoboothFree?: boolean } = {},
): { lines: QuoteLine[]; total: number } {
  const event = eventByKey(selection.event) ?? CONFIGURATOR_EVENTS[0];
  const offered = servicesFor(event);
  const service = offered.find((s) => s.key === selection.service) ?? offered.find((s) => s.key === defaultService(event))!;
  const hours = clampHours(event, selection.hours);
  const lines: QuoteLine[] = [{
    label: event.hourly ? `${service.label} · ${hours} ore` : service.label,
    amount: servicePrice(event, service.key, book, hours),
  }];

  const gift = giftedExtra(event, selection.extras, options);
  for (const key of event.extras) {
    if (!selection.extras.includes(key)) continue;
    const extra = EXTRAS[key];
    const variantIndex = extra.variants?.[selection.albumVariant ?? 0] ? selection.albumVariant ?? 0 : 0;
    const variant = extra.variants?.[variantIndex];
    lines.push(variant
      ? { label: `${extra.label} · ${variant.label}`, amount: extraPrice(key, book, variantIndex) }
      : { label: extra.label, amount: extraPrice(key, book), waived: key === gift });
    const supplement = event.askGuests ? guestTierPrice(selection.guestTier, book) : 0;
    if (key === "fotocabina" && supplement) {
      lines.push({ label: `Materie primă (hârtie, echipament) · ${GUEST_TIERS[selection.guestTier].label.toLocaleLowerCase("ro-RO")}`, amount: supplement });
    }
  }

  const total = lines.reduce((sum, line) => sum + (line.waived ? 0 : line.amount), 0);
  return { lines, total };
}
