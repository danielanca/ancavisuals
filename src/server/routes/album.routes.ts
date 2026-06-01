import { Router } from "express";
import express from "express";
import type { Request, Response } from "express";
import { getAlbum, downloadSelectedPhotos, postPrintSelection, downloadAll, deletePhoto, downloadPrintDynamic, addDeliveryAddress, getDeliveryAddress, addSwissLink } from "../controllers/album.controller";
import { getAlbumStats } from "../services/albumStats.service";
import { getAlbumRetentionBySlug } from "../services/albumRetention.service";
import { getClientIp, fetchIpInfo } from "../utils/ipinfo";
import { sendEmail } from "../notifications/mailer";
import { firestore } from "../firestore";
import { adminUser } from "../constants/credentials";

const ADMIN_EMAIL = adminUser.email;

const router = Router();

router.get("/admin/list", async (req: Request, res: Response) => {
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

// POST /api/album/:slug/report-error — trimite email admin când un client nu poate vedea pozele
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

    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `⚠️ Eroare album: clientă nu vede pozele — /${slug}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
          <h2 style="color:#dc2626;margin:0 0 8px;">⚠️ Eroare vizualizare album</h2>
          <p style="color:#666;font-size:13px;margin:0 0 20px;">Un vizitator nu a putut vedea pozele din album.</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr><td style="padding:7px 0;color:#888;width:140px;">Album</td><td style="color:#111;font-weight:600;">/${slug}</td></tr>
            <tr><td style="padding:7px 0;color:#888;">Poze pe server</td><td style="color:#111;">${photosCount ?? "necunoscut"}</td></tr>
            <tr><td style="padding:7px 0;color:#888;">Eroare</td><td style="color:#dc2626;">${errorMessage ?? "Imagini inaccesibile"}</td></tr>
            <tr><td style="padding:7px 0;color:#888;">URL</td><td style="color:#4f46e5;word-break:break-all;">${pageUrl ?? "—"}</td></tr>
            <tr><td style="padding:7px 0;color:#888;">Locație IP</td><td style="color:#111;">${location}</td></tr>
            <tr><td style="padding:7px 0;color:#888;">IP</td><td style="color:#999;font-size:11px;">${ip}</td></tr>
            <tr><td style="padding:7px 0;color:#888;">Device</td><td style="color:#555;font-size:11px;word-break:break-all;">${(userAgent ?? "—").slice(0, 120)}</td></tr>
            <tr><td style="padding:7px 0;color:#888;">Ora</td><td style="color:#111;">${timestamp ?? new Date().toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" })}</td></tr>
          </table>
          <div style="margin-top:20px;padding:12px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
            <p style="color:#991b1b;font-size:12px;margin:0;">Verifică folderul Bunny: <strong>${slug}/photos_preview/</strong> și <strong>${slug}/photos/</strong></p>
          </div>
        </div>
      `,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("[album] report-error failed:", error);
    res.status(500).json({ error: String(error) });
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
router.post("/:slug/download-all", downloadAll);
router.post("/:slug/delete-photo", express.json(), deletePhoto);
router.post("/:slug/download-print-dynamic", downloadPrintDynamic);
router.post("/:slug/delivery-address", express.json(), addDeliveryAddress);
router.get("/:slug/delivery-address", getDeliveryAddress);
router.post("/:slug/swisslink", express.json(), addSwissLink);

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

router.post("/:slug/consent", express.json(), async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const retention = await getAlbumRetentionBySlug(slug);
    const ip = getClientIp(req);
    const ipInfo = await fetchIpInfo(ip);
    const now = new Date().toLocaleString("ro-RO", {
      day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      timeZone: "Europe/Bucharest",
    });

    const location = ipInfo
      ? [ipInfo.city, ipInfo.region, ipInfo.country].filter(Boolean).join(", ")
      : "necunoscut";

    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `✅ Acord descarcare materiale — ${slug}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="color:#7c3aed;margin-bottom:4px;">✅ Client a acceptat termenii</h2>
          <p style="color:#6b7280;font-size:13px;">Album: <strong>${slug}</strong></p>
          <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px;">
            <tr><td style="padding:8px 0;color:#6b7280;width:120px;">Data</td><td style="color:#111;font-weight:600;">${now}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">IP</td><td style="color:#111;font-weight:600;">${ip || "necunoscut"}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Locație</td><td style="color:#111;font-weight:600;">${location}</td></tr>
            ${retention ? `<tr><td style="padding:8px 0;color:#6b7280;">Expiră la</td><td style="color:#111;font-weight:600;">${new Date(retention.expiresAt).toLocaleString("ro-RO", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" })}</td></tr>` : ""}
            ${ipInfo?.org ? `<tr><td style="padding:8px 0;color:#6b7280;">ISP</td><td style="color:#111;">${ipInfo.org}</td></tr>` : ""}
          </table>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Clientul a confirmat că a luat la cunoștință că materialele vor fi șterse după 60 de zile.</p>
        </div>
      `,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("[album] consent failed:", error);
    res.status(500).json({ error: "consent failed" });
  }
});

export default router;
