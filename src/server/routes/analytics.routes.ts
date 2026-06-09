import type { Request, Response } from "express";
import { Router } from "express";
import { firestore } from "../firestore";
import { Timestamp } from "firebase-admin/firestore";
import { getClientIp, fetchIpInfo } from "../utils/ipinfo";
import { isLocalIp } from "../controllers/triggerEvent.controller";
import { logActivity } from "../services/activity.service";

const SKIP_PREFIXES = ["/admin", "/login", "/revin"];

const SEO_PAGE_RE = /^\/(fotograf|videograf|foto-video|foto|video)-[a-z]/i;
const ORGANIC_REFERRER_RE = /google\.|bing\.|yahoo\.|duckduckgo\.|yandex\.|baidu\.|ecosia\.|startpage\./i;

function isOrganicReferrer(referrer: string): boolean {
  if (!referrer || referrer.trim() === "") return true; // direct/none counts as organic
  return ORGANIC_REFERRER_RE.test(referrer);
}

function parseSeoPage(page: string): { city: string; service: string } | null {
  if (!SEO_PAGE_RE.test(page)) return null;
  const slug = page.replace(/^\//, "").replace(/\?.*$/, "");
  const parts = slug.split("-");
  // Pattern: {prefix}-{service}-{city} or {prefix}-{city}-{service}
  // We just extract the full slug and present it cleanly
  if (parts.length < 3) return null;
  // Remove prefix (fotograf / videograf / foto-video / foto / video)
  let rest = slug;
  for (const prefix of ["foto-video", "fotograf", "videograf", "foto", "video"]) {
    if (slug.startsWith(prefix + "-")) {
      rest = slug.slice(prefix.length + 1);
      break;
    }
  }
  const restParts = rest.split("-");
  // Known services — first or last segment
  const SERVICES = new Set(["nunta", "botez", "majorat", "evenimente", "cununie", "civila", "logodna", "corporate", "inmormantare", "trash", "save"]);
  const serviceIdx = restParts.findIndex((p) => SERVICES.has(p));
  if (serviceIdx === -1) return { city: rest, service: "" };
  const service = restParts.slice(serviceIdx).join(" ");
  const city = restParts.slice(0, serviceIdx).join(" ") || restParts.slice(serviceIdx + 1).join(" ");
  return { city: city || slug, service };
}

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

// POST /api/analytics/pageview — record a page visit
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
    if (isLocalIp(ip ?? "")) return res.json({ ok: true });
    const ipInfo = await fetchIpInfo(ip).catch(() => null);

    const db = firestore();
    const docRef = await db.collection("siteVisits").add({
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
      timeSpent: 0,
      scrollDepth: 0,
    });

    res.json({ ok: true, id: docRef.id });

    // Log SEO organic visit to activity feed (fire-and-forget)
    const seoInfo = parseSeoPage(page);
    if (seoInfo && isOrganicReferrer(referrer ?? "")) {
      const cityLabel = ipInfo?.city || seoInfo.city || "necunoscut";
      const pageSlug = page.replace(/^\//, "");
      const serviceLabel = seoInfo.service ? ` (${seoInfo.service})` : "";
      logActivity({
        type: "seo_visit",
        title: `Vizitator organic${serviceLabel} — ${cityLabel}`,
        description: `/${pageSlug}${referrer ? ` · via ${new URL(referrer).hostname.replace(/^www\./, "")}` : " · direct"}`,
        metadata: {
          page,
          city: ipInfo?.city ?? "",
          region: ipInfo?.region ?? "",
          country: ipInfo?.country ?? "",
          referrer: referrer ?? "",
          isNew: String(isNew ?? true),
        },
        emailSent: false,
      }).catch(() => {});
    }
  } catch (error) {
    console.error("[analytics] POST /pageview failed:", error);
    res.status(500).json({ error: "Failed to log pageview" });
  }
});

