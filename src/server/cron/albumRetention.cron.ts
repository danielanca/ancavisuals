import { adminEmail } from "../notifications/templates/emailBrand";
import cron from "node-cron";
import { firestore } from "../firestore";
import { adminUser } from "../constants/credentials";
import { sendEmail } from "../notifications/mailer";
import { listAlbumRetentionCandidates } from "../services/albumRetention.service";
import { markRetentionNotificationSent } from "../services/printSelection.store";

const DAY_MS = 24 * 60 * 60 * 1000;
import { APP_BASE_URL as BASE_URL } from "../constants/domain";
import { albumNotificationUrl } from "../../shared/albumNotificationSource";
import { isValidEmail } from "../../shared/albumUpdates";

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Bucharest",
  });

async function getSubscriberEmails(slug: string): Promise<string[]> {
  const snapshot = await firestore()
    .collection("albumSubscriptions")
    .where("albumSlug", "==", slug)
    .get();

  return snapshot.docs
    .map((doc) => (doc.data() as { email?: string }).email?.trim().toLowerCase() ?? "")
    // Phone-only subscribers and typos must not reach the mailer.
    .filter((email) => isValidEmail(email));
}

export function albumExpiryReminderEmail(slug: string, expiresAt: string, daysLeft: 7 | 1): { subject: string; html: string } {
  const subject = daysLeft === 7
    ? "Albumul tău expiră în 7 zile"
    : "Albumul tău expiră mâine";

  const lead = daysLeft === 7
    ? "Mai ai 7 zile pentru a salva pozele și videoclipurile din album."
    : "Mai ai aproximativ 24 de ore pentru a salva pozele și videoclipurile din album.";
  return {
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#0a0a0a;color:#fff;">
        <h1 style="font-size:22px;font-weight:500;margin:0 0 12px;">${daysLeft === 7 ? "Reminder pentru albumul tău" : "Ultimul reminder pentru album"}</h1>
        <p style="color:#cfcfcf;font-size:15px;line-height:1.6;margin:0 0 18px;">
          ${lead}
        </p>
        <p style="color:#aaa;font-size:14px;line-height:1.6;margin:0 0 24px;">
          Albumul <strong style="color:#fff">${slug}</strong> este programat pentru expirare la <strong style="color:#fff">${formatDateTime(expiresAt)}</strong>.
        </p>
        <a href="${albumNotificationUrl(BASE_URL, slug, "email", "expira")}" style="display:inline-block;padding:12px 24px;background:#fff;color:#000;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">
          Deschide albumul
        </a>
        <hr style="border:none;border-top:1px solid #222;margin:32px 0;" />
        <p style="color:#555;font-size:12px;">
          Ai primit acest email deoarece te-ai abonat la notificările pentru albumul <em>${slug}</em>.
        </p>
      </div>
    `,
  };
}

async function sendSubscriberReminder(slug: string, expiresAt: string, daysLeft: 7 | 1) {
  const emails = await getSubscriberEmails(slug);
  if (!emails.length) return 0;

  await Promise.all(
    emails.map((email) =>
      sendEmail({
        to: email,
        ...albumExpiryReminderEmail(slug, expiresAt, daysLeft),
      }),
    ),
  );

  return emails.length;
}

export function albumExpiredAdminEmail(slug: string, expiresAt: string): { subject: string; html: string } {
  return {
    subject: `🗃️ Album expirat: ${slug}`,
    html: adminEmail({
      eyebrow: "Album · Retenție",
      title: "Album expirat",
      rows: [["Album", slug], ["Expirat la", formatDateTime(expiresAt)]],
      note: "Albumul a ajuns la termenul limită de retenție și poate fi șters sau mutat în offline.",
      button: { href: `${BASE_URL}/media/${encodeURIComponent(slug)}`, label: "Deschide albumul" },
    }),
  };
}

async function sendAdminExpiryNotice(slug: string, expiresAt: string) {
  if (!adminUser.email) {
    console.warn(`[album retention cron] adminUser.email not configured, skipping expiry notice for ${slug}`);
    return;
  }
  await sendEmail({
    to: adminUser.email,
    ...albumExpiredAdminEmail(slug, expiresAt),
  });
}

export async function processAlbumRetentionNotifications(now = new Date()): Promise<void> {
  const candidates = await listAlbumRetentionCandidates(now);

  for (const album of candidates) {
    try {
      if (album.remainingMs <= 0 && !album.notifications.expiredSentAt) {
        await sendAdminExpiryNotice(album.slug, album.expiresAt);
        await markRetentionNotificationSent(album.slug, "expiredSentAt", now.getTime());
        continue;
      }

      if (album.remainingMs <= DAY_MS && !album.notifications.oneDaySentAt) {
        await sendSubscriberReminder(album.slug, album.expiresAt, 1);
        await markRetentionNotificationSent(album.slug, "oneDaySentAt", now.getTime());
        continue;
      }

      if (album.remainingMs <= 7 * DAY_MS && !album.notifications.sevenDaysSentAt) {
        await sendSubscriberReminder(album.slug, album.expiresAt, 7);
        await markRetentionNotificationSent(album.slug, "sevenDaysSentAt", now.getTime());
      }
    } catch (error) {
      console.error(`[album retention cron] Failed for ${album.slug}:`, error);
    }
  }
}

export function startAlbumRetentionCron(): void {
  cron.schedule("0 9 * * *", () => {
    processAlbumRetentionNotifications().catch((error) => {
      console.error("[album retention cron] Fatal run error:", error);
    });
  });
  console.log("[album retention cron] Started - daily at 09:00");
}
