/*
 * Purpose: handles album-facing HTTP actions such as loading album data,
 * generating downloads, deleting media and persisting print-selection metadata.
 * It coordinates Bunny storage access with Firestore-backed selection state.
 */
import type { Request, Response } from "express";
import { Readable } from "stream";
import type { ReadableStream as NodeReadableStream } from "stream/web";
import archiver from "archiver";
import { loadAlbum } from "../services/album.service";
import { readPrintSelection, savePrintSelection, saveDeliveryAddress, readDeliveryAddress, addLink } from "../services/printSelection.store";
import { signBunnyUrl } from "../utils/signBunnyUrl";
import { db } from "../firestore";
import {
  BUNNY_ACCESS_KEY_HEADER,
  BUNNY_DEFAULT_ARCHIVE_NAME,
  BUNNY_IMAGE_FILE_PATTERN,
  BUNNY_PHOTOS_FOLDER,
  BUNNY_PREVIEW_FOLDER,
  ZIP_COMPRESSION_MAX,
  ZIP_COMPRESSION_STANDARD,
  buildBunnyDirectoryUrl,
  buildBunnyStorageUrl,
  getBunnyStorageKey,
} from "../constants/bunny";

const ADMIN_SECRET_KEY = process.env.ALBUM_ADMIN_KEY || "ankvisuals1994";
const storageKey = getBunnyStorageKey();
const MAX_SELECTED_DOWNLOAD_FILES = 300;
const MAX_PRINT_SELECTION_FILES = 2000;

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

const isSafeSlug = (slug: string) => /^[a-z0-9][a-z0-9-_]{0,120}$/i.test(slug);

