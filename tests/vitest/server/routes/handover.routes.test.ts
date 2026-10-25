/*
 * Purpose: verifies the admin/public handover (Proces Verbal) route flows around creation,
 * listing, and signing without touching Firestore or email/PDF services.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

type Handler = (req: any, res: any) => Promise<void> | void;

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

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function loadHandoverRouter() {
  const addMock = vi.fn();
  const orderByGetMock = vi.fn();
  const whereGetMock = vi.fn();
  const updateMock = vi.fn().mockResolvedValue(undefined);
  const deleteMock = vi.fn().mockResolvedValue(undefined);
  const docGetMock = vi.fn().mockResolvedValue({ exists: false });
  const transactionGet = vi.fn();
  const transactionUpdate = vi.fn();
  const generateHandoverPDFMock = vi.fn().mockResolvedValue(Buffer.from("pdf"));
  const sendHandoverLinkEmailMock = vi.fn().mockResolvedValue(undefined);
  const sendSignedHandoverEmailMock = vi.fn().mockResolvedValue(undefined);
  const sendHandoverReminderEmailMock = vi.fn().mockResolvedValue(undefined);
  const sendDownloadReminderEmailMock = vi.fn().mockResolvedValue(undefined);
  const sendSmsMock = vi.fn().mockResolvedValue(undefined);

  const collectionMock = vi.fn(() => ({
    add: addMock,
    orderBy: vi.fn(() => ({
      get: orderByGetMock,
    })),
    where: vi.fn(() => ({
      limit: vi.fn(() => ({
        get: whereGetMock,
      })),
    })),
    doc: vi.fn((id: string) => ({
      id,
      get: () => docGetMock(id),
      update: (payload: Record<string, unknown>) => updateMock(id, payload),
      delete: () => deleteMock(id),
    })),
  }));

  vi.doMock("src/server/middleware/requireFirebaseAuth", () => ({
    requireFirebaseAuth: (_req: any, _res: any, next: () => void) => next(),
    requireSupremeAdmin: (_req: any, _res: any, next: () => void) => next(),
  }));

  vi.doMock("src/server/firestore", () => ({
    firestore: () => ({
      collection: collectionMock,
      runTransaction: async (callback: any) => callback({ get: transactionGet, update: transactionUpdate }),
    }),
  }));

  vi.doMock("src/server/services/pdf.generator", () => ({
    generateHandoverPDF: generateHandoverPDFMock,
    buildHandoverHTML: vi.fn().mockReturnValue("<html></html>"),
  }));

  vi.doMock("src/server/notifications/templates/handoverEmail", () => ({
    sendHandoverLinkEmail: sendHandoverLinkEmailMock,
    sendSignedHandoverEmail: sendSignedHandoverEmailMock,
    sendHandoverReminderEmail: sendHandoverReminderEmailMock,
    sendDownloadReminderEmail: sendDownloadReminderEmailMock,
  }));

  vi.doMock("src/server/notifications/sms", () => ({
    sendSms: sendSmsMock,
    isSmsConfigured: () => true,
    normalizeRomanianPhoneNumber: (value: string) => (value.trim() ? `+40${value.trim().replace(/^0/, "")}` : null),
  }));

  vi.doMock("src/server/constants/firebase", () => ({
    FIREBASE_STORAGE_BUCKET: "test-bucket",
  }));

  vi.doMock("firebase-admin/storage", () => ({
    getStorage: () => ({
      bucket: () => ({
        file: () => ({
          save: vi.fn().mockResolvedValue(undefined),
          getSignedUrl: vi.fn().mockResolvedValue(["https://storage.example.com/handover.pdf"]),
        }),
      }),
    }),
  }));

  const module = await import("src/server/routes/handover.routes");
  const router = module.default as any;

  const getHandler = (method: "get" | "post" | "delete", path: string): Handler => {
    const layer = router.stack.find((entry: any) => entry.route?.path === path && entry.route.methods?.[method]);
    if (!layer) {
      throw new Error(`Missing ${method.toUpperCase()} handler for ${path}`);
    }
    const stack = layer.route.stack;
    return stack[stack.length - 1].handle;
  };

  return {
    addMock,
    orderByGetMock,
    whereGetMock,
    docGetMock,
    updateMock,
    generateHandoverPDFMock,
    sendHandoverLinkEmailMock,
    sendSignedHandoverEmailMock,
    sendDownloadReminderEmailMock,
    sendHandoverReminderEmailMock,
    sendSmsMock,
    postReminder: getHandler("post", "/:id/reminder"),
    postDownloadReminder: getHandler("post", "/:id/download-reminder"),
    postCreate: getHandler("post", "/"),
    getList: getHandler("get", "/"),
    getPublicSign: getHandler("get", "/sign/:token"),
    postPublicSign: getHandler("post", "/sign/:token"),
    postSend: getHandler("post", "/:id/send"),
    deleteOne: getHandler("delete", "/:id"),
    associateEvent: getHandler("post", "/:id/event"),
    associationStack: router.stack.find((entry: any) => entry.route?.path === "/:id/event").route.stack,
    transactionGet,
    transactionUpdate,
  };
}

describe("handover.routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    delete process.env.APP_BASE_URL;
  });

  describe("event association", () => {
    test("links a signed protocol and its event atomically without changing signed contents", async () => {
      const { associateEvent, transactionGet, transactionUpdate, associationStack } = await loadHandoverRouter();
      expect(associationStack).toHaveLength(3);
      transactionGet.mockResolvedValueOnce({ exists: true, data: () => ({ status: "signed", clientName: "Client" }) })
        .mockResolvedValueOnce({ exists: true, data: () => ({}) });
      const res = createMockResponse();
      await associateEvent({ params: { id: "pv-1" }, body: { eventId: "event-1" } }, res);
      expect(transactionUpdate.mock.calls.map(call => call[1])).toEqual([{ eventId: "event-1" }, { handoverId: "pv-1" }]);
      expect(res.json).toHaveBeenCalledWith({ ok: true, eventId: "event-1" });
    });
    test("rejects conflicting associations without writing", async () => {
      const { associateEvent, transactionGet, transactionUpdate } = await loadHandoverRouter();
      transactionGet.mockResolvedValueOnce({ exists: true, data: () => ({}) })
        .mockResolvedValueOnce({ exists: true, data: () => ({ handoverId: "another-pv" }) });
      const res = createMockResponse();
      await associateEvent({ params: { id: "pv-1" }, body: { eventId: "event-1" } }, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(transactionUpdate).not.toHaveBeenCalled();
    });
    test("returns 404 for a deleted event without writing", async () => {
      const { associateEvent, transactionGet, transactionUpdate } = await loadHandoverRouter();
      transactionGet.mockResolvedValueOnce({ exists: true, data: () => ({}) }).mockResolvedValueOnce({ exists: false });
      const res = createMockResponse();
      await associateEvent({ params: { id: "pv-1" }, body: { eventId: "missing" } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(transactionUpdate).not.toHaveBeenCalled();
    });
    test("rejects invalid event ids", async () => {
      const { associateEvent, transactionGet } = await loadHandoverRouter();
      const res = createMockResponse();
      await associateEvent({ params: { id: "pv-1" }, body: { eventId: "a/b" } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(transactionGet).not.toHaveBeenCalled();
    });
  });

  describe("happy path", () => {
    test("POST / creates a draft handover with default day windows", async () => {
      const { postCreate, addMock } = await loadHandoverRouter();
      const res = createMockResponse();
      addMock.mockResolvedValue({ id: "handover-1" });

      await postCreate({
        body: {
          eventType: "Nuntă",
          eventDate: "2026-09-12",
          clientEmail: "client@example.com",
          clientName: "Ion Popescu",
          includeDigitalLink: true,
        },
      }, res);

      expect(addMock).toHaveBeenCalledTimes(1);
      const saved = addMock.mock.calls[0][0];
      expect(saved.status).toBe("draft");
      expect(saved.token).toEqual(expect.any(String));
      expect(saved.createdAt).toBeInstanceOf(Timestamp);
      expect(saved.courierDeliveryDays).toBe(7);
      expect(saved.materialsReportWindowDays).toBe(7);
      expect(saved.digitalLinkExpiryDays).toBe(15);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: "handover-1", token: saved.token });
    });

    test("POST / links the handover back to the event when eventId is provided", async () => {
      const { postCreate, addMock, updateMock } = await loadHandoverRouter();
      const res = createMockResponse();
      addMock.mockResolvedValue({ id: "handover-1" });

      await postCreate({
        body: {
          eventId: "event-1",
          eventType: "Botez",
          eventDate: "2026-10-01",
          clientEmail: "client@example.com",
          includeCourier: true,
        },
      }, res);

      expect(updateMock).toHaveBeenCalledWith("event-1", { handoverId: "handover-1" });
    });

    test("GET / serializes Firestore timestamps for admin listing", async () => {
      const { getList, orderByGetMock } = await loadHandoverRouter();
      const res = createMockResponse();
      const createdAt = Timestamp.fromDate(new Date("2026-04-10T08:00:00.000Z"));

      orderByGetMock.mockResolvedValue({
        docs: [
          {
            id: "handover-1",
            data: () => ({ status: "draft", createdAt, signedAt: null, sentAt: null, clientEmail: "client@example.com" }),
          },
        ],
      });

      await getList({}, res);

      expect(res.json).toHaveBeenCalledWith({
        items: [
          {
            id: "handover-1",
            status: "draft",
            createdAt: "2026-04-10T08:00:00.000Z",
            signedAt: null,
            sentAt: null,
            clientEmail: "client@example.com",
          },
        ],
      });
    });

    test("GET /sign/:token hides sensitive fields from public payload", async () => {
      const { getPublicSign, whereGetMock } = await loadHandoverRouter();
      const res = createMockResponse();

      whereGetMock.mockResolvedValue({
        empty: false,
        docs: [
          {
            id: "handover-1",
            data: () => ({
              status: "sent",
              createdAt: Timestamp.fromDate(new Date("2026-06-01T12:00:00.000Z")),
              eventType: "Botez",
              clientEmail: "secret@example.com",
              clientSignatureBase64: "data:image/png;base64,abc",
              clientIp: "127.0.0.1",
              pdfUrl: "https://example.com/handover.pdf",
            }),
          },
        ],
      });

      await getPublicSign({ params: { token: "abc" } }, res);

      const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(payload).toMatchObject({ id: "handover-1", status: "sent", eventType: "Botez" });
      expect(payload).not.toHaveProperty("clientSignatureBase64");
      expect(payload).not.toHaveProperty("clientIp");
      expect(payload).not.toHaveProperty("pdfUrl");
    });

    test("POST /sign/:token signs the handover and starts PDF email delivery in background", async () => {
      const { postPublicSign, whereGetMock, updateMock, generateHandoverPDFMock, sendSignedHandoverEmailMock } = await loadHandoverRouter();
      const res = createMockResponse();

      whereGetMock.mockResolvedValue({
        empty: false,
        docs: [
          {
            id: "handover-1",
            data: () => ({
              token: "token-1",
              status: "sent",
              eventType: "Nuntă",
              eventDate: "2026-09-12",
              clientEmail: "client@example.com",
            }),
          },
        ],
      });

      await postPublicSign({
        params: { token: "token-1" },
        ip: "10.0.0.1",
        headers: {},
        socket: { remoteAddress: "10.0.0.2" },
        body: {
          clientName: "  Ion Popescu  ",
          clientPhone: "  0712345678  ",
          clientEmail: "  client2@example.com  ",
          digitalLinkAcknowledged: true,
          backupAcknowledged: true,
          termsAcknowledged: true,
          clientSignatureBase64: "data:image/png;base64,abc",
        },
      }, res);

      expect(updateMock).toHaveBeenCalledTimes(1);
      const [, updatePayload] = updateMock.mock.calls[0];
      expect(updatePayload).toMatchObject({
        status: "signed",
        clientName: "Ion Popescu",
        clientPhone: "0712345678",
        clientEmail: "client2@example.com",
        digitalLinkAcknowledged: true,
        backupAcknowledged: true,
        termsAcknowledged: true,
        clientSignatureBase64: "data:image/png;base64,abc",
        clientIp: "10.0.0.1",
      });
      expect(updatePayload.signedAt).toBeInstanceOf(Timestamp);
      expect(res.json).toHaveBeenCalledWith({ ok: true, message: "Procesul verbal a fost semnat cu succes!" });

      await flushPromises();

      expect(generateHandoverPDFMock).toHaveBeenCalledTimes(1);
      expect(sendSignedHandoverEmailMock).toHaveBeenCalledWith({
        to: "client2@example.com",
        eventType: "Nuntă",
        eventDate: "2026-09-12",
        clientName: "Ion Popescu",
        pdfUrl: "https://storage.example.com/handover.pdf",
        hasPdf: true,
        digitalLinkExpiryDays: 30,
      });
    });

    test("POST /:id/send updates status and uses APP_BASE_URL in the email link", async () => {
      process.env.APP_BASE_URL = "https://staging.ancavisuals.ro";
      const { postSend, docGetMock, updateMock, sendHandoverLinkEmailMock } = await loadHandoverRouter();
      const res = createMockResponse();

      docGetMock.mockResolvedValue({
        exists: true,
        data: () => ({
          status: "draft",
          token: "token-1",
          clientEmail: "client@example.com",
          eventType: "Cununie",
          eventDate: "2026-08-01",
        }),
      });

      await postSend({ params: { id: "handover-1" } }, res);

      expect(updateMock).toHaveBeenCalledTimes(1);
      const [, updatePayload] = updateMock.mock.calls[0];
      expect(updatePayload.status).toBe("sent");
      expect(updatePayload.sentAt).toBeInstanceOf(Timestamp);

      expect(sendHandoverLinkEmailMock).toHaveBeenCalledWith({
        to: "client@example.com",
        token: "token-1",
        eventType: "Cununie",
        eventDate: "2026-08-01",
        baseUrl: "https://staging.ancavisuals.ro",
        includeDigitalLink: true,
      });
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test("DELETE /:id removes the handover", async () => {
      const { deleteOne, docGetMock } = await loadHandoverRouter();
      const res = createMockResponse();

      docGetMock.mockResolvedValue({ exists: true, data: () => ({}) });

      await deleteOne({ params: { id: "handover-1" } }, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });

  describe("validation and guard paths", () => {
    test("POST / rejects missing mandatory fields", async () => {
      const { postCreate, addMock } = await loadHandoverRouter();
      const res = createMockResponse();

      await postCreate({ body: { eventType: "Nuntă" } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Câmpuri obligatorii: eventType, eventDate" });
      expect(addMock).not.toHaveBeenCalled();
    });

    test("POST /sign/:token requires the digital-link-received checkbox", async () => {
      const { postPublicSign, whereGetMock } = await loadHandoverRouter();
      const res = createMockResponse();

      whereGetMock.mockResolvedValue({
        empty: false,
        docs: [
          {
            id: "handover-1",
            data: () => ({ status: "sent", eventType: "Nuntă", eventDate: "2026-09-12" }),
          },
        ],
      });

      await postPublicSign({
        params: { token: "abc" },
        headers: {},
        body: {
          clientName: "Ion Popescu",
          clientPhone: "0712345678",
          clientEmail: "client@example.com",
          digitalLinkAcknowledged: false,
          backupAcknowledged: true,
          termsAcknowledged: true,
          clientSignatureBase64: "data:image/png;base64,abc",
        },
      }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Trebuie să confirmați că ați înțeles că veți primi link-ul digital pe email după semnare." });
      expect(whereGetMock).toHaveBeenCalled();
    });

    test("POST /sign/:token requires the terms-acknowledged checkbox", async () => {
      const { postPublicSign, whereGetMock } = await loadHandoverRouter();
      const res = createMockResponse();

      await postPublicSign({
        params: { token: "abc" },
        body: {
          clientName: "Ion Popescu",
          clientPhone: "0712345678",
          clientEmail: "client@example.com",
          backupAcknowledged: true,
          termsAcknowledged: false,
          clientSignatureBase64: "data:image/png;base64,abc",
        },
      }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Trebuie să confirmați că ați înțeles termenele de livrare." });
      expect(whereGetMock).not.toHaveBeenCalled();
    });

    test("GET /sign/:token returns signed state for already signed handovers", async () => {
      const { getPublicSign, whereGetMock } = await loadHandoverRouter();
      const res = createMockResponse();

      whereGetMock.mockResolvedValue({
        empty: false,
        docs: [{ id: "handover-1", data: () => ({ status: "signed", pdfUrl: "https://example.com/h.pdf" }) }],
      });

      await getPublicSign({ params: { token: "abc" } }, res);

      expect(res.status).toHaveBeenCalledWith(410);
      expect(res.json).toHaveBeenCalledWith({
        error: "Procesul verbal a fost deja semnat.",
        status: "signed",
        pdfUrl: "https://example.com/h.pdf",
        digitalLinks: [],
        digitalLinkUrl: null,
        digitalLinkExpiryDays: null,
        includeDigitalLink: true,
        includeCourier: true,
        includePersonalHandover: false,
        awb: null,
        courierDeliveryDays: null,
        materialsReportWindowDays: null,
        signedAt: null,
      });
    });

    test("GET /sign/:token returns 404 for unknown tokens", async () => {
      const { getPublicSign, whereGetMock } = await loadHandoverRouter();
      const res = createMockResponse();

      whereGetMock.mockResolvedValue({ empty: true, docs: [] });

      await getPublicSign({ params: { token: "missing" } }, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Proces verbal negăsit." });
    });
  });

  describe("download reminder", () => {
    const signed = {
      status: "signed",
      token: "token-1",
      clientEmail: "client@example.com",
      eventType: "Nuntă",
      eventDate: "2026-08-08",
      digitalLinkExpiryDays: 15,
      downloadReminderCount: 1,
    };

    test("emails the client with the links deadline and records the reminder", async () => {
      process.env.APP_BASE_URL = "https://ancavisuals.ro";
      const { postDownloadReminder, docGetMock, updateMock, sendDownloadReminderEmailMock } = await loadHandoverRouter();
      const res = createMockResponse();
      const signedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      docGetMock.mockResolvedValue({ exists: true, data: () => ({ ...signed, signedAt: Timestamp.fromDate(signedAt) }) });

      await postDownloadReminder({ params: { id: "handover-1" } }, res);

      expect(sendDownloadReminderEmailMock).toHaveBeenCalledWith({
        to: "client@example.com",
        token: "token-1",
        eventType: "Nuntă",
        eventDate: "2026-08-08",
        baseUrl: "https://ancavisuals.ro",
        linksValidUntil: new Date(signedAt.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      });
      const [, payload] = updateMock.mock.calls[0];
      expect(payload.downloadReminderSentAt).toBeInstanceOf(Timestamp);
      expect(payload.downloadReminderCount).toBe(2);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, downloadReminderCount: 2 }));
    });

    test("omits the deadline once the links have expired", async () => {
      const { postDownloadReminder, docGetMock, sendDownloadReminderEmailMock } = await loadHandoverRouter();
      const res = createMockResponse();
      docGetMock.mockResolvedValue({ exists: true, data: () => ({ ...signed, signedAt: Timestamp.fromDate(new Date("2026-01-01")) }) });

      await postDownloadReminder({ params: { id: "handover-1" } }, res);

      expect(sendDownloadReminderEmailMock).toHaveBeenCalledWith(expect.objectContaining({ linksValidUntil: null }));
    });

    test("refuses unsigned protocols, protocols without a digital link and clients without email", async () => {
      const { postDownloadReminder, docGetMock, updateMock, sendDownloadReminderEmailMock } = await loadHandoverRouter();
      for (const data of [{ ...signed, status: "sent" }, { ...signed, includeDigitalLink: false }, { ...signed, clientEmail: " " }]) {
        const res = createMockResponse();
        docGetMock.mockResolvedValue({ exists: true, data: () => data });
        await postDownloadReminder({ params: { id: "handover-1" } }, res);
        expect(res.status).toHaveBeenCalledWith(400);
      }
      expect(sendDownloadReminderEmailMock).not.toHaveBeenCalled();
      expect(updateMock).not.toHaveBeenCalled();
    });
  });

  describe("sign reminder (PV sent, not signed yet)", () => {
    const pending = { status: "sent", token: "token-1", clientEmail: "", eventType: "Nuntă", eventDate: "2026-08-08", eventId: "event-1", signReminderCount: 1 };
    const withEvent = (data: Record<string, unknown>, client: Record<string, unknown>) => async (id: string) =>
      id === "event-1" ? { exists: true, data: () => ({ client }) } : { exists: true, data: () => data };

    test("texts the event's phone when there is no email, and can be sent again", async () => {
      process.env.APP_BASE_URL = "https://ancavisuals.ro";
      const { postReminder, docGetMock, updateMock, sendHandoverReminderEmailMock, sendSmsMock } = await loadHandoverRouter();
      docGetMock.mockImplementation(withEvent(pending, { phone: "0712345678" }));

      for (let i = 0; i < 2; i++) {
        const res = createMockResponse();
        await postReminder({ params: { id: "pv-1" }, body: {} }, res);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, emailed: false, smsSent: true }));
      }

      expect(sendHandoverReminderEmailMock).not.toHaveBeenCalled();
      expect(sendSmsMock).toHaveBeenCalledTimes(2);
      expect(sendSmsMock.mock.calls[0][0]).toEqual({ to: "+40712345678", body: expect.stringContaining("https://ancavisuals.ro/proces-verbal/token-1") });
      expect(sendSmsMock.mock.calls[0][0].body).toContain("evenimentul din data de 8 august 2026");
      expect(updateMock.mock.calls[0][1]).toMatchObject({ signReminderCount: 2, signReminderChannels: ["sms"] });
    });

    test("emails and texts when both exist; a failed SMS doesn't fail the reminder", async () => {
      const { postReminder, docGetMock, sendHandoverReminderEmailMock, sendSmsMock } = await loadHandoverRouter();
      docGetMock.mockImplementation(withEvent(pending, { email: "ana@example.com", phone: "0712345678" }));
      sendSmsMock.mockRejectedValueOnce(new Error("no credit"));
      const res = createMockResponse();

      await postReminder({ params: { id: "pv-1" }, body: {} }, res);

      expect(sendHandoverReminderEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: "ana@example.com", token: "token-1" }));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, emailed: true, smsSent: false, smsError: "no credit" }));
    });

    test("refuses signed PVs and clients with neither email nor phone", async () => {
      const { postReminder, docGetMock, updateMock } = await loadHandoverRouter();
      for (const [data, client] of [[{ ...pending, status: "signed" }, { phone: "0712345678" }], [pending, {}]] as const) {
        docGetMock.mockImplementation(withEvent(data, client));
        const res = createMockResponse();
        await postReminder({ params: { id: "pv-1" }, body: {} }, res);
        expect(res.status).toHaveBeenCalledWith(400);
      }
      expect(updateMock).not.toHaveBeenCalled();
    });
  });
});
