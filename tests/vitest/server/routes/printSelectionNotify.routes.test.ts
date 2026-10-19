/*
 * Purpose: "Am terminat · anunță fotograful" emails the photographer at most once per album
 * every 24 h; a second tap inside the window is refused with the unlock time.
 */
import { beforeEach, expect, test, vi } from "vitest";

const store = new Map<string, Record<string, unknown>>();
const sendEmail = vi.fn().mockResolvedValue(undefined);

vi.mock("src/server/controllers/album.controller", () => ({
  getAlbum: vi.fn(), downloadSelectedPhotos: vi.fn(), postPrintSelection: vi.fn(), downloadAll: vi.fn(), deletePhoto: vi.fn(),
  downloadPrintDynamic: vi.fn(), addDeliveryAddress: vi.fn(), getDeliveryAddress: vi.fn(), addSwissLink: vi.fn(),
}));
vi.mock("src/server/services/printSelection.store", () => ({ readPrintSelection: vi.fn().mockResolvedValue(["a.jpg", "b.jpg"]) }));
vi.mock("src/server/services/albumStats.service", () => ({ getAlbumStats: vi.fn() }));
vi.mock("src/server/services/album.service", () => ({ loadAlbum: vi.fn(), resolveAlbumSlug: vi.fn() }));
vi.mock("src/server/services/activity.service", () => ({ logActivity: vi.fn().mockResolvedValue(undefined) }));
vi.mock("src/server/services/albumRetention.service", () => ({ getAlbumRetentionBySlug: vi.fn() }));
vi.mock("src/server/utils/ipinfo", () => ({ getClientIp: vi.fn(), fetchIpInfo: vi.fn() }));
vi.mock("src/server/notifications/mailer", () => ({ sendEmail }));
vi.mock("src/server/constants/credentials", () => ({ adminUser: { email: "admin@test.ro" } }));
vi.mock("src/server/middleware/requireFirebaseAuth", () => ({ requireFirebaseAuth: vi.fn(), requireSupremeAdmin: vi.fn() }));
vi.mock("src/server/firestore", () => ({
  firestore: () => ({
    collection: () => ({
      doc: (id: string) => ({
        get: async () => ({ data: () => store.get(id) }),
        set: async (value: Record<string, unknown>) => { store.set(id, { ...(store.get(id) ?? {}), ...value }); },
      }),
    }),
  }),
}));

type Handler = (req: unknown, res: unknown) => Promise<unknown>;

async function handler(method: "get" | "post"): Promise<Handler> {
  const router = (await import("src/server/routes/album.routes")).default as unknown as { stack: { route?: { path: string; methods: Record<string, boolean>; stack: { handle: Handler }[] } }[] };
  const layer = router.stack.find((l) => l.route?.path === "/:slug/print-selection/notify" && l.route.methods[method]);
  return layer!.route!.stack.at(-1)!.handle;
}

function res() {
  const r = { statusCode: 200, body: undefined as unknown, status(code: number) { r.statusCode = code; return r; }, json(body: unknown) { r.body = body; return r; } };
  return r;
}

beforeEach(() => { store.clear(); sendEmail.mockClear(); vi.useRealTimers(); });

test("first tap emails the photographer; a second tap within 24 h is refused with the unlock time", async () => {
  const post = await handler("post");
  const first = res();
  await post({ params: { slug: "nunta-ana" } }, first);
  expect(first.statusCode).toBe(200);
  expect(sendEmail).toHaveBeenCalledOnce();

  const second = res();
  await post({ params: { slug: "nunta-ana" } }, second);
  expect(second.statusCode).toBe(429);
  expect(second.body).toMatchObject({ error: "already_notified", nextAllowedAt: expect.any(Number) });
  expect(sendEmail).toHaveBeenCalledOnce();

  const status = res();
  await (await handler("get"))({ params: { slug: "nunta-ana" } }, status);
  expect((status.body as { nextAllowedAt: number }).nextAllowedAt).toBeGreaterThan(Date.now());
});

test("after 24 h the photographer can be told again", async () => {
  store.set("nunta-ana", { lastNotifiedAt: Date.now() - 25 * 60 * 60 * 1000 });
  const post = await handler("post");
  const again = res();
  await post({ params: { slug: "nunta-ana" } }, again);
  expect(again.statusCode).toBe(200);
  expect(sendEmail).toHaveBeenCalledOnce();
});
