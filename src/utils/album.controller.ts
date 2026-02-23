import type { Request, Response } from "express";
import archiver from "archiver";
import axios from "axios";
import { Readable } from "stream";
import { loadAlbum } from "../server/services/album.services";
import { readPrintSelection, savePrintSelection,saveDeliveryAddress,readDeliveryAddress,addLink } from "../server/services/printSelection.store";
import { signBunnyUrl } from "./signBunnyUrl";
import { getFirestore } from "firebase-admin/firestore";
import fetch from "node-fetch";
import { db } from "../server/firestoreInit"; // firestore init


const storageZone = process.env.BUNNY_STORAGE_ZONE!;
const storageKey = process.env.BUNNY_STORAGE_KEY!;
const STORAGE_HOST = "https://storage.bunnycdn.com";

type AlbumData = {
  slug: string;
  title: string;
  photos: string[];
  featured?: string[];
  print?: string[];
  shortvideo?: string;
  longvideo?: string;
};


// Cheia secretă pentru acces admin (ștergere definitivă poze)
const ADMIN_SECRET_KEY = "ankvisuals1994"; // parola ta

const isSafeFile = (name: string) => {
  if (!name) return false;
  if (name.includes("..")) return false;
  if (name.includes("/") || name.includes("\\")) return false;
  if (name.length > 180) return false;
  return /\.(jpg|jpeg|png|webp)$/i.test(name);
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
  if (files.length > 300) return res.status(413).send("too_many_files");

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${slug}-poze-selectate.zip"`);

  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.pipe(res);

  const photoPath = await checkPreviewExist(slug);

  for (const file of files) {
    const url = `https://storage.bunnycdn.com/${storageZone}/${slug}/${photoPath}/${encodeURIComponent(file)}`;
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

  if (clean.length > 2000) return res.status(413).json({ error: "too_many_files" });

  await savePrintSelection(slug, clean);
  return res.json({ ok: true, count: clean.length });
}

// NOU: Ștergere definitivă a unei poze din album
export async function deletePhoto(req: Request, res: Response) {
  const slug = String(req.params.slug || "");
  const { filename } = req.body;

  // Verificare cheie admin
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

    // Ștergem fișierul fizic din Bunny Storage
    const deleteUrl = `https://storage.bunnycdn.com/${storageZone}/${slug}/${photoPath}/${encodeURIComponent(filename)}`;

    const deleteRes = await axios.delete(deleteUrl, {
      headers: { AccessKey: storageKey },
    });

    if (deleteRes.status !== 200) {
      console.error("Bunny delete failed:", deleteRes.status, deleteRes.data);
      return res.status(500).json({ error: "failed_to_delete_file" });
    }

    // Actualizăm selecția de imprimare (eliminăm poza dacă era acolo)
    const currentPrint = await readPrintSelection(slug);
    const updatedPrint = currentPrint.filter((f: string) => f !== filename);
    if (updatedPrint.length !== currentPrint.length) {
      await savePrintSelection(slug, updatedPrint);
    }

    // Returnăm albumul actualizat
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

export async function downloadAll(req: Request, res: Response) {
  const slug = String(req.params.slug || "");
  const zipFile = "photos.zip";

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
  const cleanDir = dir.replace(/^\/+/, "").replace(/\/+$/, "");
  const url = `https://storage.bunnycdn.com/${storageZone}/${cleanDir}/`;

  const r = await axios.get(url, {
    headers: { AccessKey: storageKey },
    validateStatus: () => true,
  });

  if (r.status !== 200) return false;

  const entries = (r.data as any[]) ?? [];
  return entries.some((e) => !e.IsDirectory && e.ObjectName === fileName);
}


export async function downloadPrintDynamic(req: Request, res: Response) {
  const slug = String(req.params.slug || "");

  const snap = await db.collection("printSelections").doc(slug).get();
  const items = snap.data()?.items as string[] | undefined;

  if (!items || items.length === 0) {
    return res.status(404).json({ error: "No print selection" });
  }

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="poze-imprimare-${slug}.zip"`
  );
  res.setHeader("Cache-Control", "no-store");

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(res);

  const photoPath = await checkPreviewExist(slug);

  for (const file of items) {
    const storagePath = `${slug}/${photoPath}/${file}`;
    const url = `${STORAGE_HOST}/${storageZone}/${storagePath}`;

    const r = await fetch(url, {
      headers: {
        AccessKey: storageKey,
      },
    });

    if (!r.ok || !r.body) continue;

    archive.append(r.body as any, { name: file });
  }

  await archive.finalize();
}

async function checkPreviewExist(slug:string){
  const photoPreview=  `${STORAGE_HOST}/${storageZone}/${slug}/photos_preview/`;
  const result = await axios.get(photoPreview, {
    headers: { AccessKey: storageKey },
    validateStatus: () => true,
  });
  
  if(result.status == 200 && result.data.length > 0){
    return "photos";
  }else{
    return "photos";
  }
}

export async function addDeliveryAddress(req:Request,res:Response){
  try {
    const { slug } = req.params;
    const data = req.body;

    // Basic validation (you can make it more strict)
    if (!data.fullName || !data.phone || !data.street || !data.city) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: fullName, phone, street, city',
      });
    }
    await saveDeliveryAddress(slug, {
      fullName: data.fullName,
      phone: data.phone,
      street: data.street,
      city: data.city,
      easybox: data.easybox,
    });

    return res.status(200).json({
      success: true,
      message: 'Delivery address saved successfully',
    });
  } catch (error) {
    console.error('Error saving delivery address:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save delivery address',
    });
  }
}

export async function getDeliveryAddress(req:Request,res:Response){
  try {
    const { slug } = req.params;
    const result = await readDeliveryAddress(slug);
    console.log(result);
    return res.status(200).json({
      data : result,
      success: true,
      message: 'Delivery address fetched successfully',
    });
  } catch (error) {
    console.error('Error fetching delivery address:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch delivery address',
    });
  }

}
export async function addSwissLink(req: Request, res: Response) {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({
        success: false,
        error: 'Missing slug in URL',
      });
    }

    const data = req.body;

    // Decide on ONE field name — here we use "link" consistently
    if (!data.link) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: link',
      });
    }

    // Make sure this function exists and accepts (slug: string, link: string)
    await addLink(slug, data.link);

    console.log(`Swiss link added → ${slug}: ${data.link}`);

    return res.status(200).json({
      success: true,
      message: 'Swiss link saved successfully',
    });
  } catch (error) {
    console.error('Error saving swiss link:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to save swiss link',
    });
  }
}