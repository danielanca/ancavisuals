import type { Request, Response } from "express";
import { Readable } from "stream";
import archiver from "archiver";
import { signBunnyUrl } from "../utils/signBunnyUrl";
import { createShareRecord, readShareRecord } from "../services/share.store";

const BUNNY_STORAGE_BASE_URL = "https://storage.bunnycdn.com";

const storageZone = process.env.BUNNY_STORAGE_ZONE!;
const storageKey = process.env.BUNNY_STORAGE_KEY!;

const isSafeFile = (name: string) => {
  if (!name) return false;
  if (name.includes("..")) return false;
  if (name.includes("/") || name.includes("\\")) return false;
  if (name.length > 180) return false;
  return /\.(jpg|jpeg|png|webp)$/i.test(name);
};

const toZip = async (slug: string, files: string[], res: Response, zipName: string) => {
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.pipe(res);

  for (const file of files) {
    const url = `${BUNNY_STORAGE_BASE_URL}/${storageZone}/${slug}/photos/${encodeURIComponent(file)}`;
    const response = await fetch(url, { headers: { AccessKey: storageKey } });
    if (!response.ok || !response.body) continue;
    archive.append(Readable.fromWeb(response.body as any), { name: file });
  }

  await archive.finalize();
};

export const createShare = async (req: Request, res: Response) => {
  const slug = String(req.body?.slug || "");
  const itemsRaw = req.body?.items;

  if (!slug) return res.status(400).json({ error: "missing_slug" });

  const items = Array.isArray(itemsRaw) ? itemsRaw.map(String) : [];
  const clean = Array.from(new Set(items.filter(isSafeFile)));

  if (clean.length === 0) return res.status(400).json({ error: "no_files" });
  if (clean.length > 200) return res.status(413).json({ error: "too_many_files" });

  const rec = await createShareRecord(slug, clean, 7);

  return res.json({ id: rec.id, expiresAt: rec.expiresAt, count: rec.items.length });
};

export const getShare = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || "");
    const rec = await readShareRecord(id);

    if (Date.now() > rec.expiresAt) return res.status(410).json({ error: "expired" });

    const urls = rec.items.map(f => signBunnyUrl(`/${rec.slug}/photos/${f}`));

    return res.json({
      id: rec.id,
      slug: rec.slug,
      count: rec.items.length,
      expiresAt: rec.expiresAt,
      photos: urls,
    });
  } catch {
    return res.status(404).json({ error: "not_found" });
  }
};

export const downloadShareZip = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || "");
    const rec = await readShareRecord(id);

    if (Date.now() > rec.expiresAt) return res.status(410).send("expired");

    const files = rec.items.filter(isSafeFile);
    if (files.length === 0) return res.status(400).send("no_files");

    await toZip(rec.slug, files, res, `${rec.slug}-selectie.zip`);
  } catch {
    return res.status(404).send("not_found");
  }
};
