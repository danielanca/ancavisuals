import cron from "node-cron";
import nodeFetch from "node-fetch";
import https from "node:https";
import { firestore } from "../firestore";
import { buildBunnyDirectoryUrl, getBunnyStorageKey, BUNNY_ACCESS_KEY_HEADER, BUNNY_PHOTOS_FOLDER, BUNNY_PREVIEW_FOLDER } from "../constants/bunny";
import { logActivityOnce } from "../services/activity.service";

// Bunny CDN serves a certificate whose chain Node.js can't verify via the native fetch (undici).
// Using node-fetch with a custom https.Agent bypasses this while scoping the workaround to Bunny only.
const bunnyAgent = new https.Agent({ rejectUnauthorized: false });

const EXCLUDED_DIRS = new Set(["expenses", "bank-statements", "offers", "offers-assets", "qr-moments"]);
const STALE_ZIP_GRACE_MS = 15 * 60 * 1000; // quiet period after the latest photo upload, including compression time
const NOTIFICATION_COOLDOWN_MS = 5 * 24 * 60 * 60 * 1000; // same problem: remind once per 5 days per album
const DAILY_LIMIT_MS = 24 * 60 * 60 * 1000; // hard cap: at most one alert per album per day, even when the problem changes
// Backs up the Firestore record: a failed read/write must not turn into an alert every 5 minutes.
const notifiedInProcess = new Map<string, number>();
const NOTIFICATIONS_COL = "albumZipNotifications";

type BunnyEntry = { ObjectName: string; IsDirectory: boolean; LastChanged?: string };

type ZipStatus = "ok" | "stale" | "missing";

interface AlbumZipInfo {
  slug: string;
  status: ZipStatus;
  latestPhotoDate: Date | null;
  zipDate: Date | null;
  latestPreviewDate: Date | null;
  latestChangeDate: Date | null;
  issues: string[];
  state: string;
  newPhotos: string[];
}

