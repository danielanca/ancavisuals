// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/*
 * Purpose: verifies share controller validation, expiry handling and zip creation
 * while isolating Bunny and persistence dependencies behind mocks.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Readable } from "stream";

const makeWebStream = (chunks: string[]) => Readable.toWeb(Readable.from(chunks));

const createMockResponse = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
    end: vi.fn(),
    setHeader: vi.fn(),
    set: vi.fn(),
  };
  res.set = vi.fn().mockReturnValue(res);

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.send.mockReturnValue(res);

  return res;
};

const loadShareController = async () => {
  const createShareRecordMock = vi.fn();
  const readShareRecordMock = vi.fn();
  const listShareRecordsBySlugMock = vi.fn();
  const updateShareRecordMock = vi.fn().mockResolvedValue(undefined);
  const bumpShareCounterMock = vi.fn().mockResolvedValue(undefined);
  const verifyCoupleKeyMock = vi.fn().mockResolvedValue(false);
  const ensureCoupleKeyMock = vi.fn().mockResolvedValue("couple-key");
  const signBunnyUrlMock = vi.fn((path: string) => `signed:${path}`);
  const buildBunnyStorageUrlMock = vi.fn((...segments: string[]) => `https://storage.test/${segments.join("/")}`);
  const downloadBunnyOriginalMock = vi.fn();
  const archiveAppendMock = vi.fn();
  const archiveFinalizeMock = vi.fn().mockResolvedValue(undefined);
  const archivePipeMock = vi.fn();
  const archiverMock = vi.fn(() => ({
    append: archiveAppendMock,
    finalize: archiveFinalizeMock,
    pipe: archivePipeMock,
  }));

  vi.doMock("src/server/services/share.store", () => ({
    createShareRecord: createShareRecordMock,
    readShareRecord: readShareRecordMock,
    listShareRecordsBySlug: listShareRecordsBySlugMock,
    updateShareRecord: updateShareRecordMock,
    bumpShareCounter: bumpShareCounterMock,
  }));

  vi.doMock("src/server/services/coupleKey.store", () => ({
    verifyCoupleKey: verifyCoupleKeyMock,
    ensureCoupleKey: ensureCoupleKeyMock,
  }));

  vi.doMock("src/server/utils/signBunnyUrl", () => ({
    signBunnyUrl: signBunnyUrlMock,
  }));

  vi.doMock("src/server/utils/downloadBunnyOriginal", () => ({
    downloadBunnyOriginal: downloadBunnyOriginalMock,
  }));

  vi.doMock("src/server/constants/bunny", () => ({
    PRIVATE_BUNNY_DIRS: new Set(["contracts", "expenses"]),
    BUNNY_ACCESS_KEY_HEADER: "AccessKey",
    BUNNY_IMAGE_FILE_PATTERN: /\.(jpg|jpeg|png|webp)$/i,
    BUNNY_PHOTOS_FOLDER: "photos",
    BUNNY_PREVIEW_FOLDER: "photos_preview",
    ZIP_COMPRESSION_STANDARD: 6,
    buildBunnyStorageUrl: buildBunnyStorageUrlMock,
    buildBunnyDirectoryUrl: vi.fn(() => "https://storage.test/dir"),
    getBunnyStorageKey: () => "storage-key",
  }));

  vi.doMock("archiver", () => ({
    default: archiverMock,
  }));

  const module = await import("src/server/controllers/share.controller");

  return {
    module,
    createShareRecordMock,
    readShareRecordMock,
    listShareRecordsBySlugMock,
    updateShareRecordMock,
    bumpShareCounterMock,
    verifyCoupleKeyMock,
    ensureCoupleKeyMock,
    signBunnyUrlMock,
    buildBunnyStorageUrlMock,
    downloadBunnyOriginalMock,
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

  test.each(["contracts", "../contracts", "a/b"])("createShare rejects the non-album slug %s", async (slug) => {
    const { module } = await loadShareController();
    const res = createMockResponse();

    await module.createShare({ body: { slug, items: ["a.jpg"] } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "invalid_slug" });
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

    expect(createShareRecordMock).toHaveBeenCalledWith("event-2", ["a.jpg", "b.webp"], 36500, false, {
      label: "",
      message: "",
      createdBy: "guest",
    });
    expect(res.json).toHaveBeenCalledWith({ id: "share-1", expiresAt: 123456, count: 2 });
  });

  test("createShare accepts a big selection (209 picked photos)", async () => {
    const { module, createShareRecordMock } = await loadShareController();
    const res = createMockResponse();
    const files = Array.from({ length: 209 }, (_, index) => `file-${index}.jpg`);
    createShareRecordMock.mockResolvedValue({ id: "share-209", slug: "event-3", items: files, expiresAt: 123456 });

    await module.createShare({ body: { slug: "event-3", items: files } }, res);

    expect(res.status).not.toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ id: "share-209", expiresAt: 123456, count: 209 });
  });

  test("createShare rejects more than 2000 safe files", async () => {
    const { module, createShareRecordMock } = await loadShareController();
    const res = createMockResponse();
    const files = Array.from({ length: 2001 }, (_, index) => `file-${index}.jpg`);

    await module.createShare({ body: { slug: "event-3", items: files } }, res);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ error: "too_many_files" });
    expect(createShareRecordMock).not.toHaveBeenCalled();
  });

  test("getShare returns signed photo urls for active shares", async () => {
    const { module, readShareRecordMock, signBunnyUrlMock } = await loadShareController();
    const res = createMockResponse();
    // resolvePhotoFolder calls fetch for directory check — return non-ok so it falls back to photos/
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
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
      showAll: false,
      label: undefined,
      message: undefined,
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
    const { module, readShareRecordMock, downloadBunnyOriginalMock, archiverMock, archiveAppendMock, archiveFinalizeMock } =
      await loadShareController();
    const res = createMockResponse();
    // resolvePhotoFolder fetch — return non-ok so it falls back to photos/
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    downloadBunnyOriginalMock
      .mockResolvedValueOnce({ buffer: Buffer.from("binary-1"), contentType: "image/jpeg" })
      .mockResolvedValueOnce({ buffer: Buffer.from("binary-2"), contentType: "image/png" });
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
    expect(downloadBunnyOriginalMock).toHaveBeenCalledTimes(2);
    expect(archiveAppendMock).toHaveBeenCalledTimes(2);
    expect(archiveFinalizeMock).toHaveBeenCalledOnce();
  });

  const makeRecord = (overrides = {}) => ({
    id: "share-9",
    slug: "ana-mihai",
    items: ["a.jpg", "b.jpg"],
    expiresAt: Date.now() + 1000,
    showAll: false,
    label: "Nașii",
    message: "Mulțumim!",
    createdBy: "couple",
    createdAt: 1000,
    lastViewedAt: null,
    views: 3,
    downloads: 1,
    forwards: 2,
    revoked: false,
    ...overrides,
  });

  test("createShare marks the link as the couple's when the key header is valid", async () => {
    const { module, createShareRecordMock, verifyCoupleKeyMock } = await loadShareController();
    const res = createMockResponse();
    verifyCoupleKeyMock.mockResolvedValue(true);
    createShareRecordMock.mockResolvedValue({ id: "s", items: ["a.jpg"], expiresAt: 1 });

    await module.createShare(
      {
        headers: { "x-couple-key": "secret" },
        body: { slug: "ana-mihai", items: ["a.jpg"], label: "  Nașii\n ", message: "Mulțumim\r\n\n\n\nvă iubim" },
      },
      res,
    );

    expect(verifyCoupleKeyMock).toHaveBeenCalledWith("ana-mihai", "secret");
    expect(createShareRecordMock).toHaveBeenCalledWith("ana-mihai", ["a.jpg"], 36500, false, {
      label: "Nașii",
      message: "Mulțumim\n\nvă iubim",
      createdBy: "couple",
    });
  });

  test("getShare hides revoked links and does not count a view", async () => {
    const { module, readShareRecordMock, bumpShareCounterMock } = await loadShareController();
    const res = createMockResponse();
    readShareRecordMock.mockResolvedValue(makeRecord({ revoked: true }));

    await module.getShare({ params: { id: "share-9" } }, res);

    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.json).toHaveBeenCalledWith({ error: "revoked" });
    expect(bumpShareCounterMock).not.toHaveBeenCalled();
  });

  test("getShare counts a view and returns the couple's label and message", async () => {
    const { module, readShareRecordMock, bumpShareCounterMock } = await loadShareController();
    const res = createMockResponse();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    readShareRecordMock.mockResolvedValue(makeRecord());

    await module.getShare({ params: { id: "share-9" } }, res);

    expect(bumpShareCounterMock).toHaveBeenCalledWith("share-9", "views");
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ label: "Nașii", message: "Mulțumim!" }));
  });

  test("forwardShare counts a forward", async () => {
    const { module, readShareRecordMock, bumpShareCounterMock } = await loadShareController();
    const res = createMockResponse();
    readShareRecordMock.mockResolvedValue(makeRecord());

    await module.forwardShare({ params: { id: "share-9" } }, res);

    expect(bumpShareCounterMock).toHaveBeenCalledWith("share-9", "forwards");
    expect(res.status).toHaveBeenCalledWith(204);
  });

  test("requireCoupleKey rejects a wrong key", async () => {
    const { module, verifyCoupleKeyMock } = await loadShareController();
    const res = createMockResponse();
    const next = vi.fn();
    verifyCoupleKeyMock.mockResolvedValue(false);

    await module.requireCoupleKey({ params: { slug: "ana-mihai" }, headers: { "x-couple-key": "nope" } }, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("requireCoupleKey lets the couple through", async () => {
    const { module, verifyCoupleKeyMock } = await loadShareController();
    const res = createMockResponse();
    const next = vi.fn();
    verifyCoupleKeyMock.mockResolvedValue(true);

    await module.requireCoupleKey({ params: { slug: "ana-mihai" }, headers: { "x-couple-key": "ok" } }, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  test("listCoupleShares returns summaries with a signed cover", async () => {
    const { module, listShareRecordsBySlugMock } = await loadShareController();
    const res = createMockResponse();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    listShareRecordsBySlugMock.mockResolvedValue([makeRecord()]);

    await module.listCoupleShares({ params: { slug: "ana-mihai" } }, res);

    expect(res.json).toHaveBeenCalledWith({
      links: [{
        id: "share-9", label: "Nașii", message: "Mulțumim!", createdBy: "couple", count: 2, showAll: false,
        createdAt: 1000, lastViewedAt: null, views: 3, downloads: 1, forwards: 2, revoked: false,
        cover: "signed:/ana-mihai/photos/a.jpg",
      }],
    });
  });

  test("updateCoupleShare refuses a link from another album", async () => {
    const { module, readShareRecordMock, updateShareRecordMock } = await loadShareController();
    const res = createMockResponse();
    readShareRecordMock.mockResolvedValue(makeRecord({ slug: "alt-album" }));

    await module.updateCoupleShare({ params: { slug: "ana-mihai", id: "share-9" }, body: { revoked: true } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(updateShareRecordMock).not.toHaveBeenCalled();
  });

  test("updateCoupleShare renames and revokes the couple's link", async () => {
    const { module, readShareRecordMock, updateShareRecordMock } = await loadShareController();
    const res = createMockResponse();
    readShareRecordMock.mockResolvedValue(makeRecord());

    await module.updateCoupleShare({ params: { slug: "ana-mihai", id: "share-9" }, body: { label: " Părinții ", revoked: true } }, res);

    expect(updateShareRecordMock).toHaveBeenCalledWith("share-9", { label: "Părinții", revoked: true });
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test("adminCoupleKey rotates only when asked", async () => {
    const { module, ensureCoupleKeyMock } = await loadShareController();
    const res = createMockResponse();

    await module.adminCoupleKey({ params: { slug: "ana-mihai" }, body: { rotate: true } }, res);

    expect(ensureCoupleKeyMock).toHaveBeenCalledWith("ana-mihai", true);
    expect(res.json).toHaveBeenCalledWith({ key: "couple-key" });
  });
});

describe("share preview image (og:image for WhatsApp)", () => {
  beforeEach(() => { vi.resetModules(); vi.unstubAllGlobals(); });

  test("serves the first chosen photo as a 1200x630 JPEG and caches it", async () => {
    const sharp = (await import("sharp")).default;
    const photo = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#884422" } }).jpeg().toBuffer();
    const { module, readShareRecordMock } = await loadShareController();
    readShareRecordMock.mockResolvedValue({ id: "a".repeat(20), slug: "nunta", items: ["../evil.jpg", "IMG_1.jpg"], expiresAt: Date.now() + 1e6, revoked: false });
    const fetchMock = vi.fn(async (url: string) => (url.includes("storage.test")
      ? { ok: false, json: async () => [] }
      : { ok: true, arrayBuffer: async () => photo.buffer.slice(photo.byteOffset, photo.byteOffset + photo.byteLength) }));
    vi.stubGlobal("fetch", fetchMock);

    const res = createMockResponse();
    await module.getSharePreviewImage({ params: { id: "a".repeat(20) } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({ "Content-Type": "image/jpeg" }));
    const image = res.end.mock.calls[0][0];
    const meta = await sharp(image).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["jpeg", 1200, 630]);
    expect(fetchMock).toHaveBeenCalledWith("signed:/nunta/photos/IMG_1.jpg");

    const again = createMockResponse();
    await module.getSharePreviewImage({ params: { id: "a".repeat(20) } }, again);
    expect(readShareRecordMock).toHaveBeenCalledTimes(1);
  });

  test("revoked or unknown share has no preview", async () => {
    const { module, readShareRecordMock } = await loadShareController();
    readShareRecordMock.mockResolvedValueOnce({ id: "b".repeat(20), slug: "x", items: ["a.jpg"], expiresAt: Date.now() + 1e6, revoked: true });
    const res = createMockResponse();
    await module.getSharePreviewImage({ params: { id: "b".repeat(20) } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    readShareRecordMock.mockRejectedValueOnce(new Error("not_found"));
    const res2 = createMockResponse();
    await module.getSharePreviewImage({ params: { id: "c".repeat(20) } }, res2);
    expect(res2.status).toHaveBeenCalledWith(404);
  });
});
