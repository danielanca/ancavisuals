import { adminEmail, brandEmail, emailButton } from "../notifications/templates/emailBrand";
import { Router } from "express";
import express from "express";
import type { Request, Response } from "express";
import { getAlbum, downloadSelectedPhotos, postPrintSelection, downloadAll, deletePhoto, downloadPrintDynamic, addDeliveryAddress, getDeliveryAddress, addSwissLink } from "../controllers/album.controller";
import { readPrintSelection, readVideoLinks, saveVideoLinks } from "../services/printSelection.store";
import { ALBUM_VIDEO_KINDS, normalizeVideoLink, type AlbumVideoLinks } from "../../shared/albumVideoLinks";
import { getAlbumStats } from "../services/albumStats.service";
import { invalidateAlbumCache, loadAlbum, resolveAlbumSlug } from "../services/album.service";
import nodeFetch from "node-fetch";
import sharp from "sharp";
import { PassThrough, Transform } from "node:stream";
import { randomUUID } from "node:crypto";
import { BUNNY_ACCESS_KEY_HEADER, buildBunnyDirectoryUrl, buildBunnyStorageUrl, getBunnyStorageKey } from "../constants/bunny";
import { signBunnyUrl } from "../utils/signBunnyUrl";
import { albumNotificationUrl, type NotificationChannel } from "../../shared/albumNotificationSource";
import { isValidEmail } from "../../shared/albumUpdates";
import { getShortVideoStream, removeShortVideoStream, startShortVideoStream } from "../services/albumShortVideoStream.service";
import {
  SHORT_VIDEO_CHUNK_BYTES,
  SHORT_VIDEO_FOLDER,
  SHORT_VIDEO_MAX_BYTES,
  isShortVideoObject,
  sanitizeShortVideoName,
  shortVideoContentType,
  type AlbumShortVideo,
} from "../../shared/albumShortVideo";
import { logActivity } from "../services/activity.service";
import { getAlbumRetentionBySlug } from "../services/albumRetention.service";
import { getClientIp, fetchIpInfo } from "../utils/ipinfo";
import { sendEmail } from "../notifications/mailer";
import { firestore } from "../firestore";
import { adminUser } from "../constants/credentials";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { isSmsConfigured, normalizeRomanianPhoneNumber, sendSms } from "../notifications/sms";
import { APP_BASE_URL } from "../constants/domain";
import {
  PRINT_REMINDER_COOLDOWN_MS,
  PRINT_REMINDER_FORCE_GAP_MS,
  isPrintSelectionComplete,
  printReminderMessage,
  whatsappReminderUrl,
  type PrintReminderRecipient,
  type PrintReminderResult,
  type PrintReminderStatus,
} from "../../shared/printSelectionReminder";

const ADMIN_EMAIL = adminUser.email;

const router = Router();

// Acceptă atât 8august2026 cât și 08august2026 — mapăm la folderul real din Bunny.
router.param("slug", (req, _res, next, value) => {
  resolveAlbumSlug(String(value))
    .then((canonical) => { req.params.slug = canonical; next(); })
    .catch(() => next());
});

