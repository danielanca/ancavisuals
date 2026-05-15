/*
 * Purpose: verifies the admin/public contract route flows around creation,
 * listing, signing, and sending links without touching Firestore or email/PDF services.
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

async function loadContractsRouter() {
  const addMock = vi.fn();
  const orderByGetMock = vi.fn();
  const whereGetMock = vi.fn();
  const updateMock = vi.fn();
  const docGetMock = vi.fn().mockImplementation(async (id: string) => {
    if (id === "admin") return { exists: true, data: () => ({}) };
    return { exists: false };
  });
  const generateContractPDFMock = vi.fn().mockResolvedValue(Buffer.from("pdf"));
  const sendContractLinkEmailMock = vi.fn().mockResolvedValue(undefined);
  const sendSignedContractEmailMock = vi.fn().mockResolvedValue(undefined);

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
    })),
  }));

  vi.doMock("src/server/firestore", () => ({
    firestore: () => ({
      collection: collectionMock,
    }),
  }));

  vi.doMock("src/server/services/pdf.generator", () => ({
    generateContractPDF: generateContractPDFMock,
  }));

  vi.doMock("src/server/notifications/templates/contractEmail", () => ({
    sendContractLinkEmail: sendContractLinkEmailMock,
    sendSignedContractEmail: sendSignedContractEmailMock,
  }));

  vi.doMock("src/server/constants/firebase", () => ({
    FIREBASE_STORAGE_BUCKET: "test-bucket",
    BOOKED_DATES_FILE_PATH: "booked-dates.json",
  }));

  vi.doMock("firebase-admin/storage", () => ({
    getStorage: () => ({
      bucket: () => ({
        file: () => ({
          save: vi.fn().mockResolvedValue(undefined),
          getSignedUrl: vi.fn().mockResolvedValue(["https://storage.example.com/contract.pdf"]),
        }),
      }),
    }),
  }));

  const module = await import("src/server/routes/contracts.routes");
  const router = module.default as any;

  const getHandler = (method: "get" | "post", path: string): Handler => {
    const layer = router.stack.find((entry: any) => entry.route?.path === path && entry.route.methods?.[method]);
    if (!layer) {
      throw new Error(`Missing ${method.toUpperCase()} handler for ${path}`);
    }
    return layer.route.stack[0].handle;
  };

  return {
    addMock,
    orderByGetMock,
    whereGetMock,
    docGetMock,
    updateMock,
    generateContractPDFMock,
    sendContractLinkEmailMock,
    sendSignedContractEmailMock,
    postCreate: getHandler("post", "/"),
    getList: getHandler("get", "/"),
    getPublicSign: getHandler("get", "/sign/:token"),
    postPublicSign: getHandler("post", "/sign/:token"),
    postSend: getHandler("post", "/:id/send"),
  };
}

describe("contracts.routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    delete process.env.APP_BASE_URL;
  });

  describe("happy path", () => {
    test("POST / creates a draft contract with derived priceRest", async () => {
      const { postCreate, addMock } = await loadContractsRouter();
      const res = createMockResponse();
      addMock.mockResolvedValue({ id: "contract-1" });

      await postCreate({
        body: {
          eventType: "Nunta",
          eventDate: "2026-09-12",
          clientEmail: "client@example.com",
          priceTotal: "1500",
          priceAdvance: "500",
        },
      }, res);

      expect(addMock).toHaveBeenCalledTimes(1);
      const savedContract = addMock.mock.calls[0][0];
      expect(savedContract.status).toBe("draft");
      expect(savedContract.token).toEqual(expect.any(String));
      expect(savedContract.createdAt).toBeInstanceOf(Timestamp);
      expect(savedContract.priceTotal).toBe(1500);
      expect(savedContract.priceAdvance).toBe(500);
      expect(savedContract.priceRest).toBe(1000);
      expect(savedContract.currency).toBe("RON");
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        id: "contract-1",
        token: savedContract.token,
      });
    });

    test("GET / serializes Firestore timestamps for admin listing", async () => {
      const { getList, orderByGetMock } = await loadContractsRouter();
      const res = createMockResponse();
      const createdAt = Timestamp.fromDate(new Date("2026-04-10T08:00:00.000Z"));
      const signedAt = Timestamp.fromDate(new Date("2026-04-11T09:30:00.000Z"));

      orderByGetMock.mockResolvedValue({
        docs: [
          {
            id: "contract-1",
            data: () => ({
              status: "signed",
              createdAt,
              signedAt,
              sentAt: null,
              clientEmail: "client@example.com",
            }),
          },
        ],
      });

      await getList({}, res);

      expect(res.json).toHaveBeenCalledWith({
        contracts: [
          {
            id: "contract-1",
            status: "signed",
            createdAt: "2026-04-10T08:00:00.000Z",
            signedAt: "2026-04-11T09:30:00.000Z",
            sentAt: null,
            clientEmail: "client@example.com",
          },
        ],
      });
    });

    test("GET /sign/:token hides sensitive fields from public payload", async () => {
      const { getPublicSign, whereGetMock } = await loadContractsRouter();
      const res = createMockResponse();

      whereGetMock.mockResolvedValue({
        empty: false,
        docs: [
          {
            id: "contract-1",
            data: () => ({
              status: "sent",
              createdAt: Timestamp.fromDate(new Date("2026-06-01T12:00:00.000Z")),
              eventType: "Botez",
              clientEmail: "secret@example.com",
              clientSignatureBase64: "data:image/png;base64,abc",
              clientIp: "127.0.0.1",
              pdfUrl: "https://example.com/contract.pdf",
            }),
          },
        ],
      });

      await getPublicSign({ params: { token: "abc" } }, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        id: "contract-1",
        status: "sent",
        eventType: "Botez",
        clientEmail: "secret@example.com",
        createdAt: "2026-06-01T12:00:00.000Z",
      }));
      // sensitive fields must be absent
      const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(payload).not.toHaveProperty("clientSignatureBase64");
      expect(payload).not.toHaveProperty("clientIp");
      expect(payload).not.toHaveProperty("pdfUrl");
    });

    test("POST /sign/:token signs the contract and starts PDF email delivery in background", async () => {
      const {
        postPublicSign,
        whereGetMock,
        updateMock,
        generateContractPDFMock,
        sendSignedContractEmailMock,
      } = await loadContractsRouter();
      const res = createMockResponse();

      whereGetMock.mockResolvedValue({
        empty: false,
        docs: [
          {
            id: "contract-1",
            data: () => ({
              token: "token-1",
              status: "sent",
              eventType: "Nunta",
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
          clientEmail: "client@example.com",
          clientAddress: "  Cluj  ",
          clientPhone: "  0712345678  ",
          clientIdSeries: "  AB123456  ",
          clientSignatureBase64: "data:image/png;base64,abc",
        },
      }, res);

      expect(updateMock).toHaveBeenCalledTimes(1);
      const [, updatePayload] = updateMock.mock.calls[0];
      expect(updatePayload).toMatchObject({
        status: "signed",
        clientName: "Ion Popescu",
        clientAddress: "Cluj",
        clientPhone: "0712345678",
        clientIdSeries: "AB123456",
        clientSignatureBase64: "data:image/png;base64,abc",
        clientIp: "10.0.0.1",
      });
      expect(updatePayload.signedAt).toBeInstanceOf(Timestamp);

      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        message: "Contractul a fost semnat cu succes!",
      });

      await flushPromises();

      expect(generateContractPDFMock).toHaveBeenCalledTimes(1);
      expect(sendSignedContractEmailMock).toHaveBeenCalledWith({
        to: "client@example.com",
        eventType: "Nunta",
        eventDate: "2026-09-12",
        clientName: "Ion Popescu",
        pdfUrl: "https://storage.example.com/contract.pdf",
        hasPdf: true,
      });
    });

    test("POST /:id/send updates status and uses APP_BASE_URL in the email link", async () => {
      process.env.APP_BASE_URL = "https://staging.ancavisuals.ro";
      const { postSend, docGetMock, updateMock, sendContractLinkEmailMock } = await loadContractsRouter();
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

      await postSend({ params: { id: "contract-1" } }, res);

      expect(updateMock).toHaveBeenCalledTimes(1);
      const [, updatePayload] = updateMock.mock.calls[0];
      expect(updatePayload.status).toBe("sent");
      expect(updatePayload.sentAt).toBeInstanceOf(Timestamp);

      expect(sendContractLinkEmailMock).toHaveBeenCalledWith({
        to: "client@example.com",
        token: "token-1",
        eventType: "Cununie",
        eventDate: "2026-08-01",
        baseUrl: "https://staging.ancavisuals.ro",
      });
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });

  describe("validation and guard paths", () => {
    test("POST / rejects missing mandatory fields", async () => {
      const { postCreate, addMock } = await loadContractsRouter();
      const res = createMockResponse();

      await postCreate({ body: { eventType: "Nunta" } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Câmpuri obligatorii: eventType, eventDate, clientEmail" });
      expect(addMock).not.toHaveBeenCalled();
    });

    test("POST /sign/:token validates CI format before touching Firestore", async () => {
      const { postPublicSign, whereGetMock } = await loadContractsRouter();
      const res = createMockResponse();

      await postPublicSign({
        params: { token: "abc" },
        body: {
          clientName: "Ion Popescu",
          clientEmail: "client@example.com",
          clientIdSeries: "ab12",
          clientSignatureBase64: "data:image/png;base64,abc",
        },
      }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Seria și numărul buletinului trebuie să fie în formatul AB123456.",
      });
      expect(whereGetMock).not.toHaveBeenCalled();
    });

    test("GET /sign/:token returns signed state for already signed contracts", async () => {
      const { getPublicSign, whereGetMock } = await loadContractsRouter();
      const res = createMockResponse();

      whereGetMock.mockResolvedValue({
        empty: false,
        docs: [
          {
            id: "contract-1",
            data: () => ({
              status: "signed",
            }),
          },
        ],
      });

      await getPublicSign({ params: { token: "signed-token" } }, res);

      expect(res.status).toHaveBeenCalledWith(410);
      expect(res.json).toHaveBeenCalledWith({
        error: "Contractul a fost deja semnat.",
        status: "signed",
        pdfUrl: null,
      });
    });

    test("POST /:id/send rejects contracts that are already signed", async () => {
      const { postSend, docGetMock, updateMock, sendContractLinkEmailMock } = await loadContractsRouter();
      const res = createMockResponse();

      docGetMock.mockResolvedValue({
        exists: true,
        data: () => ({
          status: "signed",
        }),
      });

      await postSend({ params: { id: "contract-1" } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Contractul a fost deja semnat." });
      expect(updateMock).not.toHaveBeenCalled();
      expect(sendContractLinkEmailMock).not.toHaveBeenCalled();
    });
  });
});
