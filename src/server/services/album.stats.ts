import type { Request, Response } from "express";
import { loadAlbum } from "../services/album.services";
import {
  BUNNY_ACCESS_KEY_HEADER,
  BUNNY_IMAGE_FILE_PATTERN,
  buildBunnyDirectoryUrl,
  getBunnyStorageKey,
  getBunnyStorageZone,
} from "../constants/bunny";

const storageZone = getBunnyStorageZone();
const storageKey = getBunnyStorageKey();

type BunnyEntry = {
  ObjectName: string;
  Length: number;
  IsDirectory: boolean;
};

const listBunnyDirectory = async (directoryPath: string) => {
  const url = buildBunnyDirectoryUrl(directoryPath);

  const response = await fetch(url, {
    headers: { [BUNNY_ACCESS_KEY_HEADER]: storageKey },
  });

  if (!response.ok) {
    console.log("Bunny list failed", response.status, url, "zone:", storageZone, "hasKey:", Boolean(storageKey));
    return [];
  }

  return ((await response.json()) as BunnyEntry[]) ?? [];
};

const fetchFileSizeBytes = async (fileUrl: string) => {
  const response = await fetch(fileUrl, { method: "HEAD" });
  const contentLength = response.headers.get("content-length");
  const parsed = contentLength ? Number(contentLength) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function getAlbumStats(req: Request, res: Response) {
  const slug = String(req.params.slug || "");
  const album = await loadAlbum(slug).catch(() => null);

  if (!album) return res.status(404).json({ error: "Album not found" });

  let directoryPath = slug;

  try {
    const firstPhoto = album.originalPhoto?.[0];
    if (firstPhoto) {
      const pathname = new URL(firstPhoto).pathname.replace(/^\/+/, "");
      const pathParts = pathname.split("/");
      pathParts.pop();
      directoryPath = pathParts.join("/");
    }
  } catch {}

  const directoryEntries = await listBunnyDirectory(directoryPath).catch(() => []);

  const photoEntries = directoryEntries
    .filter((entry) => !entry.IsDirectory)
    .filter((entry) => BUNNY_IMAGE_FILE_PATTERN.test(entry.ObjectName));

  const photosCount = photoEntries.length;
  const photosBytesTotal = photoEntries.reduce((total, entry) => total + (Number(entry.Length) || 0), 0);

  const shortVideoBytes = album.shortvideo ? await fetchFileSizeBytes(album.shortvideo) : 0;
  const longVideoBytes = album.longvideo ? await fetchFileSizeBytes(album.longvideo) : 0;

  return res.json({
    photosCount,
    photosBytesTotal,
    shortVideoBytes,
    longVideoBytes,
    bytesTotalAll: photosBytesTotal + shortVideoBytes + longVideoBytes,
    directoryPath,
  });
}
