/*
 * Purpose: verifies the instagram proposals route flows — propose a photo,
 * list by album, update status, and delete — without touching Firestore.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

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

async function loadInstagramProposalsRouter() {
  const addMock = vi.fn().mockResolvedValue({ id: "prop-1" });
  const getMock = vi.fn();
  const updateMock = vi.fn().mockResolvedValue(undefined);
  const deleteMock = vi.fn().mockResolvedValue(undefined);
  const docGetMock = vi.fn().mockResolvedValue({
    exists: true,
    data: () => ({ destinations: ["instagram"], mediaAssetServiceIds: [] }),
  });
  const docMock = vi.fn(() => ({ update: updateMock, delete: deleteMock, get: docGetMock }));

  const whereMock = vi.fn();

  const collectionMock = vi.fn(() => ({
    add: addMock,
    doc: docMock,
    where: vi.fn(() => ({
      where: vi.fn(() => ({
        where: vi.fn(() => ({
          get: getMock,
        })),
      })),
      orderBy: vi.fn(() => ({
        get: whereMock,
      })),
    })),
  }));

  vi.doMock("src/server/firestore", () => ({
    firestore: () => ({ collection: collectionMock }),
  }));

  vi.doMock("src/server/middleware/requireFirebaseAuth", () => ({
    requireFirebaseAuth: (req: any, _res: any, next: any) => {
      req.firebaseUid = "uid-123";
      req.firebaseEmail = "user@test.com";
      next();
    },
    requireSupremeAdmin: (_req: any, _res: any, next: any) => next(),
    requireEsteraOrAdmin: (_req: any, _res: any, next: any) => next(),
  }));

  vi.doMock("firebase-admin/firestore", () => ({
    Timestamp: {
      now: () => ({ toDate: () => new Date("2026-04-28T10:00:00.000Z") }),
      fromDate: (d: Date) => ({ toDate: () => d }),
    },
  }));

  const module = await import("src/server/routes/instagramProposals.routes");
  const router = module.default as any;

  const getHandler = (method: "get" | "post" | "patch" | "delete", path: string): Handler => {
    const layer = router.stack.find(
      (entry: any) => entry.route?.path === path && entry.route.methods?.[method],
    );
    if (!layer) throw new Error(`Missing ${method.toUpperCase()} handler for ${path}`);
    return layer.route.stack[layer.route.stack.length - 1].handle;
  };

  return {
    addMock,
    getMock,
    updateMock,
    deleteMock,
    docMock,
    docGetMock,
    whereMock,
    postProposal: getHandler("post", "/"),
    getByAlbum: getHandler("get", "/album/:slug"),
    patchStatus: getHandler("patch", "/:id"),
    deleteProposal: getHandler("delete", "/:id"),
  };
}

describe("instagramProposals.routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  describe("POST /", () => {
    test("creates a new proposal and returns 201", async () => {
      const { postProposal, addMock, getMock } = await loadInstagramProposalsRouter();
      const res = createMockResponse();

      getMock.mockResolvedValue({ empty: true });

      await postProposal(
        {
          firebaseUid: "uid-123",
          firebaseEmail: "user@test.com",
          body: { albumSlug: "nunta-ion", photoUrl: "https://cdn.example.com/photo.jpg", fileName: "photo.jpg" },
        },
        res,
      );

      expect(addMock).toHaveBeenCalledWith(
        expect.objectContaining({
          albumSlug: "nunta-ion",
          photoUrl: "https://cdn.example.com/photo.jpg",
          fileName: "photo.jpg",
          proposedBy: "user@test.com",
          proposedByUid: "uid-123",
          status: "pending",
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ ok: true, id: "prop-1" });
    });

    test("returns existing proposal id when already proposed", async () => {
      const { postProposal, addMock, getMock } = await loadInstagramProposalsRouter();
      const res = createMockResponse();

      getMock.mockResolvedValue({
        empty: false,
        docs: [{
          id: "prop-existing",
          data: () => ({ destinations: ["instagram"], mediaAssetServiceIds: [] }),
          ref: { update: vi.fn().mockResolvedValue(undefined) },
        }],
      });

      await postProposal(
        {
          firebaseUid: "uid-123",
          firebaseEmail: "user@test.com",
          body: { albumSlug: "nunta-ion", photoUrl: "https://cdn.example.com/photo.jpg", fileName: "photo.jpg" },
        },
        res,
      );

      expect(addMock).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        id: "prop-existing",
        alreadyProposed: true,
        destinations: ["instagram"],
        mediaAssetServiceIds: [],
      });
    });

    test("rejects payload missing required fields", async () => {
      const { postProposal, addMock } = await loadInstagramProposalsRouter();
      const res = createMockResponse();

      await postProposal(
        {
          firebaseUid: "uid-123",
          firebaseEmail: "user@test.com",
          body: { albumSlug: "nunta-ion" },
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(addMock).not.toHaveBeenCalled();
    });
  });

  describe("GET /album/:slug", () => {
    test("returns proposals ordered by date desc", async () => {
      const { getByAlbum, whereMock } = await loadInstagramProposalsRouter();
      const res = createMockResponse();

      whereMock.mockResolvedValue({
        docs: [
          {
            id: "prop-1",
            data: () => ({
              albumSlug: "nunta-ion",
              photoUrl: "https://cdn.example.com/a.jpg",
              fileName: "a.jpg",
              proposedBy: "user@test.com",
              proposedByUid: "uid-123",
              status: "pending",
              proposedAt: { toDate: () => new Date("2026-04-28T10:00:00.000Z") },
            }),
          },
        ],
      });

      await getByAlbum({ params: { slug: "nunta-ion" } }, res);

      expect(res.json).toHaveBeenCalledWith({
        proposals: [
          expect.objectContaining({
            id: "prop-1",
            albumSlug: "nunta-ion",
            status: "pending",
            proposedAt: new Date("2026-04-28T10:00:00.000Z").toISOString(),
          }),
        ],
      });
    });

    test("returns empty array when no proposals exist", async () => {
      const { getByAlbum, whereMock } = await loadInstagramProposalsRouter();
      const res = createMockResponse();

      whereMock.mockResolvedValue({ docs: [] });

      await getByAlbum({ params: { slug: "nunta-fara-propuneri" } }, res);

      expect(res.json).toHaveBeenCalledWith({ proposals: [] });
    });
  });

  describe("PATCH /:id", () => {
    test("updates status to accepted", async () => {
      const { patchStatus, updateMock, docMock } = await loadInstagramProposalsRouter();
      const res = createMockResponse();

      await patchStatus({ params: { id: "prop-1" }, body: { status: "accepted" } }, res);

      expect(docMock).toHaveBeenCalledWith("prop-1");
      expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "accepted" }));
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test("updates status to rejected", async () => {
      const { patchStatus, updateMock } = await loadInstagramProposalsRouter();
      const res = createMockResponse();

      await patchStatus({ params: { id: "prop-2" }, body: { status: "rejected" } }, res);

      expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "rejected" }));
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test("rejects invalid status value", async () => {
      const { patchStatus, updateMock } = await loadInstagramProposalsRouter();
      const res = createMockResponse();

      await patchStatus({ params: { id: "prop-1" }, body: { status: "approved" } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(updateMock).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /:id", () => {
    test("deletes the proposal document", async () => {
      const { deleteProposal, deleteMock, docMock } = await loadInstagramProposalsRouter();
      const res = createMockResponse();

      await deleteProposal({ params: { id: "prop-1" } }, res);

      expect(docMock).toHaveBeenCalledWith("prop-1");
      expect(deleteMock).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });
});
