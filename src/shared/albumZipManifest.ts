// Originals that belong in photos.zip, identical for the browser-built and the server-built archive.
export const ALBUM_ZIP_PHOTO_EXT = /\.(jpg|jpeg|png|webp|heic|heif)$/i;

/** Canonical text both sides hash (SHA-256) to prove the ZIP holds exactly the album's originals. */
export function albumZipManifest(names: string[]): string {
  return [...names].sort().join("\n");
}
