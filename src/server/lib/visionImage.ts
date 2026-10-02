import heicConvert from "heic-convert";
import sharp from "sharp";
import type Anthropic from "@anthropic-ai/sdk";

// Limita de rezoluție pentru modelele Opus 4.7+ (latura lungă). Peste ea, API-ul
// micșorează imaginea singur — iar pe un bon lung pozat întreg asta face cifrele
// prea mici ca să fie citite corect.
const MAX_LONG_EDGE = 2576;
// Un bon mai înalt de ~2x lățimea lui e tăiat în bucăți suprapuse, fiecare
// trimisă la rezoluție maximă, în loc de o singură imagine micșorată.
const TILE_ASPECT = 1.6;
const TILE_OVERLAP = 0.08;
const MAX_TILES = 4;

function isHeic(buffer: Buffer, mediaType: string): boolean {
  if (/image\/hei[cf]/i.test(mediaType)) return true;
  // Unele browsere trimit pozele de pe iPhone cu type gol sau application/octet-stream.
  const brand = buffer.subarray(4, 12).toString("latin1");
  return brand.startsWith("ftyphei") || brand.startsWith("ftypmif1") || brand.startsWith("ftypheix");
}

export function isSupportedImageUpload(buffer: Buffer, mediaType: string): boolean {
  return mediaType.startsWith("image/") || isHeic(buffer, mediaType);
}

async function toDecodableBuffer(buffer: Buffer, mediaType: string): Promise<Buffer> {
  if (!isHeic(buffer, mediaType)) return buffer;
  try {
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const converted = Buffer.from(await heicConvert({ buffer: arrayBuffer, format: "JPEG", quality: 0.92 }));
    if (converted.length > 0) return converted;
  } catch (error) {
    console.warn("[vision-image] heic-convert failed, retrying with sharp:", error);
  }
  return buffer; // sharp încearcă direct dacă are suport HEIF compilat
}

async function encodeTile(image: sharp.Sharp): Promise<Anthropic.ImageBlockParam> {
  const data = await image
    .resize({ width: MAX_LONG_EDGE, height: MAX_LONG_EDGE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
  return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: data.toString("base64") } };
}

/**
 * Pregătește o poză de bon/factură/extras pentru Claude: o rotește după EXIF,
 * convertește HEIC → JPEG, iar pozele foarte înalte (bonuri lungi) le taie în
 * bucăți suprapuse ca textul mic să rămână lizibil.
 */
export async function prepareImageBlocks(buffer: Buffer, mediaType: string): Promise<Anthropic.ImageBlockParam[]> {
  const decodable = await toDecodableBuffer(buffer, mediaType);
  const rotated = await sharp(decodable).rotate().toBuffer();
  const { width = 0, height = 0 } = await sharp(rotated).metadata();

  if (!width || !height) {
    return [await encodeTile(sharp(rotated))];
  }

  const tall = height / width;
  if (tall <= TILE_ASPECT * 1.25 || height <= MAX_LONG_EDGE) {
    return [await encodeTile(sharp(rotated))];
  }

  const tileCount = Math.min(MAX_TILES, Math.ceil(tall / TILE_ASPECT));
  const overlap = Math.round(height * TILE_OVERLAP);
  const baseTileHeight = Math.ceil(height / tileCount);
  const tiles: Anthropic.ImageBlockParam[] = [];
  for (let i = 0; i < tileCount; i++) {
    const top = Math.max(0, i * baseTileHeight - overlap);
    const bottom = Math.min(height, (i + 1) * baseTileHeight + overlap);
    tiles.push(await encodeTile(sharp(rotated).extract({ left: 0, top, width, height: bottom - top })));
  }
  return tiles;
}
