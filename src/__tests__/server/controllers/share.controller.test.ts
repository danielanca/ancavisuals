// @ts-nocheck
/*
 * Purpose: verifies share controller validation, expiry handling and zip creation
 * while isolating Bunny and persistence dependencies behind mocks.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const createMockResponse = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
    setHeader: vi.fn(),
  };

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.send.mockReturnValue(res);

  return res;
};

const loadShareController = async () => {
  const createShareRecordMock = vi.fn();
  const readShareRecordMock = vi.fn();
  const signBunnyUrlMock = vi.fn((path: string) => `signed:${path}`);
  const buildBunnyStorageUrlMock = vi.fn((...segments: string[]) => `https://storage.test/${segments.join("/")}`);
  const archiveAppendMock = vi.fn();
  const archiveFinalizeMock = vi.fn().mockResolvedValue(undefined);
  const archivePipeMock = vi.fn();
  const archiverMock = vi.fn(() => ({
    append: archiveAppendMock,
    finalize: archiveFinalizeMock,
    pipe: archivePipeMock,
  }));

  vi.doMock("../../../server/services/share.store", () => ({
    createShareRecord: createShareRecordMock,
    readShareRecord: readShareRecordMock,
  }));

  vi.doMock("../../../server/utils/signBunnyUrl", () => ({
    signBunnyUrl: signBunnyUrlMock,
  }));

  vi.doMock("../../../server/constants/bunny", () => ({
    BUNNY_ACCESS_KEY_HEADER: "AccessKey",
    BUNNY_IMAGE_FILE_PATTERN: /\.(jpg|jpeg|png|webp)$/i,
    BUNNY_PHOTOS_FOLDER: "photos",
    ZIP_COMPRESSION_STANDARD: 6,
    buildBunnyStorageUrl: buildBunnyStorageUrlMock,
    getBunnyStorageKey: () => "storage-key",
  }));

  vi.doMock("archiver", () => ({
    default: archiverMock,
  }));

  const module = await import("../../../server/controllers/share.controller");

  return {
    module,
    createShareRecordMock,
    readShareRecordMock,
    signBunnyUrlMock,
    buildBunnyStorageUrlMock,
    archiverMock,
    archiveAppendMock,
    archiveFinalizeMock,
    archivePipeMock,
  };
};

describe("share.controller", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-11T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  test("createShare rejects requests without a slug", async () => {
    const { module, createShareRecordMock } = await loadShareController();
    const res = createMockResponse();

    await module.createShare({ body: { items: ["a.jpg"] } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "missing_slug" });
    expect(createShareRecordMock).not.toHaveBeenCalled();
  });

  test("createShare rejects when all provided files are unsafe", async () => {
    const { module, createShareRecordMock } = await loadShareController();
    const res = createMockResponse();

    await module.createShare(
      { body: { slug: "event-1", items: ["../secret.jpg", "nested/a.jpg", "malware.exe"] } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "no_files" });
    expect(createShareRecordMock).not.toHaveBeenCalled();
  });

  test("createShare deduplicates safe files before persisting", async () => {
    const { module, createShareRecordMock } = await loadShareController();
    const res = createMockResponse();
    createShareRecordMock.mockResolvedValue({
      id: "share-1",
      slug: "event-2",
      items: ["a.jpg", "b.webp"],
      expiresAt: 123456,
    });

    await module.createShare(
      { body: { slug: "event-2", items: ["a.jpg", "a.jpg", "bad.exe", "b.webp", "folder/b.jpg"] } },
      res,
    );

    expect(createShareRecordMock).toHaveBeenCalledWith("event-2", ["a.jpg", "b.webp"], 7);
    expect(res.json).toHaveBeenCalledWith({ id: "share-1", expiresAt: 123456, count: 2 });
  });

  test("createShare rejects more than 200 safe files", async () => {
    const { module, createShareRecordMock } = await loadShareController();
    const res = createMockResponse();
    const files = Array.from({ length: 201 }, (_, index) => `file-${index}.jpg`);

    await module.createShare({ body: { slug: "event-3", items: files } }, res);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ error: "too_many_files" });
    expect(createShareRecordMock).not.toHaveBeenCalled();
  });

  test("getShare returns signed photo urls for active shares", async () => {
    const { module, readShareRecordMock, signBunnyUrlMock } = await loadShareController();
    const res = createMockResponse();
    readShareRecordMock.mockResolvedValue({
      id: "share-2",
      slug: "event-4",
      items: ["a.jpg", "b.png"],
      expiresAt: Date.now() + 1000,
    });

    await module.getShare({ params: { id: "share-2" } }, res);

    expect(signBunnyUrlMock).toHaveBeenNthCalledWith(1, "/event-4/photos/a.jpg");
    expect(signBunnyUrlMock).toHaveBeenNthCalledWith(2, "/event-4/photos/b.png");
    expect(res.json).toHaveBeenCalledWith({
      id: "share-2",
      slug: "event-4",
      count: 2,
      expiresAt: Date.now() + 1000,
      photos: ["signed:/event-4/photos/a.jpg", "signed:/event-4/photos/b.png"],
    });
  });

  test("getShare returns expired when the share timestamp is in the past", async () => {
    const { module, readShareRecordMock } = await loadShareController();
    const res = createMockResponse();
    readShareRecordMock.mockResolvedValue({
      id: "share-3",
      slug: "event-5",
      items: ["a.jpg"],
      expiresAt: Date.now() - 1,
    });

    await module.getShare({ params: { id: "share-3" } }, res);

    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.json).toHaveBeenCalledWith({ error: "expired" });
  });

  test("getShare maps store errors to not_found", async () => {
    const { module, readShareRecordMock } = await loadShareController();
    const res = createMockResponse();
    readShareRecordMock.mockRejectedValue(new Error("missing"));

    await module.getShare({ params: { id: "missing" } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "not_found" });
  });

  test("downloadShareZip returns no_files when all share items are unsafe", async () => {
    const { module, readShareRecordMock, archiverMock } = await loadShareController();
    const res = createMockResponse();
    readShareRecordMock.mockResolvedValue({
      id: "share-4",
      slug: "event-6",
      items: ["../hack.jpg", "nested/a.jpg", "script.sh"],
      expiresAt: Date.now() + 1000,
    });

    await module.downloadShareZip({ params: { id: "share-4" } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("no_files");
    expect(archiverMock).not.toHaveBeenCalled();
  });

  test("downloadShareZip streams only safe files into the archive", async () => {
    const { module, readShareRecordMock, archiverMock, archiveAppendMock, archiveFinalizeMock } =
      await loadShareController();
    const res = createMockResponse();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: ReadableStream.from(["binary-1"]),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: ReadableStream.from(["binary-2"]),
      });
    vi.stubGlobal("fetch", fetchMock);
    readShareRecordMock.mockResolvedValue({
      id: "share-5",
      slug: "event-7",
      items: ["safe one.jpg", "bad.exe", "safe-two.png"],
      expiresAt: Date.now() + 1000,
    });

    await module.downloadShareZip({ params: { id: "share-5" } }, res);

    expect(res.setHeader).toHaveBeenNthCalledWith(1, "Content-Type", "application/zip");
    expect(res.setHeader).toHaveBeenNthCalledWith(
      2,
      "Content-Disposition",
      'attachment; filename="event-7-selectie.zip"',
    );
    expect(archiverMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(archiveAppendMock).toHaveBeenCalledTimes(2);
    expect(archiveFinalizeMock).toHaveBeenCalledOnce();
  });
});
