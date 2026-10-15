// Shared Bunny Storage constants used across uploads, album downloads, and stats.
export const BUNNY_STORAGE_BASE_URL = "https://storage.bunnycdn.com";
export const BUNNY_STORAGE_ZONE_FALLBACK = "ancavisuals-ro";
export const BUNNY_ACCESS_KEY_HEADER = "AccessKey";

// Common folder names in Bunny for delivered media.
export const BUNNY_PHOTOS_FOLDER = "photos";
export const BUNNY_PREVIEW_FOLDER = "photos_preview";
export const BUNNY_QR_MOMENT_FOLDER = "qr-moment";
export const BUNNY_DEFAULT_ARCHIVE_NAME = "photos.zip";

// Top-level folders holding business documents, never served through the public CDN signers.
export const PRIVATE_BUNNY_DIRS = new Set([
  "admin-events", "bank-statements", "company-documents", "contracts", "expenses",
  "handover", "health-activity", "invoices", "offers",
]);

/** The decoded path when it is safe to sign for a visitor (album media), otherwise null. */
export function publicMediaPath(raw: string): string | null {
  let path: string;
  try { path = decodeURIComponent(raw); } catch { return null; }
  path = path.replace(/^\/+/, "");
  const segments = path.split("/");
  if (!path || path.includes("\\") || segments.some((s) => s === ".." || s === "." || s === "")) return null;
  if (PRIVATE_BUNNY_DIRS.has(segments[0].toLowerCase())) return null;
  return path;
}

// Shared operational limits for uploads and generated archives.
export const MAX_QR_UPLOAD_FILES = 25;
export const MAX_QR_UPLOAD_FILE_SIZE_BYTES = 200 * 1024 * 1024;
export const ZIP_COMPRESSION_STANDARD = 6;
export const ZIP_COMPRESSION_MAX = 9;

export const BUNNY_IMAGE_FILE_PATTERN = /\.(jpg|jpeg|png|webp)$/i;

export const getBunnyStorageZone = (): string =>
  process.env.BUNNY_STORAGE_ZONE || BUNNY_STORAGE_ZONE_FALLBACK;

export const getBunnyStorageKey = (): string => process.env.BUNNY_STORAGE_KEY || "";

export const getBunnyStoragePassword = (): string => process.env.BUNNY_STORAGE_PASSWORD || "";

const buildBunnyStoragePath = (...segments: string[]): string => {
  const cleanSegments = segments
    .map(segment => segment.replace(/^\/+/, "").replace(/\/+$/, ""))
    .filter(Boolean);

  return [getBunnyStorageZone(), ...cleanSegments].join("/");
};

export const buildBunnyStorageUrl = (...segments: string[]): string =>
  `${BUNNY_STORAGE_BASE_URL}/${buildBunnyStoragePath(...segments)}`;

export const buildBunnyDirectoryUrl = (...segments: string[]): string =>
  `${buildBunnyStorageUrl(...segments)}/`;
