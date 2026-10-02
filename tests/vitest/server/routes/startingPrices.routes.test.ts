/* eslint-disable @typescript-eslint/no-explicit-any -- reaches into Express router internals and mock req/res */
/*
 * Purpose: starting prices are read publicly with defaults as fallback, and only
 * a full set of whole positive amounts can be saved from /admin/preturi.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

type Handler = (req: any, res: any) => Promise<void> | void;

function createMockResponse() {
  const res: any = { status: vi.fn(), json: vi.fn(), set: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

async function loadRouter(stored?: Record<string, unknown>) {
  const set = vi.fn().mockResolvedValue(undefined);
  const get = vi.fn().mockResolvedValue({ data: () => (stored ? { prices: stored } : undefined) });
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
    expect(res.json).toHaveBeenCalledWith({ prices: { nunta: 1100, botez: 350, majorat: 200, cununie: 150, alt: 150 } });
  });

  test("admin save stores a full valid set", async () => {
    const { put, set } = await loadRouter();
    const res = createMockResponse();
    await put({ body: { prices: full } }, res);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ prices: full }));
    expect(res.json).toHaveBeenCalledWith({ prices: full });
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
