import cron from "node-cron";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { sendEmail } from "../notifications/mailer";
import { sendSms, normalizeRomanianPhoneNumber, isSmsConfigured } from "../notifications/sms";
import {
  BUNNY_ACCESS_KEY_HEADER,
  BUNNY_IMAGE_FILE_PATTERN,
  buildBunnyDirectoryUrl,
  getBunnyStoragePassword,
} from "../constants/bunny";

const APP_BASE_URL = process.env.APP_BASE_URL ?? "https://ancavisuals.ro";
const ADMIN_EVENTS_COLLECTION = "adminEvents";
const PHOTOBOOTH_COLLECTION = "photobooth_guests";

function buildGalleryUrl(albumSlug: string): string {
  return `${APP_BASE_URL}/fotocabina/${albumSlug}/galerie`;
}

function buildEmailHtml(guestName: string, galleryUrl: string): string {
  return `
    <div style="margin:0;padding:24px;background:#f5f1ea;font-family:Arial,sans-serif;color:#241f1a;">
      <div style="max-width:560px;margin:0 auto;background:#fffdf9;border:1px solid #eadfce;border-radius:18px;padding:28px 24px;box-shadow:0 8px 30px rgba(68,44,16,0.08);">
        <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#b7791f;">Fotocabina AncaVisuals</p>
        <h2 style="color:#241f1a;margin:0 0 6px;font-size:24px;font-weight:600;">Bună, ${guestName}!</h2>
        <p style="color:#6b5b4d;margin:0 0 18px;line-height:1.6;">
          Pozele de la fotocabina AncaVisuals sunt gata. Intră în galerie, caută-le pe ale tale și le poți descărca direct.
        </p>
        <a href="${galleryUrl}" style="display:inline-block;background:#e0a13b;color:#241f1a;padding:13px 26px;border-radius:999px;text-decoration:none;font-weight:700;font-size:15px;">
          Deschide galeria foto →
        </a>
        <p style="color:#7b6a5a;font-size:12px;margin:24px 0 0;line-height:1.5;">
          AncaVisuals · <a href="https://ancavisuals.ro" style="color:#8c5a16;text-decoration:none;">ancavisuals.ro</a>
        </p>
      </div>
    </div>
  `;
}

function buildSmsBody(guestName: string, galleryUrl: string): string {
  return `Bună ${guestName}! Pozele de la fotocabina AncaVisuals sunt gata: ${galleryUrl} - AncaVisuals`;
}

async function hasBunnyPhotoboothFiles(albumSlug: string): Promise<boolean> {
  const accessKey = getBunnyStoragePassword();
  if (!accessKey) return false;
  try {
    const listUrl = buildBunnyDirectoryUrl(albumSlug, "photobooth");
    const response = await fetch(listUrl, {
      headers: { [BUNNY_ACCESS_KEY_HEADER]: accessKey },
    });
    if (!response.ok) return false;
    const entries = (await response.json()) as Array<{ ObjectName: string; IsDirectory: boolean }>;
    return entries.some((entry) => !entry.IsDirectory && BUNNY_IMAGE_FILE_PATTERN.test(entry.ObjectName));
  } catch {
    return false;
  }
}

async function runPhotoboothNotify() {
  try {
    const db = firestore();
    const now = new Date();

    // Look at events from yesterday and today (covers late events)
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const eventsSnapshot = await db
      .collection(ADMIN_EVENTS_COLLECTION)
      .where("eventDate", ">=", Timestamp.fromDate(yesterday))
      .where("eventDate", "<", Timestamp.fromDate(tomorrow))
      .get();

    if (eventsSnapshot.empty) return;

    for (const eventDoc of eventsSnapshot.docs) {
      const albumSlug = eventDoc.data().albumSlug as string | undefined;
      if (!albumSlug) continue;

      const hasPhotos = await hasBunnyPhotoboothFiles(albumSlug);
      if (!hasPhotos) continue;

      const galleryUrl = buildGalleryUrl(albumSlug);

      const guestsSnapshot = await db
        .collection(PHOTOBOOTH_COLLECTION)
        .doc(eventDoc.id)
        .collection("guests")
        .where("notified", "==", false)
        .get();

      if (guestsSnapshot.empty) continue;

      const batch = db.batch();
      const notifiedAt = Timestamp.now();

      for (const guestDoc of guestsSnapshot.docs) {
        const guest = guestDoc.data();
        const guestName = guest.name as string;

        if (guest.email) {
          sendEmail({
            to: guest.email as string,
            subject: "📸 Pozele tale de la fotocabina AncaVisuals sunt gata!",
            html: buildEmailHtml(guestName, galleryUrl),
          }).catch(() => {});
        }

        if (guest.phone && isSmsConfigured()) {
          const normalized = normalizeRomanianPhoneNumber(guest.phone as string);
          if (normalized) {
            sendSms({ to: normalized, body: buildSmsBody(guestName, galleryUrl) }).catch(() => {});
          }
        }

        batch.update(guestDoc.ref, { notified: true, notifiedAt });
      }

      await batch.commit();
      console.log(`[photoboothNotify] Notified ${guestsSnapshot.size} guests for event ${eventDoc.id} (${albumSlug})`);
    }
  } catch (error) {
    console.error("[photoboothNotify] cron failed:", error);
  }
}

export function startPhotoboothNotifyCron() {
  // Runs every day at 23:30
  cron.schedule("30 23 * * *", runPhotoboothNotify, { timezone: "Europe/Bucharest" });
  console.log("[photoboothNotify] Cron scheduled at 23:30 Europe/Bucharest");
}
