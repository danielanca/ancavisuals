import type { Request, Response } from "express";
import { loadAlbum } from "../services/album.services";

const BUNNY_STORAGE_BASE_URL = "https://storage.bunnycdn.com";

const storageZone = process.env.BUNNY_STORAGE_ZONE!;
const storageKey = process.env.BUNNY_STORAGE_KEY!;

type BunnyEntry = {
  ObjectName: string;
  Length: number;
  IsDirectory: boolean;
};

const listBunnyDirectory = async (directoryPath: string) => {
  const cleanPath = directoryPath.replace(/^\/+/, "").replace(/\/+$/, "");
  const url = `${BUNNY_STORAGE_BASE_URL}/${storageZone}/${cleanPath}/`;

  const response = await fetch(url, {
    headers: { AccessKey: storageKey },
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
    .filter((entry) => /\.(jpg|jpeg|png|webp)$/i.test(entry.ObjectName));

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
