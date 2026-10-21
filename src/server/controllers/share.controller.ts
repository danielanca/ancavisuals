/*
 * Purpose: exposes the share-selection HTTP endpoints that create temporary share
 * records, return signed asset URLs and stream zip archives for selected media.
 */
import type { Request, Response } from "express";
import archiver from "archiver";
import sharp from "sharp";
import { signBunnyUrl } from "../utils/signBunnyUrl";
import { PRIVATE_BUNNY_DIRS } from "../constants/bunny";
import { downloadBunnyOriginal } from "../utils/downloadBunnyOriginal";
import {
  bumpShareCounter,
  createShareRecord,
  listShareRecordsBySlug,
  readShareRecord,
  updateShareRecord,
  type ShareRecord,
} from "../services/share.store";
import { ensureCoupleKey, verifyCoupleKey } from "../services/coupleKey.store";
import {
  COUPLE_KEY_HEADER,
  SHARE_LABEL_MAX,
  cleanShareMessage,
  cleanShareText,
  type ShareLinkSummary,
} from "../../shared/media/shareLinks";
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
// One cap for both: "all photos" already allowed 2000, so a lower cap on the picked ones
// only blocked big selections (209 ticked → 413) without protecting anything.
const MAX_SHARED_FILES = 2000;
const MAX_SHARED_FILES_ALL = 2000;
const SHARE_EXPIRY_DAYS = 365 * 100;

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

// Album folders only: a share later signs `/${slug}/<photos folder>/<file>` for anyone.
const isAlbumSlug = (slug: string) =>
  /^[a-z0-9][a-z0-9-_]{0,120}$/i.test(slug) && !PRIVATE_BUNNY_DIRS.has(slug.toLowerCase());

const coupleKeyFrom = (req: Request) => req.get?.(COUPLE_KEY_HEADER) ?? req.headers?.[COUPLE_KEY_HEADER];

export const createShare = async (req: Request, res: Response) => {
  const slug = String(req.body?.slug || "");
  const itemsRaw = req.body?.items;
  const allItemsRaw = req.body?.allItems;
  const showAll = req.body?.showAll === true;

  if (!slug) return res.status(400).json({ error: "missing_slug" });
  if (!isAlbumSlug(slug)) return res.status(400).json({ error: "invalid_slug" });

  const items = Array.isArray(itemsRaw) ? itemsRaw.map(String) : [];
  const clean = Array.from(new Set(items.filter(isSafeFile)));

  if (clean.length === 0) return res.status(400).json({ error: "no_files" });

  let finalItems = clean;

  if (showAll && Array.isArray(allItemsRaw)) {
    const allItems = allItemsRaw.map(String).filter(isSafeFile);
    const prioritySet = new Set(clean);
    const rest = allItems.filter((name) => !prioritySet.has(name));
    finalItems = [...clean, ...rest];
    if (finalItems.length > MAX_SHARED_FILES_ALL) return res.status(413).json({ error: "too_many_files" });
  } else {
    if (clean.length > MAX_SHARED_FILES) return res.status(413).json({ error: "too_many_files" });
  }

  const label = cleanShareText(req.body?.label, SHARE_LABEL_MAX);
  const message = cleanShareMessage(req.body?.message);
  const byCouple = await verifyCoupleKey(slug, coupleKeyFrom(req)).catch(() => false);

  const rec = await createShareRecord(slug, finalItems, SHARE_EXPIRY_DAYS, showAll, {
    label,
    message,
    createdBy: byCouple ? "couple" : "guest",
  });

  return res.json({ id: rec.id, expiresAt: rec.expiresAt, count: rec.items.length });
};

// GET /api/share/:id/preview.jpg — the image WhatsApp / Messenger show under the link
// (og:image): the first chosen photo as a small 1200×630 JPEG. Stable URL (the CDN links
// are signed for 1 h only) and small (WhatsApp skips heavy previews). Kept in memory.
const PREVIEW_CACHE_MAX = 50;
const previewCache = new Map<string, Buffer>();

export const getSharePreviewImage = async (req: Request, res: Response) => {
  const id = String(req.params.id || "");
  try {
    let image = previewCache.get(id);
    if (!image) {
      const rec = await readShareRecord(id);
      if (rec.revoked || Date.now() > rec.expiresAt) return res.status(404).end();
      const first = rec.items.find(isSafeFile);
      if (!first) return res.status(404).end();
      const folder = await resolvePhotoFolder(rec.slug);
      const source = await fetch(signBunnyUrl(`/${rec.slug}/${folder}/${first}`));
      if (!source.ok) return res.status(404).end();
      image = await sharp(Buffer.from(await source.arrayBuffer()))
        .rotate()
        .resize(1200, 630, { fit: "cover", position: "attention" })
        .jpeg({ quality: 78, mozjpeg: true })
        .toBuffer();
      if (previewCache.size >= PREVIEW_CACHE_MAX) previewCache.delete(previewCache.keys().next().value as string);
      previewCache.set(id, image);
    }
    return res.status(200).set({ "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" }).end(image);
  } catch {
    return res.status(404).end();
  }
};

