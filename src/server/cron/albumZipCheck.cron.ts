import cron from "node-cron";
import { sendEmail } from "../notifications/mailer";
import { adminUser } from "../constants/credentials";
import { firestore } from "../firestore";
import { buildBunnyDirectoryUrl, getBunnyStorageKey, BUNNY_ACCESS_KEY_HEADER, BUNNY_PHOTOS_FOLDER } from "../constants/bunny";

const EXCLUDED_DIRS = new Set(["expenses", "bank-statements", "offers", "offers-assets", "qr-moments"]);
const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const NOTIFICATION_COOLDOWN_MS = 60 * 60 * 1000; // re-notify max once per hour per album
const NOTIFICATIONS_COL = "albumZipNotifications";

type BunnyEntry = { ObjectName: string; IsDirectory: boolean; LastChanged?: string };

type ZipStatus = "ok" | "stale" | "missing";

interface AlbumZipInfo {
  slug: string;
  status: ZipStatus;
  latestPhotoDate: Date | null;
  zipDate: Date | null;
}

async function listDir(path: string): Promise<BunnyEntry[]> {
  try {
    const res = await fetch(buildBunnyDirectoryUrl(path), {
      headers: { [BUNNY_ACCESS_KEY_HEADER]: getBunnyStorageKey() },
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

  return { slug, status, latestPhotoDate, zipDate };
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

async function runZipCheck() {
  const storageKey = getBunnyStorageKey();
  if (!storageKey) return;

  try {
    const rootRes = await fetch(buildBunnyDirectoryUrl(""), {
      headers: { [BUNNY_ACCESS_KEY_HEADER]: storageKey },
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

    const rows = toNotify.map((a) => {
      const statusLabel = a.status === "missing" ? "❌ Lipsă" : "⚠️ Depășit";
      const photoDateStr = a.latestPhotoDate
        ? a.latestPhotoDate.toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" })
        : "—";
      const zipDateStr = a.zipDate
        ? a.zipDate.toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" })
        : "—";
      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;">${a.slug}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${statusLabel}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">${photoDateStr}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">${zipDateStr}</td>
        </tr>`;
    }).join("");

    await sendEmail({
      to: adminUser.email,
      subject: `📦 ${toNotify.length} album${toNotify.length > 1 ? "e" : ""} cu ZIP neactualizat`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#111;margin:0 0 8px;">ZIP neactualizat după poze noi</h2>
          <p style="color:#555;margin:0 0 20px;">
            Următoarele albume au poze adăugate recent dar <strong>photos.zip</strong> nu a fost actualizat.
            Creează/actualizează zip-ul din Bunny Storage.
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr style="background:#f5f5f5;">
                <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #ddd;">Album</th>
                <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #ddd;">Status ZIP</th>
                <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #ddd;">Ultima poză adăugată</th>
                <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #ddd;">ZIP creat</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin-top:20px;">
            <a href="https://dash.bunny.net/storage" style="color:#7c3aed;">Deschide Bunny Storage →</a>
          </p>
        </div>`,
    });

    // Mark all as notified
    await Promise.all(
      toNotify.map((a) => a.latestPhotoDate ? markNotified(a.slug, a.latestPhotoDate) : Promise.resolve())
    );

    console.log(`[album-zip-check] Notificat pentru ${toNotify.length} albume: ${toNotify.map((a) => a.slug).join(", ")}`);
  } catch (error) {
    console.error("[album-zip-check] Eroare:", error);
  }
}

export function startAlbumZipCheckCron() {
  // Every 5 minutes
  cron.schedule("*/5 * * * *", runZipCheck);
  console.log("[album-zip-check] Started - every 5 minutes");
}
