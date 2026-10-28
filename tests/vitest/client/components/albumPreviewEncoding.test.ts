import { afterEach, describe, expect, test, vi } from "vitest";
import { encodeAlbumPreview } from "src/client/features/admin/components/albumPreviewEncoding";

afterEach(() => vi.unstubAllGlobals());
describe("album WebP encoding", () => {
  test.each([[6000, 4000, 1000, 667], [800, 1200, 800, 1200]])("resizes %s×%s without enlarging and releases the decoded image", async (w, h, width, height) => {
    const close = vi.fn();
    const drawImage = vi.fn();
    const convertToBlob = vi.fn().mockResolvedValue(new Blob(["webp"], { type: "image/webp" }));
    const canvas = vi.fn(function () { return { getContext: () => ({ drawImage }), convertToBlob }; });
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: w, height: h, close }));
    vi.stubGlobal("OffscreenCanvas", canvas);
    const output = await encodeAlbumPreview(new Blob(["jpeg"]));
    expect(canvas).toHaveBeenCalledWith(width, height);
    expect(convertToBlob).toHaveBeenCalledWith({ type: "image/webp", quality: 0.72 });
    expect(output.type).toBe("image/webp");
    expect(close).toHaveBeenCalledOnce();
  });
  test("rejects browsers silently returning PNG and still releases memory", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 100, height: 100, close }));
    vi.stubGlobal("OffscreenCanvas", vi.fn(function () { return { getContext: () => ({ drawImage: vi.fn() }), convertToBlob: async () => new Blob(["png"], { type: "image/png" }) }; }));
    await expect(encodeAlbumPreview(new Blob())).rejects.toThrow("WebP indisponibil");
    expect(close).toHaveBeenCalledOnce();
  });
});
