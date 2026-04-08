import type { Request, Response } from "express";
import axios from "axios";
import { loadAlbum } from "../services/album.services";

const storageZone = process.env.BUNNY_STORAGE_ZONE!;
const storageKey = process.env.BUNNY_STORAGE_KEY!;

type BunnyEntry = {
  ObjectName: string;
  Length: number;
  IsDirectory: boolean;
};

const listBunnyDir = async (path: string) => {
  const clean = path.replace(/^\/+/, "").replace(/\/+$/, "");
  const url = `https://storage.bunnycdn.com/${storageZone}/${clean}/`;

  const r = await axios.get(url, {
    headers: { AccessKey: storageKey },
    validateStatus: () => true,
  });

  if (r.status < 200 || r.status >= 300) {
    console.log("Bunny list failed", r.status, url, "zone:", storageZone, "hasKey:", Boolean(storageKey));
    return [];
  }

  return (r.data as BunnyEntry[]) ?? [];
};


const headSize = async (url: string) => {
  const r = await axios.head(url, { validateStatus: () => true });
  const v = r.headers?.["content-length"];
  const n = typeof v === "string" ? Number(v) : Array.isArray(v) ? Number(v[0]) : NaN;
  return Number.isFinite(n) ? n : 0;
};

export async function getAlbumStats(req: Request, res: Response) {
  const slug = String(req.params.slug || "");
  const album = await loadAlbum(slug).catch(() => null);

  if (!album) return res.status(404).json({ error: "Album not found" });

  let dir = slug;

  try {
    const first = album.originalPhoto?.[0];
    if (first) {
      const p = new URL(first).pathname.replace(/^\/+/, "");
      const parts = p.split("/");
      parts.pop();
      dir = parts.join("/");
    }
  } catch {}

  const entries = await listBunnyDir(dir).catch(() => []);

  const photoEntries = entries
    .filter((e) => !e.IsDirectory)
    .filter((e) => /\.(jpg|jpeg|png|webp)$/i.test(e.ObjectName));

  const photosCount = photoEntries.length;
  const photosBytesTotal = photoEntries.reduce((s, e) => s + (Number(e.Length) || 0), 0);

  const shortVideoBytes = album.shortvideo ? await headSize(album.shortvideo) : 0;
  const longVideoBytes = album.longvideo ? await headSize(album.longvideo) : 0;

  return res.json({
    photosCount,
    photosBytesTotal,
    shortVideoBytes,
    longVideoBytes,
    bytesTotalAll: photosBytesTotal + shortVideoBytes + longVideoBytes,
    dir,
  });
}
