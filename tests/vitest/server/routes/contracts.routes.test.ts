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
  const sendFullySignedContractEmailMock = vi.fn().mockResolvedValue(undefined);

  const eventsGetMock = vi.fn().mockResolvedValue({ docs: [] });
  const eventSetMock = vi.fn();
  const transactionContractMock = vi.fn();
  const runTransactionMock = vi.fn(async (callback: any) => {
    const writes: Array<() => void> = [];
    const result = await callback({
      get: async (ref: any) => {
        if (ref.collectionName === "adminEvents") return eventsGetMock();
        const fresh = transactionContractMock();
        if (fresh) return fresh;
        const snapshot = await whereGetMock();
        const contract = snapshot?.docs?.find((doc: any) => doc.id === ref.id);
        return contract ? { exists: true, data: contract.data } : docGetMock(ref.id);
      },
      set: (ref: any, payload: any, options: any) => writes.push(() => eventSetMock(ref.id, payload, options)),
      update: (ref: any, payload: any) => writes.push(() => updateMock(ref.id, payload)),
    });
    for (const write of writes) write();
    return result;
  });
  const collectionMock = vi.fn((collectionName: string) => ({
    collectionName,
    add: addMock,
    orderBy: vi.fn(() => ({
      get: orderByGetMock,
    })),
    where: vi.fn(() => ({
      limit: vi.fn(() => ({
        get: whereGetMock,
      })),
    })),
    doc: vi.fn((id: string = "new-event") => ({
      id,
      get: () => docGetMock(id),
      update: (payload: Record<string, unknown>) => updateMock(id, payload),
    })),
  }));

  vi.doMock("src/server/middleware/requireFirebaseAuth", () => ({
    requireFirebaseAuth: (_req: any, _res: any, next: () => void) => next(),
    requireSupremeAdmin: (_req: any, _res: any, next: () => void) => next(),
  }));

  vi.doMock("src/server/firestore", () => ({
    firestore: () => ({
      collection: collectionMock,
      runTransaction: runTransactionMock,
    }),
  }));

  vi.doMock("src/server/services/pdf.generator", () => ({
    generateContractPDF: generateContractPDFMock,
  }));

  vi.doMock("src/server/notifications/templates/contractEmail", () => ({
    sendContractLinkEmail: sendContractLinkEmailMock,
    sendSignedContractEmail: sendSignedContractEmailMock,
    sendFullySignedContractEmail: sendFullySignedContractEmailMock,
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

  const getHandler = (method: "get" | "post" | "patch", path: string): Handler => {
    const layer = router.stack.find((entry: any) => entry.route?.path === path && entry.route.methods?.[method]);
    if (!layer) {
      throw new Error(`Missing ${method.toUpperCase()} handler for ${path}`);
    }
    const stack = layer.route.stack;
    return stack[stack.length - 1].handle;
  };

  return {
    addMock,
    eventsGetMock,
    eventSetMock,
    transactionContractMock,
    runTransactionMock,
    orderByGetMock,
    whereGetMock,
    docGetMock,
    updateMock,
    generateContractPDFMock,
    sendContractLinkEmailMock,
    sendSignedContractEmailMock,
    sendFullySignedContractEmailMock,
    postPrestatorSign: getHandler("post", "/:id/prestator-sign"),
    postCreateEvent: getHandler("post", "/:id/create-event"),
    postCreate: getHandler("post", "/"),
    patchContract: getHandler("patch", "/:id"),
    getList: getHandler("get", "/"),
    getPublicSign: getHandler("get", "/sign/:token"),
    postPublicSign: getHandler("post", "/sign/:token"),
    postSend: getHandler("post", "/:id/send"),
    postResend: getHandler("post", "/:id/resend"),
  };
}

describe("contracts.routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    delete process.env.APP_BASE_URL;
  });

  describe("custom clause snapshots", () => {
    const clause = { templateId: "custom:1", key: "custom:1", title: "Ora de încheiere", body: "<p>Activitatea se încheie la ora 23:00.</p>", order: 10, groupKey: null };
    test("persists custom headings and text on create", async () => {
      const { postCreate, addMock } = await loadContractsRouter();
      addMock.mockResolvedValue({ id: "contract-1" });
      const res = createMockResponse();
      await postCreate({ body: { eventType: "Nunta", eventDate: "2026-09-12", clauses: [clause] } }, res);
      expect(addMock).toHaveBeenCalledWith(expect.objectContaining({ clauses: [clause] }));
      expect(res.status).toHaveBeenCalledWith(201);
    });
    test.each([{ ...clause, title: " " }, { ...clause, body: "<p>&nbsp;</p>" }])("rejects incomplete custom clauses on create", async (incomplete) => {
      const { postCreate, addMock } = await loadContractsRouter();
      const res = createMockResponse();
      await postCreate({ body: { eventType: "Nunta", eventDate: "2026-09-12", clauses: [incomplete] } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(addMock).not.toHaveBeenCalled();
    });
    test("preserves custom text on update and refuses incomplete edits", async () => {
      const { patchContract, docGetMock, updateMock } = await loadContractsRouter();
      docGetMock.mockResolvedValue({ exists: true, data: () => ({ status: "draft" }) });
      await patchContract({ params: { id: "c1" }, body: { clauses: [clause] } }, createMockResponse());
      expect(updateMock).toHaveBeenCalledWith("c1", expect.objectContaining({ clauses: [clause] }));
      updateMock.mockClear();
      const res = createMockResponse();
      await patchContract({ params: { id: "c1" }, body: { clauses: [{ ...clause, title: "" }] } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(updateMock).not.toHaveBeenCalled();
    });
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
        eventSetMock,
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
          nightEvent: "nu",
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
      expect(updatePayload.eventId).toBe("new-event");
      expect(eventSetMock).toHaveBeenCalledWith("new-event", expect.objectContaining({
        status: "confirmat", contractId: "contract-1", eventDates: ["2026-09-12"],
        client: { fullName: "Ion Popescu", phone: "0712345678", email: "client@example.com" },
      }), { merge: true });

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

    test("POST /sign/:token stores company details completed by the client", async () => {
      const { postPublicSign, whereGetMock, updateMock } = await loadContractsRouter();
      const res = createMockResponse();
      whereGetMock.mockResolvedValue({
        empty: false,
        docs: [{
          id: "company-contract",
          data: () => ({ token: "company-token", status: "draft", clientType: "PJ", eventType: "Nuntă", eventDate: "2026-09-12" }),
        }],
      });

      await postPublicSign({
        params: { token: "company-token" },
        ip: "10.0.0.1",
        headers: {},
        socket: { remoteAddress: "10.0.0.2" },
        body: {
          clientName: "Firma Client SRL",
          clientCIF: "ro12345678",
          clientEntityType: "Firma",
          clientRegistrationNumber: "J32/123/2020",
          clientAddress: "Strada Exemplu 1, Cluj",
          clientCity: "Cluj-Napoca",
          clientCounty: "Cluj",
          clientEmail: "client@example.com",
          clientPhone: "0712345678",
          clientBankName: "Raiffeisen Bank",
          clientIBAN: "ro49aaaa1b31007593840000",
          clientRepresentativeName: "Ion Popescu",
          clientRepresentativeRole: "administrator",
          clientRepresentativeIdSeries: "AB123456",
          clientSignatureBase64: "data:image/png;base64,abc",
          nightEvent: "nu",
        },
      }, res);

      const [, updatePayload] = updateMock.mock.calls[0];
      expect(updatePayload).toMatchObject({
        status: "signed",
        clientName: "Firma Client SRL",
        clientCIF: "RO12345678",
        clientEntityType: "Firma",
        clientRegistrationNumber: "J32/123/2020",
        clientAddress: "Strada Exemplu 1, Cluj",
        clientCity: "Cluj-Napoca",
        clientCounty: "Cluj",
        clientEmail: "client@example.com",
        clientBankName: "Raiffeisen Bank",
        clientIBAN: "RO49AAAA1B31007593840000",
        clientRepresentativeName: "Ion Popescu",
        clientRepresentativeRole: "administrator",
      });
      expect(res.json).toHaveBeenCalledWith({ ok: true, message: "Contractul a fost semnat cu succes!" });
    });

    test("POST /sign/:token rejects incomplete company details before signing", async () => {
      const { postPublicSign, whereGetMock, updateMock } = await loadContractsRouter();
      const res = createMockResponse();
      whereGetMock.mockResolvedValue({
        empty: false,
        docs: [{
          id: "company-contract",
          data: () => ({ token: "company-token", status: "draft", clientType: "PJ", eventType: "Nuntă", eventDate: "2026-09-12" }),
        }],
      });

      await postPublicSign({
        params: { token: "company-token" },
        ip: "10.0.0.1",
        headers: {},
        socket: { remoteAddress: "10.0.0.2" },
        body: {
          clientEmail: "client@example.com",
          clientRepresentativeName: "Ion Popescu",
          clientRepresentativeIdSeries: "AB123456",
          clientSignatureBase64: "data:image/png;base64,abc",
          nightEvent: "nu",
        },
      }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Denumirea entității este obligatorie." });
      expect(updateMock).not.toHaveBeenCalled();
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

  describe("calendar after client signing", () => {
    const body = {
      clientName: "Client Complet", clientEmail: "client@example.com", clientIdSeries: "AB123456",
      clientPhone: "0712345678", clientAddress: "Cluj", clientSignatureBase64: "data:image/png;base64,abc", nightEvent: "nu",
    };
    const request = { params: { token: "token" }, headers: {}, ip: "127.0.0.1", body };
    const contract = { status: "sent", eventType: "Nuntă", eventDate: "2027-05-01",
      eventDates: ["2027-05-01", "2027-05-03"], priceTotal: 1500, priceAdvance: 500, priceRest: 1000 };
    function snapshot(data: Record<string, unknown>) {
      return { empty: false, docs: [{ id: "contract-1", data: () => data }] };
    }

    test("creation and sending do not reserve the calendar", async () => {
      const { postCreate, postSend, addMock, docGetMock, eventSetMock, eventsGetMock } = await loadContractsRouter();
      addMock.mockResolvedValue({ id: "contract-1" });
      await postCreate({ body: contract }, createMockResponse());
      docGetMock.mockResolvedValue({ exists: true, data: () => ({ ...contract, clientEmail: body.clientEmail }) });
      await postSend({ params: { id: "contract-1" } }, createMockResponse());
      expect(eventSetMock).not.toHaveBeenCalled();
      expect(eventsGetMock).not.toHaveBeenCalled();
    });

    test.each(["draft", "sent", "anulat", "expired"])("manual calendar creation rejects %s contracts", async (status) => {
      const { postCreateEvent, docGetMock, eventSetMock, updateMock } = await loadContractsRouter();
      docGetMock.mockResolvedValue({ exists: true, data: () => ({ ...contract, status }) });
      const res = createMockResponse();
      await postCreateEvent({ params: { id: "contract-1" } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(eventSetMock).not.toHaveBeenCalled();
      expect(updateMock).not.toHaveBeenCalled();
    });

    test.each([
      { ...body, clientEmail: "" },
      { ...body, clientIdSeries: "" },
      { ...body, clientSignatureBase64: "" },
      { ...body, clientName: "" },
    ])("incomplete signing data cannot reserve the calendar", async (incompleteBody) => {
      const { postPublicSign, whereGetMock, eventSetMock, updateMock } = await loadContractsRouter();
      whereGetMock.mockResolvedValue(snapshot(contract));
      const res = createMockResponse();
      await postPublicSign({ ...request, body: incompleteBody }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(eventSetMock).not.toHaveBeenCalled();
      expect(updateMock).not.toHaveBeenCalled();
    });

    test.each([
      [{ ...body, nightEvent: undefined }, "Alegeți dacă evenimentul este de zi sau de noapte."],
      [{ ...body, nightEvent: "da" }, "Pentru un eveniment de noapte, completați ora estimată de final (între 00:00 și 08:00)."],
      [{ ...body, nightEvent: "da", nightEventEndTime: "21:00" }, "Pentru un eveniment de noapte, completați ora estimată de final (între 00:00 și 08:00)."],
    ])("signing requires the day/night declaration", async (nightBody, error) => {
      const { postPublicSign, whereGetMock, updateMock } = await loadContractsRouter();
      whereGetMock.mockResolvedValue(snapshot(contract));
      const res = createMockResponse();
      await postPublicSign({ ...request, body: nightBody }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error });
      expect(updateMock).not.toHaveBeenCalled();
    });

    test("a night event stores the declared end time", async () => {
      const { postPublicSign, whereGetMock, updateMock } = await loadContractsRouter();
      whereGetMock.mockResolvedValue(snapshot(contract));
      await postPublicSign({ ...request, body: { ...body, nightEvent: "da", nightEventEndTime: "02:30" } }, createMockResponse());
      const [, payload] = updateMock.mock.calls[0];
      expect(payload).toMatchObject({ nightEvent: "da", nightEventEndTime: "02:30" });
      expect(payload.nightEventDeclaredAt).toBeInstanceOf(Timestamp);
    });

    test("event types without a night question sign without it", async () => {
      const { postPublicSign, whereGetMock, updateMock } = await loadContractsRouter();
      whereGetMock.mockResolvedValue(snapshot({ ...contract, eventType: "Ședință foto" }));
      await postPublicSign({ ...request, body: { ...body, nightEvent: undefined } }, createMockResponse());
      const [, payload] = updateMock.mock.calls[0];
      expect(payload).not.toHaveProperty("nightEvent");
    });

    test("manual creation remains available for old signed contracts without an event", async () => {
      const { postCreateEvent, docGetMock, eventSetMock } = await loadContractsRouter();
      docGetMock.mockResolvedValue({ exists: true, data: () => ({ ...contract, ...body, status: "signed" }) });
      const res = createMockResponse();
      await postCreateEvent({ params: { id: "contract-1" } }, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(eventSetMock).toHaveBeenCalledTimes(1);
    });

    test("signing reserves all exact dates and does not imply the advance was paid", async () => {
      const { postPublicSign, whereGetMock, eventSetMock } = await loadContractsRouter();
      whereGetMock.mockResolvedValue(snapshot(contract));
      await postPublicSign(request, createMockResponse());
      expect(eventSetMock).toHaveBeenCalledWith("new-event", expect.objectContaining({
        eventDates: ["2027-05-01", "2027-05-03"], eventEndDate: "2027-05-03",
        pricing: { total: 1500, advanceAmount: 500, advancePaid: false, remainingAmount: 1000 },
      }), { merge: true });
    });

    test("signing updates a linked lead without duplicating it or losing payment information", async () => {
      const { postPublicSign, whereGetMock, eventsGetMock, eventSetMock, updateMock } = await loadContractsRouter();
      whereGetMock.mockResolvedValue(snapshot({ ...contract, eventId: "lead-1" }));
      eventsGetMock.mockResolvedValue({ docs: [{ id: "lead-1", ref: { id: "lead-1" },
        data: () => ({ status: "tentativ", pricing: { advancePaid: true }, notes: "Notă existentă" }) }] });
      await postPublicSign(request, createMockResponse());
      expect(eventSetMock).toHaveBeenCalledWith("lead-1", expect.objectContaining({
        status: "confirmat", client: expect.objectContaining({ fullName: "Client Complet" }),
        pricing: expect.objectContaining({ advancePaid: true }), notes: "Notă existentă",
      }), { merge: true });
      expect(updateMock.mock.calls[0][1].eventId).toBe("lead-1");
    });

    test("a conflict on any contract date saves neither signature nor event", async () => {
      const { postPublicSign, whereGetMock, eventsGetMock, eventSetMock, updateMock } = await loadContractsRouter();
      whereGetMock.mockResolvedValue(snapshot(contract));
      eventsGetMock.mockResolvedValue({ docs: [{ id: "other-event", data: () => ({ status: "confirmat", eventDate: "2027-05-03" }) }] });
      const res = createMockResponse();
      await postPublicSign(request, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(eventSetMock).not.toHaveBeenCalled();
      expect(updateMock).not.toHaveBeenCalled();
    });

    test("a concurrent signature cannot create a second event", async () => {
      const { postPublicSign, whereGetMock, transactionContractMock, eventSetMock, updateMock } = await loadContractsRouter();
      whereGetMock.mockResolvedValue(snapshot(contract));
      transactionContractMock.mockReturnValue({ exists: true, data: () => ({ ...contract, status: "signed", eventId: "existing" }) });
      const res = createMockResponse();
      await postPublicSign(request, res);
      expect(res.status).toHaveBeenCalledWith(410);
      expect(eventSetMock).not.toHaveBeenCalled();
      expect(updateMock).not.toHaveBeenCalled();
    });

    test("a failed transaction saves neither signature nor event", async () => {
      const { postPublicSign, whereGetMock, runTransactionMock, eventSetMock, updateMock } = await loadContractsRouter();
      whereGetMock.mockResolvedValue(snapshot(contract));
      runTransactionMock.mockRejectedValue(new Error("Firestore unavailable"));
      const res = createMockResponse();
      await postPublicSign(request, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(eventSetMock).not.toHaveBeenCalled();
      expect(updateMock).not.toHaveBeenCalled();
    });
  });

  describe("validation and guard paths", () => {
    test("POST / rejects missing mandatory fields", async () => {
      const { postCreate, addMock } = await loadContractsRouter();
      const res = createMockResponse();

      await postCreate({ body: { eventType: "Nunta" } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Câmpuri obligatorii: eventType, eventDate" });
      expect(addMock).not.toHaveBeenCalled();
    });

    test("POST / saves a draft without client email", async () => {
      const { postCreate, addMock } = await loadContractsRouter();
      const res = createMockResponse();
      addMock.mockResolvedValue({ id: "contract-draft" });

      await postCreate({ body: { eventType: "Nuntă", eventDate: "2026-09-12", clientType: "PJ" } }, res);

      expect(addMock).toHaveBeenCalledTimes(1);
      expect(addMock.mock.calls[0][0]).toMatchObject({
        status: "draft", clientType: "PJ", clientEmail: "", clientName: "", clientCIF: "", clientAddress: "",
      });
      expect(res.status).toHaveBeenCalledWith(201);
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
          nightEvent: "nu",
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

    test("POST /:id/resend responds immediately and triggers PDF email in background for signed contracts", async () => {
      const { postResend, docGetMock, generateContractPDFMock, sendSignedContractEmailMock } = await loadContractsRouter();
      const res = createMockResponse();

      docGetMock.mockResolvedValue({
        exists: true,
        data: () => ({
          status: "signed",
          clientEmail: "client@example.com",
          eventType: "Nunta",
          eventDate: "2026-09-12",
          clientName: "Ion Popescu",
          token: "token-1",
        }),
      });

      await postResend({ params: { id: "contract-1" } }, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });

      await flushPromises();

      expect(generateContractPDFMock).toHaveBeenCalledTimes(1);
      expect(sendSignedContractEmailMock).toHaveBeenCalledTimes(1);
      expect(sendSignedContractEmailMock).toHaveBeenCalledWith(expect.objectContaining({
        to: "client@example.com",
        eventType: "Nunta",
        clientName: "Ion Popescu",
      }));
    });

    test("provider signing after the client emails the client the final contract", async () => {
      const { postPrestatorSign, docGetMock, generateContractPDFMock, sendFullySignedContractEmailMock } = await loadContractsRouter();
      const res = createMockResponse();
      docGetMock.mockResolvedValue({ exists: true, data: () => ({
        status: "signed", clientEmail: "client@example.com", eventType: "Nuntă", eventDate: "2026-09-12", clientName: "Ion Popescu", token: "token-1",
      }) });

      await postPrestatorSign({ params: { id: "contract-1" }, body: { prestatorSignatureBase64: "data:image/png;base64,me" } }, res);
      expect(res.json).toHaveBeenCalledWith({ ok: true, clientNotified: true });

      await flushPromises();
      expect(generateContractPDFMock).toHaveBeenCalledWith(expect.objectContaining({ prestatorSignatureBase64: "data:image/png;base64,me" }));
      expect(sendFullySignedContractEmailMock).toHaveBeenCalledWith(expect.objectContaining({
        to: "client@example.com", eventType: "Nuntă", clientName: "Ion Popescu", hasPdf: true,
      }));
    });

    test.each([
      ["the client has not signed yet", { status: "sent", clientEmail: "client@example.com" }],
      ["the provider had already signed before", { status: "signed", clientEmail: "client@example.com", prestatorSignatureBase64: "data:image/png;base64,old" }],
    ])("provider signing does not email the client when %s", async (_label, data) => {
      const { postPrestatorSign, docGetMock, sendFullySignedContractEmailMock } = await loadContractsRouter();
      const res = createMockResponse();
      docGetMock.mockResolvedValue({ exists: true, data: () => ({ eventType: "Nuntă", eventDate: "2026-09-12", ...data }) });

      await postPrestatorSign({ params: { id: "contract-1" }, body: { prestatorSignatureBase64: "data:image/png;base64,me" } }, res);
      await flushPromises();

      expect(res.json).toHaveBeenCalledWith({ ok: true, clientNotified: false });
      expect(sendFullySignedContractEmailMock).not.toHaveBeenCalled();
    });

    test("POST /:id/resend rejects unsigned contracts", async () => {
      const { postResend, docGetMock } = await loadContractsRouter();
      const res = createMockResponse();

      docGetMock.mockResolvedValue({
        exists: true,
        data: () => ({ status: "sent", clientEmail: "client@example.com" }),
      });

      await postResend({ params: { id: "contract-1" } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Contractul nu este semnat." });
    });

    test("POST /:id/resend returns 404 for unknown contract", async () => {
      const { postResend, docGetMock } = await loadContractsRouter();
      const res = createMockResponse();

      docGetMock.mockResolvedValue({ exists: false });

      await postResend({ params: { id: "unknown" } }, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Contract negăsit." });
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

    test("POST /:id/send refuses to send when the draft has no client email", async () => {
      const { postSend, docGetMock, updateMock, sendContractLinkEmailMock } = await loadContractsRouter();
      const res = createMockResponse();
      docGetMock.mockResolvedValue({ exists: true, data: () => ({ status: "draft", clientEmail: "" }) });

      await postSend({ params: { id: "contract-1" } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(updateMock).not.toHaveBeenCalled();
      expect(sendContractLinkEmailMock).not.toHaveBeenCalled();
    });
  });
});