router.get("/admin/list", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const { buildBunnyDirectoryUrl, getBunnyStorageKey, BUNNY_ACCESS_KEY_HEADER } = await import("../constants/bunny");
    const url = buildBunnyDirectoryUrl();
    const response = await fetch(url, { headers: { [BUNNY_ACCESS_KEY_HEADER]: getBunnyStorageKey() } });
    if (!response.ok) return res.status(500).json({ error: "Bunny list failed" });
    const entries = await response.json() as { ObjectName: string; IsDirectory: boolean }[];
    const slugs = entries
      .filter((e) => e.IsDirectory)
      .map((e) => e.ObjectName.replace(/\/$/, ""))
      .sort();

    if (req.query.hasShortVideo === "true") {
      const storageKey = getBunnyStorageKey();
      const results = await Promise.all(slugs.map(async slug => {
        const dirUrl = buildBunnyDirectoryUrl(slug, "shortvideo");
        const dirResponse = await fetch(dirUrl, { headers: { [BUNNY_ACCESS_KEY_HEADER]: storageKey } });
        if (!dirResponse.ok) return null;
        const files = await dirResponse.json() as { ObjectName: string; IsDirectory: boolean }[];
        return files.some(f => !f.IsDirectory) ? slug : null;
      }));
      const filtered = results.filter((slug): slug is string => slug !== null);
      return res.json({ slugs: filtered, links: filtered.map(s => `/media/${s}`) });
    }

    res.json({ slugs, links: slugs.map((s) => `/media/${s}`) });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export function albumViewErrorEmail(input: {
  slug: string; errorMessage?: string; photosCount?: number | null; pageUrl?: string; location: string; ip: string; userAgent?: string; timestamp?: string;
}): { subject: string; html: string } {
  const { slug, errorMessage, photosCount, pageUrl, location, ip, userAgent, timestamp } = input;
  const isSlowLoad = errorMessage?.includes("8 secunde");
  const subject = isSlowLoad
    ? `🐢 Album lent (>8s) — /${slug}`
    : `⚠️ Eroare album: clientă nu vede pozele — /${slug}`;
  const headerColor = isSlowLoad ? "#d97706" : "#dc2626";
  const headerText = isSlowLoad ? "🐢 Încărcare lentă album" : "⚠️ Eroare vizualizare album";
  const subText = isSlowLoad
    ? "Un vizitator a așteptat mai mult de 8 secunde să se încarce albumul."
    : "Un vizitator nu a putut vedea pozele din album.";

  return {
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <h2 style="color:${headerColor};margin:0 0 8px;">${headerText}</h2>
        <p style="color:#666;font-size:13px;margin:0 0 20px;">${subText}</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr><td style="padding:7px 0;color:#888;width:140px;">Album</td><td style="color:#111;font-weight:600;">/${slug}</td></tr>
          ${!isSlowLoad ? `<tr><td style="padding:7px 0;color:#888;">Poze pe server</td><td style="color:#111;">${photosCount ?? "necunoscut"}</td></tr>` : ""}
          <tr><td style="padding:7px 0;color:#888;">Problemă</td><td style="color:${headerColor};">${errorMessage ?? "Imagini inaccesibile"}</td></tr>
          <tr><td style="padding:7px 0;color:#888;">URL</td><td style="color:#4f46e5;word-break:break-all;">${pageUrl ?? "—"}</td></tr>
          <tr><td style="padding:7px 0;color:#888;">Locație IP</td><td style="color:#111;">${location}</td></tr>
          <tr><td style="padding:7px 0;color:#888;">IP</td><td style="color:#999;font-size:11px;">${ip}</td></tr>
          <tr><td style="padding:7px 0;color:#888;">Device</td><td style="color:#555;font-size:11px;word-break:break-all;">${(userAgent ?? "—").slice(0, 120)}</td></tr>
          <tr><td style="padding:7px 0;color:#888;">Ora</td><td style="color:#111;">${timestamp ?? new Date().toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" })}</td></tr>
        </table>
        ${isSlowLoad
          ? `<div style="margin-top:20px;padding:12px 16px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;">
              <p style="color:#92400e;font-size:12px;margin:0;">Verifică serverul / Bunny CDN. Albumul poate fi prea mare sau conexiunea clientei e slabă.</p>
             </div>`
          : `<div style="margin-top:20px;padding:12px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
              <p style="color:#991b1b;font-size:12px;margin:0;">Verifică folderul Bunny: <strong>${slug}/photos_preview/</strong> și <strong>${slug}/photos/</strong></p>
             </div>`
        }
      </div>
    `,
  };
}

// POST /api/album/:slug/report-error — trimite email admin când un client nu poate vedea pozele sau albumul e lent
router.post("/:slug/report-error", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { photosCount, errorMessage, pageUrl, userAgent, timestamp } = req.body as {
      photosCount?: number;
      errorMessage?: string;
      pageUrl?: string;
      userAgent?: string;
      timestamp?: string;
    };

    const ip = getClientIp(req);
    const ipInfo = await fetchIpInfo(ip).catch(() => null);
    const location = [ipInfo?.city, ipInfo?.region, ipInfo?.country].filter(Boolean).join(", ") || "—";

    await sendEmail({ to: ADMIN_EMAIL, ...albumViewErrorEmail({ slug, errorMessage, photosCount, pageUrl, location, ip, userAgent, timestamp }) });

    res.json({ ok: true });
  } catch (error) {
    console.error("[album] report-error failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// GET /api/album/:slug/preview.jpg — the image WhatsApp & co. show under an album link
// (og:image, see ssr/mediaOg.ts): the album's first photo as a small 1200×630 JPEG, stable URL
// (CDN links are signed for 1 h). Kept in memory per album + first photo.
const ALBUM_PREVIEW_CACHE_MAX = 50;
/** 1200×630. A portrait photo keeps its upper part (faces), not the middle (a dress, hands). */
export async function albumPreviewJpeg(input: Buffer): Promise<Buffer> {
  const upright = await sharp(input).rotate().toBuffer({ resolveWithObject: true });
  const { width, height } = upright.info;
  const image = sharp(upright.data);
  if (height > width) {
    const scaledHeight = Math.round(height * 1200 / width);
    const top = Math.max(0, Math.min(scaledHeight - 630, Math.round(scaledHeight * 0.3 - 315)));
    image.resize(1200).extract({ left: 0, top, width: 1200, height: 630 });
  } else {
    image.resize(1200, 630, { fit: "cover", position: "attention" });
  }
  return image.jpeg({ quality: 78, mozjpeg: true }).toBuffer();
}
const albumPreviewCache = new Map<string, Buffer>();
router.get("/:slug/preview.jpg", async (req: Request, res: Response) => {
  try {
    const slug = await resolveAlbumSlug(String(req.params.slug || ""));
    const album = await loadAlbum(slug);
    const first = album?.photos[0] ?? album?.featured[0];
    if (!first) return res.status(404).end();
    const key = `${slug}|${first.split("?")[0]}`;
    let image = albumPreviewCache.get(key);
    if (!image) {
      const source = await fetch(first, { signal: AbortSignal.timeout(20_000) });
      if (!source.ok) return res.status(404).end();
      image = await albumPreviewJpeg(Buffer.from(await source.arrayBuffer()));
      if (albumPreviewCache.size >= ALBUM_PREVIEW_CACHE_MAX) albumPreviewCache.delete(albumPreviewCache.keys().next().value as string);
      albumPreviewCache.set(key, image);
    }
    return res.status(200).set({ "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" }).end(image);
  } catch {
    return res.status(404).end();
  }
});

router.get("/:slug", getAlbum);
router.get("/:slug/stats", getAlbumStats);
router.get("/:slug/retention", async (req: Request, res: Response) => {
  try {
    const retention = await getAlbumRetentionBySlug(req.params.slug);
    if (!retention) {
      res.status(404).json({ error: "Retention not found" });
      return;
    }
    res.json(retention);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post("/:slug/download-selected", express.urlencoded({ extended: false }), downloadSelectedPhotos);
router.post("/:slug/print-selection", express.json(), postPrintSelection);
// The client tells the photographer the album-photo selection is done. One email per album
// every 24 h: a second tap within that window is refused and the page shows when it unlocks.
export const PRINT_NOTIFY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const printNoticeRef = (slug: string) => firestore().collection("printSelectionNotices").doc(slug);

router.get("/:slug/print-selection/notify", async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug || "");
    const last = ((await printNoticeRef(slug).get()).data() as { lastNotifiedAt?: number } | undefined)?.lastNotifiedAt ?? null;
    const nextAllowedAt = last !== null && Date.now() - last < PRINT_NOTIFY_COOLDOWN_MS ? last + PRINT_NOTIFY_COOLDOWN_MS : null;
    return res.json({ lastNotifiedAt: last, nextAllowedAt });
  } catch (error) {
    console.error("[album] print notify status failed:", error);
    return res.json({ lastNotifiedAt: null, nextAllowedAt: null });
  }
});

export function printSelectionDoneEmail(slug: string, count: number): { subject: string; html: string } {
  return {
    subject: `🖨️ Selecție imprimare finalizată — ${slug}`,
    html: adminEmail({
      eyebrow: "Album · Imprimare",
      title: "Clientul a terminat selecția pentru imprimare",
      rows: [["Album", slug], ["Fotografii alese", count]],
      button: { href: `https://ancavisuals.ro/media/${encodeURIComponent(slug)}?select=print`, label: "Deschide selecția" },
    }),
  };
}

