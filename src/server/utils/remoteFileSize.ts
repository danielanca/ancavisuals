// Byte size — and, for photos, pixel width/height — of public files (CDN photos). One ranged
// GET of the first bytes per URL: the total size comes from Content-Range (or Content-Length),
// the dimensions from the WebP / JPEG / PNG header. Cached per URL for a day — the files behind
// these URLs never change in place. Never throws: anything unknown is `undefined`.

const TTL_MS = 24 * 60 * 60_000;
const REQUEST_TIMEOUT_MS = 4000;
const CONCURRENCY = 8;
// JPEG dimensions sit after the EXIF block, usually well inside the first 64 KB.
const HEADER_BYTES = 64 * 1024;

export type RemoteImageInfo = { bytes?: number; width?: number; height?: number };

const cache = new Map<string, { info: RemoteImageInfo; at: number }>();
const inFlight = new Map<string, Promise<void>>();

/** Width/height from the start of a WebP, PNG or JPEG file. */
export function imageDimensions(bytes: Uint8Array): { width: number; height: number } | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  if (bytes.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const chunk = ascii(12, 4);
    if (chunk === "VP8X") return { width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)), height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) };
    if (chunk === "VP8 ") return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    if (chunk === "VP8L") {
      const bits = view.getUint32(21, true);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    return undefined;
  }
  if (bytes.length >= 24 && bytes[0] === 0x89 && ascii(1, 3) === "PNG") {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
      const length = view.getUint16(offset + 2);
      // SOF0–SOF15 except DHT (C4), JPG (C8) and DAC (CC) carry the frame size.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  return undefined;
}

async function readStart(response: Response): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array(await response.arrayBuffer()).subarray(0, HEADER_BYTES);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < HEADER_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.length;
  }
  // A server that ignored the Range header would send the whole file: stop it here.
  await reader.cancel().catch(() => {});
  const joined = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) { joined.set(chunk, at); at += chunk.length; }
  return joined.subarray(0, HEADER_BYTES);
}

async function fetchInfo(url: string): Promise<RemoteImageInfo> {
  try {
    const res = await fetch(url, { headers: { Range: `bytes=0-${HEADER_BYTES - 1}` }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!res.ok) return {};
    const range = res.headers.get("content-range");
    const total = range ? Number(range.split("/")[1]) : Number(res.headers.get("content-length"));
    const bytes = Number.isFinite(total) && total > 0 ? total : undefined;
    const dimensions = imageDimensions(await readStart(res));
    return { bytes, ...dimensions };
  } catch {
    return {};
  }
}

function fresh(url: string) {
  const hit = cache.get(url);
  return hit && Date.now() - hit.at < TTL_MS ? hit : undefined;
}

async function fill(urls: string[]): Promise<void> {
  const todo = [...new Set(urls)].filter((url) => !fresh(url));
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const url = todo[next++];
      let job = inFlight.get(url);
      if (!job) {
        job = fetchInfo(url).then((info) => { cache.set(url, { info, at: Date.now() }); }).finally(() => inFlight.delete(url));
        inFlight.set(url, job);
      }
      await job;
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));
}

/**
 * Size and dimensions for these URLs. Waits at most `waitMs` for the ones not cached yet (the
 * rest keep loading in the background for the next request) so a cold cache never holds the
 * page back for long.
 */
export async function remoteImageInfos(urls: string[], waitMs = 1500): Promise<Map<string, RemoteImageInfo>> {
  const job = fill(urls);
  await Promise.race([job, new Promise((resolve) => setTimeout(resolve, waitMs))]);
  return new Map(urls.map((url) => [url, fresh(url)?.info ?? {}]));
}

/** Byte sizes only (see remoteImageInfos). */
export async function remoteFileSizes(urls: string[], waitMs = 1500): Promise<Map<string, number | undefined>> {
  const infos = await remoteImageInfos(urls, waitMs);
  return new Map(urls.map((url) => [url, infos.get(url)?.bytes]));
}

/** True only once a request for this URL finished without a size (missing / unreadable file). */
export function isKnownMissing(url: string): boolean {
  const hit = fresh(url);
  return Boolean(hit) && hit!.info.bytes === undefined;
}
