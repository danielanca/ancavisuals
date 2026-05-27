/*
 * Purpose: exposes the share-selection HTTP endpoints that create temporary share
 * records, return signed asset URLs and stream zip archives for selected media.
 */
import type { Request, Response } from "express";
import archiver from "archiver";
import { signBunnyUrl } from "../utils/signBunnyUrl";
import { downloadBunnyOriginal } from "../utils/downloadBunnyOriginal";
import { createShareRecord, readShareRecord } from "../services/share.store";
import {
  BUNNY_ACCESS_KEY_HEADER,
  BUNNY_IMAGE_FILE_PATTERN,
  BUNNY_PHOTOS_FOLDER,
  BUNNY_PREVIEW_FOLDER,
  ZIP_COMPRESSION_STANDARD,
  buildBunnyDirectoryUrl,
  getBunnyStorageKey,
} from "../constants/bunny";

const storageKey = getBunnyStorageKey();
const MAX_SHARED_FILES = 200;
const SHARE_EXPIRY_DAYS = 7;

async function resolvePhotoFolder(slug: string): Promise<string> {
  try {
    const url = buildBunnyDirectoryUrl(slug, BUNNY_PREVIEW_FOLDER);
    const response = await fetch(url, { headers: { [BUNNY_ACCESS_KEY_HEADER]: storageKey } });
    if (response.ok) {
      const data = await response.json() as { ObjectName: string; IsDirectory: boolean }[];
      if (Array.isArray(data) && data.length > 0) return BUNNY_PREVIEW_FOLDER;
    }
  } catch { /* fall through */ }
  return BUNNY_PHOTOS_FOLDER;
}

const isSafeFile = (name: string) => {
  if (!name) return false;
  if (name.includes("..")) return false;
  if (name.includes("/") || name.includes("\\")) return false;
  if (name.length > 180) return false;
  return BUNNY_IMAGE_FILE_PATTERN.test(name);
};

const toZip = async (slug: string, folder: string, files: string[], res: Response, zipName: string) => {
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

  const archive = archiver("zip", { zlib: { level: ZIP_COMPRESSION_STANDARD } });
  archive.pipe(res);

  for (const file of files) {
    try {
      // signBunnyUrl builds a CDN URL; downloadBunnyOriginal will try photos/ (original)
      // first when the path contains photos_preview/, falling back to preview if needed
      const cdnUrl = signBunnyUrl(`/${slug}/${folder}/${file}`);
      const { buffer, contentType } = await downloadBunnyOriginal(cdnUrl);
      const baseName = file.replace(/\.[^.]+$/, "");
      const extension = contentType.includes("png") ? ".png" : ".jpg";
      archive.append(buffer, { name: `${baseName}${extension}` });
    } catch {
      // skip files that can't be fetched
    }
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

    const photoFolder = await resolvePhotoFolder(rec.slug);
    const urls = rec.items.map(f => signBunnyUrl(`/${rec.slug}/${photoFolder}/${f}`));

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

    const photoFolder = await resolvePhotoFolder(rec.slug);
    await toZip(rec.slug, photoFolder, files, res, `${rec.slug}-selectie.zip`);
  } catch {
    return res.status(404).send("not_found");
  }
};