router.post("/:slug/print-selection/notify", async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug || "");
    const items = await readPrintSelection(slug);
    if (items.length === 0) return res.status(400).json({ error: "no_print_selection" });

    const ref = printNoticeRef(slug);
    const last = ((await ref.get()).data() as { lastNotifiedAt?: number } | undefined)?.lastNotifiedAt;
    const now = Date.now();
    if (last !== undefined && now - last < PRINT_NOTIFY_COOLDOWN_MS) {
      return res.status(429).json({ error: "already_notified", lastNotifiedAt: last, nextAllowedAt: last + PRINT_NOTIFY_COOLDOWN_MS });
    }

    await sendEmail({
      to: ADMIN_EMAIL,
      source: "print-selection",
      ...printSelectionDoneEmail(slug, items.length),
    });
    await ref.set({ lastNotifiedAt: now, count: items.length }, { merge: true });
    return res.json({ ok: true, count: items.length, lastNotifiedAt: now, nextAllowedAt: now + PRINT_NOTIFY_COOLDOWN_MS });
  } catch (error) {
    console.error("[album] print selection notification failed:", error);
    return res.status(500).json({ error: "notification_failed" });
  }
});

// Admin → client: "alege pozele pentru album". Recipients = the client(s) of every event linked
// to this album; email + SMS go out automatically, WhatsApp comes back as wa.me links.
export function printReminderEmail(message: string, emailUrl: string): { subject: string; html: string } {
  return {
    subject: "[Mesaj automat] Alege pozele pentru albumul tău",
    html: brandEmail(`
      ${message.split("\n\n").map((p) => `<p style="color:#111;font-size:15px;line-height:1.6;margin:0 0 14px;">${escapeHtml(p).replace(escapeHtml(emailUrl), "").trim()}</p>`).join("")}
      ${emailButton(emailUrl, "Alege pozele pentru album")}
    `),
  };
}

const printReminderRef = (slug: string) => firestore().collection("printSelectionReminders").doc(slug);
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

async function printReminderRecipients(slug: string): Promise<PrintReminderRecipient[]> {
  const events = await firestore().collection("adminEvents").where("albumSlug", "==", slug).get();
  const seen = new Set<string>();
  const recipients: PrintReminderRecipient[] = [];
  events.docs.forEach((doc) => {
    const client = (doc.data().client ?? {}) as { fullName?: string; email?: string; phone?: string };
    const email = String(client.email ?? "").trim().toLowerCase() || null;
    const phone = normalizeRomanianPhoneNumber(String(client.phone ?? ""));
    const key = email ?? phone;
    if (!key || seen.has(key)) return;
    seen.add(key);
    recipients.push({ name: String(client.fullName ?? "").trim(), email: email && email.includes("@") ? email : null, phone });
  });
  return recipients;
}

async function printReminderLastSentAt(slug: string): Promise<number | null> {
  return ((await printReminderRef(slug).get()).data() as { lastSentAt?: number } | undefined)?.lastSentAt ?? null;
}

const nextReminderAt = (last: number | null, now = Date.now()) =>
  last !== null && now - last < PRINT_REMINDER_COOLDOWN_MS ? last + PRINT_REMINDER_COOLDOWN_MS : null;

router.get("/:slug/print-reminder", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug || "");
    const [items, recipients, lastSentAt] = await Promise.all([
      readPrintSelection(slug),
      printReminderRecipients(slug),
      printReminderLastSentAt(slug),
    ]);
    const status: PrintReminderStatus = { selectedCount: items.length, recipients, lastSentAt, nextAllowedAt: nextReminderAt(lastSentAt) };
    return res.json(status);
  } catch (error) {
    console.error("[album] print reminder status failed:", error);
    return res.status(500).json({ error: "print_reminder_failed" });
  }
});

