/*
 * Purpose: exposes the share-selection HTTP endpoints that create temporary share
 * records, return signed asset URLs and stream zip archives for selected media.
 */
import type { Request, Response } from "express";
import { Readable } from "stream";
import type { ReadableStream as NodeReadableStream } from "stream/web";
import archiver from "archiver";
import { signBunnyUrl } from "../utils/signBunnyUrl";
import { createShareRecord, readShareRecord } from "../services/share.store";
import {
  BUNNY_ACCESS_KEY_HEADER,
  BUNNY_IMAGE_FILE_PATTERN,
  BUNNY_PHOTOS_FOLDER,
  ZIP_COMPRESSION_STANDARD,
  buildBunnyStorageUrl,
  getBunnyStorageKey,
} from "../constants/bunny";

const storageKey = getBunnyStorageKey();
const MAX_SHARED_FILES = 200;
const SHARE_EXPIRY_DAYS = 7;

type BunnyDirectoryEntry = {
  ObjectName: string;
  IsDirectory: boolean;
};

const isSafeFile = (name: string) => {
  if (!name) return false;
  if (name.includes("..")) return false;
  if (name.includes("/") || name.includes("\\")) return false;
  if (name.length > 180) return false;
  return BUNNY_IMAGE_FILE_PATTERN.test(name);
};

const toZip = async (slug: string, files: string[], res: Response, zipName: string) => {
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

  const archive = archiver("zip", { zlib: { level: ZIP_COMPRESSION_STANDARD } });
  archive.pipe(res);

  for (const file of files) {
    const url = buildBunnyStorageUrl(slug, BUNNY_PHOTOS_FOLDER, encodeURIComponent(file));
    const response = await fetch(url, { headers: { [BUNNY_ACCESS_KEY_HEADER]: storageKey } });
    if (!response.ok || !response.body) continue;
    archive.append(Readable.fromWeb(response.body as unknown as NodeReadableStream), { name: file });
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
  if (clean.length > MAX_SHARED_FILES) return res.status(413).json({ error: "too_many_files" });

  const rec = await createShareRecord(slug, clean, SHARE_EXPIRY_DAYS);

  return res.json({ id: rec.id, expiresAt: rec.expiresAt, count: rec.items.length });
};

export const getShare = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || "");
    const rec = await readShareRecord(id);

    if (Date.now() > rec.expiresAt) return res.status(410).json({ error: "expired" });

    const urls = rec.items.map(f => signBunnyUrl(`/${rec.slug}/${BUNNY_PHOTOS_FOLDER}/${f}`));

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
