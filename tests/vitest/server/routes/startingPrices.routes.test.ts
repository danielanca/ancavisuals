/* eslint-disable @typescript-eslint/no-explicit-any -- reaches into Express router internals and mock req/res */
/*
 * Purpose: starting prices are read publicly with defaults as fallback, and only
 * a full set of whole positive amounts can be saved from /admin/preturi.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_CONFIGURATOR_PRICES } from "src/shared/pricing/configuratorPrices";

type Handler = (req: any, res: any) => Promise<void> | void;

function createMockResponse() {
  const res: any = { status: vi.fn(), json: vi.fn(), set: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

async function loadRouter(stored?: Record<string, unknown>, storedConfigurator?: Record<string, unknown>, storedSeasons?: unknown) {
  const set = vi.fn().mockResolvedValue(undefined);
  const get = vi.fn().mockResolvedValue({ data: () => (stored ? { prices: stored, configurator: storedConfigurator, seasons: storedSeasons } : undefined) });
  vi.doMock("src/server/firestore", () => ({ firestore: () => ({ collection: () => ({ doc: () => ({ get, set }) }) }) }));
  vi.doMock("src/server/middleware/requireFirebaseAuth", () => ({ requireFirebaseAuth: vi.fn(), requireSupremeAdmin: vi.fn() }));
  const mod = await import("src/server/routes/startingPrices.routes");
  const handler = (router: any, method: string): Handler => {
    const layer = router.stack.find((e: any) => e.route?.methods?.[method]);
    return layer.route.stack[layer.route.stack.length - 1].handle;
  };
  return { getPublic: handler(mod.startingPricesPublicRouter, "get"), put: handler(mod.startingPricesAdminRouter, "put"), set };
}

const full = { nunta: 990, botez: 350, majorat: 200, cununie: 150, alt: 150 };

describe("starting prices API", () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  test("public read falls back to defaults for missing or bad values", async () => {
    const { getPublic } = await loadRouter({ nunta: 1100, botez: "abc" });
    const res = createMockResponse();
    await getPublic({}, res);
    expect(res.json).toHaveBeenCalledWith({
      prices: { nunta: 1100, botez: 250, majorat: 200, cununie: 150, alt: 150 },
      configurator: DEFAULT_CONFIGURATOR_PRICES,
      seasons: [],
      datePrices: [],
    });
  });

  test("admin save stores a full valid set", async () => {
    const { put, set } = await loadRouter();
    const res = createMockResponse();
    await put({ body: { prices: full } }, res);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ prices: full, configurator: DEFAULT_CONFIGURATOR_PRICES }));
    expect(res.json).toHaveBeenCalledWith({ prices: full, configurator: DEFAULT_CONFIGURATOR_PRICES, seasons: [], datePrices: [] });
  });

  test("public read returns the stored configurator prices", async () => {
    const { getPublic } = await loadRouter(full, { fotocabina: 300 });
    const res = createMockResponse();
    await getPublic({}, res);
    expect(res.json.mock.calls[0][0].configurator).toEqual({ ...DEFAULT_CONFIGURATOR_PRICES, fotocabina: 300 });
  });

  test("admin save stores the configurator prices, 0 allowed", async () => {
    const { put, set } = await loadRouter();
    const configurator = { ...DEFAULT_CONFIGURATOR_PRICES, fotocabina: 300, guests_200_500: 0 };
    const res = createMockResponse();
    await put({ body: { prices: full, configurator } }, res);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ prices: full, configurator }));
    expect(res.json).toHaveBeenCalledWith({ prices: full, configurator, seasons: [], datePrices: [] });
  });

  test("admin save rejects an incomplete or invalid configurator set", async () => {
    const { put, set } = await loadRouter();
    for (const configurator of [{ fotocabina: 300 }, { ...DEFAULT_CONFIGURATOR_PRICES, videobooth: -1 }, { ...DEFAULT_CONFIGURATOR_PRICES, album: 9.5 }]) {
      const res = createMockResponse();
      await put({ body: { prices: full, configurator } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    }
    expect(set).not.toHaveBeenCalled();
  });

  test("admin save rejects a missing or non-integer price", async () => {
    const { put, set } = await loadRouter();
    for (const prices of [{ ...full, botez: 0 }, { ...full, majorat: 12.5 }, { nunta: 950 }]) {
      const res = createMockResponse();
      await put({ body: { prices } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    }
    expect(set).not.toHaveBeenCalled();
  });

  describe("seasons", () => {
    const season = { id: "varf", name: "Vârf", months: [7, 8], percent: { nunta: 20, botez: 10, majorat: 0 }, color: 1 };

    test("admin save stores valid seasons and keeps them on later saves without seasons", async () => {
      const { put, set } = await loadRouter();
      const res = createMockResponse();
      await put({ body: { prices: full, seasons: [season] } }, res);
      expect(set).toHaveBeenCalledWith(expect.objectContaining({ seasons: [season] }));
      expect(res.json.mock.calls[0][0].seasons).toEqual([season]);

      const again = createMockResponse();
      await put({ body: { prices: full } }, again);
      expect(again.json.mock.calls[0][0].seasons).toEqual([season]);
    });

    test("admin save rejects overlapping months, bad percents and missing names", async () => {
      const { put, set } = await loadRouter();
      for (const seasons of [
        [season, { ...season, id: "x", name: "Alt", months: [8, 9] }],
        [{ ...season, percent: { ...season.percent, nunta: 150 } }],
        [{ ...season, percent: { ...season.percent, nunta: 2.5 } }],
        [{ ...season, name: "  " }],
        [{ ...season, months: [13] }],
        "nu",
      ]) {
        const res = createMockResponse();
        await put({ body: { prices: full, seasons } }, res);
        expect(res.status).toHaveBeenCalledWith(400);
      }
      expect(set).not.toHaveBeenCalled();
    });

    test("public read drops malformed stored seasons instead of failing", async () => {
      const { getPublic } = await loadRouter(full, {}, [season, { name: "" }, { ...season, id: "dup", name: "Dublură", months: [8, 12] }]);
      const res = createMockResponse();
      await getPublic({}, res);
      expect(res.json.mock.calls[0][0].seasons).toEqual([season, { ...season, id: "dup", name: "Dublură", months: [12], color: 1 }]);
    });
  });

  describe("date prices", () => {
    const saturday = { date: "2027-08-14", percent: { nunta: 15, botez: 5 } };

    test("admin save stores weekend date prices and keeps them on later saves without them", async () => {
      const { put, set } = await loadRouter();
      const res = createMockResponse();
      await put({ body: { prices: full, datePrices: [saturday] } }, res);
      expect(set).toHaveBeenCalledWith(expect.objectContaining({ datePrices: [saturday] }));
      expect(res.json.mock.calls[0][0].datePrices).toEqual([saturday]);

      const again = createMockResponse();
      await put({ body: { prices: full } }, again);
      expect(again.json.mock.calls[0][0].datePrices).toEqual([saturday]);
    });

    test("admin save rejects weekdays, duplicates and bad percents", async () => {
      const { put, set } = await loadRouter();
      for (const datePrices of [
        [{ ...saturday, date: "2027-08-11" }],
        [saturday, saturday],
        [{ ...saturday, percent: { nunta: 150, botez: 0 } }],
        [{ ...saturday, date: "2027-02-30" }],
        "nu",
      ]) {
        const res = createMockResponse();
        await put({ body: { prices: full, datePrices } }, res);
        expect(res.status).toHaveBeenCalledWith(400);
      }
      expect(set).not.toHaveBeenCalled();
    });
  });
});
