import type { Request, Response } from "express";
import archiver from "archiver";
import axios from "axios";
import { loadAlbum } from "../server/services/album.services";
import { readPrintSelection } from "../server/services/printSelection.store";
import { signBunnyUrl } from "./signBunnyUrl";
import { savePrintSelection } from "../server/services/printSelection.store";

const storageZone = process.env.BUNNY_STORAGE_ZONE!;
const storageKey = process.env.BUNNY_STORAGE_KEY!;

const isSafeFile = (name: string) => {
  if (!name) return false;
  if (name.includes("..")) return false;
  if (name.includes("/") || name.includes("\\")) return false;
  if (name.length > 180) return false;
  return /\.(jpg|jpeg|png|webp)$/i.test(name);
};

export async function getAlbum(req: Request, res: Response) {
  const slug = String(req.params.slug || "");

  const exists = await albumExists(slug);
  if (!exists) return res.status(404).json({ error: "Album not found" });

  const album = await loadAlbum(slug);
  if (!album) return res.status(404).json({ error: "Album not found" });

  const saved = await readPrintSelection(slug);
  const clean = Array.from(new Set(saved.filter(isSafeFile)));
  const print = clean.map(f => signBunnyUrl(`/${slug}/photos/${f}`));

  return res.json({ ...album, print });
}

export async function downloadSelectedPhotos(req: Request, res: Response) {
  const slug = String(req.params.slug || "");

  const exists = await albumExists(slug);
  if (!exists) return res.status(404).send("album_not_found");

  const raw = String(req.body?.items || "[]");

  let items: string[] = [];
  try {
    items = JSON.parse(raw);
  } catch {
    return res.status(400).send("invalid_items");
  }

  if (!Array.isArray(items)) return res.status(400).send("invalid_items");

  const files = Array.from(new Set(items.map(String).filter(isSafeFile)));
  if (files.length === 0) return res.status(400).send("no_files");
  if (files.length > 300) return res.status(413).send("too_many_files");

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${slug}-poze-selectate.zip"`);

  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.pipe(res);

  for (const file of files) {
    const url = `https://storage.bunnycdn.com/${storageZone}/${slug}/photos/${encodeURIComponent(file)}`;
    const r = await axios.get(url, {
      responseType: "stream",
      headers: { AccessKey: storageKey },
    });
    archive.append(r.data, { name: file });
  }

  await archive.finalize();
}

export async function postPrintSelection(req: Request, res: Response) {
  const slug = String(req.params.slug || "");

  const exists = await albumExists(slug);
  if (!exists) return res.status(404).json({ error: "album_not_found" });

  const itemsRaw = req.body?.items;

  const items = Array.isArray(itemsRaw) ? itemsRaw.map(String) : [];
  const clean = Array.from(new Set(items.filter(isSafeFile)));

  if (!slug) return res.status(400).json({ error: "missing_slug" });
  if (clean.length === 0) return res.status(400).json({ error: "no_files" });
  if (clean.length > 2000) return res.status(413).json({ error: "too_many_files" });

  await savePrintSelection(slug, clean);
  return res.json({ ok: true, count: clean.length });
}

const albumRootPath = (slug: string) => `https://storage.bunnycdn.com/${storageZone}/${encodeURIComponent(slug)}/`;
async function albumExists(slug: string) {
  const r = await axios.get(albumRootPath(slug), {
    headers: { AccessKey: storageKey },
    validateStatus: () => true,
  });

  if (r.status === 404) return false;
  if (r.status >= 200 && r.status < 300) return true;

  throw new Error(`meta_check_failed:${r.status}`);
}

type BunnyListItem = {
  ObjectName: string;
  IsDirectory: boolean;
};

const isSafeSlug = (slug: string) => /^[a-z0-9][a-z0-9-_]{0,120}$/i.test(slug);

async function bunnyListDir(path: string) {
  const clean = path.replace(/^\/+/, "").replace(/\/?$/, "/");
  const url = `https://storage.bunnycdn.com/${storageZone}/${clean}`;

  const r = await axios.get(url, {
    headers: { AccessKey: storageKey },
    validateStatus: () => true,
  });

  if (r.status === 404) return null;
  if (r.status < 200 || r.status >= 300) {
    throw new Error(`bunny_list_failed:${r.status}`);
  }

  return r.data as BunnyListItem[];
}

const fileNameFromUrl = (src: string) => {
  const p = new URL(src).pathname;
  const last = p.split("/").pop() || "";
  return decodeURIComponent(last);
};

export async function downloadAll(req: Request, res: Response) {
  const slug = String(req.params.slug || "");
  const album = await loadAlbum(slug).catch(() => null);

  if (!album || !Array.isArray(album.photos) || album.photos.length === 0) {
    return res.status(404).json({ error: "Album not found or empty" });
  }

  const base = `${req.protocol}://${req.get("host")}`;

  const toAbsUrl = (src: string) => {
    try {
      return new URL(src).toString();
    } catch {
      return new URL(src, base).toString();
    }
  };

  const candidates = album.photos
    .map((src) => ({ src, abs: toAbsUrl(src), name: (() => {
      try {
        return fileNameFromUrl(toAbsUrl(src));
      } catch {
        return "";
      }
    })() }))
    .filter((x) => isSafeFile(x.name));

  const tryStream = async (url: string) => {
    const r = await axios.get(url, { responseType: "stream", validateStatus: () => true });
    if (r.status >= 200 && r.status < 300) return r.data;
    return null;
  };

  let first: { name: string; stream: any } | null = null;

  for (const c of candidates) {
    try {
      const s1 = await tryStream(c.abs);
      if (s1) {
        first = { name: c.name, stream: s1 };
        break;
      }

      const signed = signBunnyUrl(`${slug}/${c.name}`);
      const s2 = await tryStream(signed);
      if (s2) {
        first = { name: c.name, stream: s2 };
        break;
      }
    } catch {}
  }

  if (!first) {
    return res.status(502).json({ error: "Could not fetch any photos for zipping" });
  }

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${slug}-toate-pozele.zip"`);

  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.on("error", () => {
    try {
      res.status(500).end();
    } catch {}
  });

  archive.pipe(res);

  archive.append(first.stream, { name: first.name });

  for (const c of candidates) {
    if (c.name === first.name) continue;

    try {
      const s1 = await tryStream(c.abs);
      if (s1) {
        archive.append(s1, { name: c.name });
        continue;
      }

      const signed = signBunnyUrl(`${slug}/${c.name}`);
      const s2 = await tryStream(signed);
      if (s2) {
        archive.append(s2, { name: c.name });
      }
    } catch {}
  }

  await archive.finalize();
}

