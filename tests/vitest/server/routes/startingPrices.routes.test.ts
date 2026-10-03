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

async function loadRouter(stored?: Record<string, unknown>, storedConfigurator?: Record<string, unknown>) {
  const set = vi.fn().mockResolvedValue(undefined);
  const get = vi.fn().mockResolvedValue({ data: () => (stored ? { prices: stored, configurator: storedConfigurator } : undefined) });
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
    });
  });

  test("admin save stores a full valid set", async () => {
    const { put, set } = await loadRouter();
    const res = createMockResponse();
    await put({ body: { prices: full } }, res);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ prices: full, configurator: DEFAULT_CONFIGURATOR_PRICES }));
    expect(res.json).toHaveBeenCalledWith({ prices: full, configurator: DEFAULT_CONFIGURATOR_PRICES });
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
    expect(res.json).toHaveBeenCalledWith({ prices: full, configurator });
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
});