router.post("/:slug/print-reminder", requireFirebaseAuth, requireSupremeAdmin, express.json(), async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug || "");
    const wantEmail = req.body?.email !== false;
    const wantSms = req.body?.sms !== false;
    const force = req.body?.force === true;
    const now = Date.now();
    const lastSentAt = await printReminderLastSentAt(slug);
    const blockedUntil = force
      ? (lastSentAt !== null && now - lastSentAt < PRINT_REMINDER_FORCE_GAP_MS ? lastSentAt + PRINT_REMINDER_FORCE_GAP_MS : null)
      : nextReminderAt(lastSentAt, now);
    if (blockedUntil) return res.status(429).json({ error: "already_sent", lastSentAt, nextAllowedAt: blockedUntil });

    // A contact typed by hand in the panel, for this send only (the event is not changed).
    const manualEmailRaw = typeof req.body?.manualEmail === "string" ? req.body.manualEmail.trim() : "";
    const manualPhoneRaw = typeof req.body?.manualPhone === "string" ? req.body.manualPhone.trim() : "";
    const manualEmail = manualEmailRaw && isValidEmail(manualEmailRaw) ? manualEmailRaw.toLowerCase() : null;
    const manualPhone = manualPhoneRaw ? normalizeRomanianPhoneNumber(manualPhoneRaw) : null;
    if (manualEmailRaw && !manualEmail) return res.status(400).json({ error: "invalid_manual_email" });
    if (manualPhoneRaw && !manualPhone) return res.status(400).json({ error: "invalid_manual_phone" });

    const [items, recipients] = await Promise.all([readPrintSelection(slug), printReminderRecipients(slug)]);
    if (isPrintSelectionComplete(items.length)) return res.status(409).json({ error: "selection_complete", selectedCount: items.length });
    const known = new Set(recipients.flatMap((r) => [r.email, r.phone]).filter(Boolean));
    const extra = { name: "contact manual", email: manualEmail && !known.has(manualEmail) ? manualEmail : null, phone: manualPhone && !known.has(manualPhone) ? manualPhone : null };
    if (extra.email || extra.phone) recipients.push(extra);
    if (recipients.length === 0) return res.status(400).json({ error: "no_recipients" });

    // One link per channel: `?s=<canal>-poze` tells which reminder the client came from.
    const selectUrl = (channel: NotificationChannel) => albumNotificationUrl(APP_BASE_URL, slug, channel, "poze", { select: "print" });
    const smsReady = isSmsConfigured();
    const result: PrintReminderResult = {
      emailed: 0, smsSent: 0, smsFailed: 0, smsSkipped: wantSms && !smsReady, whatsapp: [], lastSentAt: now, nextAllowedAt: now + PRINT_REMINDER_COOLDOWN_MS,
    };

    for (const recipient of recipients) {
      const message = (channel: NotificationChannel) => printReminderMessage(slug, items.length, selectUrl(channel));
      if (wantEmail && recipient.email) {
        const emailUrl = selectUrl("email");
        await sendEmail({
          to: recipient.email,
          source: "print-selection-reminder",
          ...printReminderEmail(message("email"), emailUrl),
        }).then(() => { result.emailed++; }, (error) => console.error("[album] print reminder email failed:", error));
      }
      if (wantSms && smsReady && recipient.phone) {
        try { await sendSms({ to: recipient.phone, body: message("sms"), log: { source: "print-selection-reminder", event: slug, recipientName: recipient.name } }); result.smsSent++; }
        catch (error) { result.smsFailed++; console.error("[album] print reminder SMS failed:", error); }
      }
      if (recipient.phone) result.whatsapp.push({ name: recipient.name, url: whatsappReminderUrl(recipient.phone, message("wa")) });
    }

    await printReminderRef(slug).set({ lastSentAt: now, selectedCount: items.length, emailed: result.emailed, smsSent: result.smsSent }, { merge: true });
    return res.json(result);
  } catch (error) {
    console.error("[album] print reminder failed:", error);
    return res.status(500).json({ error: "print_reminder_failed" });
  }
});
// POST /:slug/zip-request — a client found no "download all" ZIP and asks for it. Emails the
// admin at most once per album every 6 h (repeated clicks only refresh the inbox entry).
export function zipRequestEmail(slug: string, count: number): { subject: string; html: string } {
  return {
    subject: `📦 Albumul ${slug} nu are ZIP-ul gata de descărcare`,
    html: adminEmail({
      eyebrow: "Album · ZIP",
      title: "Un client vrea să descarce toate pozele",
      rows: [["Album", slug], ["Cereri", count]],
      note: "Albumul nu are încă arhiva photos.zip. Clientul a apăsat „Anunță fotograful” din album.",
      button: { href: `https://ancavisuals.ro/media/${encodeURIComponent(slug)}`, label: "Deschide albumul" },
    }),
  };
}

