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
  const album = await loadAlbum(slug);
  if (!album) return res.status(404).json({ error: "Album not found" });

  const saved = await readPrintSelection(slug);
  const clean = Array.from(new Set(saved.filter(isSafeFile)));
  const print = clean.map((f) => signBunnyUrl(`/${slug}/photos/${f}`));

  return res.json({ ...album, print });
}

export async function downloadSelectedPhotos(req: Request, res: Response) {
  const slug = String(req.params.slug || "");
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
  const itemsRaw = req.body?.items;

  const items = Array.isArray(itemsRaw) ? itemsRaw.map(String) : [];
  const clean = Array.from(new Set(items.filter(isSafeFile)));

  if (!slug) return res.status(400).json({ error: "missing_slug" });
  if (clean.length === 0) return res.status(400).json({ error: "no_files" });
  if (clean.length > 2000) return res.status(413).json({ error: "too_many_files" });

  await savePrintSelection(slug, clean);
  return res.json({ ok: true, count: clean.length });
}