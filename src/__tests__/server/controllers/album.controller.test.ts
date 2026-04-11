// @ts-nocheck
/*
 * Purpose: exercises album controller guards and side effects around album lookup,
 * deletion, archive generation and delivery-link flows without hitting real services.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Readable } from "stream";

const makeWebStream = (chunks: string[]) => Readable.toWeb(Readable.from(chunks));

const createMockResponse = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
    setHeader: vi.fn(),
    redirect: vi.fn(),
  };

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.send.mockReturnValue(res);
  res.redirect.mockReturnValue(res);

  return res;
};

const loadAlbumController = async () => {
  const loadAlbumMock = vi.fn();
  const readPrintSelectionMock = vi.fn();
  const savePrintSelectionMock = vi.fn();
  const saveDeliveryAddressMock = vi.fn();
  const readDeliveryAddressMock = vi.fn();
  const addLinkMock = vi.fn();
  const signBunnyUrlMock = vi.fn((path: string) => `signed:${path}`);
  const buildBunnyDirectoryUrlMock = vi.fn((...segments: string[]) => `https://bunny.dir/${segments.join("/")}/`);
  const buildBunnyStorageUrlMock = vi.fn((...segments: string[]) => `https://bunny.storage/${segments.join("/")}`);
  const dbGetMock = vi.fn().mockResolvedValue({
    data: () => ({ items: [] }),
  });
  const dbDocMock = vi.fn(() => ({
    get: dbGetMock,
  }));
  const collectionMock = vi.fn(() => ({
    doc: dbDocMock,
  }));
  const archiveAppendMock = vi.fn();
  const archiveFinalizeMock = vi.fn().mockResolvedValue(undefined);
  const archivePipeMock = vi.fn();
  const archiverMock = vi.fn(() => ({
    append: archiveAppendMock,
    finalize: archiveFinalizeMock,
    pipe: archivePipeMock,
  }));

  vi.doMock("../../../server/services/album.service", () => ({
    loadAlbum: loadAlbumMock,
  }));

  vi.doMock("../../../server/services/printSelection.store", () => ({
    readPrintSelection: readPrintSelectionMock,
    savePrintSelection: savePrintSelectionMock,
    saveDeliveryAddress: saveDeliveryAddressMock,
    readDeliveryAddress: readDeliveryAddressMock,
    addLink: addLinkMock,
  }));

  vi.doMock("../../../server/utils/signBunnyUrl", () => ({
    signBunnyUrl: signBunnyUrlMock,
  }));

  vi.doMock("../../../server/firestore", () => ({
    db: {
      collection: collectionMock,
    },
  }));

  vi.doMock("../../../server/constants/bunny", () => ({
    BUNNY_ACCESS_KEY_HEADER: "AccessKey",
    BUNNY_DEFAULT_ARCHIVE_NAME: "photos.zip",
    BUNNY_IMAGE_FILE_PATTERN: /\.(jpg|jpeg|png|webp)$/i,
    BUNNY_PHOTOS_FOLDER: "photos",
    BUNNY_PREVIEW_FOLDER: "photos_preview",
    ZIP_COMPRESSION_MAX: 9,
    ZIP_COMPRESSION_STANDARD: 6,
    buildBunnyDirectoryUrl: buildBunnyDirectoryUrlMock,
    buildBunnyStorageUrl: buildBunnyStorageUrlMock,
    getBunnyStorageKey: () => "storage-key",
  }));

  vi.doMock("archiver", () => ({
    default: archiverMock,
  }));

  const module = await import("../../../server/controllers/album.controller");

  return {
    module,
    loadAlbumMock,
    readPrintSelectionMock,
    savePrintSelectionMock,
    saveDeliveryAddressMock,
    readDeliveryAddressMock,
    addLinkMock,
    signBunnyUrlMock,
    buildBunnyDirectoryUrlMock,
    buildBunnyStorageUrlMock,
    collectionMock,
    dbGetMock,
    archiverMock,
    archiveAppendMock,
    archiveFinalizeMock,
    archivePipeMock,
  };
};

describe("album.controller", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  test("downloadSelectedPhotos returns album_not_found when the album root is missing", async () => {
    const { module } = await loadAlbumController();
    const res = createMockResponse();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 404,
        ok: false,
      }),
    );

    await module.downloadSelectedPhotos({ params: { slug: "missing" }, body: { items: "[]" } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith("album_not_found");
  });

  test("downloadSelectedPhotos rejects invalid json payloads", async () => {
    const { module } = await loadAlbumController();
    const res = createMockResponse();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
      }),
    );

    await module.downloadSelectedPhotos({ params: { slug: "demo" }, body: { items: "{bad json" } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("invalid_items");
  });

  test("downloadSelectedPhotos rejects non-array payloads", async () => {
    const { module } = await loadAlbumController();
    const res = createMockResponse();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
      }),
    );

    await module.downloadSelectedPhotos({ params: { slug: "demo" }, body: { items: JSON.stringify("x") } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("invalid_items");
  });

  test("downloadSelectedPhotos rejects when no safe files remain", async () => {
    const { module } = await loadAlbumController();
    const res = createMockResponse();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
      }),
    );

    await module.downloadSelectedPhotos(
      { params: { slug: "demo" }, body: { items: JSON.stringify(["../secret.jpg", "nested/a.jpg", "virus.exe"]) } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("no_files");
  });

  test("getAlbum returns 404 when the album root is missing", async () => {
    const { module, loadAlbumMock } = await loadAlbumController();
    const res = createMockResponse();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 404, ok: false }));

    await module.getAlbum({ params: { slug: "missing" } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Album not found" });
    expect(loadAlbumMock).not.toHaveBeenCalled();
  });

  test("getAlbum returns 404 when album loading returns null", async () => {
    const { module, loadAlbumMock } = await loadAlbumController();
    const res = createMockResponse();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, ok: true }));
    loadAlbumMock.mockResolvedValue(null);

    await module.getAlbum({ params: { slug: "demo" } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Album not found" });
  });

  test("getAlbum returns signed print urls using the preview folder when it exists", async () => {
    const { module, loadAlbumMock, readPrintSelectionMock, signBunnyUrlMock } = await loadAlbumController();
    const res = createMockResponse();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([{ ObjectName: "thumb.jpg", IsDirectory: false }]),
      });
    vi.stubGlobal("fetch", fetchMock);
    loadAlbumMock.mockResolvedValue({ slug: "demo", originalPhoto: [] });
    readPrintSelectionMock.mockResolvedValue(["a.jpg", "../bad.jpg", "b.png", "a.jpg"]);

    await module.getAlbum({ params: { slug: "demo" } }, res);

    expect(signBunnyUrlMock).toHaveBeenNthCalledWith(1, "/demo/photos_preview/a.jpg");
    expect(signBunnyUrlMock).toHaveBeenNthCalledWith(2, "/demo/photos_preview/b.png");
    expect(res.json).toHaveBeenCalledWith({
      slug: "demo",
      originalPhoto: [],
      print: ["signed:/demo/photos_preview/a.jpg", "signed:/demo/photos_preview/b.png"],
    });
  });

  test("postPrintSelection rejects when more than 2000 safe files are provided", async () => {
    const { module, savePrintSelectionMock } = await loadAlbumController();
    const res = createMockResponse();
    const fetchMock = vi.fn().mockResolvedValue({ status: 200, ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const files = Array.from({ length: 2001 }, (_, index) => `photo-${index}.jpg`);

    await module.postPrintSelection({ params: { slug: "demo" }, body: { items: files } }, res);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ error: "too_many_files" });
    expect(savePrintSelectionMock).not.toHaveBeenCalled();
  });

  test("postPrintSelection saves deduplicated safe files", async () => {
    const { module, savePrintSelectionMock } = await loadAlbumController();
    const res = createMockResponse();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, ok: true }));

    await module.postPrintSelection(
      { params: { slug: "demo" }, body: { items: ["a.jpg", "a.jpg", "bad.exe", "b.png", "nested/c.jpg"] } },
      res,
    );

    expect(savePrintSelectionMock).toHaveBeenCalledWith("demo", ["a.jpg", "b.png"]);
    expect(res.json).toHaveBeenCalledWith({ ok: true, count: 2 });
  });

  test("deletePhoto rejects requests with a wrong admin key", async () => {
    const { module } = await loadAlbumController();
    const res = createMockResponse();

    await module.deletePhoto(
      { params: { slug: "demo" }, body: { filename: "a.jpg" }, headers: { "x-admin-key": "wrong" } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "forbidden" });
  });

  test("deletePhoto rejects invalid slugs", async () => {
    const { module } = await loadAlbumController();
    const res = createMockResponse();

    await module.deletePhoto(
      { params: { slug: "../demo" }, body: { filename: "a.jpg" }, headers: { "x-admin-key": "ankvisuals1994" } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "invalid_slug" });
  });

  test("deletePhoto rejects invalid filenames", async () => {
    const { module } = await loadAlbumController();
    const res = createMockResponse();

    await module.deletePhoto(
      { params: { slug: "demo" }, body: { filename: "../a.jpg" }, headers: { "x-admin-key": "ankvisuals1994" } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "invalid_filename" });
  });

  test("deletePhoto returns album_not_found after validation when album root is missing", async () => {
    const { module } = await loadAlbumController();
    const res = createMockResponse();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 404, ok: false }));

    await module.deletePhoto(
      { params: { slug: "demo" }, body: { filename: "a.jpg" }, headers: { "x-admin-key": "ankvisuals1994" } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "album_not_found" });
  });

  test("deletePhoto returns failed_to_delete_file when Bunny deletion fails", async () => {
    const { module } = await loadAlbumController();
    const res = createMockResponse();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([{ ObjectName: "thumb.jpg", IsDirectory: false }]),
      })
      .mockResolvedValueOnce({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);

    await module.deletePhoto(
      { params: { slug: "demo" }, body: { filename: "a.jpg" }, headers: { "x-admin-key": "ankvisuals1994" } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "failed_to_delete_file" });
    expect(consoleError).toHaveBeenCalled();
  });

  test("deletePhoto returns failed_to_reload_album when the album cannot be reloaded", async () => {
    const { module, readPrintSelectionMock, loadAlbumMock } = await loadAlbumController();
    const res = createMockResponse();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([{ ObjectName: "thumb.jpg", IsDirectory: false }]),
      })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    readPrintSelectionMock.mockResolvedValue(["a.jpg"]);
    loadAlbumMock.mockResolvedValue(null);

    await module.deletePhoto(
      { params: { slug: "demo" }, body: { filename: "a.jpg" }, headers: { "x-admin-key": "ankvisuals1994" } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "failed_to_reload_album" });
  });

  test("deletePhoto removes the filename from print selection and returns refreshed signed urls", async () => {
    const { module, readPrintSelectionMock, savePrintSelectionMock, loadAlbumMock, signBunnyUrlMock } =
      await loadAlbumController();
    const res = createMockResponse();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([{ ObjectName: "thumb.jpg", IsDirectory: false }]),
      })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    readPrintSelectionMock
      .mockResolvedValueOnce(["a.jpg", "b.png"])
      .mockResolvedValueOnce(["b.png", "../bad.jpg"]);
    loadAlbumMock.mockResolvedValue({ slug: "demo", originalPhoto: [] });

    await module.deletePhoto(
      { params: { slug: "demo" }, body: { filename: "a.jpg" }, headers: { "x-admin-key": "ankvisuals1994" } },
      res,
    );

    expect(savePrintSelectionMock).toHaveBeenCalledWith("demo", ["b.png"]);
    expect(signBunnyUrlMock).toHaveBeenCalledWith("/demo/photos_preview/b.png");
    expect(res.json).toHaveBeenCalledWith({
      slug: "demo",
      originalPhoto: [],
      print: ["signed:/demo/photos_preview/b.png"],
    });
  });

  test("deletePhoto returns server_error when an unexpected error is thrown", async () => {
    const { module } = await loadAlbumController();
    const res = createMockResponse();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await module.deletePhoto(
      { params: { slug: "demo" }, body: { filename: "a.jpg" }, headers: { "x-admin-key": "ankvisuals1994" } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "server_error" });
    expect(consoleError).toHaveBeenCalled();
  });

  test("addDeliveryAddress validates required fields", async () => {
    const { module, saveDeliveryAddressMock } = await loadAlbumController();
    const res = createMockResponse();

    await module.addDeliveryAddress(
      { params: { slug: "demo" }, body: { fullName: "Ana", phone: "", street: "Street", city: "Cluj" } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Missing required fields: fullName, phone, street, city",
    });
    expect(saveDeliveryAddressMock).not.toHaveBeenCalled();
  });

  test("addDeliveryAddress forwards payload to the store on success", async () => {
    const { module, saveDeliveryAddressMock } = await loadAlbumController();
    const res = createMockResponse();
    saveDeliveryAddressMock.mockResolvedValue(undefined);

    await module.addDeliveryAddress(
      {
        params: { slug: "demo" },
        body: { fullName: "Ana", phone: "0711", street: "Street", city: "Cluj", easybox: "Locker" },
      },
      res,
    );

    expect(saveDeliveryAddressMock).toHaveBeenCalledWith("demo", {
      fullName: "Ana",
      phone: "0711",
      street: "Street",
      city: "Cluj",
      easybox: "Locker",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("getDeliveryAddress returns store data", async () => {
    const { module, readDeliveryAddressMock } = await loadAlbumController();
    const res = createMockResponse();
    readDeliveryAddressMock.mockResolvedValue({ deliveryAddress: { city: "Cluj" } });

    await module.getDeliveryAddress({ params: { slug: "demo" } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: { deliveryAddress: { city: "Cluj" } },
      success: true,
      message: "Delivery address fetched successfully",
    });
  });

  test("downloadAll returns ZipNotReady when the archive is missing", async () => {
    const { module } = await loadAlbumController();
    const res = createMockResponse();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([{ ObjectName: "other.zip", IsDirectory: false }]),
      }),
    );

    await module.downloadAll({ params: { slug: "demo" } }, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: "ZipNotReady",
      message: "photos.zip lipsește. Creează-l în Bunny: click dreapta pe folderul 'photos' -> Compress -> nume 'photos'.",
      expectedPath: "demo/photos.zip",
    });
  });

  test("downloadAll redirects to the download endpoint when the archive exists", async () => {
    const { module } = await loadAlbumController();
    const res = createMockResponse();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([{ ObjectName: "photos.zip", IsDirectory: false }]),
      }),
    );

    await module.downloadAll({ params: { slug: "demo event" } }, res);

    expect(res.redirect).toHaveBeenCalledWith(
      302,
      "/api/download?path=demo%20event%2Fphotos.zip&name=demo%20event-toate-pozele.zip",
    );
  });

  test("downloadPrintDynamic returns 404 when no print selection exists", async () => {
    const { module, dbGetMock } = await loadAlbumController();
    const res = createMockResponse();
    dbGetMock.mockResolvedValue({
      data: () => ({ items: [] }),
    });

    await module.downloadPrintDynamic({ params: { slug: "demo" } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "No print selection" });
  });

  test("downloadPrintDynamic streams selected print files using the preview folder when present", async () => {
    const { module, dbGetMock, archiverMock, archiveAppendMock, archiveFinalizeMock } = await loadAlbumController();
    const res = createMockResponse();
    dbGetMock.mockResolvedValue({
      data: () => ({ items: ["a.jpg", "b.png"] }),
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([{ ObjectName: "thumb.jpg", IsDirectory: false }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: makeWebStream(["binary-1"]),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: makeWebStream(["binary-2"]),
      });
    vi.stubGlobal("fetch", fetchMock);

    await module.downloadPrintDynamic({ params: { slug: "demo" } }, res);

    expect(res.setHeader).toHaveBeenNthCalledWith(1, "Content-Type", "application/zip");
    expect(res.setHeader).toHaveBeenNthCalledWith(
      2,
      "Content-Disposition",
      'attachment; filename="poze-imprimare-demo.zip"',
    );
    expect(res.setHeader).toHaveBeenNthCalledWith(3, "Cache-Control", "no-store");
    expect(archiverMock).toHaveBeenCalledOnce();
    expect(archiveAppendMock).toHaveBeenCalledTimes(2);
    expect(archiveFinalizeMock).toHaveBeenCalledOnce();
  });

  test("addSwissLink validates both slug and link", async () => {
    const { module, addLinkMock } = await loadAlbumController();
    const res = createMockResponse();

    await module.addSwissLink({ params: { slug: "" }, body: { link: "" } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: "Missing slug in URL" });
    expect(addLinkMock).not.toHaveBeenCalled();
  });

  test("addSwissLink saves the link on success", async () => {
    const { module, addLinkMock } = await loadAlbumController();
    const res = createMockResponse();
    addLinkMock.mockResolvedValue(undefined);

    await module.addSwissLink({ params: { slug: "demo" }, body: { link: "https://swiss.example" } }, res);

    expect(addLinkMock).toHaveBeenCalledWith("demo", "https://swiss.example");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Swiss link saved successfully",
    });
  });
});
