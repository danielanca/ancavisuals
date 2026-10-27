import sharp from "sharp";
import { MAX_PHOTO_BYTES } from "../../shared/media/photoWeight";

// Phones show these photos at most ~1200 px wide; 1600 px keeps them sharp on desktop too.
const MAX_EDGE_PX = 1600;
const QUALITIES = [78, 68, 58];

/**
 * A photo over MAX_PHOTO_BYTES (a camera original, 2–4 MB) becomes a 1600 px WebP, usually
 * 100–250 KB, so it is never too heavy for the public site. Anything else — videos, light
 * photos, files sharp cannot read — comes back unchanged. forceWebp also converts light
 * photos when creating a separate preview; unsupported formats still remain unchanged.
 */
export async function shrinkPhoto(
  buffer: Buffer,
  contentType: string,
  forceWebp = false,
): Promise<{ buffer: Buffer; contentType: string; shrunk: boolean }> {
  const unchanged = { buffer, contentType, shrunk: false };
  if (!contentType.toLowerCase().startsWith("image/") || /gif|svg/i.test(contentType) || (!forceWebp && buffer.length <= MAX_PHOTO_BYTES)) {
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
    return smallest && (forceWebp || smallest.length < buffer.length)
      ? { buffer: smallest, contentType: "image/webp", shrunk: true }
      : unchanged;
  } catch (error) {
    console.warn("[shrinkPhoto] could not shrink, keeping the original:", error);
    return unchanged;
  }
}

// Gallery tiles are ~300–450 CSS px wide; 800 px stays sharp on 2× screens.
const THUMB_EDGE_PX = 800;

/** A small WebP only for showing a photo in a gallery (PageSpeed: 1600 px files shown at ~300 px). Null when sharp cannot read it. */
export async function thumbPhoto(buffer: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(buffer)
      .rotate()
      .resize({ width: THUMB_EDGE_PX, height: THUMB_EDGE_PX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();
  } catch (error) {
    console.warn("[thumbPhoto] could not make a thumbnail:", error);
    return null;
  }
}

/** `photo.jpg` → `photo.webp` once shrunk. */
export const webpName = (name: string) => name.replace(/\.[^.]+$/, "") + ".webp";
