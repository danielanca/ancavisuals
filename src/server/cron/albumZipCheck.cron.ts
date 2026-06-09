import cron from "node-cron";
import nodeFetch from "node-fetch";
import https from "node:https";
import { sendEmail } from "../notifications/mailer";
import { adminUser } from "../constants/credentials";
import { firestore } from "../firestore";
import { buildBunnyDirectoryUrl, getBunnyStorageKey, BUNNY_ACCESS_KEY_HEADER, BUNNY_PHOTOS_FOLDER } from "../constants/bunny";
import { APP_BASE_URL } from "../constants/domain";

// Bunny CDN serves a certificate whose chain Node.js can't verify via the native fetch (undici).
// Using node-fetch with a custom https.Agent bypasses this while scoping the workaround to Bunny only.
const bunnyAgent = new https.Agent({ rejectUnauthorized: false });

const EXCLUDED_DIRS = new Set(["expenses", "bank-statements", "offers", "offers-assets", "qr-moments"]);
const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const NOTIFICATION_COOLDOWN_MS = 5 * 24 * 60 * 60 * 1000; // re-notify max once per 5 days per album
const NOTIFICATIONS_COL = "albumZipNotifications";

type BunnyEntry = { ObjectName: string; IsDirectory: boolean; LastChanged?: string };

type ZipStatus = "ok" | "stale" | "missing";

interface AlbumZipInfo {
  slug: string;
  status: ZipStatus;
  latestPhotoDate: Date | null;
  zipDate: Date | null;
  photoCount: number;
  newPhotos: string[];
}

async function listDir(path: string): Promise<BunnyEntry[]> {
  try {
    const res = await nodeFetch(buildBunnyDirectoryUrl(path), {
      headers: { [BUNNY_ACCESS_KEY_HEADER]: getBunnyStorageKey() },
      agent: bunnyAgent,
    });
    if (!res.ok) return [];
    return await res.json() as BunnyEntry[];
  } catch { return []; }
}

async function checkAlbumZip(slug: string): Promise<AlbumZipInfo> {
  const [rootEntries, photoEntries] = await Promise.all([
    listDir(slug),
    listDir(`${slug}/${BUNNY_PHOTOS_FOLDER}`),
  ]);

  const zipEntry = rootEntries.find((e) => !e.IsDirectory && e.ObjectName === "photos.zip");
  const photos = photoEntries.filter((e) => !e.IsDirectory && /\.(jpg|jpeg|png)$/i.test(e.ObjectName));

  const latestPhotoDate = photos.length > 0
    ? new Date(Math.max(...photos.map((p) => p.LastChanged ? new Date(p.LastChanged).getTime() : 0)))
    : null;

  const zipDate = zipEntry?.LastChanged ? new Date(zipEntry.LastChanged) : null;

  let status: ZipStatus = "missing";
  if (zipDate && latestPhotoDate) {
    status = zipDate >= latestPhotoDate ? "ok" : "stale";
  } else if (zipDate && !latestPhotoDate) {
    status = "ok";
  }

  const newPhotos = (status === "stale" && zipDate)
    ? photos
        .filter((p) => p.LastChanged && new Date(p.LastChanged) > zipDate)
        .sort((photoA, photoB) => new Date(photoB.LastChanged ?? 0).getTime() - new Date(photoA.LastChanged ?? 0).getTime())
        .map((p) => p.ObjectName)
    : photos.map((p) => p.ObjectName);

  return { slug, status, latestPhotoDate, zipDate, photoCount: photos.length, newPhotos };
}

async function shouldNotify(slug: string, latestPhotoDate: Date): Promise<boolean> {
  try {
    const db = firestore();
    const doc = await db.collection(NOTIFICATIONS_COL).doc(slug).get();
    if (!doc.exists) return true;

    const data = doc.data() as { notifiedAt?: { toMillis: () => number }; lastPhotoDate?: string };
    const lastNotifiedAt = data.notifiedAt?.toMillis() ?? 0;
    const lastTrackedPhotoDate = data.lastPhotoDate ? new Date(data.lastPhotoDate).getTime() : 0;

    // New photos added since last notification → notify again
    if (latestPhotoDate.getTime() > lastTrackedPhotoDate) return true;
    // Same photos but cooldown passed → re-notify
    if (Date.now() - lastNotifiedAt > NOTIFICATION_COOLDOWN_MS) return true;

    return false;
  } catch { return true; }
}

