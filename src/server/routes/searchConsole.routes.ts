import type { Request, Response } from "express";
import { Router } from "express";
import { google } from "googleapis";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth.js";

const router = Router();

const SITE_URL = "sc-domain:ancavisuals.ro";

function getAuth() {
  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!base64) throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 not set");
  const serviceAccount = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  return new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
}

// GET /api/admin/search-console/queries?days=28
router.get("/search-console/queries", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  try {
    const days = Math.min(Number(req.query.days) || 28, 90);
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const auth = getAuth();
    const webmasters = google.webmasters({ version: "v3", auth });

    const [queriesRes, pagesRes] = await Promise.all([
      webmasters.searchanalytics.query({
        siteUrl: SITE_URL,
        requestBody: {
          startDate: fmt(startDate),
          endDate: fmt(endDate),
          dimensions: ["query"],
          rowLimit: 100,
          dataState: "all",
        },
      }),
      webmasters.searchanalytics.query({
        siteUrl: SITE_URL,
        requestBody: {
          startDate: fmt(startDate),
          endDate: fmt(endDate),
          dimensions: ["page"],
          rowLimit: 10,
          dataState: "all",
        },
      }),
    ]);

    res.json({
      queries: (queriesRes.data.rows ?? []).filter((r) => (r.impressions ?? 0) >= 20),
      pages: (pagesRes.data.rows ?? []).filter((r) => (r.impressions ?? 0) >= 20),
      period: { startDate: fmt(startDate), endDate: fmt(endDate), days },
    });
  } catch (error) {
    console.error("[search-console] error:", error);
    res.status(500).json({ error: String(error) });
  }
});

export default router;