const ZIP_REQUEST_COOLDOWN_MS = 6 * 60 * 60 * 1000;
router.post("/:slug/zip-request", async (req: Request, res: Response) => {
  const slug = String(req.params.slug || "");
  if (!/^[a-z0-9][a-z0-9-_]{0,120}$/i.test(slug)) return res.status(400).json({ error: "invalid_album" });
  try {
    const album = await loadAlbum(slug);
    if (!album) return res.status(404).json({ error: "album_not_found" });
    if (album.zipReady) return res.json({ ok: true, zipReady: true });

    const ref = firestore().collection("albumZipRequests").doc(slug);
    const previous = (await ref.get()).data() as { lastNotifiedAt?: number; count?: number } | undefined;
    const now = Date.now();
    const count = (previous?.count ?? 0) + 1;
    const recentlyNotified = previous?.lastNotifiedAt !== undefined && now - previous.lastNotifiedAt < ZIP_REQUEST_COOLDOWN_MS;
    await ref.set({ lastRequestedAt: now, count, ...(recentlyNotified ? {} : { lastNotifiedAt: now }) }, { merge: true });
    if (recentlyNotified) return res.json({ ok: true, alreadyNotified: true });

    await logActivity({
      type: "album_zip",
      title: `📦 Client cere ZIP-ul — ${slug}`,
      description: "Albumul nu are încă arhiva cu toate pozele gata de descărcare.",
      metadata: { albumSlug: slug, count: String(count) },
      emailSent: true,
    }).catch(() => {});
    await sendEmail({
      to: ADMIN_EMAIL,
      source: "album-zip-request",
      ...zipRequestEmail(slug, count),
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error("[album] zip request failed:", error);
    return res.status(500).json({ error: "notification_failed" });
  }
});
router.post("/:slug/download-all", downloadAll);
router.post("/:slug/delete-photo", requireFirebaseAuth, requireSupremeAdmin, express.json(), deletePhoto);
router.post("/:slug/download-print-dynamic", downloadPrintDynamic);
router.post("/:slug/delivery-address", express.json(), addDeliveryAddress);
router.get("/:slug/delivery-address", getDeliveryAddress);
router.post("/:slug/swisslink", requireFirebaseAuth, requireSupremeAdmin, express.json(), addSwissLink);

router.get("/:slug/video-links", async (req: Request, res: Response) => {
  try {
    return res.json({ links: await readVideoLinks(req.params.slug) });
  } catch (error) {
    console.error("[album] video links read failed:", error);
    return res.status(500).json({ error: "video_links_failed" });
  }
});

router.put("/:slug/video-links", requireFirebaseAuth, requireSupremeAdmin, express.json(), async (req: Request, res: Response) => {
  const updates: AlbumVideoLinks = {};
  for (const kind of ALBUM_VIDEO_KINDS) {
    // A kind missing from the body is kept: /media and EventCard each edit one link at a time.
    if (req.body?.[kind] === undefined) continue;
    const link = normalizeVideoLink(req.body[kind]);
    if (link === null) return res.status(400).json({ error: "invalid_link", kind });
    updates[kind] = link;
  }
  try {
    const merged = { ...await readVideoLinks(req.params.slug), ...updates };
    const links: AlbumVideoLinks = Object.fromEntries(Object.entries(merged).filter(([, link]) => Boolean(link)));
    await saveVideoLinks(req.params.slug, links);
    return res.json({ links });
  } catch (error) {
    console.error("[album] video links save failed:", error);
    return res.status(500).json({ error: "video_links_failed" });
  }
});

// /media/:slug (🛠 Admin) urcă poze prin aceleași rute ca EventCard, care cer id-ul evenimentului.
router.get("/:slug/admin-event", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const events = await firestore().collection("adminEvents").where("albumSlug", "==", req.params.slug).limit(1).get();
    const doc = events.docs[0];
    if (!doc) return res.status(404).json({ error: "Albumul nu e legat de niciun eveniment din dashboard." });
    return res.json({ eventId: doc.id });
  } catch (error) {
    console.error("[album] admin event lookup failed:", error);
    return res.status(500).json({ error: "admin_event_failed" });
  }
});

// ── Video scurt încărcat direct (Bunny {slug}/shortvideo/) ────────────────────
// Un singur fișier: uploadul nou îl înlocuiește pe cel vechi. Bunny nu are upload presemnat,
// deci fișierul trece în stream prin server (nimic pe discul VPS), ca photos.zip.

type BunnyEntry = { ObjectName: string; IsDirectory?: boolean; Length?: number };

