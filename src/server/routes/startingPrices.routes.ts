import type { Request, Response } from "express";
import { Router } from "express";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { normalizeStartingPrices, STARTING_PRICE_TYPES, type StartingPrices } from "../../shared/pricing/startingPrices";
import {
  CONFIGURATOR_PRICE_FIELDS,
  isValidConfiguratorPrice,
  normalizeConfiguratorPrices,
  type ConfiguratorPrices,
} from "../../shared/pricing/configuratorPrices";
import {
  datePricesError,
  normalizeDatePrices,
  normalizeSeasons,
  seasonsError,
  type DatePrice,
  type PriceSeason,
} from "../../shared/pricing/seasonalPricing";

const DOC = () => firestore().collection("settings").doc("startingPrices");
const CACHE_MS = 60_000;
type Stored = { prices: StartingPrices; configurator: ConfiguratorPrices; seasons: PriceSeason[]; datePrices: DatePrice[] };
let cache: (Stored & { at: number }) | null = null;

async function readPrices(): Promise<Stored> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  try {
    const data = (await DOC().get()).data();
    cache = {
      prices: normalizeStartingPrices(data?.prices),
      configurator: normalizeConfiguratorPrices(data?.configurator),
      seasons: normalizeSeasons(data?.seasons),
      datePrices: normalizeDatePrices(data?.datePrices),
      at: Date.now(),
    };
  } catch (error) {
    console.error("[startingPrices] read failed:", error);
    return cache ?? { prices: normalizeStartingPrices(null), configurator: normalizeConfiguratorPrices(null), seasons: [], datePrices: [] };
  }
  return cache;
}

/** Never throws: pages and the chatbot fall back to the defaults. */
export async function getStartingPrices(): Promise<StartingPrices> {
  return (await readPrices()).prices;
}

/** Never throws: no seasons (standard prices) when the read fails. */
export async function getPriceSeasons(): Promise<PriceSeason[]> {
  return (await readPrices()).seasons;
}

/** Never throws: no special weekend prices when the read fails. */
export async function getDatePrices(): Promise<DatePrice[]> {
  return (await readPrices()).datePrices;
}

export const startingPricesPublicRouter = Router();
export const startingPricesAdminRouter = Router();

// GET /api/starting-prices — public
startingPricesPublicRouter.get("/", async (_req: Request, res: Response) => {
  res.set("Cache-Control", "public, max-age=60");
  const { prices, configurator, seasons, datePrices } = await readPrices();
  res.json({ prices, configurator, seasons, datePrices });
});

// PUT /api/admin/starting-prices — { prices: { nunta: 950, ... }, configurator?: { nunta_foto: 650, ... }, seasons?: PriceSeason[], datePrices?: DatePrice[] }
startingPricesAdminRouter.put("/", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { prices?: Record<string, unknown>; configurator?: Record<string, unknown>; seasons?: unknown; datePrices?: unknown };
  const rawPrices = body.prices ?? {};
  for (const { key, label } of STARTING_PRICE_TYPES) {
    const value = Number(rawPrices[key]);
    if (!Number.isInteger(value) || value <= 0 || value > 100_000) {
      return res.status(400).json({ error: `Preț invalid pentru ${label}.` });
    }
  }
  if (body.configurator !== undefined) {
    for (const { key, group, label } of CONFIGURATOR_PRICE_FIELDS) {
      const raw = body.configurator?.[key];
      if (raw === undefined || raw === null || raw === "" || !isValidConfiguratorPrice(Number(raw))) {
        return res.status(400).json({ error: `Preț invalid: ${group} · ${label}.` });
      }
    }
  }
  if (body.seasons !== undefined) {
    const error = seasonsError(body.seasons);
    if (error) return res.status(400).json({ error });
  }
  if (body.datePrices !== undefined) {
    const error = datePricesError(body.datePrices);
    if (error) return res.status(400).json({ error });
  }
  const prices = normalizeStartingPrices(rawPrices);
  const current = await readPrices();
  const configurator = body.configurator !== undefined ? normalizeConfiguratorPrices(body.configurator) : current.configurator;
  const seasons = body.seasons !== undefined ? normalizeSeasons(body.seasons) : current.seasons;
  const datePrices = body.datePrices !== undefined ? normalizeDatePrices(body.datePrices) : current.datePrices;
  try {
    await DOC().set({ prices, configurator, seasons, datePrices, updatedAt: new Date().toISOString() });
    cache = { prices, configurator, seasons, datePrices, at: Date.now() };
    res.json({ prices, configurator, seasons, datePrices });
  } catch (error) {
    console.error("[startingPrices] save failed:", error);
    res.status(500).json({ error: "Nu s-au putut salva prețurile." });
  }
});
