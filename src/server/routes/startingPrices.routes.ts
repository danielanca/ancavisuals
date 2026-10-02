import type { Request, Response } from "express";
import { Router } from "express";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { normalizeStartingPrices, STARTING_PRICE_TYPES, type StartingPrices } from "../../shared/pricing/startingPrices";

const DOC = () => firestore().collection("settings").doc("startingPrices");
const CACHE_MS = 60_000;
let cache: { prices: StartingPrices; at: number } | null = null;

/** Never throws: pages and the chatbot fall back to the defaults. */
export async function getStartingPrices(): Promise<StartingPrices> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.prices;
  try {
    const doc = await DOC().get();
    cache = { prices: normalizeStartingPrices(doc.data()?.prices), at: Date.now() };
  } catch (error) {
    console.error("[startingPrices] read failed:", error);
    return cache?.prices ?? normalizeStartingPrices(null);
  }
  return cache.prices;
}

export const startingPricesPublicRouter = Router();
export const startingPricesAdminRouter = Router();

// GET /api/starting-prices — public
startingPricesPublicRouter.get("/", async (_req: Request, res: Response) => {
  res.set("Cache-Control", "public, max-age=60");
  res.json({ prices: await getStartingPrices() });
});

// PUT /api/admin/starting-prices — { prices: { nunta: 950, ... } }
startingPricesAdminRouter.put("/", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const body = (req.body as { prices?: Record<string, unknown> })?.prices ?? {};
  for (const { key, label } of STARTING_PRICE_TYPES) {
    const value = Number(body[key]);
    if (!Number.isInteger(value) || value <= 0 || value > 100_000) {
      return res.status(400).json({ error: `Preț invalid pentru ${label}.` });
    }
  }
  const prices = normalizeStartingPrices(body);
  try {
    await DOC().set({ prices, updatedAt: new Date().toISOString() });
    cache = { prices, at: Date.now() };
    res.json({ prices });
  } catch (error) {
    console.error("[startingPrices] save failed:", error);
    res.status(500).json({ error: "Nu s-au putut salva prețurile." });
  }
});