async function listShortVideos(slug: string): Promise<BunnyEntry[]> {
  const response = await nodeFetch(buildBunnyDirectoryUrl(slug, SHORT_VIDEO_FOLDER), {
    headers: { [BUNNY_ACCESS_KEY_HEADER]: getBunnyStorageKey() }, signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`Bunny list ${response.status}`);
  return (await response.json() as BunnyEntry[]).filter(isShortVideoObject);
}

async function deleteShortVideo(slug: string, fileName: string): Promise<void> {
  const response = await nodeFetch(buildBunnyStorageUrl(slug, SHORT_VIDEO_FOLDER, fileName), {
    method: "DELETE", headers: { [BUNNY_ACCESS_KEY_HEADER]: getBunnyStorageKey() },
  });
  if (!response.ok && response.status !== 404) throw new Error(`Bunny delete ${response.status}`);
}

router.get("/:slug/short-video", async (req: Request, res: Response) => {
  try {
    const [video] = await listShortVideos(req.params.slug);
    const result: AlbumShortVideo | null = video
      ? {
        fileName: video.ObjectName,
        size: video.Length ?? null,
        url: signBunnyUrl(`/${req.params.slug}/${SHORT_VIDEO_FOLDER}/${video.ObjectName}`),
        stream: await getShortVideoStream(req.params.slug, video.ObjectName).catch(() => null),
      }
      : null;
    res.setHeader("Cache-Control", "no-store");
    return res.json({ video: result });
  } catch (error) {
    console.error("[album] short video read failed:", error);
    return res.status(502).json({ error: "short_video_failed" });
  }
});

router.get("/:slug/short-video/download", async (req: Request, res: Response) => {
  try {
    const [video] = await listShortVideos(req.params.slug);
    if (!video) return res.status(404).json({ error: "Albumul nu are video scurt." });
    const bunnyRes = await nodeFetch(buildBunnyStorageUrl(req.params.slug, SHORT_VIDEO_FOLDER, video.ObjectName), {
      headers: { [BUNNY_ACCESS_KEY_HEADER]: getBunnyStorageKey() },
    });
    if (!bunnyRes.ok || !bunnyRes.body) return res.status(502).json({ error: "Videoul nu poate fi descărcat acum." });
    res.setHeader("Content-Type", shortVideoContentType(video.ObjectName));
    const length = bunnyRes.headers.get("content-length");
    if (length) res.setHeader("Content-Length", length);
    // Files put straight into Bunny may have diacritics: an ASCII fallback + the UTF-8 name.
    const asciiName = video.ObjectName.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "") || "video-scurt.mp4";
    res.setHeader("Content-Disposition", `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(video.ObjectName)}`);
    res.setHeader("Cache-Control", "no-store");
    bunnyRes.body.on("error", () => res.destroy());
    bunnyRes.body.pipe(res);
  } catch (error) {
    console.error("[album] short video download failed:", error);
    if (!res.headersSent) res.status(502).json({ error: "Videoul nu poate fi descărcat acum." });
  }
});

/**
 * After the file is in Bunny: checks its size, then replaces the previous video and starts Stream.
 * Null when Bunny holds a different size than was sent.
 */
async function finishShortVideoUpload(slug: string, fileName: string, size: number, previous: BunnyEntry[]): Promise<AlbumShortVideo | null> {
  const uploaded = (await listShortVideos(slug)).find((entry) => entry.ObjectName === fileName);
  if (!uploaded || (uploaded.Length !== undefined && uploaded.Length !== size)) return null;
  // Only after the new file is verified, so a failed upload never leaves the album without a video.
  await Promise.all(previous.filter((entry) => entry.ObjectName !== fileName).map((entry) => deleteShortVideo(slug, entry.ObjectName)));
  await invalidateAlbumCache(slug);
  // Stream pulls its own copy from Storage and transcodes it; until then /media plays the original.
  await startShortVideoStream(slug, fileName);
  return {
    fileName, size, url: signBunnyUrl(`/${slug}/${SHORT_VIDEO_FOLDER}/${fileName}`),
    stream: await getShortVideoStream(slug, fileName).catch(() => null),
  };
}

/** A unique name per upload: the CDN (and Stream's fetch through it) would otherwise serve the old file. */
const uniqueShortVideoName = (fileName: string) => fileName.replace(/(\.[a-z0-9]+)$/, `-${Date.now().toString(36)}$1`);

// Chunked upload: Cloudflare (in front of ancavisuals.ro) refuses any request over 100 MB with a
// 413 — and the browser then sits at 0%. The browser sends the video in SHORT_VIDEO_CHUNK_BYTES
// pieces, in order; each one is written into a single open PUT to Bunny, so nothing lands on
// the VPS disk. A session idle for SHORT_VIDEO_SESSION_IDLE_MS is dropped (and so is the PUT).
type ShortVideoSession = {
  slug: string;
  fileName: string;
  size: number;
  received: number;
  busy: boolean;
  previous: BunnyEntry[];
  body: PassThrough;
  bunny: Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;
  abort: AbortController;
  idle: ReturnType<typeof setTimeout>;
};
const SHORT_VIDEO_SESSION_IDLE_MS = 180_000;
const shortVideoSessions = new Map<string, ShortVideoSession>();

function dropShortVideoSession(id: string) {
  const session = shortVideoSessions.get(id);
  if (!session) return;
  shortVideoSessions.delete(id);
  clearTimeout(session.idle);
  session.abort.abort();
  session.body.destroy();
}

function touchShortVideoSession(id: string, session: ShortVideoSession) {
  clearTimeout(session.idle);
  session.idle = setTimeout(() => dropShortVideoSession(id), SHORT_VIDEO_SESSION_IDLE_MS);
}

router.post("/:slug/short-video/uploads", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { slug } = req.params;
  const { name, size } = (req.body ?? {}) as { name?: unknown; size?: unknown };
  const sanitized = sanitizeShortVideoName(String(name ?? ""));
  if (!sanitized) return res.status(400).json({ error: "Format acceptat: MP4, MOV, M4V sau WEBM." });
  if (!Number.isSafeInteger(size) || (size as number) <= 0) return res.status(400).json({ error: "Fișier gol sau dimensiune lipsă." });
  if ((size as number) > SHORT_VIDEO_MAX_BYTES) return res.status(413).json({ error: "Videoul depășește 4 GB." });
  try {
    const fileName = uniqueShortVideoName(sanitized);
    const previous = await listShortVideos(slug);
    const body = new PassThrough();
    const abort = new AbortController();
    const bunny = nodeFetch(buildBunnyStorageUrl(slug, SHORT_VIDEO_FOLDER, fileName), {
      method: "PUT",
      headers: { [BUNNY_ACCESS_KEY_HEADER]: getBunnyStorageKey(), "Content-Type": shortVideoContentType(fileName), "Content-Length": String(size) },
      body, signal: abort.signal,
    });
    const id = randomUUID();
    const session: ShortVideoSession = { slug, fileName, size: size as number, received: 0, busy: false, previous, body, bunny, abort, idle: setTimeout(() => undefined, 0) };
    // Bunny answering (or failing) before the last piece: nothing more can be written — end the
    // session, so a piece in progress fails at once instead of hanging. The last piece awaits it.
    const early = () => { if (session.received < session.size) dropShortVideoSession(id); };
    bunny.then(early, early);
    shortVideoSessions.set(id, session);
    touchShortVideoSession(id, session);
    return res.json({ uploadId: id, chunkBytes: SHORT_VIDEO_CHUNK_BYTES });
  } catch (error) {
    console.error("[album] short video upload start failed:", error);
    return res.status(502).json({ error: "Încărcarea videoului nu a putut porni. Reîncearcă." });
  }
});

