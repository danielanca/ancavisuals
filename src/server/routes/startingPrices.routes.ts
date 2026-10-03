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

const DOC = () => firestore().collection("settings").doc("startingPrices");
const CACHE_MS = 60_000;
type Stored = { prices: StartingPrices; configurator: ConfiguratorPrices };
let cache: (Stored & { at: number }) | null = null;

async function readPrices(): Promise<Stored> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  try {
    const data = (await DOC().get()).data();
    cache = { prices: normalizeStartingPrices(data?.prices), configurator: normalizeConfiguratorPrices(data?.configurator), at: Date.now() };
  } catch (error) {
    console.error("[startingPrices] read failed:", error);
    return cache ?? { prices: normalizeStartingPrices(null), configurator: normalizeConfiguratorPrices(null) };
  }
  return cache;
}

/** Never throws: pages and the chatbot fall back to the defaults. */
export async function getStartingPrices(): Promise<StartingPrices> {
  return (await readPrices()).prices;
}

export const startingPricesPublicRouter = Router();
export const startingPricesAdminRouter = Router();

// GET /api/starting-prices — public
startingPricesPublicRouter.get("/", async (_req: Request, res: Response) => {
  res.set("Cache-Control", "public, max-age=60");
  const { prices, configurator } = await readPrices();
  res.json({ prices, configurator });
});

// PUT /api/admin/starting-prices — { prices: { nunta: 950, ... }, configurator?: { nunta_foto: 650, ... } }
startingPricesAdminRouter.put("/", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { prices?: Record<string, unknown>; configurator?: Record<string, unknown> };
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
  const prices = normalizeStartingPrices(rawPrices);
  const current = await readPrices();
  const configurator = body.configurator !== undefined ? normalizeConfiguratorPrices(body.configurator) : current.configurator;
  try {
    await DOC().set({ prices, configurator, updatedAt: new Date().toISOString() });
    cache = { prices, configurator, at: Date.now() };
    res.json({ prices, configurator });
  } catch (error) {
    console.error("[startingPrices] save failed:", error);
    res.status(500).json({ error: "Nu s-au putut salva prețurile." });
  }
});
