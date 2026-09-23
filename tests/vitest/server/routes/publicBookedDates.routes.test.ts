/*
 * Purpose: verifies GET /api/booked-dates — the public, unauthenticated
 * endpoint the "verifică disponibilitatea" flow (booking wizard, Bio page,
 * campaign landing pages) uses to know which days are already taken. Only
 * confirmed/finalized events should count, and a Firestore failure must
 * degrade to a clean error response rather than crash the route (the client
 * treats that as "no booked dates" and keeps the availability check usable).
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

type Handler = (req: any, res: any) => Promise<void> | void;

function createMockResponse() {
  const res: any = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

async function loadRouter(docs: Array<Record<string, unknown>>) {
  const getMock = vi.fn().mockResolvedValue({ docs: docs.map((data) => ({ data: () => data })) });
  const collectionMock = vi.fn(() => ({ get: getMock }));

  vi.doMock("src/server/firestore", () => ({ firestore: () => ({ collection: collectionMock }) }));

  const mod = await import("src/server/routes/publicBookedDates.routes");
  const router = mod.default as any;
  const layer = router.stack.find((e: any) => e.route?.path === "/" && e.route.methods?.get);
  const handler: Handler = layer.route.stack[layer.route.stack.length - 1].handle;

  return { handler, getMock, collectionMock };
}

describe("publicBookedDates.routes — GET /api/booked-dates", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  test("returns dates only for confirmed/finalized events", async () => {
    const { handler } = await loadRouter([
      { status: "confirmat", eventDate: "2026-10-01" },
      { status: "finalizat", eventDate: "2026-10-05" },
      { status: "in asteptare", eventDate: "2026-10-10" },
      { status: "anulat", eventDate: "2026-10-15" },
    ]);
    const res = createMockResponse();

    await handler({}, res);

    expect(res.json).toHaveBeenCalledWith({ dates: expect.arrayContaining(["2026-10-01", "2026-10-05"]) });
    const { dates } = res.json.mock.calls[0][0];
    expect(dates).not.toContain("2026-10-10");
    expect(dates).not.toContain("2026-10-15");
  });

  test("expands multi-day confirmed events into every day in range", async () => {
    const { handler } = await loadRouter([
      { status: "confirmat", eventDate: "2026-10-01", eventEndDate: "2026-10-03" },
    ]);
    const res = createMockResponse();

    await handler({}, res);

    expect(res.json).toHaveBeenCalledWith({
      dates: expect.arrayContaining(["2026-10-01", "2026-10-02", "2026-10-03"]),
    });
  });

  test("returns an empty list when there are no events", async () => {
    const { handler } = await loadRouter([]);
    const res = createMockResponse();

    await handler({}, res);

    expect(res.json).toHaveBeenCalledWith({ dates: [] });
  });

  test("returns 500 with a Romanian error message when Firestore fails, instead of crashing", async () => {
    const { handler, getMock } = await loadRouter([]);
    getMock.mockRejectedValueOnce(new Error("firestore down"));
    const res = createMockResponse();

    await expect(handler({}, res)).resolves.not.toThrow();

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Nu s-au putut încărca datele." });
  });
});
