/*
 * Purpose: one photo of an album lives in several files — the WebP the page shows
 * (photos_preview/Picture-0001.webp), the original (photos/Picture-0001.jpg) and maybe a featured
 * copy. Owner (2026-10-29): deleting a photo deletes all of them. Matched by the name without the
 * extension, read straight from Bunny (not from the album cache), in the main storage zone.
 */
import {
  BUNNY_ACCESS_KEY_HEADER,
  BUNNY_PHOTOS_FOLDER,
  BUNNY_PREVIEW_FOLDER,
  buildBunnyStorageUrl,
  buildBunnyStorageUrlForZone,
  getBunnyStorageKey,
  getBunnySecondStorageKey,
  getBunnyStorageZone,
  getBunnyStorageZoneSecondary,
} from "../constants/bunny";

/** In the order a photo is shown from: the light WebP first, then the original. */
export const PHOTO_FOLDERS = [BUNNY_PREVIEW_FOLDER, BUNNY_PHOTOS_FOLDER, "featured"] as const;

export type AlbumListing = Record<(typeof PHOTO_FOLDERS)[number], string[]>;

export const photoBaseName = (file: string) => file.replace(/\.[^./]+$/, "").toLowerCase();

async function listFolderInZone(zone: string, key: string, slug: string, folder: string): Promise<string[]> {
  const response = await fetch(`${buildBunnyStorageUrlForZone(zone, slug, folder)}/`, { headers: { [BUNNY_ACCESS_KEY_HEADER]: key } });
  if (!response.ok) return [];
  const data = await response.json().catch(() => []) as unknown;
  const items = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { Objects?: unknown[] }).Objects)
      ? (data as { Objects: unknown[] }).Objects
      : [];
  return items
    .filter((item): item is { ObjectName: string; IsDirectory?: boolean } => Boolean(item) && typeof (item as { ObjectName?: unknown }).ObjectName === "string")
    .filter((item) => !item.IsDirectory)
    .map((item) => item.ObjectName);
}

async function listFolder(slug: string, folder: string): Promise<string[]> {
  const primary = await listFolderInZone(getBunnyStorageZone(), getBunnyStorageKey(), slug, folder);
  if (primary.length > 0) return primary;
  const secondaryKey = getBunnySecondStorageKey();
  if (!secondaryKey || getBunnyStorageZoneSecondary() === getBunnyStorageZone()) return primary;
  return listFolderInZone(getBunnyStorageZoneSecondary(), secondaryKey, slug, folder);
}

export async function listAlbumPhotoFolders(slug: string): Promise<AlbumListing> {
  const [preview, photos, featured] = await Promise.all(PHOTO_FOLDERS.map((folder) => listFolder(slug, folder)));
  return { [BUNNY_PREVIEW_FOLDER]: preview, [BUNNY_PHOTOS_FOLDER]: photos, featured } as AlbumListing;
}

/** "photos_preview/Picture-0001.webp", "photos/Picture-0001.jpg", … — every file of that photo. */
export function photoCopies(listing: AlbumListing, filename: string): string[] {
  const wanted = photoBaseName(filename);
  return PHOTO_FOLDERS.flatMap((folder) => listing[folder].filter((name) => photoBaseName(name) === wanted).map((name) => `${folder}/${name}`));
}

/** The file to show for a photo: its preview when there is one, else the original (or null when gone). */
export function photoDisplayPath(listing: AlbumListing, filename: string): string | null {
  return photoCopies(listing, filename)[0] ?? null;
}

/**
 * Bunny normally returns the real extension in the folder listing. Keep the
 * canonical counterparts too, because an older/incomplete listing may expose
 * only the WebP name while the original JPG is still present.
 */
function photoDeletePaths(listing: AlbumListing, filename: string): string[] {
  const base = filename.replace(/\.[^./]+$/, "");
  const listed = photoCopies(listing, filename);
  const canonical = [
    ...["webp"].map((extension) => `${BUNNY_PREVIEW_FOLDER}/${base}.${extension}`),
    ...["jpg", "jpeg", "png", "webp"].map((extension) => `${BUNNY_PHOTOS_FOLDER}/${base}.${extension}`),
    ...["jpg", "jpeg", "png", "webp"].map((extension) => `featured/${base}.${extension}`),
  ];
  return Array.from(new Set([...listed, ...canonical]));
}

export type DeleteResult = {
  /** Photos with no file left (deleted now, or already gone). */
  deleted: string[];
  /** Photos Bunny refused to delete (a file of theirs is still there). */
  failed: string[];
  /** How many files were actually removed. */
  filesRemoved: number;
};

/** Deletes every copy of each photo. A file already missing (404) counts as deleted. */
export async function deletePhotoCopies(slug: string, filenames: string[], listing?: AlbumListing): Promise<DeleteResult> {
  const files = listing ?? await listAlbumPhotoFolders(slug);
  const result: DeleteResult = { deleted: [], failed: [], filesRemoved: 0 };
  for (const filename of filenames) {
    let ok = true;
    for (const path of photoDeletePaths(files, filename)) {
      const encodedPath = [slug, ...path.split("/").map(encodeURIComponent)];
      const response = await fetch(buildBunnyStorageUrl(...encodedPath), {
        method: "DELETE",
        headers: { [BUNNY_ACCESS_KEY_HEADER]: getBunnyStorageKey() },
      });
      if (response.ok) result.filesRemoved += 1;
      else if (response.status === 404 && getBunnySecondStorageKey() && getBunnyStorageZoneSecondary() !== getBunnyStorageZone()) {
        const secondaryResponse = await fetch(buildBunnyStorageUrlForZone(getBunnyStorageZoneSecondary(), ...encodedPath), {
          method: "DELETE",
          headers: { [BUNNY_ACCESS_KEY_HEADER]: getBunnySecondStorageKey() },
        });
        if (secondaryResponse.ok) result.filesRemoved += 1;
        else if (secondaryResponse.status !== 404) {
          console.error(`[album-photo] Bunny delete failed for ${slug}/${path} in secondary zone: ${secondaryResponse.status}`);
          ok = false;
        }
      } else if (response.status !== 404) {
        console.error(`[album-photo] Bunny delete failed for ${slug}/${path}: ${response.status}`);
        ok = false;
      }
    }
    (ok ? result.deleted : result.failed).push(filename);
  }
  return result;
}
