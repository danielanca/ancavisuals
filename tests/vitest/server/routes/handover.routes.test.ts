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
  const generateHandoverPDFMock = vi.fn().mockResolvedValue(Buffer.from("pdf"));
  const sendHandoverLinkEmailMock = vi.fn().mockResolvedValue(undefined);
  const sendSignedHandoverEmailMock = vi.fn().mockResolvedValue(undefined);
  const sendHandoverReminderEmailMock = vi.fn().mockResolvedValue(undefined);

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
    postCreate: getHandler("post", "/"),
    getList: getHandler("get", "/"),
    getPublicSign: getHandler("get", "/sign/:token"),
    postPublicSign: getHandler("post", "/sign/:token"),
    postSend: getHandler("post", "/:id/send"),
    deleteOne: getHandler("delete", "/:id"),
  };
}

describe("handover.routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    delete process.env.APP_BASE_URL;
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
      expect(saved.digitalLinkExpiryDays).toBe(30);
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
});
