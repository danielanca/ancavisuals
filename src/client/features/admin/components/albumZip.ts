import { albumZipManifest } from "../../../../shared/albumZipManifest";

export interface AlbumZipEntry {
  name: string;
  file: Blob & { lastModified?: number };
}

const MAX_32 = 0xffffffff;
const CHUNK = 4 * 1024 * 1024;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(crc: number, bytes: Uint8Array): number {
  let c = crc ^ MAX_32;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ MAX_32) >>> 0;
}

function dosDateTime(ms: number): { time: number; date: number } {
  const d = new Date(ms);
  const year = Math.min(Math.max(d.getFullYear(), 1980), 2107);
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

const u64 = (view: DataView, offset: number, value: number) => {
  view.setUint32(offset, value % 0x100000000, true);
  view.setUint32(offset + 4, Math.floor(value / 0x100000000), true);
};

/**
 * Stored (uncompressed) ZIP: JPEGs do not shrink, and a Blob made of the original
 * File parts never loads the album into RAM. Only the CRC pass reads each file once.
 * Offsets past 4 GB switch to ZIP64 so large weddings still open everywhere.
 */
export async function buildAlbumZip(
  entries: AlbumZipEntry[],
  signal: AbortSignal,
  onProgress: (readBytes: number, totalBytes: number) => void,
  zip64Threshold = MAX_32,
): Promise<Blob> {
  const encoder = new TextEncoder();
  const totalBytes = entries.reduce((sum, entry) => sum + entry.file.size, 0);
  const parts: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  let readBytes = 0;

  for (const entry of entries) {
    if (entry.file.size >= MAX_32) throw new Error(`${entry.name} depășește 4 GB.`);
    let crc = 0;
    for (let start = 0; start < entry.file.size; start += CHUNK) {
      if (signal.aborted) throw new Error("ZIP anulat");
      const chunk = new Uint8Array(await entry.file.slice(start, start + CHUNK).arrayBuffer());
      crc = crc32(crc, chunk);
      readBytes += chunk.length;
      onProgress(readBytes, totalBytes);
    }

    const name = encoder.encode(entry.name);
    const { time, date } = dosDateTime(entry.file.lastModified ?? Date.now());
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, entry.file.size, true);
    local.setUint32(22, entry.file.size, true);
    local.setUint16(26, name.length, true);
    parts.push(local.buffer, name, entry.file);

    const zip64 = offset >= zip64Threshold;
    const header = new DataView(new ArrayBuffer(46 + name.length + (zip64 ? 12 : 0)));
    header.setUint32(0, 0x02014b50, true);
    header.setUint16(4, 45, true);
    header.setUint16(6, zip64 ? 45 : 20, true);
    header.setUint16(8, 0x0800, true);
    header.setUint16(12, time, true);
    header.setUint16(14, date, true);
    header.setUint32(16, crc, true);
    header.setUint32(20, entry.file.size, true);
    header.setUint32(24, entry.file.size, true);
    header.setUint16(28, name.length, true);
    header.setUint16(30, zip64 ? 12 : 0, true);
    header.setUint32(42, zip64 ? MAX_32 : offset, true);
    new Uint8Array(header.buffer).set(name, 46);
    if (zip64) {
      header.setUint16(46 + name.length, 0x0001, true);
      header.setUint16(48 + name.length, 8, true);
      u64(header, 50 + name.length, offset);
    }
    central.push(new Uint8Array(header.buffer));
    offset += 30 + name.length + entry.file.size;
  }

  const centralOffset = offset;
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  parts.push(...central);
  const needsZip64 = entries.length >= 0xffff || centralOffset >= zip64Threshold || centralSize >= zip64Threshold;
  if (needsZip64) {
    const record = new DataView(new ArrayBuffer(56 + 20));
    record.setUint32(0, 0x06064b50, true);
    u64(record, 4, 44);
    record.setUint16(12, 45, true);
    record.setUint16(14, 45, true);
    u64(record, 24, entries.length);
    u64(record, 32, entries.length);
    u64(record, 40, centralSize);
    u64(record, 48, centralOffset);
    record.setUint32(56, 0x07064b50, true);
    u64(record, 64, centralOffset + centralSize);
    record.setUint32(72, 1, true);
    parts.push(record.buffer);
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, needsZip64 ? 0xffff : entries.length, true);
  end.setUint16(10, needsZip64 ? 0xffff : entries.length, true);
  end.setUint32(12, needsZip64 ? MAX_32 : centralSize, true);
  end.setUint32(16, needsZip64 ? MAX_32 : centralOffset, true);
  parts.push(end.buffer);
  return new Blob(parts, { type: "application/zip" });
}

export async function albumZipManifestHash(names: string[]): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(albumZipManifest(names)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** XHR instead of fetch: only XHR reports upload progress for a multi-GB body. */
export function uploadAlbumZip(
  url: string,
  zip: Blob,
  headers: Record<string, string>,
  signal: AbortSignal,
  onProgress: (sentBytes: number, totalBytes: number) => void,
): Promise<{ ok: boolean; status: number; error?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    // No total timeout (a big album on a slow uplink takes long); abort only when bytes stop moving.
    let stall = setTimeout(() => xhr.abort(), 180_000);
    const touch = () => { clearTimeout(stall); stall = setTimeout(() => xhr.abort(), 180_000); };
    const abort = () => xhr.abort();
    const cleanup = () => { clearTimeout(stall); signal.removeEventListener("abort", abort); };
    signal.addEventListener("abort", abort, { once: true });
    xhr.open("POST", url);
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = (event) => { touch(); onProgress(event.loaded, event.total || zip.size); };
    // After the last byte the server still verifies the ZIP in Bunny, so no stall timer then.
    xhr.upload.onload = () => clearTimeout(stall);
    xhr.onload = () => {
      cleanup();
      let error: string | undefined;
      try { error = (JSON.parse(xhr.responseText) as { error?: string }).error; } catch { /* non-JSON proxy page */ }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, error });
    };
    xhr.onerror = () => { cleanup(); reject(new Error("Conexiunea s-a întrerupt în timpul încărcării ZIP-ului.")); };
    xhr.onabort = () => { cleanup(); reject(new Error(signal.aborted ? "ZIP anulat" : "Încărcarea ZIP-ului s-a blocat (fără progres 3 minute).")); };
    xhr.send(zip);
  });
}