// PATCH /api/analytics/engagement — update time spent + scroll depth for a visit
analyticsPublicRouter.patch("/engagement", async (req: Request, res: Response) => {
  try {
    const { id, timeSpent, scrollDepth } = req.body as {
      id?: string;
      timeSpent?: number;
      scrollDepth?: number;
    };
    if (!id || typeof timeSpent !== "number") return res.status(400).json({ error: "Missing fields" });

    const db = firestore();
    await db.collection("siteVisits").doc(id).update({
      timeSpent: Math.min(Math.round(timeSpent), 7200),
      scrollDepth: typeof scrollDepth === "number" ? Math.min(100, Math.max(0, Math.round(scrollDepth))) : 0,
    });

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to update engagement" });
  }
});

// GET /api/admin/analytics/visits — all recent visits
analyticsAdminRouter.get("/analytics/visits", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const limit = Math.min(Number(req.query.limit) || 1000, 5000);
    const includeLocal = req.query.includeLocal === "true";

    const snapshot = await db
      .collection("siteVisits")
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    const visits = snapshot.docs
      .filter((doc) => includeLocal || !isLocalIp(doc.data().ip ?? ""))
      .map((doc) => {
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
          timeSpent: d.timeSpent ?? 0,
          scrollDepth: d.scrollDepth ?? 0,
        };
      });

    res.json({ visits });
  } catch (error) {
    console.error("[analytics] GET /visits failed:", error);
    res.status(500).json({ error: "Failed to load visits" });
  }
});

// GET /api/admin/analytics/stats — aggregated statistics
analyticsAdminRouter.get("/analytics/stats", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    const includeLocal = req.query.includeLocal === "true";
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const daysAgo = (days: number): Date =>
      new Date(todayStart.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

    const uniqueVisitors = (snap: FirebaseFirestore.QuerySnapshot): number =>
      new Set(
        snap.docs
          .filter((d) => includeLocal || !isLocalIp(d.data().ip ?? ""))
          .map((d) => d.data().visitorId || d.data().sessionId)
      ).size;

    const [todaySnap, threeDaysSnap, weekSnap, monthSnap, threeMonthsSnap] = await Promise.all([
      db.collection("siteVisits").where("timestamp", ">=", Timestamp.fromDate(todayStart)).get(),
      db.collection("siteVisits").where("timestamp", ">=", Timestamp.fromDate(daysAgo(3))).get(),
      db.collection("siteVisits").where("timestamp", ">=", Timestamp.fromDate(daysAgo(7))).get(),
      db.collection("siteVisits").where("timestamp", ">=", Timestamp.fromDate(daysAgo(30))).get(),
      db.collection("siteVisits").where("timestamp", ">=", Timestamp.fromDate(daysAgo(90))).get(),
    ]);

    const pageCount: Record<string, number> = {};
    const referrerCount: Record<string, number> = {};
    const countryCount: Record<string, number> = {};

    monthSnap.docs.filter((d) => includeLocal || !isLocalIp(d.data().ip ?? "")).forEach((d) => {
      const data = d.data();
      const page = data.page as string;
      pageCount[page] = (pageCount[page] ?? 0) + 1;

      const ref = data.referrer as string;
      if (ref && !ref.includes("ancavisuals.ro")) {
        try {
          const host = new URL(ref).hostname.replace(/^www\./, "");
          if (!includeLocal && (host === "localhost" || host.startsWith("127.") || host === "::1")) return;
          referrerCount[host] = (referrerCount[host] ?? 0) + 1;
        } catch { /* invalid URL */ }
      }

      const country = data.country as string;
      if (country) countryCount[country] = (countryCount[country] ?? 0) + 1;
    });

    const topPages = Object.entries(pageCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([page, count]) => ({ page, count }));

    const topReferrers = Object.entries(referrerCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([referrer, count]) => ({ referrer, count }));

    const topCountries = Object.entries(countryCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([country, count]) => ({ country, count }));

    res.json({
      today: { visitors: uniqueVisitors(todaySnap) },
      threeDays: { visitors: uniqueVisitors(threeDaysSnap) },
      week: { visitors: uniqueVisitors(weekSnap) },
      month: { visitors: uniqueVisitors(monthSnap) },
      threeMonths: { visitors: uniqueVisitors(threeMonthsSnap) },
      topPages,
      topReferrers,
      topCountries,
    });
  } catch (error) {
    console.error("[analytics] GET /stats failed:", error);
    res.status(500).json({ error: "Failed to load stats" });
  }
});