async function markNotified(slug: string, latestPhotoDate: Date): Promise<void> {
  try {
    await firestore().collection(NOTIFICATIONS_COL).doc(slug).set({
      notifiedAt: new Date(),
      lastPhotoDate: latestPhotoDate.toISOString(),
    });
  } catch {}
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

function formatStaleDuration(latestPhotoDate: Date, zipDate: Date | null): string {
  const referenceMs = zipDate ? zipDate.getTime() : latestPhotoDate.getTime();
  const diffMs = Date.now() - referenceMs;
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} zi${diffDays !== 1 ? "le" : ""}`;
}

async function runZipCheck() {
  const storageKey = getBunnyStorageKey();
  if (!storageKey) return;

  try {
    const rootRes = await nodeFetch(buildBunnyDirectoryUrl(""), {
      headers: { [BUNNY_ACCESS_KEY_HEADER]: storageKey },
      agent: bunnyAgent,
    });
    if (!rootRes.ok) return;

    const rootEntries = await rootRes.json() as BunnyEntry[];
    const archivedSlugs = await getArchivedSlugs();

    const albumSlugs = rootEntries
      .filter((e) => e.IsDirectory && !EXCLUDED_DIRS.has(e.ObjectName) && !archivedSlugs.has(e.ObjectName))
      .map((e) => e.ObjectName);

    const results = await Promise.all(albumSlugs.map(checkAlbumZip));

    const now = Date.now();
    const toNotify: AlbumZipInfo[] = [];

    for (const album of results) {
      if (album.status === "ok") continue;

      // Only alert if photos are old enough (> 15 min) — give the user time to compress
      const latestPhotoDate = album.latestPhotoDate;
      if (!latestPhotoDate) continue;
      if (now - latestPhotoDate.getTime() < STALE_THRESHOLD_MS) continue;

      if (await shouldNotify(album.slug, latestPhotoDate)) {
        toNotify.push(album);
      }
    }

    if (toNotify.length === 0) return;

    const notifyDateStr = new Date().toLocaleDateString("ro-RO", {
      timeZone: "Europe/Bucharest",
      day: "2-digit",
      month: "short",
    });

    const rows = toNotify.map((album) => {
      const statusLabel = album.status === "missing" ? "❌ Lipsă ZIP" : "⚠️ ZIP depășit";
      const photoDateStr = album.latestPhotoDate
        ? album.latestPhotoDate.toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" })
        : "—";
      const zipDateStr = album.zipDate
        ? album.zipDate.toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" })
        : "—";
      const staleDuration = album.latestPhotoDate
        ? formatStaleDuration(album.latestPhotoDate, album.zipDate)
        : "—";
      const albumHealthUrl = `${APP_BASE_URL}/admin/album-health`;
      const MAX_FILES_SHOWN = 8;
      const shownFiles = album.newPhotos.slice(0, MAX_FILES_SHOWN);
      const hiddenCount = album.newPhotos.length - shownFiles.length;
      const filesHtml = shownFiles
        .map((name) => `<li style="margin:2px 0;color:#374151;font-size:12px;font-family:monospace;">${name}</li>`)
        .join("") + (hiddenCount > 0 ? `<li style="margin:2px 0;color:#9ca3af;font-size:12px;">+ încă ${hiddenCount}</li>` : "");

      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;vertical-align:top;">
            <a href="${albumHealthUrl}?slug=${encodeURIComponent(album.slug)}" style="font-weight:600;color:#111;text-decoration:none;">${album.slug}</a>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;vertical-align:top;">${statusLabel}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;vertical-align:top;">
            <span style="color:#d97706;font-weight:600;">${album.newPhotos.length} fișiere</span>
            <ul style="margin:4px 0 0;padding-left:16px;list-style:disc;">${filesHtml}</ul>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#666;font-size:13px;vertical-align:top;">${photoDateStr}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#666;font-size:13px;vertical-align:top;">${zipDateStr}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#dc2626;font-weight:600;vertical-align:top;">${staleDuration}</td>
        </tr>`;
    }).join("");

    await sendEmail({
      to: adminUser.email,
      subject: `📦 ZIP neactualizat (${toNotify.length}) — ${notifyDateStr}`,
      html: `
        <div style="font-family:sans-serif;max-width:700px;margin:0 auto;">
          <h2 style="color:#111;margin:0 0 8px;">ZIP neactualizat după poze noi</h2>
          <p style="color:#555;margin:0 0 20px;">
            Următoarele albume au poze adăugate recent dar <strong>photos.zip</strong> nu a fost actualizat.
            Creează/actualizează zip-ul din Bunny Storage.
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr style="background:#f5f5f5;">
                <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #ddd;">Album</th>
                <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #ddd;">Status</th>
                <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #ddd;">Fișiere noi</th>
                <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #ddd;">Ultima poză</th>
                <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #ddd;">ZIP creat</th>
                <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #ddd;">Vechi de</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin-top:20px;display:flex;gap:16px;">
            <a href="${APP_BASE_URL}/admin/album-health" style="color:#7c3aed;margin-right:16px;">Deschide Album Health →</a>
            <a href="https://dash.bunny.net/storage" style="color:#555;">Bunny Storage →</a>
          </p>
        </div>`,
    });

    // Mark all as notified
    await Promise.all(
      toNotify.map((album) => album.latestPhotoDate ? markNotified(album.slug, album.latestPhotoDate) : Promise.resolve())
    );

    console.log(`[album-zip-check] Notificat pentru ${toNotify.length} albume: ${toNotify.map((album) => album.slug).join(", ")}`);
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
