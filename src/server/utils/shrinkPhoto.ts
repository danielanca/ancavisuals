import sharp from "sharp";
import { MAX_PHOTO_BYTES } from "../../shared/media/photoWeight";

// Phones show these photos at most ~1200 px wide; 1600 px keeps them sharp on desktop too.
const MAX_EDGE_PX = 1600;
const QUALITIES = [78, 68, 58];

/**
 * A photo over MAX_PHOTO_BYTES (a camera original, 2–4 MB) becomes a 1600 px WebP, usually
 * 100–250 KB, so it is never too heavy for the public site. Anything else — videos, light
 * photos, files sharp cannot read — comes back unchanged.
 */
export async function shrinkPhoto(
  buffer: Buffer,
  contentType: string,
): Promise<{ buffer: Buffer; contentType: string; shrunk: boolean }> {
  const unchanged = { buffer, contentType, shrunk: false };
  if (!contentType.toLowerCase().startsWith("image/") || /gif|svg/i.test(contentType) || buffer.length <= MAX_PHOTO_BYTES) {
    return unchanged;
  }
  try {
    let smallest: Buffer | undefined;
    for (const quality of QUALITIES) {
      const out = await sharp(buffer)
        .rotate() // apply the EXIF orientation before it is stripped
        .resize({ width: MAX_EDGE_PX, height: MAX_EDGE_PX, fit: "inside", withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();
      if (!smallest || out.length < smallest.length) smallest = out;
      if (out.length <= MAX_PHOTO_BYTES) break;
    }
    return smallest && smallest.length < buffer.length
      ? { buffer: smallest, contentType: "image/webp", shrunk: true }
      : unchanged;
  } catch (error) {
    console.warn("[shrinkPhoto] could not shrink, keeping the original:", error);
    return unchanged;
  }
}

/** `photo.jpg` → `photo.webp` once shrunk. */
export const webpName = (name: string) => name.replace(/\.[^.]+$/, "") + ".webp";