router.put("/:slug/short-video/uploads/:id", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { slug, id } = req.params;
  const session = shortVideoSessions.get(id);
  if (!session || session.slug !== slug) return res.status(404).json({ error: "Încărcarea a expirat. Pornește din nou." });
  const offset = Number(req.query.offset);
  const length = Number(req.headers["content-length"]);
  if (session.busy || offset !== session.received) return res.status(409).json({ error: "Bucăți trimise în altă ordine. Pornește din nou.", received: session.received });
  if (!Number.isSafeInteger(length) || length <= 0 || length > SHORT_VIDEO_CHUNK_BYTES || offset + length > session.size) {
    dropShortVideoSession(id);
    return res.status(400).json({ error: "Bucată de fișier invalidă. Pornește din nou." });
  }
  session.busy = true;
  touchShortVideoSession(id, session);
  try {
    let got = 0;
    const counter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        got += chunk.length;
        touchShortVideoSession(id, session);
        callback(null, chunk);
      },
    });
    await new Promise<void>((resolve, reject) => {
      const closed = () => reject(new Error("upload session closed"));
      session.body.once("close", closed);
      counter.on("end", () => { session.body.off("close", closed); resolve(); });
      req.on("error", reject);
      req.on("aborted", () => reject(new Error("aborted")));
      // end: false — the Bunny PUT stays open for the next piece.
      req.pipe(counter).pipe(session.body, { end: false });
    });
    if (got !== length) throw new Error(`chunk ${got} of ${length} bytes`);
    session.received += got;
    session.busy = false;
    if (session.received < session.size) return res.json({ received: session.received });

    // Last piece: close the PUT and wait for Bunny to confirm the whole file.
    session.body.end();
    clearTimeout(session.idle);
    const uploadRes = await session.bunny;
    shortVideoSessions.delete(id);
    if (!uploadRes.ok) {
      console.error(`[album] short video Bunny ${uploadRes.status}: ${await uploadRes.text().catch(() => "")}`);
      return res.status(502).json({ error: `Bunny a respins videoul (${uploadRes.status}).` });
    }
    const video = await finishShortVideoUpload(slug, session.fileName, session.size, session.previous);
    if (!video) return res.status(502).json({ error: "Videoul din Bunny are altă dimensiune decât cel trimis. Reîncearcă." });
    return res.json({ video });
  } catch (error) {
    // A piece cut half-way already went to Bunny: this upload cannot continue.
    console.error("[album] short video chunk failed:", error);
    dropShortVideoSession(id);
    if (!res.headersSent) return res.status(502).json({ error: "Încărcarea videoului s-a întrerupt. Reîncearcă." });
  }
});

router.delete("/:slug/short-video/uploads/:id", requireFirebaseAuth, requireSupremeAdmin, (req: Request, res: Response) => {
  const session = shortVideoSessions.get(req.params.id);
  if (session?.slug === req.params.slug) dropShortVideoSession(req.params.id);
  res.json({ ok: true });
});

router.put("/:slug/short-video", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const { slug } = req.params;
  const size = Number(req.headers["content-length"]);
  let fileName: string | null = null;
  try { fileName = sanitizeShortVideoName(decodeURIComponent(String(req.headers["x-file-name"] ?? ""))); } catch { /* invalid header */ }
  if (!fileName) return res.status(400).json({ error: "Format acceptat: MP4, MOV, M4V sau WEBM." });
  if (!Number.isSafeInteger(size) || size <= 0) return res.status(400).json({ error: "Fișier gol sau dimensiune lipsă." });
  if (size > SHORT_VIDEO_MAX_BYTES) return res.status(413).json({ error: "Videoul depășește 4 GB." });
  fileName = uniqueShortVideoName(fileName);
  try {
    const previous = await listShortVideos(slug);

    // Abort only when the browser stops sending: a large video legitimately takes longer than any fixed limit.
    const stalled = new AbortController();
    let idle = setTimeout(() => stalled.abort(), 180_000);
    const body = req.pipe(new Transform({
      transform(chunk, _encoding, callback) {
        clearTimeout(idle);
        idle = setTimeout(() => stalled.abort(), 180_000);
        callback(null, chunk);
      },
    }));
    let uploadRes;
    try {
      uploadRes = await nodeFetch(buildBunnyStorageUrl(slug, SHORT_VIDEO_FOLDER, fileName), {
        method: "PUT",
        headers: { [BUNNY_ACCESS_KEY_HEADER]: getBunnyStorageKey(), "Content-Type": shortVideoContentType(fileName), "Content-Length": String(size) },
        body, signal: stalled.signal,
      });
    } finally {
      clearTimeout(idle);
    }
    if (!uploadRes.ok) {
      console.error(`[album] short video Bunny ${uploadRes.status}: ${await uploadRes.text().catch(() => "")}`);
      return res.status(502).json({ error: `Bunny a respins videoul (${uploadRes.status}).` });
    }

    const video = await finishShortVideoUpload(slug, fileName, size, previous);
    if (!video) return res.status(502).json({ error: "Videoul din Bunny are altă dimensiune decât cel trimis. Reîncearcă." });
    return res.json({ video });
  } catch (error) {
    console.error("[album] short video upload failed:", error);
    if (!res.headersSent) res.status(502).json({ error: "Încărcarea videoului a eșuat. Reîncearcă." });
  }
});

