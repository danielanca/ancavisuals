import { Router } from "express";
import express from "express";
import type { Request, Response } from "express";
import { getAlbum, downloadSelectedPhotos, postPrintSelection, downloadAll, deletePhoto, downloadPrintDynamic, addDeliveryAddress, getDeliveryAddress, addSwissLink } from "../controllers/album.controller";
import { getAlbumStats } from "../services/albumStats.service";
import { getClientIp, fetchIpInfo } from "../utils/ipinfo";
import { sendEmail } from "../notifications/mailer";

const ADMIN_EMAIL = "ancadaniel1994@gmail.com";

const router = Router();

router.get("/admin/list", async (_req: Request, res: Response) => {
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
    res.json({ slugs, links: slugs.map((s) => `/media/${s}`) });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.get("/:slug", getAlbum);
router.get("/:slug/stats", getAlbumStats);

router.post("/:slug/download-selected", express.urlencoded({ extended: false }), downloadSelectedPhotos);
router.post("/:slug/print-selection", express.json(), postPrintSelection);
router.post("/:slug/download-all", downloadAll);
router.post("/:slug/delete-photo", express.json(), deletePhoto);
router.post("/:slug/download-print-dynamic", downloadPrintDynamic);
router.post("/:slug/delivery-address", express.json(), addDeliveryAddress);
router.get("/:slug/delivery-address", getDeliveryAddress);
router.post("/:slug/swisslink", express.json(), addSwissLink);

router.post("/:slug/consent", express.json(), async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
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
            ${ipInfo?.org ? `<tr><td style="padding:8px 0;color:#6b7280;">ISP</td><td style="color:#111;">${ipInfo.org}</td></tr>` : ""}
          </table>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Clientul a confirmat că a luat la cunoștință că materialele vor fi șterse după 30 de zile.</p>
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