export const getShare = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || "");
    const rec = await readShareRecord(id);

    if (rec.revoked) return res.status(410).json({ error: "revoked" });
    if (Date.now() > rec.expiresAt) return res.status(410).json({ error: "expired" });

    const photoFolder = await resolvePhotoFolder(rec.slug);
    const urls = rec.items.map(f => signBunnyUrl(`/${rec.slug}/${photoFolder}/${f}`));
    void bumpShareCounter(rec.id, "views");

    return res.json({
      id: rec.id,
      slug: rec.slug,
      count: rec.items.length,
      expiresAt: rec.expiresAt,
      showAll: rec.showAll ?? false,
      label: rec.label,
      message: rec.message,
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

    if (rec.revoked) return res.status(410).send("revoked");
    if (Date.now() > rec.expiresAt) return res.status(410).send("expired");

    const files = rec.items.filter(isSafeFile);
    if (files.length === 0) return res.status(400).send("no_files");

    void bumpShareCounter(rec.id, "downloads");
    const photoFolder = await resolvePhotoFolder(rec.slug);
    await toZip(rec.slug, photoFolder, files, res, `${rec.slug}-selectie.zip`);
  } catch {
    return res.status(404).send("not_found");
  }
};

/** Someone pressed "Trimite mai departe" on a share page. */
export const forwardShare = async (req: Request, res: Response) => {
  try {
    const rec = await readShareRecord(String(req.params.id || ""));
    if (rec.revoked) return res.status(410).json({ error: "revoked" });
    await bumpShareCounter(rec.id, "forwards");
    return res.status(204).end();
  } catch {
    return res.status(404).json({ error: "not_found" });
  }
};

/* ---------- Couple's share manager (unlocked by the secret album key) ---------- */

export const requireCoupleKey = async (req: Request, res: Response, next: () => void) => {
  const slug = String(req.params.slug || "");
  if (!isAlbumSlug(slug)) return res.status(400).json({ error: "invalid_slug" });
  const ok = await verifyCoupleKey(slug, coupleKeyFrom(req)).catch(() => false);
  if (!ok) return res.status(401).json({ error: "invalid_key" });
  next();
};

export const verifyCouple = (_req: Request, res: Response) => res.json({ ok: true });

const toSummary = (rec: ShareRecord, coverFolder: string): ShareLinkSummary => {
  const first = rec.items.find(isSafeFile);
  return {
    id: rec.id,
    label: rec.label,
    message: rec.message,
    createdBy: rec.createdBy,
    count: rec.items.length,
    showAll: rec.showAll ?? false,
    createdAt: rec.createdAt,
    lastViewedAt: rec.lastViewedAt,
    views: rec.views,
    downloads: rec.downloads,
    forwards: rec.forwards,
    revoked: rec.revoked,
    cover: first ? signBunnyUrl(`/${rec.slug}/${coverFolder}/${first}`) : null,
  };
};

export const listCoupleShares = async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug);
    const [records, folder] = await Promise.all([listShareRecordsBySlug(slug), resolvePhotoFolder(slug)]);
    return res.json({ links: records.map((rec) => toSummary(rec, folder)) });
  } catch (error) {
    console.error("[share] list couple shares failed:", error);
    return res.status(500).json({ error: "list_failed" });
  }
};

export const updateCoupleShare = async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug);
    const rec = await readShareRecord(String(req.params.id || "")).catch(() => null);
    if (!rec || rec.slug !== slug) return res.status(404).json({ error: "not_found" });

    const body = req.body ?? {};
    const patch: { label?: string; message?: string; revoked?: boolean } = {};
    if (body.label !== undefined) patch.label = cleanShareText(body.label, SHARE_LABEL_MAX);
    if (body.message !== undefined) patch.message = cleanShareMessage(body.message);
    if (typeof body.revoked === "boolean") patch.revoked = body.revoked;
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "nothing_to_update" });

    await updateShareRecord(rec.id, patch);
    return res.json({ ok: true });
  } catch (error) {
    console.error("[share] update couple share failed:", error);
    return res.status(500).json({ error: "update_failed" });
  }
};

/* ---------- Admin: the couple's secret link ---------- */

export const adminCoupleKey = async (req: Request, res: Response) => {
  const slug = String(req.params.slug || "");
  if (!isAlbumSlug(slug)) return res.status(400).json({ error: "invalid_slug" });
  try {
    const key = await ensureCoupleKey(slug, req.body?.rotate === true);
    return res.json({ key });
  } catch (error) {
    console.error("[share] couple key failed:", error);
    return res.status(500).json({ error: "key_failed" });
  }
};
