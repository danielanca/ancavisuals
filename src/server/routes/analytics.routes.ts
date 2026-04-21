import type { Request, Response } from "express";
import { Router } from "express";
import { firestore } from "../firestore";
import { Timestamp } from "firebase-admin/firestore";
import { getClientIp, fetchIpInfo } from "../utils/ipinfo";

const SKIP_PREFIXES = ["/admin", "/login", "/revin"];

// Comprehensive bot/crawler/headless UA filter
const BOT_UA = new RegExp(
  [
    // Generic bot/crawler markers
    "bot", "crawl", "spider", "slurp", "scraper", "scan", "fetch", "checker",
    "monitor", "probe", "ping", "audit", "inspect", "preview", "snapshot",
    // Named crawlers & search engines
    "googlebot", "bingbot", "yandexbot", "baiduspider", "duckduckbot",
    "sogou", "exabot", "facebot", "ia_archiver", "ahrefsbot", "semrushbot",
    "dotbot", "mj12bot", "rogerbot", "screaming frog", "seokicks",
    "sistrix", "linkdexbot", "blexbot", "seobilitybot", "dataforseo",
    "majestic", "serpstat", "bytespider", "petalbot",
    // Social / link preview bots
    "facebookexternalhit", "twitterbot", "linkedinbot", "whatsapp",
    "slackbot", "discordbot", "telegrambot", "viber", "line-poker",
    "applebot", "pinterest", "tumblr",
    // HTTP tools / scripts
    "python", "curl", "wget", "axios", "got", "node-fetch", "java",
    "ruby", "perl", "go-http", "okhttp", "libwww", "lwp",
    "httpclient", "httpunit", "requests", "urllib",
    // Headless browsers
    "headlesschrome", "phantomjs", "selenium", "puppeteer", "playwright",
    "webdriver", "cypress",
    // Security / uptime scanners
    "zgrab", "masscan", "nmap", "nikto", "nuclei", "shodan",
    "censys", "qualys", "netcraft", "uptimerobot", "statuscake",
    "pingdom", "newrelic", "datadog", "freshping", "hetrixtools",
  ].join("|"),
  "i"
);

export const analyticsPublicRouter = Router();
export const analyticsAdminRouter = Router();

const ADMIN_COOKIE = "av_admin";

function isAdminRequest(req: Request): boolean {
  const cookies = req.headers.cookie ?? "";
  return cookies.split(";").some((c) => c.trim() === `${ADMIN_COOKIE}=1`);
}

// POST /api/analytics/pageview — înregistrează o vizită de pagină
analyticsPublicRouter.post("/pageview", async (req: Request, res: Response) => {
  try {
    const { page, referrer, sessionId, visitorId, isNew } = req.body as {
      page?: string;
      referrer?: string;
      sessionId?: string;
      visitorId?: string;
      isNew?: boolean;
    };

    if (!page || !sessionId) return res.status(400).json({ error: "Missing fields" });
    if (SKIP_PREFIXES.some((p) => page.startsWith(p))) return res.json({ ok: true });
    if (isAdminRequest(req)) return res.json({ ok: true });

    const ua = req.headers["user-agent"] ?? "";
    if (BOT_UA.test(ua)) return res.json({ ok: true });

    const ip = getClientIp(req);
    const ipInfo = await fetchIpInfo(ip).catch(() => null);

    const db = firestore();
    await db.collection("siteVisits").add({
      sessionId,
      visitorId: visitorId ?? "",
      isNew: isNew ?? true,
      page,
      referrer: referrer ?? "",
      timestamp: Timestamp.now(),
      ip: ip ?? "",
      userAgent: ua,
      city: ipInfo?.city ?? "",
      region: ipInfo?.region ?? "",
      country: ipInfo?.country ?? "",
      org: ipInfo?.org ?? "",
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("[analytics] POST /pageview failed:", error);
    res.status(500).json({ error: "Failed to log pageview" });
  }
});

// GET /api/admin/analytics/visits — toate vizitele recente
analyticsAdminRouter.get("/analytics/visits", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const limit = Math.min(Number(req.query.limit) || 1000, 5000);

    const snapshot = await db
      .collection("siteVisits")
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    const visits = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        sessionId: d.sessionId,
        visitorId: d.visitorId ?? "",
        isNew: d.isNew ?? true,
        page: d.page,
        referrer: d.referrer,
        timestamp: d.timestamp instanceof Timestamp ? d.timestamp.toDate().toISOString() : d.timestamp,
        ip: d.ip,
        userAgent: d.userAgent,
        city: d.city,
        region: d.region,
        country: d.country,
        org: d.org,
      };
    });

    res.json({ visits });
  } catch (error) {
    console.error("[analytics] GET /visits failed:", error);
    res.status(500).json({ error: "Failed to load visits" });
  }
});

// GET /api/admin/analytics/stats — statistici agregate
analyticsAdminRouter.get("/analytics/stats", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);

    const [todaySnap, weekSnap] = await Promise.all([
      db.collection("siteVisits").where("timestamp", ">=", Timestamp.fromDate(todayStart)).get(),
      db.collection("siteVisits").where("timestamp", ">=", Timestamp.fromDate(weekStart)).get(),
    ]);

    const todaySessions = new Set(todaySnap.docs.map((d) => d.data().sessionId)).size;
    const weekSessions = new Set(weekSnap.docs.map((d) => d.data().sessionId)).size;

    const pageCount: Record<string, number> = {};
    weekSnap.docs.forEach((d) => {
      const page = d.data().page as string;
      pageCount[page] = (pageCount[page] ?? 0) + 1;
    });
    const topPages = Object.entries(pageCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([page, count]) => ({ page, count }));

    const countryCount: Record<string, number> = {};
    weekSnap.docs.forEach((d) => {
      const country = d.data().country as string;
      if (country) countryCount[country] = (countryCount[country] ?? 0) + 1;
    });
    const topCountries = Object.entries(countryCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([country, count]) => ({ country, count }));

    res.json({
      today: { pageviews: todaySnap.size, sessions: todaySessions },
      week: { pageviews: weekSnap.size, sessions: weekSessions },
      topPages,
      topCountries,
    });
  } catch (error) {
    console.error("[analytics] GET /stats failed:", error);
    res.status(500).json({ error: "Failed to load stats" });
  }
});
