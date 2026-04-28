/*
 * Purpose: verifies the monitoring route flows — client error ingestion,
 * error listing, unseen count, and mark-seen — without touching Firestore.
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

async function loadMonitoringRouter() {
  const addMock = vi.fn().mockResolvedValue({ id: "err-1" });
  const countGetMock = vi.fn();
  const whereMock = vi.fn();
  const orderByMock = vi.fn();
  const batchUpdateMock = vi.fn();
  const batchCommitMock = vi.fn().mockResolvedValue(undefined);

  const batchMock = {
    update: batchUpdateMock,
    commit: batchCommitMock,
  };

  const collectionMock = vi.fn(() => ({
    add: addMock,
    orderBy: vi.fn(() => ({
      limit: vi.fn(() => ({
        get: orderByMock,
      })),
    })),
    where: vi.fn(() => ({
      count: vi.fn(() => ({ get: countGetMock })),
      get: whereMock,
      orderBy: vi.fn(() => ({
        limit: vi.fn(() => ({
          get: whereMock,
        })),
      })),
    })),
  }));

  vi.doMock("src/server/firestore", () => ({
    firestore: () => ({
      collection: collectionMock,
      batch: () => batchMock,
    }),
  }));

  vi.doMock("src/server/monitoring/serverMonitor", () => ({
    captureClientError: vi.fn(),
    ERRORS_COLLECTION: "serverErrors",
  }));

  vi.doMock("src/server/utils/ipinfo", () => ({
    getClientIp: vi.fn().mockReturnValue(""),
    fetchIpInfo: vi.fn().mockResolvedValue(null),
  }));

  vi.doMock("src/server/middleware/requireFirebaseAuth", () => ({
    requireFirebaseAuth: (_req: any, _res: any, next: any) => next(),
    requireSupremeAdmin: (_req: any, _res: any, next: any) => next(),
  }));

  vi.doMock("firebase-admin/firestore", () => ({
    Timestamp: {
      fromDate: (d: Date) => ({ toDate: () => d }),
    },
  }));

  const module = await import("src/server/routes/monitoring.routes");
  const router = module.default as any;

  const getHandler = (method: "get" | "post" | "patch", path: string): Handler => {
    const layer = router.stack.find(
      (entry: any) => entry.route?.path === path && entry.route.methods?.[method]
    );
    if (!layer) throw new Error(`Missing ${method.toUpperCase()} handler for ${path}`);
    return layer.route.stack[layer.route.stack.length - 1].handle;
  };

  return {
    addMock,
    countGetMock,
    whereMock,
    orderByMock,
    batchUpdateMock,
    batchCommitMock,
    captureClientError: (await import("src/server/monitoring/serverMonitor")).captureClientError as ReturnType<typeof vi.fn>,
    postClientError: getHandler("post", "/client-error"),
    getErrors: getHandler("get", "/errors"),
    getUnseenCount: getHandler("get", "/errors/unseen-count"),
    patchMarkSeen: getHandler("patch", "/errors/mark-seen"),
  };
}

describe("monitoring.routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  describe("POST /client-error", () => {
    test("forwards valid error to captureClientError", async () => {
      const { postClientError, captureClientError } = await loadMonitoringRouter();
      const res = createMockResponse();

      await postClientError({
        body: { message: "TypeError: Cannot read property", stack: "at App.tsx:42", page: "/gallery" },
      }, res);

      expect(captureClientError).toHaveBeenCalledWith(
        "TypeError: Cannot read property",
        "at App.tsx:42",
        "/gallery",
        undefined,
        undefined,
      );
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test("silently ignores chrome extension errors", async () => {
      const { postClientError, captureClientError } = await loadMonitoringRouter();
      const res = createMockResponse();

      await postClientError({
        body: {
          message: "Script error.",
          stack: "at chrome-extension://abc123/content.js:10",
          page: "/",
        },
      }, res);

      expect(captureClientError).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ ok: true, ignored: true });
    });

    test("silently ignores firefox extension errors", async () => {
      const { postClientError, captureClientError } = await loadMonitoringRouter();
      const res = createMockResponse();

      await postClientError({
        body: {
          message: "Extension context invalidated",
          stack: "at moz-extension://xyz/bg.js:5",
          page: "/",
        },
      }, res);

      expect(captureClientError).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ ok: true, ignored: true });
    });

    test("rejects payload without message", async () => {
      const { postClientError, captureClientError } = await loadMonitoringRouter();
      const res = createMockResponse();

      await postClientError({ body: { stack: "somewhere" } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(captureClientError).not.toHaveBeenCalled();
    });
  });

  describe("GET /errors", () => {
    test("returns serialized errors from Firestore ordered by date desc", async () => {
      const { getErrors, orderByMock } = await loadMonitoringRouter();
      const res = createMockResponse();
      const capturedAt = Timestamp.fromDate(new Date("2026-04-20T10:00:00.000Z"));

      orderByMock.mockResolvedValue({
        docs: [
          {
            id: "err-1",
            data: () => ({
              message: "ReferenceError: foo is not defined",
              stack: "at index.tsx:10",
              source: "client",
              severity: "error",
              page: "/gallery",
              seen: false,
              capturedAt,
            }),
          },
        ],
      });

      await getErrors({}, res);

      expect(res.json).toHaveBeenCalledWith({
        errors: [
          {
            id: "err-1",
            message: "ReferenceError: foo is not defined",
            stack: "at index.tsx:10",
            source: "client",
            severity: "error",
            page: "/gallery",
            seen: false,
            ip: null,
            geo: null,
            capturedAt: new Date("2026-04-20T10:00:00.000Z").toISOString(),
          },
        ],
      });
    });

    test("handles null capturedAt gracefully", async () => {
      const { getErrors, orderByMock } = await loadMonitoringRouter();
      const res = createMockResponse();

      orderByMock.mockResolvedValue({
        docs: [
          {
            id: "err-2",
            data: () => ({
              message: "Something failed",
              stack: "",
              source: "server",
              severity: "warn",
              page: "",
              seen: true,
              capturedAt: null,
            }),
          },
        ],
      });

      await getErrors({}, res);

      const result = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(result.errors[0].capturedAt).toBeNull();
    });
  });

  describe("GET /errors/unseen-count", () => {
    test("returns count of unseen errors", async () => {
      const { getUnseenCount, countGetMock } = await loadMonitoringRouter();
      const res = createMockResponse();

      countGetMock.mockResolvedValue({ data: () => ({ count: 7 }) });

      await getUnseenCount({}, res);

      expect(res.json).toHaveBeenCalledWith({ count: 7 });
    });

    test("returns 0 when no unseen errors", async () => {
      const { getUnseenCount, countGetMock } = await loadMonitoringRouter();
      const res = createMockResponse();

      countGetMock.mockResolvedValue({ data: () => ({ count: 0 }) });

      await getUnseenCount({}, res);

      expect(res.json).toHaveBeenCalledWith({ count: 0 });
    });
  });

  describe("PATCH /errors/mark-seen", () => {
    test("marks all unseen errors as seen via batch", async () => {
      const { patchMarkSeen, whereMock, batchUpdateMock, batchCommitMock } = await loadMonitoringRouter();
      const res = createMockResponse();
      const refMock = { id: "err-1" };

      whereMock.mockResolvedValue({
        empty: false,
        size: 3,
        docs: [
          { ref: refMock },
          { ref: refMock },
          { ref: refMock },
        ],
      });

      await patchMarkSeen({}, res);

      expect(batchUpdateMock).toHaveBeenCalledTimes(3);
      expect(batchUpdateMock).toHaveBeenCalledWith(refMock, { seen: true });
      expect(batchCommitMock).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith({ updated: 3 });
    });

    test("returns 0 when there are no unseen errors", async () => {
      const { patchMarkSeen, whereMock, batchCommitMock } = await loadMonitoringRouter();
      const res = createMockResponse();

      whereMock.mockResolvedValue({ empty: true, size: 0, docs: [] });

      await patchMarkSeen({}, res);

      expect(batchCommitMock).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ updated: 0 });
    });
  });
});
