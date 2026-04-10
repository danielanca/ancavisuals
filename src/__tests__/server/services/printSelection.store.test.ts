/*
 * Purpose: validates Firestore persistence helpers for print selections,
 * delivery addresses and Swiss links, including fallback write behavior.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

type DocSnapshot = {
  exists: boolean;
  data: () => unknown;
};

const loadPrintSelectionStore = async (options?: {
  getSnapshot?: DocSnapshot;
  updateImpl?: ReturnType<typeof vi.fn>;
  setImpl?: ReturnType<typeof vi.fn>;
}) => {
  const getMock = vi.fn().mockResolvedValue(
    options?.getSnapshot ?? {
      exists: false,
      data: () => undefined,
    },
  );
  const updateMock = options?.updateImpl ?? vi.fn().mockResolvedValue(undefined);
  const setMock = options?.setImpl ?? vi.fn().mockResolvedValue(undefined);
  const docMock = vi.fn(() => ({
    get: getMock,
    update: updateMock,
    set: setMock,
  }));
  const collectionMock = vi.fn(() => ({
    doc: docMock,
  }));
  const firestoreMock = vi.fn(() => ({
    collection: collectionMock,
  }));

  vi.doMock("../../../server/firestoreInit", () => ({
    firestore: firestoreMock,
  }));

  const module = await import("../../../server/services/printSelection.store");

  return {
    module,
    firestoreMock,
    collectionMock,
    docMock,
    getMock,
    updateMock,
    setMock,
  };
};

describe("printSelection.store", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-11T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test("savePrintSelection persists slug, items and updatedAt", async () => {
    const { module, collectionMock, docMock, setMock } = await loadPrintSelectionStore();

    await module.savePrintSelection("demo-album", ["a.jpg", "b.jpg"]);

    expect(collectionMock).toHaveBeenCalledWith("printSelections");
    expect(docMock).toHaveBeenCalledWith("demo-album");
    expect(setMock).toHaveBeenCalledWith(
      {
        slug: "demo-album",
        items: ["a.jpg", "b.jpg"],
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  });

  test("readPrintSelection returns an empty array when the document does not exist", async () => {
    const { module } = await loadPrintSelectionStore();

    await expect(module.readPrintSelection("missing")).resolves.toEqual([]);
  });

  test("readPrintSelection coerces stored items to strings", async () => {
    const { module } = await loadPrintSelectionStore({
      getSnapshot: {
        exists: true,
        data: () => ({ items: ["1.jpg", 2, true] }),
      },
    });

    await expect(module.readPrintSelection("demo")).resolves.toEqual(["1.jpg", "2", "true"]);
  });

  test("saveDeliveryAddress trims fields on update and stores null for blank easybox", async () => {
    const { module, updateMock, setMock } = await loadPrintSelectionStore();

    await module.saveDeliveryAddress("slug-1", {
      fullName: "  Anca Visuals  ",
      phone: " 0712345678 ",
      street: " Strada Lalelelor 10 ",
      city: " Cluj ",
      easybox: " ",
    });

    expect(updateMock).toHaveBeenCalledWith({
      deliveryAddress: {
        fullName: "Anca Visuals",
        phone: "0712345678",
        street: "Strada Lalelelor 10",
        city: "Cluj",
        easybox: null,
        deliveryAddressUpdatedAt: Date.now(),
      },
    });
    expect(setMock).not.toHaveBeenCalled();
  });

  test("saveDeliveryAddress falls back to set with merge when update gets not-found", async () => {
    const updateMock = vi.fn().mockRejectedValue({ code: "not-found" });
    const { module, setMock } = await loadPrintSelectionStore({ updateImpl: updateMock });

    await module.saveDeliveryAddress("slug-2", {
      fullName: "  Maria  ",
      phone: " 0700 ",
      street: " Main St ",
      city: " Sibiu ",
      easybox: " Locker 4 ",
    });

    expect(setMock).toHaveBeenCalledWith(
      {
        slug: "slug-2",
        deliveryAddress: {
          fullName: "Maria",
          phone: "0700",
          street: "Main St",
          city: "Sibiu",
          easybox: "Locker 4",
        },
        deliveryAddressUpdatedAt: Date.now(),
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  });

  test("saveDeliveryAddress rethrows non not-found update errors", async () => {
    const updateMock = vi.fn().mockRejectedValue(new Error("permission denied"));
    const { module } = await loadPrintSelectionStore({ updateImpl: updateMock });

    await expect(
      module.saveDeliveryAddress("slug-3", {
        fullName: "Ana",
        phone: "0711",
        street: "Street",
        city: "Brasov",
      }),
    ).rejects.toThrow("permission denied");
  });

  test("readDeliveryAddress returns null when the document is missing", async () => {
    const { module } = await loadPrintSelectionStore();

    await expect(module.readDeliveryAddress("missing")).resolves.toBeNull();
  });

  test("readDeliveryAddress returns the stored document data", async () => {
    const data = {
      deliveryAddress: { fullName: "Ana", phone: "0711", street: "Street", city: "Brasov" },
      swissLink: "https://example.com",
    };
    const { module } = await loadPrintSelectionStore({
      getSnapshot: {
        exists: true,
        data: () => data,
      },
    });

    await expect(module.readDeliveryAddress("slug")).resolves.toEqual(data);
  });

  test("addLink updates the swissLink field", async () => {
    const { module, updateMock } = await loadPrintSelectionStore();

    await module.addLink("slug-4", "https://swiss.example/link");

    expect(updateMock).toHaveBeenCalledWith({ swissLink: "https://swiss.example/link" });
  });
});
