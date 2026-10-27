import sharp from "sharp";
import { afterEach, expect, test, vi } from "vitest";
import { createMediaAssetPreview } from "src/server/utils/mediaAssetPreview";

afterEach(() => vi.unstubAllGlobals());

test("stores a genuine WebP beside even a small JPEG, with no reference to its album", async () => {
  const original = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#c9a96e" } }).jpeg().toBuffer();
  const fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
  const preview = await createMediaAssetPreview(original, "image/jpeg", "offers-assets/photo/example.jpg");
  expect(preview.previewBunnyPath).toBe("offers-assets/photo/example.preview.webp");
  expect(preview.displayUrl).toBe(preview.previewUrl);
  expect(preview.previewUrl).toContain("/offers-assets/photo/example.preview.webp");
  const [url, request] = fetchMock.mock.calls[0];
  expect(url).toContain("/offers-assets/photo/example.preview.webp");
  expect(request.method).toBe("PUT");
  expect(request.headers["Content-Type"]).toBe("image/webp");
  expect((await sharp(request.body).metadata()).format).toBe("webp");
  expect((await sharp(original).metadata()).format).toBe("jpeg");
});

test("also stores a small gallery thumbnail (max 800 px WebP) beside the preview", async () => {
  const original = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#c9a96e" } }).jpeg().toBuffer();
  const fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
  const preview = await createMediaAssetPreview(original, "image/jpeg", "offers-assets/photo/example.jpg");
  expect(preview.thumbBunnyPath).toBe("offers-assets/photo/example.thumb.webp");
  expect(preview.thumbUrl).toContain("/offers-assets/photo/example.thumb.webp");
  const [, request] = fetchMock.mock.calls[1];
  const meta = await sharp(request.body).metadata();
  expect(meta.format).toBe("webp");
  expect(Math.max(meta.width!, meta.height!)).toBe(800);
});

test("a WebP input uses a distinct path so its existing copy is preserved", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  const original = await sharp({ create: { width: 10, height: 10, channels: 3, background: "white" } }).webp().toBuffer();
  const preview = await createMediaAssetPreview(original, "image/webp", "offers-assets/photo/example.webp");
  expect(preview.previewBunnyPath).toBe("offers-assets/photo/example.preview.webp");
});

test("videos do not create image previews", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  expect(await createMediaAssetPreview(Buffer.from("video"), "video/mp4", "offers-assets/video/example.mp4")).toEqual({});
  expect(fetchMock).not.toHaveBeenCalled();
});

test("upload failure does not return metadata claiming a preview exists", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
  const original = await sharp({ create: { width: 10, height: 10, channels: 3, background: "white" } }).jpeg().toBuffer();
  await expect(createMediaAssetPreview(original, "image/jpeg", "offers-assets/photo/example.jpg")).rejects.toThrow("503");
});
