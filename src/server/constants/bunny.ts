// Shared Bunny Storage constants used across uploads, album downloads, and stats.
export const BUNNY_STORAGE_BASE_URL = "https://storage.bunnycdn.com";
export const BUNNY_STORAGE_ZONE_FALLBACK = "ancavisuals-romania";
export const BUNNY_ACCESS_KEY_HEADER = "AccessKey";

// Common folder names in Bunny for delivered media.
export const BUNNY_PHOTOS_FOLDER = "photos";
export const BUNNY_PREVIEW_FOLDER = "photos_preview";
export const BUNNY_QR_MOMENT_FOLDER = "qr-moment";
export const BUNNY_DEFAULT_ARCHIVE_NAME = "photos.zip";

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
