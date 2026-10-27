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
      get: whereMock,
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

  // Profiles: the built-in defaults (Daniel, Estera, Salomeea), nothing saved in Firestore.
  vi.doMock("src/server/services/photoReviewers.service", async () => {
    const { PHOTO_REVIEWERS } = await import("src/shared/media/proposalConsensus");
    return { listPhotoReviewers: async () => [...PHOTO_REVIEWERS], albumCoverage: () => ({ total: 0, seen: {} }) };
  });
  vi.doMock("src/server/services/album.service", () => ({ loadAlbum: async () => null }));

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

    test("authenticated reviewer identity comes from the account, ignoring the request body", async () => {
      const { postProposal, addMock, getMock } = await loadInstagramProposalsRouter();
      getMock.mockResolvedValue({ empty: true });
      await postProposal({ firebaseUid: "daniel-uid", firebaseEmail: "ancadaniel1994@gmail.com",
        body: { albumSlug: "album", photoUrl: "https://cdn.test/photo.jpg", fileName: "photo.jpg", reviewerId: "salomeea", destinations: ["instagram", "media_assets"], mediaAssetServiceIds: ["photo"] },
      }, createMockResponse());
      expect(addMock).toHaveBeenCalledWith(expect.objectContaining({ reviewerId: "daniel", selectionDestinations: ["instagram", "media_assets"] }));
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
          { id: "older", data: () => ({ proposedAt: { toDate: () => new Date("2026-04-27T10:00:00.000Z") } }) },
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
          expect.objectContaining({ id: "older" }),
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

    test("accepting a photo for a different destination preserves the reviewer's original vote", async () => {
      const { patchStatus, docGetMock, updateMock } = await loadInstagramProposalsRouter();
      docGetMock.mockResolvedValue({ exists: true, data: () => ({ destinations: ["media_assets"], selectionDestinations: ["instagram"], mediaAssetServiceIds: [] }) });
      await patchStatus({ params: { id: "prop-1" }, body: { status: "accepted", destinations: ["instagram"] } }, createMockResponse());
      expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ selectionDestinations: ["instagram"], destinations: ["instagram"] }));
    });

    test("accepting another person's vote reuses an existing Media Asset for the same photo and service", async () => {
      const { patchStatus, docGetMock, whereMock, addMock, updateMock } = await loadInstagramProposalsRouter();
      docGetMock.mockResolvedValue({ exists: true, data: () => ({ albumSlug: "album", fileName: "IMG_1.jpg", photoUrl: "https://cdn.test/album/photos/IMG_1.jpg?token=new", destinations: ["media_assets"], mediaAssetServiceIds: ["photo"] }) });
      whereMock.mockResolvedValue({ docs: [{ id: "asset-existing", data: () => ({ serviceId: "photo", sourcePhotoUrl: "https://cdn.test/album/photos_preview/IMG_1.webp?token=old" }) }] });
      const res = createMockResponse();
      await patchStatus({ params: { id: "estera-vote" }, body: { status: "accepted" } }, res);
      expect(addMock).not.toHaveBeenCalled();
      expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ mediaAssetIds: ["asset-existing"] }));
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test("a Bunny upload refused with 400 is retried and the import still succeeds", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.doMock("src/server/utils/downloadBunnyOriginal", () => ({ downloadBunnyOriginal: async () => ({ buffer: Buffer.from("jpg"), contentType: "image/jpeg" }) }));
      vi.doMock("src/server/utils/mediaAssetPreview", () => ({ createMediaAssetPreview: async () => ({}) }));
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 400, text: async () => '{"HttpCode":400,"Message":"Unable to upload file: "}' })
        .mockResolvedValueOnce({ ok: true, status: 201, text: async () => "" });
      vi.stubGlobal("fetch", fetchMock);
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const { patchStatus, docGetMock, whereMock, addMock, updateMock } = await loadInstagramProposalsRouter();
      docGetMock.mockResolvedValue({ exists: true, data: () => ({ albumSlug: "album", fileName: "IMG_1.jpg", photoUrl: "https://cdn.test/album/photos/IMG_1.jpg", destinations: ["media_assets"], mediaAssetServiceIds: ["photo"] }) });
      whereMock.mockResolvedValue({ docs: [] });
      addMock.mockResolvedValue({ id: "asset-new" });
      const res = createMockResponse();

      await patchStatus({ params: { id: "vote-1" }, body: { status: "accepted" } }, res);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "accepted", mediaAssetIds: ["asset-new"] }));
      expect(res.json).toHaveBeenCalledWith({ ok: true });
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    test("at most two Media Assets imports run at once; the rest wait their turn", async () => {
      const { withImportSlot } = await import("src/server/routes/instagramProposals.routes");
      let running = 0;
      let peak = 0;
      const releases: Array<() => void> = [];
      const task = () => withImportSlot(async () => {
        running++;
        peak = Math.max(peak, running);
        await new Promise<void>((resolve) => releases.push(resolve));
        running--;
      });
      const all = Promise.all([task(), task(), task(), task()]);
      await vi.waitFor(() => expect(releases).toHaveLength(2));
      while (releases.length) { releases.shift()!(); await new Promise((r) => setTimeout(r, 0)); }
      await vi.waitFor(() => expect(running).toBe(0));
      await all;
      expect(peak).toBe(2);
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
