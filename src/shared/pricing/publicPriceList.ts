import { CONFIGURATOR_EVENTS, EXTRAS, servicePrice, servicesFor, type ConfiguratorEventKey } from "./eventConfigurator";
import type { PriceBook } from "./configuratorPrices";
import type { YearPrices } from "./yearPricing";

// Public "de la" prices for the city pages and llms.txt — the same /admin/preturi
// prices the configurator uses, so Google, ChatGPT and the configurator never disagree.

export interface PublicPriceLine { label: string; price: number; note: string }

const CONFIGURATOR_EVENT_BY_SERVICE: Record<string, ConfiguratorEventKey> = {
  nunta: "nunta",
  botez: "botez",
  majorat: "majorat",
  corporate: "corporate",
};

/** Price lines for a city-page service (nunta, botez, cununie-civila…); other events use "Alt eveniment". */
export function priceLinesFor(serviceSlug: string, book: PriceBook): PublicPriceLine[] {
  const event = CONFIGURATOR_EVENTS.find((entry) => entry.key === CONFIGURATOR_EVENT_BY_SERVICE[serviceSlug]);
  if (event?.hourly) {
    const { includedHours, extraHourKey } = event.hourly;
    return [{
      label: `Foto · primele ${includedHours} ore`,
      price: servicePrice(event, "foto", book),
      note: `Fiecare oră în plus: ${book[extraHourKey]} EUR.`,
    }];
  }
  if (event) {
    // Most complete first: foto + video, then foto, then video.
    const order = ["foto_video", "foto", "video"];
    return [...servicesFor(event)].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)).map((service) => ({
      label: service.label,
      price: servicePrice(event, service.key, book),
      note: service.note,
    }));
  }
  const price = serviceSlug === "cununie-civila" ? book.cununie : book.alt;
  return [{ label: "Foto", price, note: "Fotografii editate, livrate în galerie online" }];
}

export function extraPriceLines(book: PriceBook): PublicPriceLine[] {
  return (["fotocabina", "videobooth"] as const).map((key) => ({ label: EXTRAS[key].label, price: book[EXTRAS[key].priceKey], note: EXTRAS[key].note }));
}

/** "Foto + Video de la 1380 EUR, foto de la 800 EUR, video de la 700 EUR." */
export function priceSentence(lines: PublicPriceLine[]): string {
  const parts = lines.map((line, index) => `${index === 0 ? line.label : line.label.toLowerCase()} de la ${line.price} EUR`);
  return `${parts.join(", ")}.`;
}

const LLMS_EVENTS = [
  { slug: "nunta", label: "Nuntă" },
  { slug: "botez", label: "Botez" },
  { slug: "majorat", label: "Majorat" },
  { slug: "cununie-civila", label: "Cununie civilă" },
  { slug: "corporate", label: "Corporate" },
  { slug: "evenimente", label: "Alte evenimente (logodnă, aniversare, ședințe foto)" },
];

function eventLines(book: PriceBook): string[] {
  return LLMS_EVENTS.map(({ slug, label }) => {
    const lines = priceLinesFor(slug, book);
    const hourlyNote = slug === "corporate" ? ` ${lines[0].note}` : "";
    return `- ${label}: ${priceSentence(lines)}${hourlyNote}`;
  });
}

/** The "Prețuri orientative" block of llms.txt, from the live /admin/preturi prices. */
export function llmsPriceSection(book: PriceBook, yearPrices: YearPrices): string {
  const extras = extraPriceLines(book).map((line) => `- ${line.label}: de la ${line.price} EUR`);
  const years = Object.keys(yearPrices).sort().map((year) => `Pentru evenimente din ${year}:\n${eventLines(yearPrices[year]).join("\n")}`);
  return [
    "Prețuri orientative (EUR, actualizate automat din lista de prețuri a studioului):",
    ...eventLines(book),
    ...extras,
    ...(years.length ? ["", ...years] : []),
  ].join("\n");
}

const LLMS_PRICE_BLOCK = /^Prețuri orientative[^\n]*\n(?:.*\S.*\n?)*(?:\nPentru evenimente din \d{4}:\n(?:.*\S.*\n?)*)*/m;

/** llms.txt with its price block replaced by the live prices (unchanged if there is no block). */
export function withLivePrices(llmsTxt: string, book: PriceBook, yearPrices: YearPrices): string {
  return llmsTxt.replace(LLMS_PRICE_BLOCK, `${llmsPriceSection(book, yearPrices)}\n`);
}
