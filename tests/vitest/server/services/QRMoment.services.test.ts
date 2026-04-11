// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/*
 * Purpose: validates QR Moments route checks by combining Firestore event presence
 * with Bunny folder existence so dead or partial event setups are handled safely.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const createMockResponse = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);

  return res;
};

const loadQRMomentServices = async (options?: {
  snapshotExists?: boolean;
  snapshotData?: unknown;
}) => {
  const snapshot = {
    exists: options?.snapshotExists ?? false,
    data: vi.fn(() => options?.snapshotData),
  };
  const getMock = vi.fn().mockResolvedValue(snapshot);
  const docMock = vi.fn(() => ({
    get: getMock,
  }));
  const collectionMock = vi.fn(() => ({
    doc: docMock,
  }));
  const firestoreMock = vi.fn(() => ({
    collection: collectionMock,
  }));
  const buildBunnyDirectoryUrlMock = vi.fn((eventDate: string) => `https://bunny.dir/${eventDate}/`);

  vi.doMock("src/server/firestore", () => ({
    firestore: firestoreMock,
  }));

  vi.doMock("src/server/constants/bunny", () => ({
    BUNNY_ACCESS_KEY_HEADER: "AccessKey",
    buildBunnyDirectoryUrl: buildBunnyDirectoryUrlMock,
    getBunnyStorageKey: () => "storage-key",
  }));

  const module = await import("src/server/services/qrMoment.service");

  return {
    module,
    firestoreMock,
    collectionMock,
    docMock,
    getMock,
    snapshot,
    buildBunnyDirectoryUrlMock,
  };
};

describe("qrMoment.service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  test("returns urlFound false when the Firestore document is missing", async () => {
    const { module, collectionMock, docMock } = await loadQRMomentServices({
      snapshotExists: false,
    });
    const res = createMockResponse();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue([{ ObjectName: "a.jpg" }]) }));

    await module.checkRoute({ params: { eventDate: "2026-06-01" } }, res);

    expect(collectionMock).toHaveBeenCalledWith("qr-moments");
    expect(docMock).toHaveBeenCalledWith("2026-06-01");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      urlFound: false,
      data: [],
      message: "No events found",
    });
  });

  test("returns urlFound false when the Bunny folder is missing", async () => {
    const { module } = await loadQRMomentServices({
      snapshotExists: true,
      snapshotData: { bride: "Ana" },
    });
    const res = createMockResponse();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await module.checkRoute({ params: { eventDate: "2026-06-02" } }, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      urlFound: false,
      data: [],
      message: "No events found",
    });
  });

  test("returns urlFound false when the Bunny folder exists but is empty", async () => {
    const { module } = await loadQRMomentServices({
      snapshotExists: true,
      snapshotData: { bride: "Ana" },
    });
    const res = createMockResponse();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue([]) }));

    await module.checkRoute({ params: { eventDate: "2026-06-03" } }, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      urlFound: false,
      data: [],
      message: "No events found",
    });
  });

  test("returns event data when both Firestore and Bunny folder checks succeed", async () => {
    const eventData = { bride: "Ana", groom: "Mihai", message: "Welcome!" };
    const { module, buildBunnyDirectoryUrlMock } = await loadQRMomentServices({
      snapshotExists: true,
      snapshotData: eventData,
    });
    const res = createMockResponse();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([{ ObjectName: "photo-1.jpg" }]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await module.checkRoute({ params: { eventDate: "2026-06-04" } }, res);

    expect(buildBunnyDirectoryUrlMock).toHaveBeenCalledWith("2026-06-04");
    expect(fetchMock).toHaveBeenCalledWith("https://bunny.dir/2026-06-04/", {
      headers: { AccessKey: "storage-key" },
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      urlFound: true,
      data: eventData,
    });
  });
});
