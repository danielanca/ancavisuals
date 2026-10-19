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

      const updateMock = vi.fn().mockResolvedValue(undefined);
      getMock.mockResolvedValueOnce({ empty: false, docs: [{ data: () => ({ albumSlug: "nunta-ana", email: "ana@test.com" }), ref: { update: updateMock } }] });

      await subscribe({ body: { albumSlug: "nunta-ana", email: "ana@test.com" } }, res);

      expect(addMock).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ ok: true, alreadySubscribed: true, channels: ["email"] });
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

  describe("canale și noutăți album", () => {
    test("subscribes by WhatsApp with a normalized Romanian phone", async () => {
      const { handlers, addMock, getMock } = await loadRouter();
      getMock.mockResolvedValueOnce({ empty: true, docs: [] });
      const res = createMockResponse();
      await handlers["POST /subscribe"]({ body: { albumSlug: "nunta-ana", channels: ["whatsapp"], phone: "0745 123 456", name: "Mătușa Ana" } }, res);
      expect(addMock).toHaveBeenCalledWith(expect.objectContaining({
        albumSlug: "nunta-ana", phone: "+40745123456", email: null, name: "Mătușa Ana", channels: ["whatsapp"],
        unsubscribeToken: expect.stringMatching(/^[a-f0-9]{24}$/),
      }));
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test.each([
      ["POST /subscribe", { channels: ["whatsapp"], phone: "0745123456" }],
      ["POST /subscribe", { channels: ["sms"], phone: "0745123456" }],
      ["POST /subscribe", { channels: ["email"], email: "ana@test.ro" }],
      ["POST /admin-add", { channels: ["whatsapp"], phone: "0745123456" }],
      ["POST /admin-add", { channels: ["sms"], phone: "0745123456" }],
      ["POST /admin-add", { channels: ["email"], email: "ana@test.ro" }],
    ])("%s accepts a subscriber without a name %#", async (route, body) => {
      const { handlers, addMock, getMock } = await loadRouter();
      getMock.mockResolvedValue({ empty: true, docs: [] });
      const res = createMockResponse();
      await handlers[route]({ body: { albumSlug: "nunta-ana", ...body } }, res);
      expect(addMock).toHaveBeenCalledWith(expect.objectContaining({ name: null, channels: body.channels }));
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test.each([
      [{ albumSlug: "nunta-ana", channels: [] }, "Alege cel puțin un canal: Email, SMS sau WhatsApp."],
      [{ albumSlug: "nunta-ana", channels: ["sms"], phone: "12" }, "Scrie un număr de telefon valid (ex. 07xx xxx xxx)."],
      [{ albumSlug: "nunta-ana", channels: ["email"], email: "nu-e-email" }, "Scrie o adresă de email validă."],
    ])("rejects incomplete subscriptions %#", async (body, error) => {
      const { handlers, addMock } = await loadRouter();
      const res = createMockResponse();
      await handlers["POST /subscribe"]({ body }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error });
      expect(addMock).not.toHaveBeenCalled();
    });

    test("publishing an update emails subscribers and prepares WhatsApp links", async () => {
      const { handlers, getMock, addMock } = await loadRouter();
      const { sendEmail } = await import("src/server/notifications/mailer");
      const refUpdate = vi.fn().mockResolvedValue(undefined);
      addMock.mockResolvedValueOnce({ id: "upd-1", update: refUpdate });
      getMock.mockResolvedValueOnce({ empty: false, docs: [
        { data: () => ({ albumSlug: "nunta-ana", email: "ana@test.com", channels: ["email"], unsubscribeToken: "a".repeat(24) }) },
        { data: () => ({ albumSlug: "nunta-ana", phone: "+40745123456", name: "Ion", channels: ["whatsapp"] }) },
      ] });
      const res = createMockResponse();

      await handlers["POST /updates/:slug"]({
        params: { slug: "nunta-ana" },
        body: { kind: "estimate", text: "Pozele editate sunt aproape gata.", estimateDate: "2099-11-15", notify: true },
      }, res);

      expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "ana@test.com" }));
      const payload = res.json.mock.calls[0][0];
      expect(payload.sent).toEqual({ email: 1, sms: 0, failed: 0 });
      expect(payload.whatsapp).toHaveLength(1);
      expect(payload.whatsapp[0].link).toMatch(/^https:\/\/wa\.me\/40745123456\?text=/);
      expect(decodeURIComponent(payload.whatsapp[0].link)).toContain("📅 Estimare (15 noiembrie 2099): Pozele editate sunt aproape gata.");
      expect(refUpdate).toHaveBeenCalledWith({ sent: { email: 1, sms: 0, failed: 0, whatsapp: 1 }, phoneDelivery: "subscriber", email: true });
      // Every channel says the message is automatic.
      expect(decodeURIComponent(payload.whatsapp[0].link)).toContain("🤖 Acest mesaj este automat și a fost trimis de sistemul ancavisuals.ro — fotograful de la evenimentul tău.\n\n📅 Estimare");
      const clientEmail = sendEmail.mock.calls.find(([opts]: [{ to: string }]) => opts.to === "ana@test.com")[0];
      expect(clientEmail.subject).toMatch(/^\[Mesaj automat\]/);
      expect(clientEmail.html).toContain("Acest mesaj este automat și a fost trimis de sistemul ancavisuals.ro — fotograful de la evenimentul tău.");
      // The admin gets the WhatsApp preview + one-click send buttons by email.
      const adminEmail = sendEmail.mock.calls.find(([opts]: [{ to: string }]) => opts.to === "ancadaniel1994@gmail.com")[0];
      expect(adminEmail.subject).toContain("De trimis pe WhatsApp (1)");
      expect(adminEmail.html).toContain("Trimite pe WhatsApp → Ion");
      expect(adminEmail.html).toContain("https://wa.me/40745123456?text=");
      expect(payload.adminEmailed).toBe(true);
    });

    test("rejects an estimate date in the past (mistyped year)", async () => {
      const { handlers, addMock } = await loadRouter();
      const res = createMockResponse();
      await handlers["POST /updates/:slug"]({ params: { slug: "nunta-ana" }, body: { kind: "estimate", text: "Gata curând.", estimateDate: "2024-11-23" } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Data estimată e în trecut. Verifică anul." });
      expect(addMock).not.toHaveBeenCalled();
    });

    test("bulk: posts the same update on every chosen album and sends ONE WhatsApp email to the admin", async () => {
      const { handlers, getMock, addMock } = await loadRouter();
      const { sendEmail } = await import("src/server/notifications/mailer");
      addMock.mockResolvedValue({ id: "upd", update: vi.fn().mockResolvedValue(undefined) });
      getMock.mockResolvedValue({ empty: false, docs: [
        { data: () => ({ phone: "+40745123456", name: "Ion", channels: ["whatsapp"] }) },
      ] });
      const res = createMockResponse();
      await handlers["POST /updates-bulk"]({
        body: { slugs: ["nunta-ana", "botez-maria", "nunta-ana", "../rau"], kind: "delay", text: "Mai durează puțin.", notify: true },
      }, res);
      expect(res.status).toHaveBeenCalledWith(201);
      const payload = res.json.mock.calls[0][0];
      expect(payload.results.map((r: { slug: string }) => r.slug)).toEqual(["nunta-ana", "botez-maria"]);
      expect(addMock).toHaveBeenCalledWith(expect.objectContaining({ albumSlug: "nunta-ana", kind: "delay" }));
      expect(addMock).toHaveBeenCalledWith(expect.objectContaining({ albumSlug: "botez-maria", kind: "delay" }));
      const adminEmails = sendEmail.mock.calls.filter(([opts]: [{ to: string }]) => opts.to === "ancadaniel1994@gmail.com");
      expect(adminEmails).toHaveLength(1);
      expect(adminEmails[0][0].subject).toContain("De trimis pe WhatsApp (2) — noutate la 2 albume");
      expect(adminEmails[0][0].html).toContain("/media/botez-maria");
      expect(payload.adminEmailed).toBe(true);
    });

    test("bulk: no album chosen, or an invalid message, publishes nothing", async () => {
      const { handlers, addMock } = await loadRouter();
      const res = createMockResponse();
      await handlers["POST /updates-bulk"]({ body: { slugs: [], kind: "delay", text: "x" } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      const res2 = createMockResponse();
      await handlers["POST /updates-bulk"]({ body: { slugs: ["a", "b"], kind: "delay", text: "  " } }, res2);
      expect(res2.status).toHaveBeenCalledWith(400);
      expect(addMock).not.toHaveBeenCalled();
    });

    test("rejects an empty update", async () => {
      const { handlers, addMock } = await loadRouter();
      const res = createMockResponse();
      await handlers["POST /updates/:slug"]({ params: { slug: "nunta-ana" }, body: { kind: "photos", text: "  " } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(addMock).not.toHaveBeenCalled();
    });
  });
});