export async function getAlbum(req: Request, res: Response) {
  const slug = String(req.params.slug || "");

  const exists = await albumExists(slug);
  if (!exists) return res.status(404).json({ error: "Album not found" });

  const album = await loadAlbum(slug);
  if (!album) return res.status(404).json({ error: "Album not found" });

  const saved = await readPrintSelection(slug);
  const photoPath = await checkPreviewExist(slug);
  const clean = Array.from(new Set(saved.filter(isSafeFile)));
  const print = clean.map(f => signBunnyUrl(`/${slug}/${photoPath}/${f}`));

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
  if (files.length > MAX_SELECTED_DOWNLOAD_FILES) return res.status(413).send("too_many_files");

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${slug}-poze-selectate.zip"`);

  const archive = archiver("zip", { zlib: { level: ZIP_COMPRESSION_STANDARD } });
  archive.pipe(res);

  const photoPath = await checkPreviewExist(slug);

  for (const file of files) {
    const url = buildBunnyStorageUrl(slug, photoPath, encodeURIComponent(file));
    try {
      const response = await fetch(url, { headers: { [BUNNY_ACCESS_KEY_HEADER]: storageKey } });
      if (!response.ok || !response.body) continue;
      archive.append(Readable.fromWeb(response.body as unknown as NodeReadableStream), { name: file });
    } catch (err) {
      console.error(`Failed to fetch file for zip: ${file}`, err);
    }
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

  if (clean.length > MAX_PRINT_SELECTION_FILES) return res.status(413).json({ error: "too_many_files" });

  await savePrintSelection(slug, clean);
  return res.json({ ok: true, count: clean.length });
}

export async function deletePhoto(req: Request, res: Response) {
  const slug = String(req.params.slug || "");
  const { filename } = req.body;

  const providedKey = req.headers["x-admin-key"];
  if (providedKey !== ADMIN_SECRET_KEY) {
    return res.status(403).json({ error: "forbidden" });
  }

  if (!slug || !isSafeSlug(slug)) {
    return res.status(400).json({ error: "invalid_slug" });
  }

  if (!filename || typeof filename !== "string" || !isSafeFile(filename)) {
    return res.status(400).json({ error: "invalid_filename" });
  }

  try {
    const exists = await albumExists(slug);
    if (!exists) return res.status(404).json({ error: "album_not_found" });

    const photoPath = await checkPreviewExist(slug);
    const deleteUrl = buildBunnyStorageUrl(slug, photoPath, encodeURIComponent(filename));

    const deleteResponse = await fetch(deleteUrl, {
      method: "DELETE",
      headers: { [BUNNY_ACCESS_KEY_HEADER]: storageKey },
    });

    if (!deleteResponse.ok) {
      console.error("Bunny delete failed:", deleteResponse.status);
      return res.status(500).json({ error: "failed_to_delete_file" });
    }

    const currentPrint = await readPrintSelection(slug);
    const updatedPrint = currentPrint.filter((f: string) => f !== filename);
    if (updatedPrint.length !== currentPrint.length) {
      await savePrintSelection(slug, updatedPrint);
    }

    const album = await loadAlbum(slug);
    if (!album) return res.status(500).json({ error: "failed_to_reload_album" });

    const saved = await readPrintSelection(slug);
    const clean = Array.from(new Set(saved.filter(isSafeFile)));
    const print = clean.map((f: string) => signBunnyUrl(`/${slug}/${photoPath}/${f}`));

    return res.json({ ...album, print });
  } catch (error) {
    console.error("Delete photo error:", error);
    return res.status(500).json({ error: "server_error" });
  }
}

const albumRootUrl = (slug: string) =>
  buildBunnyDirectoryUrl(encodeURIComponent(slug));

async function albumExists(slug: string) {
  const response = await fetch(albumRootUrl(slug), {
    headers: { [BUNNY_ACCESS_KEY_HEADER]: storageKey },
  });

  if (response.status === 404) return false;
  if (response.ok) return true;

  throw new Error(`meta_check_failed:${response.status}`);
}

export async function downloadAll(req: Request, res: Response) {
  const slug = String(req.params.slug || "");
  const zipFile = BUNNY_DEFAULT_ARCHIVE_NAME;

  const ok = await bunnyHasFileInDir(slug, zipFile);

  if (!ok) {
    return res.status(409).json({
      error: "ZipNotReady",
      message: "photos.zip lipsește. Creează-l în Bunny: click dreapta pe folderul 'photos' -> Compress -> nume 'photos'.",
      expectedPath: `${slug}/${zipFile}`,
    });
  }

  const zipPath = `${slug}/photos.zip`;
  const downloadName = `${slug}-toate-pozele.zip`;

  return res.redirect(
    302,
    `/api/download?path=${encodeURIComponent(zipPath)}&name=${encodeURIComponent(downloadName)}`
  );
}

async function bunnyHasFileInDir(dir: string, fileName: string) {
  const url = buildBunnyDirectoryUrl(dir);

  const response = await fetch(url, { headers: { [BUNNY_ACCESS_KEY_HEADER]: storageKey } });

  if (!response.ok) return false;

  const entries = (await response.json()) as BunnyDirectoryEntry[];
  return entries.some((entry) => !entry.IsDirectory && entry.ObjectName === fileName);
}

export async function downloadPrintDynamic(req: Request, res: Response) {
  const slug = String(req.params.slug || "");

  const snap = await db.collection("printSelections").doc(slug).get();
  const items = snap.data()?.items as string[] | undefined;

  if (!items || items.length === 0) {
    return res.status(404).json({ error: "No print selection" });
  }

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="poze-imprimare-${slug}.zip"`);
  res.setHeader("Cache-Control", "no-store");

  const archive = archiver("zip", { zlib: { level: ZIP_COMPRESSION_MAX } });
  archive.pipe(res);

  const photoPath = await checkPreviewExist(slug);

  for (const file of items) {
    const url = buildBunnyStorageUrl(slug, photoPath, file);
    const response = await fetch(url, { headers: { [BUNNY_ACCESS_KEY_HEADER]: storageKey } });

    if (!response.ok || !response.body) continue;

    archive.append(Readable.fromWeb(response.body as unknown as NodeReadableStream), { name: file });
  }

  await archive.finalize();
}

async function checkPreviewExist(slug: string) {
  const url = buildBunnyDirectoryUrl(slug, BUNNY_PREVIEW_FOLDER);

  const response = await fetch(url, { headers: { [BUNNY_ACCESS_KEY_HEADER]: storageKey } });

  if (response.ok) {
    const data = await response.json() as BunnyDirectoryEntry[];
    if (Array.isArray(data) && data.length > 0) return BUNNY_PREVIEW_FOLDER;
  }

  return BUNNY_PHOTOS_FOLDER;
}

export async function addDeliveryAddress(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const data = req.body;

    if (!data.fullName || !data.phone || !data.street || !data.city) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: fullName, phone, street, city",
      });
    }

    await saveDeliveryAddress(slug, {
      fullName: data.fullName,
      phone: data.phone,
      street: data.street,
      city: data.city,
      easybox: data.easybox,
    });

    return res.status(200).json({ success: true, message: "Delivery address saved successfully" });
  } catch (error) {
    console.error("Error saving delivery address:", error);
    return res.status(500).json({ success: false, error: "Failed to save delivery address" });
  }
}

export async function getDeliveryAddress(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const result = await readDeliveryAddress(slug);
    return res.status(200).json({ data: result, success: true, message: "Delivery address fetched successfully" });
  } catch (error) {
    console.error("Error fetching delivery address:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch delivery address" });
  }
}

export async function addSwissLink(req: Request, res: Response) {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({ success: false, error: "Missing slug in URL" });
    }

    const data = req.body;

    if (!data.link) {
      return res.status(400).json({ success: false, error: "Missing required field: link" });
    }

    await addLink(slug, data.link);

    return res.status(200).json({ success: true, message: "Swiss link saved successfully" });
  } catch (error) {
    console.error("Error saving swiss link:", error);
    return res.status(500).json({ success: false, error: "Failed to save swiss link" });
  }
}