async function listDir(path: string): Promise<BunnyEntry[]> {
  const res = await nodeFetch(buildBunnyDirectoryUrl(path), {
    headers: { [BUNNY_ACCESS_KEY_HEADER]: getBunnyStorageKey() },
    agent: bunnyAgent,
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Bunny directory listing failed (${res.status})`);
  return await res.json() as BunnyEntry[];
}

function entryDate(entry: BunnyEntry): Date {
  const date = entry.LastChanged ? new Date(entry.LastChanged) : null;
  if (!date || !Number.isFinite(date.getTime())) throw new Error("Missing or invalid Bunny file timestamp");
  return date;
}

function latestDate(entries: BunnyEntry[]): Date | null {
  return entries.length ? new Date(Math.max(...entries.map(entry => entryDate(entry).getTime()))) : null;
}

async function checkAlbumZip(slug: string): Promise<AlbumZipInfo> {
  const [rootEntries, photoEntries, previewEntries] = await Promise.all([
    listDir(slug),
    listDir(`${slug}/${BUNNY_PHOTOS_FOLDER}`),
    listDir(`${slug}/${BUNNY_PREVIEW_FOLDER}`),
  ]);
  const photos = photoEntries.filter(e => !e.IsDirectory && /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(e.ObjectName));
  const previews = previewEntries.filter(e => !e.IsDirectory && /\.(jpg|jpeg|png|webp)$/i.test(e.ObjectName));
  const zipEntry = rootEntries.find(e => !e.IsDirectory && e.ObjectName === "photos.zip");
  const latestPhotoDate = latestDate(photos);
  const latestPreviewDate = latestDate(previews);
  const zipDate = zipEntry ? entryDate(zipEntry) : null;
  const latestChangeDate = latestDate([...photos, ...previews, ...(zipEntry ? [zipEntry] : [])]);
  const issues: string[] = [];
  const affected = new Set<string>();
  const baseName = (name: string) => name.replace(/\.[^.]+$/, "");
  const previewsByName = new Map(previews.map(entry => [baseName(entry.ObjectName), entry]));

  for (const original of photos) {
    const preview = previewsByName.get(baseName(original.ObjectName));
    if (!preview) {
      issues.push(`Lipsă preview: ${original.ObjectName}`);
      affected.add(original.ObjectName);
    } else if (entryDate(preview) < entryDate(original)) {
      issues.push(`Preview depășit: ${original.ObjectName}`);
      affected.add(original.ObjectName);
    }
  }
  if (latestPhotoDate && latestPreviewDate && latestPreviewDate < latestPhotoDate) {
    issues.push("photos_preview este mai vechi decât photos");
  }
  // ZIP-ul arhivează originale, deci poate fi creat înaintea preview-urilor.
  // Ordine valide: photos ≤ photos_preview ≤ photos.zip sau photos ≤ photos.zip ≤ photos_preview.
  const latestSourceDate = latestPhotoDate;
  const status: ZipStatus = !zipDate ? "missing"
    : latestSourceDate && zipDate < latestSourceDate ? "stale" : "ok";
  if (status === "missing") issues.push("Lipsă ZIP");
  if (status === "stale") issues.push("ZIP depășit: photos.zip este mai vechi decât photos / photos_preview");
  for (const original of photos) {
    if (!zipDate || entryDate(original) > zipDate) affected.add(original.ObjectName);
  }
  // Bunny does not guarantee listing order. Keep the fingerprint stable so the
  // same set of stale files does not look like a new problem every 5 minutes.
  const state = JSON.stringify({
    latestPhotoDate: latestPhotoDate?.toISOString() ?? null,
    latestPreviewDate: latestPreviewDate?.toISOString() ?? null,
    zipDate: zipDate?.toISOString() ?? null,
    issues: [...issues].sort(),
  });
  return { slug, status, latestPhotoDate, latestPreviewDate, latestChangeDate, zipDate,
    issues, state, newPhotos: [...affected] };
}

async function shouldNotify(slug: string, latestPhotoDate: Date, state: string): Promise<boolean> {
  if (Date.now() - (notifiedInProcess.get(slug) ?? 0) < DAILY_LIMIT_MS) return false;
  try {
    const db = firestore();
    const doc = await db.collection(NOTIFICATIONS_COL).doc(slug).get();
    if (!doc.exists) return true;

    const data = doc.data() as { notifiedAt?: { toMillis: () => number }; lastPhotoDate?: string; state?: string };
    const lastNotifiedAt = data.notifiedAt?.toMillis() ?? 0;
    const lastTrackedPhotoDate = data.lastPhotoDate ? new Date(data.lastPhotoDate).getTime() : 0;

    if (Date.now() - lastNotifiedAt < DAILY_LIMIT_MS) return false;

    if (data.state && data.state !== state) return true;

    // New photos or previews added since last notification → notify again
    if (latestPhotoDate.getTime() > lastTrackedPhotoDate) return true;
    // Same photos but cooldown passed → re-notify
    if (Date.now() - lastNotifiedAt > NOTIFICATION_COOLDOWN_MS) return true;

    return false;
  } catch (error) {
    // Unknown history: stay quiet rather than alert every run.
    console.warn(`[album-zip-check] Nu pot citi istoricul notificărilor pentru ${slug}:`, error);
    return false;
  }
}

async function markNotified(slug: string, latestPhotoDate: Date, state: string): Promise<void> {
  notifiedInProcess.set(slug, Date.now());
  try {
    await firestore().collection(NOTIFICATIONS_COL).doc(slug).set({
      notifiedAt: new Date(),
      lastPhotoDate: latestPhotoDate.toISOString(),
      state,
    });
  } catch (error) {
    console.warn(`[album-zip-check] Nu pot salva notificarea pentru ${slug}:`, error);
  }
}

async function getArchivedSlugs(): Promise<Set<string>> {
  try {
    const doc = await firestore().collection("settings").doc("albumHealthCategories").get();
    if (!doc.exists) return new Set();
    const data = doc.data() as Record<string, string>;
    return new Set(
      Object.entries(data)
        .filter(([, category]) => category === "archived")
        .map(([slug]) => slug)
    );
  } catch { return new Set(); }
}

const MAX_ISSUES_SHOWN = 8;
const MAX_FILES_SHOWN = 8;

function describeAlbumIssues(album: AlbumZipInfo): string {
  const issues = album.issues.slice(0, MAX_ISSUES_SHOWN).join(" · ")
    + (album.issues.length > MAX_ISSUES_SHOWN ? ` · + încă ${album.issues.length - MAX_ISSUES_SHOWN} probleme` : "");
  if (album.newPhotos.length === 0) return issues;
  const files = album.newPhotos.slice(0, MAX_FILES_SHOWN).join(", ")
    + (album.newPhotos.length > MAX_FILES_SHOWN ? ` + încă ${album.newPhotos.length - MAX_FILES_SHOWN}` : "");
  return `${issues} — ${album.newPhotos.length} fișiere afectate: ${files}`;
}

async function runZipCheck() {
  const storageKey = getBunnyStorageKey();
  if (!storageKey) return;

  try {
    const rootRes = await nodeFetch(buildBunnyDirectoryUrl(""), {
      headers: { [BUNNY_ACCESS_KEY_HEADER]: storageKey },
      agent: bunnyAgent,
      signal: AbortSignal.timeout(30_000),
    });
    if (!rootRes.ok) return;

    const rootEntries = await rootRes.json() as BunnyEntry[];
    const archivedSlugs = await getArchivedSlugs();

    const albumSlugs = rootEntries
      .filter((e) => e.IsDirectory && !EXCLUDED_DIRS.has(e.ObjectName) && !archivedSlugs.has(e.ObjectName))
      .map((e) => e.ObjectName);

    const checks = await Promise.allSettled(albumSlugs.map(checkAlbumZip));
    const results: AlbumZipInfo[] = [];
    checks.forEach((check, index) => {
      if (check.status === "fulfilled") results.push(check.value);
      else console.warn(`[album-zip-check] Verificare indisponibilă pentru ${albumSlugs[index]}`);
    });

    const now = Date.now();
    const toNotify: AlbumZipInfo[] = [];

    for (const album of results) {
      if (album.issues.length === 0) continue;

      // Wait for uploads to settle and allow compression to finish. Each new
      // photo restarts the quiet period, even when the batch takes an hour.
      const latestPhotoDate = album.latestPhotoDate;
      const latestChangeDate = album.latestChangeDate;
      if (!latestPhotoDate || !Number.isFinite(latestPhotoDate.getTime())) continue;
      if (!latestChangeDate || now - latestChangeDate.getTime() < STALE_ZIP_GRACE_MS) continue;

      if (await shouldNotify(album.slug, latestChangeDate, album.state)) {
        toNotify.push(album);
      }
    }

    if (toNotify.length === 0) return;

    // Inbox only (/admin activity feed) — the owner no longer wants these by email.
    const notified: string[] = [];
    await Promise.all(toNotify.map(async (album) => {
      try {
        // Timestamp first: logActivityOnce truncates long keys, and each decision to notify is its own incident.
        await logActivityOnce(`album-health:${now}:${album.slug}`, {
          type: "album_zip",
          title: `Fișiere album neactualizate: ${album.slug}`,
          description: describeAlbumIssues(album),
          metadata: { slug: album.slug, route: `/admin/album-health?slug=${encodeURIComponent(album.slug)}` },
          emailSent: false,
        });
        if (album.latestChangeDate) await markNotified(album.slug, album.latestChangeDate, album.state);
        notified.push(album.slug);
      } catch (error) {
        // Not marked notified, so the next run retries.
        console.error(`[album-zip-check] Inbox event failed for ${album.slug}:`, error);
      }
    }));
    if (notified.length === 0) return;

    console.log(`[album-zip-check] Notificat în inbox pentru ${notified.length} albume: ${notified.join(", ")}`);
  } catch (error) {
    const isNetworkError = error instanceof Error &&
      ("code" in error) &&
      (error as NodeJS.ErrnoException).code === "ENOTFOUND";
    if (isNetworkError) {
      console.warn("[album-zip-check] DNS unavailable — skip (storage.bunnycdn.com not reachable)");
    } else {
      console.error("[album-zip-check] Eroare:", error);
    }
  }
}

export function startAlbumZipCheckCron() {
  // Every 5 minutes
  cron.schedule("*/5 * * * *", runZipCheck);
  console.log("[album-zip-check] Started - every 5 minutes");
}