router.delete("/:slug/short-video", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const videos = await listShortVideos(req.params.slug);
    await Promise.all(videos.map((entry) => deleteShortVideo(req.params.slug, entry.ObjectName)));
    await removeShortVideoStream(req.params.slug);
    await invalidateAlbumCache(req.params.slug);
    return res.json({ video: null });
  } catch (error) {
    console.error("[album] short video delete failed:", error);
    return res.status(502).json({ error: "Videoul nu a putut fi șters." });
  }
});

router.get("/:slug/qr-moments", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { buildBunnyDirectoryUrl, getBunnyStorageKey, BUNNY_ACCESS_KEY_HEADER, BUNNY_QR_MOMENT_FOLDER } = await import("../constants/bunny");
    const { signBunnyUrl } = await import("../utils/signBunnyUrl");

    const storageKey = getBunnyStorageKey();

    // QR moments are stored directly under {slug}/qr-moment/{type}/
    const listFolder = async (type: string): Promise<string[]> => {
      const url = buildBunnyDirectoryUrl(slug, BUNNY_QR_MOMENT_FOLDER, type);
      const response = await fetch(url, { headers: { [BUNNY_ACCESS_KEY_HEADER]: storageKey } });
      if (!response.ok) return [];
      const entries = await response.json() as { ObjectName: string; IsDirectory?: boolean }[];
      return entries
        .filter((e) => !e.IsDirectory)
        .map((e) => signBunnyUrl(`/${slug}/${BUNNY_QR_MOMENT_FOLDER}/${type}/${e.ObjectName}`));
    };

    const [photos, videos, audio] = await Promise.all([
      listFolder("photo"),
      listFolder("video"),
      listFolder("audio"),
    ]);

    let eventSlug: string | null = null;
    let galleryUrl: string | null = null;

    const adminEventSnapshot = await firestore()
      .collection("adminEvents")
      .where("albumSlug", "==", slug)
      .limit(1)
      .get();

    if (!adminEventSnapshot.empty) {
      const adminEventId = adminEventSnapshot.docs[0].id;
      const qrEventSnapshot = await firestore()
        .collection("qr_events")
        .where("adminEventId", "==", adminEventId)
        .limit(1)
        .get();

      if (!qrEventSnapshot.empty) {
        const qrEventDoc = qrEventSnapshot.docs[0];
        const qrEventData = qrEventDoc.data();
        eventSlug = (qrEventData.eventSlug as string | undefined) ?? qrEventDoc.id;
        const pin = qrEventData.pin as string | undefined;
        if (eventSlug && pin) {
          galleryUrl = `/qr-moments/${eventSlug}/gallery?pin=${encodeURIComponent(pin)}`;
        }
      }
    }

    res.json({ photos, videos, audio, eventSlug, galleryUrl });
  } catch (error) {
    console.error("[album] qr-moments failed:", error);
    res.status(500).json({ error: "Failed to load QR moments" });
  }
});

// GET /api/album/:slug/photobooth — photos uploaded to {slug}/photobooth/ (from the photo booth)
router.get("/:slug/photobooth", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { buildBunnyDirectoryUrl, getBunnyStorageKey, BUNNY_ACCESS_KEY_HEADER, BUNNY_IMAGE_FILE_PATTERN } = await import("../constants/bunny");
    const { signBunnyUrl } = await import("../utils/signBunnyUrl");

    const url = buildBunnyDirectoryUrl(slug, "photobooth");
    const response = await fetch(url, { headers: { [BUNNY_ACCESS_KEY_HEADER]: getBunnyStorageKey() } });

    if (!response.ok) {
      res.json({ photos: [], galleryUrl: null });
      return;
    }

    const entries = await response.json() as { ObjectName: string; IsDirectory?: boolean }[];
    const photos = entries
      .filter((e) => !e.IsDirectory && BUNNY_IMAGE_FILE_PATTERN.test(e.ObjectName))
      .map((e) => signBunnyUrl(`/${slug}/photobooth/${e.ObjectName}`));

    res.json({
      photos,
      galleryUrl: photos.length > 0 ? `/fotocabina/${slug}/galerie` : null,
    });
  } catch (error) {
    console.error("[album] photobooth failed:", error);
    res.status(500).json({ error: "Failed to load photobooth photos" });
  }
});

router.post("/:slug/consent", express.json(), async (req: Request, res: Response) => {
  try {
    // Notificarea pe email a fost dezactivată la cerere; doar confirmăm succesul către client
    res.json({ ok: true });
  } catch (error) {
    console.error("[album] consent failed:", error);
    res.status(500).json({ error: "consent failed" });
  }
});

export default router;
