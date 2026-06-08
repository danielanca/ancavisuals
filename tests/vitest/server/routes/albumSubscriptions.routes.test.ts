/*
 * Purpose: verifies album subscription routes — subscribe, list, count, and notify —
 * without touching Firestore or sending real emails.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

function createMockResponse() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    setHeader: vi.fn(),
    send: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.send.mockReturnValue(res);
  return res;
}

type Handler = (req: any, res: any) => Promise<void> | void;

async function loadRouter() {
  const addMock = vi.fn().mockResolvedValue({ id: "sub-1" });
  const querySnapshotEmpty = { empty: true, docs: [], size: 0 };

  const existingSubSnapshot = { empty: false };
  const noSubSnapshot = { empty: true };

  let subscribeExistingCheck = false;

  const getMock = vi.fn().mockImplementation(async () => {
    if (subscribeExistingCheck) {
      subscribeExistingCheck = false;
      return noSubSnapshot;
    }
    return {
      empty: false,
      size: 2,
      docs: [
        { data: () => ({ email: "ana@test.com", subscribedAt: { toDate: () => new Date("2026-01-01") } }) },
        { data: () => ({ email: "ion@test.com", subscribedAt: null }) },
      ],
    };
  });

  const whereMock = vi.fn(() => ({ get: getMock, where: vi.fn(() => ({ get: getMock })) }));

  const activityAddMock = vi.fn().mockResolvedValue({ id: "log-1" });
  const collectionMock = vi.fn((name?: string) => {
    if (name === "site_activity") return { add: activityAddMock };
    return { add: addMock, where: whereMock };
  });

  vi.doMock("src/server/firestore", () => ({
    firestore: () => ({ collection: collectionMock }),
  }));

  vi.doMock("src/server/middleware/requireFirebaseAuth", () => ({
    requireFirebaseAuth: (req: any, _res: any, next: any) => {
      req.firebaseUid = "uid-admin";
      req.firebaseEmail = "ancadaniel1994@gmail.com";
      req.isSupremeAdmin = true;
      next();
    },
    requireSupremeAdmin: (_req: any, _res: any, next: any) => next(),
  }));

  vi.doMock("src/server/notifications/mailer", () => ({
    sendEmail: vi.fn().mockResolvedValue(undefined),
  }));

  vi.doMock("src/server/utils/ipinfo", () => ({
    getClientIp: () => "127.0.0.1",
    fetchIpInfo: vi.fn().mockResolvedValue(null),
  }));

  vi.doMock("src/server/constants/credentials", () => ({
    adminUser: { email: "ancadaniel1994@gmail.com" },
  }));

  vi.doMock("src/server/constants/domain", () => ({
    APP_BASE_URL: "https://example.com",
  }));

  const mod = await import("src/server/routes/albumSubscriptions.routes");
  const router = mod.default;
  const handlers: Record<string, Handler> = {};

  for (const layer of router.stack) {
    const method: string = layer.route?.stack[layer.route.stack.length - 1]?.method ?? "";
    const path: string = layer.route?.path ?? "";
    handlers[`${method.toUpperCase()} ${path}`] = layer.route?.stack[layer.route.stack.length - 1]?.handle;
  }

  return { handlers, addMock, getMock, whereMock, collectionMock, subscribeExistingCheck };
}

describe("albumSubscriptions.routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  // ── POST /subscribe ──────────────────────────────────────────────────────────

  describe("POST /subscribe", () => {
    test("creates a new subscription and returns ok:true", async () => {
      const { handlers, getMock, addMock } = await loadRouter();
      const subscribe = handlers["POST /subscribe"];
      const res = createMockResponse();

      // no existing subscription
      getMock.mockResolvedValueOnce({ empty: true });

      await subscribe({ body: { albumSlug: "nunta-ana", email: "ana@test.com" } }, res);

      expect(addMock).toHaveBeenCalledOnce();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test("returns ok:true with alreadySubscribed when email exists", async () => {
      const { handlers, getMock, addMock } = await loadRouter();
      const subscribe = handlers["POST /subscribe"];
      const res = createMockResponse();

      getMock.mockResolvedValueOnce({ empty: false });

      await subscribe({ body: { albumSlug: "nunta-ana", email: "ana@test.com" } }, res);

      expect(addMock).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ ok: true, alreadySubscribed: true });
    });

    test("normalizes email to lowercase before saving", async () => {
      const { handlers, getMock, addMock } = await loadRouter();
      const subscribe = handlers["POST /subscribe"];
      const res = createMockResponse();

      getMock.mockResolvedValueOnce({ empty: true });

      await subscribe({ body: { albumSlug: "nunta-ana", email: "  Ana@TEST.COM  " } }, res);

      expect(addMock).toHaveBeenCalledWith(
        expect.objectContaining({ email: "ana@test.com", albumSlug: "nunta-ana" })
      );
    });

    test("returns 400 when albumSlug is missing", async () => {
      const { handlers } = await loadRouter();
      const subscribe = handlers["POST /subscribe"];
      const res = createMockResponse();

      await subscribe({ body: { email: "ana@test.com" } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("returns 400 when email is missing", async () => {
      const { handlers } = await loadRouter();
      const subscribe = handlers["POST /subscribe"];
      const res = createMockResponse();

      await subscribe({ body: { albumSlug: "nunta-ana" } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("returns 400 when both fields are missing", async () => {
      const { handlers } = await loadRouter();
      const subscribe = handlers["POST /subscribe"];
      const res = createMockResponse();

      await subscribe({ body: {} }, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ── GET /list/:slug ──────────────────────────────────────────────────────────

  describe("GET /list/:slug", () => {
    test("returns subscriber list for the album", async () => {
      const { handlers } = await loadRouter();
      const list = handlers["GET /list/:slug"];
      const res = createMockResponse();

      await list({ params: { slug: "nunta-ana" } }, res);

      expect(res.json).toHaveBeenCalledWith({
        subscribers: expect.arrayContaining([
          expect.objectContaining({ email: "ana@test.com" }),
          expect.objectContaining({ email: "ion@test.com" }),
        ]),
      });
    });

    test("returns empty array when no subscribers exist", async () => {
      const { handlers, getMock } = await loadRouter();
      const list = handlers["GET /list/:slug"];
      const res = createMockResponse();

      getMock.mockResolvedValueOnce({ empty: true, size: 0, docs: [] });

      await list({ params: { slug: "album-fara-abonati" } }, res);

      expect(res.json).toHaveBeenCalledWith({ subscribers: [] });
    });

    test("does NOT use orderBy (no composite index required)", async () => {
      const { handlers, whereMock } = await loadRouter();
      const list = handlers["GET /list/:slug"];
      const res = createMockResponse();

      const whereResult = { get: vi.fn().mockResolvedValue({ empty: true, docs: [] }), where: vi.fn() };
      whereMock.mockReturnValueOnce(whereResult);

      await list({ params: { slug: "any-album" } }, res);

      // orderBy chaining would return a different object; direct .get() is called
      expect(whereResult.get).toHaveBeenCalledOnce();
    });
  });

  // ── GET /count/:slug ─────────────────────────────────────────────────────────

  describe("GET /count/:slug", () => {
    test("returns subscriber count", async () => {
      const { handlers } = await loadRouter();
      const count = handlers["GET /count/:slug"];
      const res = createMockResponse();

      await count({ params: { slug: "nunta-ana" } }, res);

      expect(res.json).toHaveBeenCalledWith({ count: 2 });
    });

    test("returns count:0 when no subscribers", async () => {
      const { handlers, getMock } = await loadRouter();
      const count = handlers["GET /count/:slug"];
      const res = createMockResponse();

      getMock.mockResolvedValueOnce({ empty: true, size: 0, docs: [] });

      await count({ params: { slug: "album-gol" } }, res);

      expect(res.json).toHaveBeenCalledWith({ count: 0 });
    });
  });

  // ── DELETE /unsubscribe ──────────────────────────────────────────────────────

  describe("DELETE /unsubscribe", () => {
    test("deletes subscriber document and returns ok:true", async () => {
      const { handlers, getMock } = await loadRouter();
      const unsubscribe = handlers["DELETE /unsubscribe"];
      const res = createMockResponse();

      const deleteMock = vi.fn().mockResolvedValue(undefined);
      getMock.mockResolvedValueOnce({
        empty: false,
        docs: [{ ref: { delete: deleteMock } }],
      });

      await unsubscribe({ body: { albumSlug: "nunta-ana", email: "ana@test.com" } }, res);

      expect(deleteMock).toHaveBeenCalledOnce();
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test("returns 404 when subscriber is not found", async () => {
      const { handlers, getMock } = await loadRouter();
      const unsubscribe = handlers["DELETE /unsubscribe"];
      const res = createMockResponse();

      getMock.mockResolvedValueOnce({ empty: true, docs: [] });

      await unsubscribe({ body: { albumSlug: "nunta-ana", email: "necunoscut@test.com" } }, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("returns 400 when albumSlug is missing", async () => {
      const { handlers } = await loadRouter();
      const unsubscribe = handlers["DELETE /unsubscribe"];
      const res = createMockResponse();

      await unsubscribe({ body: { email: "ana@test.com" } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("returns 400 when email is missing", async () => {
      const { handlers } = await loadRouter();
      const unsubscribe = handlers["DELETE /unsubscribe"];
      const res = createMockResponse();

      await unsubscribe({ body: { albumSlug: "nunta-ana" } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ── POST /notify/:slug ───────────────────────────────────────────────────────

  describe("POST /notify/:slug", () => {
    test("sends emails to all subscribers and returns sent count", async () => {
      const { handlers, getMock } = await loadRouter();
      const { sendEmail } = await import("src/server/notifications/mailer") as any;
      const notify = handlers["POST /notify/:slug"];
      const res = createMockResponse();

      getMock.mockResolvedValueOnce({
        empty: false,
        docs: [
          { data: () => ({ email: "ana@test.com" }) },
          { data: () => ({ email: "ion@test.com" }) },
        ],
      });

      await notify({ params: { slug: "nunta-ana" } }, res);

      expect(sendEmail).toHaveBeenCalledTimes(2);
      expect(res.json).toHaveBeenCalledWith({ ok: true, sent: 2 });
    });

    test("returns sent:0 when no subscribers", async () => {
      const { handlers, getMock } = await loadRouter();
      const notify = handlers["POST /notify/:slug"];
      const res = createMockResponse();

      getMock.mockResolvedValueOnce({ empty: true, docs: [] });

      await notify({ params: { slug: "album-gol" } }, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true, sent: 0 });
    });
  });
});
