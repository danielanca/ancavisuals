/*
 * Purpose: photos over the site's weight limit are stored as a ≤1600 px WebP under the limit;
 * light photos and videos are left alone.
 */
import sharp from "sharp";
import { describe, expect, test } from "vitest";
import { shrinkPhoto, webpName } from "src/server/utils/shrinkPhoto";
import { MAX_PHOTO_BYTES } from "src/shared/media/photoWeight";

// Random noise compresses badly: a 3000×2000 JPEG of it is several MB, like a camera original.
async function heavyJpeg() {
  const width = 3000, height = 2000;
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) >>> 24;
  return sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();
}

describe("shrinkPhoto", () => {
  test("a heavy JPEG becomes a smaller WebP of at most 1600 px", async () => {
    const original = await heavyJpeg();
    expect(original.length).toBeGreaterThan(MAX_PHOTO_BYTES);
    const out = await shrinkPhoto(original, "image/jpeg");
    expect(out.shrunk).toBe(true);
    expect(out.contentType).toBe("image/webp");
    expect(out.buffer.length).toBeLessThan(original.length);
    const meta = await sharp(out.buffer).metadata();
    expect(meta.format).toBe("webp");
    expect(Math.max(meta.width!, meta.height!)).toBe(1600);
  }, 30_000);

  test("light photos and videos are untouched", async () => {
    const light = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#c9a96e" } }).jpeg().toBuffer();
    expect((await shrinkPhoto(light, "image/jpeg")).shrunk).toBe(false);
    const video = Buffer.alloc(MAX_PHOTO_BYTES + 1);
    expect(await shrinkPhoto(video, "video/mp4")).toEqual({ buffer: video, contentType: "video/mp4", shrunk: false });
  });

  test("webpName swaps the extension", () => {
    expect(webpName("Picture_0108.jpg")).toBe("Picture_0108.webp");
  });
});
