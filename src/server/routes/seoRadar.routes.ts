import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { requireFirebaseAuth, requireSupremeAdmin, type AuthenticatedRequest } from "../middleware/requireFirebaseAuth";
import { firestore } from "../firestore.js";

const HISTORY_COLLECTION = "seoRadarSearches";
const LINKED_COLLECTION = "seoRadarLinkedPosts";
const OWN_DOMAIN = "ancavisuals.ro";
const DATAFORSEO_ROMANIA_LOCATION_CODE = 2642;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 30_000, maxRetries: 1 });
const anthropicLong = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120_000, maxRetries: 1 });

type SerpResult = { position: number; title: string; url: string; domain: string; snippet: string };
type HistoryRecord = {
  id: string;
  capturedAt: string;
  ownDomainPosition?: number | null;
  ownDomainUrl?: string | null;
  positionChange?: number | null;
  localPack?: boolean;
  organicResults?: SerpResult[];
};
type LinkedPostRecord = {
  id: string;
  queryKey: string;
  keyword: string;
  city: string;
  provider: SearchProvider;
  slug: string;
  title: string;
  url: string;
  date?: string;
  linkedAt: string | null;
};
type LinkedPostStatus = {
  status: "ranked" | "own_other" | "pending";
  rankedPosition: number | null;
};
type JsonRecord = Record<string, unknown>;
type SearchProvider = "serpapi" | "dataforseo";

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(record: JsonRecord, key: string): string {
  return typeof record[key] === "string" ? record[key] as string : "";
}

function numberValue(record: JsonRecord, key: string, fallback: number): number {
  return typeof record[key] === "number" ? record[key] as number : fallback;
}

function hasLocalPack(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return Array.isArray(asRecord(value).places) && (asRecord(value).places as unknown[]).length > 0;
}

function queryKey(keyword: string, city: string, provider: SearchProvider): string {
  return `${provider}::${keyword.trim().toLowerCase()}::${city.trim().toLowerCase()}`;
}

// Groups near-identical analyses together by the keyword text only (the thing actually
// searched on Google): strips diacritics, lowercases, reduces to a sorted word set so
// "fotocabina Huedin" / "fotocabină huedin" / "fotocabina  huedin" collapse into one row.
// The stored `city` field is only a geo hint and is deliberately ignored here — otherwise a
// stale Locație value ("fotocabina huedin" scanned with city "Bacău") would fragment the row.
// Provider stays separate because positions differ between SerpApi and DataForSEO.
function analysisGroupKey(keyword: string, provider: SearchProvider): string {
  const words = keyword
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return `${provider}::${Array.from(new Set(words)).sort().join(" ")}`;
}

// Diacritics/case/whitespace-insensitive form, order preserved — used to de-dupe keyword
// suggestions and to exclude the seed term itself from its own alternatives.
function normalizeKeyword(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function ownResult(results: SerpResult[]): SerpResult | null {
  return results.find((item) => item.domain === OWN_DOMAIN || item.domain.endsWith(`.${OWN_DOMAIN}`)) ?? null;
}

async function getHistory(key: string) {
  const snapshot = await firestore().collection(HISTORY_COLLECTION).where("queryKey", "==", key).get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as HistoryRecord))
    .sort((a, b) => String(a.capturedAt).localeCompare(String(b.capturedAt)));
}

function toIso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as { toDate?: () => Date }).toDate === "function") {
    try { return (value as { toDate: () => Date }).toDate().toISOString(); } catch { return null; }
  }
  return null;
}

function sameBlogSlug(url: string, slug: string): boolean {
  if (!url || !slug) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host !== OWN_DOMAIN && !host.endsWith(`.${OWN_DOMAIN}`)) return false;
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments.length > 0 && segments[segments.length - 1] === slug;
  } catch {
    return false;
  }
}

function linkedPostStatus(
  post: { slug: string },
  organicResults: SerpResult[],
  ownDomainPosition: number | null,
  ownDomainUrl: string | null,
): LinkedPostStatus {
  const match = organicResults.find((item) => sameBlogSlug(item.url, post.slug));
  if (match) return { status: "ranked", rankedPosition: match.position ?? ownDomainPosition ?? null };
  if (ownDomainUrl && sameBlogSlug(ownDomainUrl, post.slug)) {
    return { status: "ranked", rankedPosition: ownDomainPosition ?? null };
  }
  if (ownDomainPosition !== null && ownDomainPosition !== undefined) {
    return { status: "own_other", rankedPosition: ownDomainPosition };
  }
  return { status: "pending", rankedPosition: null };
}

async function getLinkedPosts(key: string): Promise<LinkedPostRecord[]> {
  const snapshot = await firestore().collection(LINKED_COLLECTION).where("queryKey", "==", key).get();
  return snapshot.docs
    .map((doc) => {
      const data = doc.data() as JsonRecord;
      return {
        id: doc.id,
        queryKey: stringValue(data, "queryKey"),
        keyword: stringValue(data, "keyword"),
        city: stringValue(data, "city"),
        provider: data.provider === "dataforseo" ? "dataforseo" : "serpapi",
        slug: stringValue(data, "slug"),
        title: stringValue(data, "title") || stringValue(data, "slug"),
        url: stringValue(data, "url"),
        date: typeof data.date === "string" ? data.date : undefined,
        linkedAt: toIso(data.linkedAt),
      } as LinkedPostRecord;
    })
    .sort((a, b) => String(a.linkedAt ?? "").localeCompare(String(b.linkedAt ?? "")));
}

const router = Router();
router.use(requireFirebaseAuth, requireSupremeAdmin);

router.get("/stats", async (req, res) => {
  const provider: SearchProvider = req.query.provider === "dataforseo" ? "dataforseo" : "serpapi";
  if (provider === "dataforseo") {
    const login = process.env.API_LOGIN_DATAFORSEO;
    const password = process.env.API_DATAFORSEO_PASSWORD;
    if (!login || !password) return res.status(500).json({ error: "Lipsesc API_LOGIN_DATAFORSEO și API_DATAFORSEO_PASSWORD din .env." });
    try {
      const credentials = Buffer.from(`${login}:${password}`).toString("base64");
      const response = await fetch("https://api.dataforseo.com/v3/appendix/user_data", { headers: { Authorization: `Basic ${credentials}` } });
      const payload = await response.json() as JsonRecord;
      const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
      const task = asRecord(tasks[0]);
      const userData = Array.isArray(task.result) ? asRecord(task.result[0]) : {};
      const money = asRecord(userData.money);
      if (!response.ok || numberValue(task, "status_code", 20000) !== 20000 || payload.status_code && payload.status_code !== 20000) {
        return res.status(502).json({ error: stringValue(task, "status_message") || stringValue(payload, "status_message") || "DataForSEO account request failed" });
      }
      return res.json({ provider, balance: numberValue(money, "balance", 0), capturedAt: new Date().toISOString() });
    } catch (error) {
      console.error("[seo-radar] DataForSEO stats error:", error);
      return res.status(502).json({ error: "Nu am putut încărca soldul DataForSEO." });
    }
  }

  const apiKey = process.env.SERP_API;
  if (!apiKey) return res.status(500).json({ error: "Lipsește SERP_API din .env." });

  try {
    const response = await fetch(`https://serpapi.com/account.json?api_key=${encodeURIComponent(apiKey)}`);
    const payload = await response.json() as Record<string, unknown>;
    if (!response.ok || payload.error) {
      return res.status(502).json({ error: String(payload.error || "SerpApi account request failed") });
    }

    res.json({
      provider,
      planName: payload.plan_name ?? null,
      searchesLeft: payload.total_searches_left ?? payload.plan_searches_left ?? null,
      searchesUsed: payload.total_searches_used ?? payload.plan_searches_used ?? null,
      searchesLimit: payload.plan_searches ?? null,
      thisMonthUsage: payload.this_month_usage ?? null,
      capturedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[seo-radar] stats error:", error);
    res.status(502).json({ error: "Nu am putut încărca statisticile SerpApi." });
  }
});

router.get("/history", async (req, res) => {
  const keyword = String(req.query.keyword || "").trim();
  const city = String(req.query.city || "").trim();
  const provider: SearchProvider = req.query.provider === "dataforseo" ? "dataforseo" : "serpapi";
  if (!keyword) return res.status(400).json({ error: "Keyword-ul este obligatoriu." });

  try {
    const key = queryKey(keyword, city, provider);
    const history = await getHistory(key);
    const latest = history.at(-1);
    const linkedPosts = (await getLinkedPosts(key)).map((post) => ({
      ...post,
      ...linkedPostStatus(post, latest?.organicResults ?? [], latest?.ownDomainPosition ?? null, latest?.ownDomainUrl ?? null),
    }));
    res.json({ keyword, city, history, linkedPosts });
  } catch (error) {
    console.error("[seo-radar] history error:", error);
    res.status(500).json({ error: "Nu am putut încărca istoricul." });
  }
});

router.get("/analyses", async (_req, res) => {
  try {
    const [scanSnap, linkSnap] = await Promise.all([
      firestore().collection(HISTORY_COLLECTION)
        .select("queryKey", "keyword", "city", "provider", "capturedAt", "ownDomainPosition", "ownDomainUrl", "localPack", "positionChange")
        .orderBy("capturedAt", "desc")
        .limit(2000)
        .get(),
      firestore().collection(LINKED_COLLECTION).limit(1000).get(),
    ]);

    const linksByKey = new Map<string, LinkedPostRecord[]>();
    for (const doc of linkSnap.docs) {
      const data = doc.data() as JsonRecord;
      const key = stringValue(data, "queryKey");
      if (!key) continue;
      const record: LinkedPostRecord = {
        id: doc.id,
        queryKey: key,
        keyword: stringValue(data, "keyword"),
        city: stringValue(data, "city"),
        provider: data.provider === "dataforseo" ? "dataforseo" : "serpapi",
        slug: stringValue(data, "slug"),
        title: stringValue(data, "title") || stringValue(data, "slug"),
        url: stringValue(data, "url"),
        date: typeof data.date === "string" ? data.date : undefined,
        linkedAt: toIso(data.linkedAt),
      };
      const bucket = linksByKey.get(key) ?? [];
      bucket.push(record);
      linksByKey.set(key, bucket);
    }

    type ScanRow = { queryKey: string; keyword: string; city: string; provider: SearchProvider; capturedAt: string; ownDomainPosition: number | null; ownDomainUrl: string | null; localPack: boolean; positionChange: number | null };
    const groups = new Map<string, ScanRow[]>();
    for (const doc of scanSnap.docs) {
      const data = doc.data() as JsonRecord;
      const rawKey = stringValue(data, "queryKey");
      if (!rawKey) continue;
      const provider: SearchProvider = data.provider === "dataforseo" ? "dataforseo" : "serpapi";
      const keyword = stringValue(data, "keyword");
      const city = stringValue(data, "city");
      const row: ScanRow = {
        queryKey: rawKey,
        keyword,
        city,
        provider,
        capturedAt: stringValue(data, "capturedAt"),
        ownDomainPosition: typeof data.ownDomainPosition === "number" ? data.ownDomainPosition : null,
        ownDomainUrl: typeof data.ownDomainUrl === "string" ? data.ownDomainUrl : null,
        localPack: data.localPack === true,
        positionChange: typeof data.positionChange === "number" ? data.positionChange : null,
      };
      const groupKey = analysisGroupKey(keyword, provider);
      const bucket = groups.get(groupKey) ?? [];
      bucket.push(row);
      groups.set(groupKey, bucket);
    }

    const analyses = Array.from(groups.values()).map((rowsUnsorted) => {
      const rows = [...rowsUnsorted].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
      const first = rows[0];
      const latest = rows[rows.length - 1];
      const firstPosition = first.ownDomainPosition;
      const latestPosition = latest.ownDomainPosition;
      const groupQueryKeys = Array.from(new Set(rows.map((row) => row.queryKey)));
      const seenSlugs = new Set<string>();
      const linkedPosts = groupQueryKeys
        .flatMap((qk) => linksByKey.get(qk) ?? [])
        .sort((a, b) => String(b.linkedAt ?? "").localeCompare(String(a.linkedAt ?? "")))
        .filter((post) => (seenSlugs.has(post.slug) ? false : (seenSlugs.add(post.slug), true)))
        .map((post) => {
          const ranked = latest.ownDomainUrl && sameBlogSlug(latest.ownDomainUrl, post.slug);
          const status: LinkedPostStatus["status"] = ranked ? "ranked" : latestPosition !== null ? "own_other" : "pending";
          return { ...post, status, rankedPosition: ranked ? latestPosition : status === "own_other" ? latestPosition : null };
        })
        .sort((a, b) => String(a.linkedAt ?? "").localeCompare(String(b.linkedAt ?? "")));
      return {
        queryKey: latest.queryKey,
        keyword: latest.keyword,
        city: latest.city,
        provider: latest.provider,
        scanCount: rows.length,
        firstScanAt: first.capturedAt,
        lastScanAt: latest.capturedAt,
        firstPosition,
        latestPosition,
        positionTrend: firstPosition !== null && latestPosition !== null ? firstPosition - latestPosition : null,
        latestOwnUrl: latest.ownDomainUrl,
        localPack: latest.localPack,
        linkedPosts,
        positionHistory: rows.map((row) => ({
          capturedAt: row.capturedAt,
          position: row.ownDomainPosition,
          change: row.positionChange,
        })),
      };
    }).sort((a, b) => b.lastScanAt.localeCompare(a.lastScanAt));

    res.json({ analyses });
  } catch (error) {
    console.error("[seo-radar] analyses error:", error);
    res.status(500).json({ error: "Nu am putut încărca analizele salvate." });
  }
});

// Șterge definitiv una sau mai multe analize (toate scanările + articolele legate).
// Body: { groups: [{ keyword, provider }] }. Fiecare grup e identificat prin analysisGroupKey.
router.delete("/analyses", async (req, res) => {
  const rawGroups = Array.isArray(req.body?.groups) ? req.body.groups : [];
  const targets = rawGroups
    .map((group: unknown) => {
      const record = asRecord(group);
      return {
        keyword: stringValue(record, "keyword").trim(),
        provider: (record.provider === "dataforseo" ? "dataforseo" : "serpapi") as SearchProvider,
      };
    })
    .filter((group: { keyword: string }) => group.keyword.length > 0);
  if (!targets.length) return res.status(400).json({ error: "Nicio analiză de șters." });

  const wantedGroupKeys = new Set(targets.map((group: { keyword: string; provider: SearchProvider }) => analysisGroupKey(group.keyword, group.provider)));

  try {
    const db = firestore();
    const scanSnap = await db.collection(HISTORY_COLLECTION)
      .select("queryKey", "keyword", "provider")
      .limit(5000)
      .get();

    const docRefs: FirebaseFirestore.DocumentReference[] = [];
    const queryKeys = new Set<string>();
    for (const doc of scanSnap.docs) {
      const data = doc.data() as JsonRecord;
      const keyword = stringValue(data, "keyword");
      const provider: SearchProvider = data.provider === "dataforseo" ? "dataforseo" : "serpapi";
      if (wantedGroupKeys.has(analysisGroupKey(keyword, provider))) {
        docRefs.push(doc.ref);
        const qk = stringValue(data, "queryKey");
        if (qk) queryKeys.add(qk);
      }
    }

    const linkedSnap = await db.collection(LINKED_COLLECTION).limit(2000).get();
    for (const doc of linkedSnap.docs) {
      if (queryKeys.has(stringValue(doc.data() as JsonRecord, "queryKey"))) docRefs.push(doc.ref);
    }

    for (let index = 0; index < docRefs.length; index += 450) {
      const batch = db.batch();
      docRefs.slice(index, index + 450).forEach(ref => batch.delete(ref));
      await batch.commit();
    }

    res.json({ ok: true, deleted: docRefs.length });
  } catch (error) {
    console.error("[seo-radar] delete analyses error:", error);
    res.status(500).json({ error: "Nu am putut șterge analiza." });
  }
});

router.post("/linked-posts", async (req, res) => {
  const provider: SearchProvider = req.body?.provider === "dataforseo" ? "dataforseo" : "serpapi";
  const keyword = String(req.body?.keyword || "").trim();
  const city = String(req.body?.city || "").trim();
  const slug = String(req.body?.slug || "").trim();
  const title = String(req.body?.title || "").trim();
  const date = typeof req.body?.date === "string" ? req.body.date.trim() : "";
  if (!keyword || !slug) return res.status(400).json({ error: "Keyword-ul și slug-ul sunt obligatorii." });

  const url = (typeof req.body?.url === "string" && req.body.url.trim())
    ? req.body.url.trim()
    : `https://${OWN_DOMAIN}/blog/${slug}`;
  const key = queryKey(keyword, city, provider);
  const docId = `${key}::${slug}`;

  try {
    await firestore().collection(LINKED_COLLECTION).doc(docId).set({
      queryKey: key,
      keyword,
      city,
      provider,
      slug,
      title: title || slug,
      url,
      ...(date ? { date } : {}),
      linkedAt: Timestamp.now(),
      createdBy: (req as AuthenticatedRequest).firebaseEmail ?? null,
    }, { merge: true });
    res.json({ ok: true, linkedPost: { id: docId, queryKey: key, slug, title: title || slug, url, date: date || undefined, linkedAt: new Date().toISOString() } });
  } catch (error) {
    console.error("[seo-radar] link post error:", error);
    res.status(500).json({ error: "Nu am putut lega articolul de analiză." });
  }
});

router.delete("/linked-posts", async (req, res) => {
  const key = String(req.query.queryKey || "").trim();
  const slug = String(req.query.slug || "").trim();
  if (!key || !slug) return res.status(400).json({ error: "queryKey și slug sunt obligatorii." });
  try {
    await firestore().collection(LINKED_COLLECTION).doc(`${key}::${slug}`).delete();
    res.json({ ok: true });
  } catch (error) {
    console.error("[seo-radar] unlink post error:", error);
    res.status(500).json({ error: "Nu am putut dezlega articolul." });
  }
});

const ARTICLE_PLAN_COLLECTION = "seoRadarArticlePlans";

router.get("/article-plan", async (req, res) => {
  const keyword = String(req.query.keyword || "").trim();
  const city = String(req.query.city || "").trim();
  const provider: SearchProvider = req.query.provider === "dataforseo" ? "dataforseo" : "serpapi";
  if (!keyword) return res.status(400).json({ error: "Keyword-ul este obligatoriu." });
  try {
    const key = queryKey(keyword, city, provider);
    const doc = await firestore().collection(ARTICLE_PLAN_COLLECTION).doc(key).get();
    if (!doc.exists) return res.json({ plan: null });
    const data = doc.data() as JsonRecord;
    res.json({
      plan: {
        targetKeyword: stringValue(data, "targetKeyword") || keyword,
        secondaryKeywords: Array.isArray(data.secondaryKeywords) ? data.secondaryKeywords.filter((item): item is string => typeof item === "string") : [],
      },
    });
  } catch (error) {
    console.error("[seo-radar] article-plan get error:", error);
    res.status(500).json({ error: "Nu am putut încărca planul articolului." });
  }
});

router.put("/article-plan", async (req, res) => {
  const provider: SearchProvider = req.body?.provider === "dataforseo" ? "dataforseo" : "serpapi";
  const keyword = String(req.body?.keyword || "").trim();
  const city = String(req.body?.city || "").trim();
  const targetKeyword = String(req.body?.targetKeyword || "").trim() || keyword;
  const secondaryKeywords = Array.isArray(req.body?.secondaryKeywords)
    ? req.body.secondaryKeywords.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0).map((item: string) => item.trim()).slice(0, 15)
    : [];
  if (!keyword) return res.status(400).json({ error: "Keyword-ul este obligatoriu." });
  try {
    const key = queryKey(keyword, city, provider);
    await firestore().collection(ARTICLE_PLAN_COLLECTION).doc(key).set({
      queryKey: key,
      keyword,
      city,
      provider,
      targetKeyword,
      secondaryKeywords,
      updatedAt: Timestamp.now(),
    }, { merge: true });
    res.json({ ok: true });
  } catch (error) {
    console.error("[seo-radar] article-plan put error:", error);
    res.status(500).json({ error: "Nu am putut salva planul articolului." });
  }
});

router.post("/ads-insight", async (req, res) => {
  const login = process.env.API_LOGIN_DATAFORSEO;
  const password = process.env.API_DATAFORSEO_PASSWORD;
  if (!login || !password) return res.status(500).json({ error: "Lipsesc API_LOGIN_DATAFORSEO și API_DATAFORSEO_PASSWORD din .env." });

  const keyword = typeof req.body?.keyword === "string" ? req.body.keyword.trim() : "";
  if (!keyword) return res.status(400).json({ error: "Keyword-ul este obligatoriu." });

  const credentials = Buffer.from(`${login}:${password}`).toString("base64");
  const headers = { "Content-Type": "application/json", Authorization: `Basic ${credentials}` };

  const results = await Promise.allSettled([
    fetch("https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live", {
      method: "POST", headers,
      body: JSON.stringify([{ keywords: [keyword], location_code: DATAFORSEO_ROMANIA_LOCATION_CODE, language_code: "ro" }]),
    }).then(r => r.json()),
    fetch("https://api.dataforseo.com/v3/dataforseo_labs/google/search_intent/live", {
      method: "POST", headers,
      body: JSON.stringify([{ keywords: [keyword], language_code: "ro" }]),
    }).then(r => r.json()),
  ]);
  const [volumeResult, intentResult] = results;

  const insight: JsonRecord = {
    keyword,
    volume: null, cpc: null, competition: null, competitionIndex: null, lowBid: null, highBid: null,
    intent: null, intentProbability: null,
  };
  let succeeded = 0;

  if (volumeResult.status === "fulfilled") {
    try {
      const tasks = (volumeResult.value as JsonRecord).tasks;
      const row = asRecord(Array.isArray(tasks) ? (Array.isArray(asRecord(tasks[0]).result) ? (asRecord(tasks[0]).result as unknown[])[0] : null) : null);
      if (Object.keys(row).length) {
        insight.volume = typeof row.search_volume === "number" ? row.search_volume : null;
        insight.cpc = typeof row.cpc === "number" ? row.cpc : null;
        insight.competition = typeof row.competition === "string" ? row.competition : null;
        insight.competitionIndex = typeof row.competition_index === "number" ? row.competition_index : null;
        insight.lowBid = typeof row.low_top_of_page_bid === "number" ? row.low_top_of_page_bid : null;
        insight.highBid = typeof row.high_top_of_page_bid === "number" ? row.high_top_of_page_bid : null;
      }
      succeeded++;
    } catch (error) {
      console.error("[seo-radar] ads-insight search_volume parse error:", error);
    }
  }

  if (intentResult.status === "fulfilled") {
    try {
      const tasks = (intentResult.value as JsonRecord).tasks;
      const list = Array.isArray(tasks) ? asRecord(asRecord(tasks[0]).result && (asRecord(tasks[0]).result as unknown[])[0]) : {};
      const item = asRecord((Array.isArray(list.items) ? list.items : [])[0]);
      const keywordIntent = asRecord(item.keyword_intent);
      if (typeof keywordIntent.label === "string") insight.intent = keywordIntent.label;
      if (typeof keywordIntent.probability === "number") insight.intentProbability = keywordIntent.probability;
      succeeded++;
    } catch (error) {
      console.error("[seo-radar] ads-insight search_intent parse error:", error);
    }
  }

  if (succeeded === 0) return res.status(502).json({ error: "Nu am putut încărca datele de Ads." });
  res.json({ insight });
});

router.post("/ads-budget", async (req, res) => {
  const login = process.env.API_LOGIN_DATAFORSEO;
  const password = process.env.API_DATAFORSEO_PASSWORD;
  if (!login || !password) return res.status(500).json({ error: "Lipsesc API_LOGIN_DATAFORSEO și API_DATAFORSEO_PASSWORD din .env." });

  const keyword = typeof req.body?.keyword === "string" ? req.body.keyword.trim() : "";
  const bidRaw = Number(req.body?.bid);
  const bid = Number.isFinite(bidRaw) && bidRaw > 0 ? bidRaw : 3;
  if (!keyword) return res.status(400).json({ error: "Keyword-ul este obligatoriu." });

  try {
    const credentials = Buffer.from(`${login}:${password}`).toString("base64");
    const response = await fetch("https://api.dataforseo.com/v3/keywords_data/google_ads/ad_traffic_by_keywords/live", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${credentials}` },
      body: JSON.stringify([{ keywords: [keyword], location_code: DATAFORSEO_ROMANIA_LOCATION_CODE, language_code: "ro", bid, match: "exact" }]),
    });
    const payload = await response.json() as JsonRecord;
    const tasks = payload.tasks;
    const row = asRecord(Array.isArray(tasks) ? (Array.isArray(asRecord(tasks[0]).result) ? (asRecord(tasks[0]).result as unknown[])[0] : null) : null);
    if (!Object.keys(row).length) throw new Error("Fără estimare de la DataForSEO.");
    res.json({
      estimate: {
        bid,
        clicks: typeof row.clicks === "number" ? row.clicks : null,
        cost: typeof row.cost === "number" ? row.cost : null,
        avgCpc: typeof row.average_cpc === "number" ? row.average_cpc : null,
        impressions: typeof row.impressions === "number" ? row.impressions : null,
      },
    });
  } catch (error) {
    console.error("[seo-radar] ads-budget error:", error);
    res.status(502).json({ error: "Nu am putut estima bugetul de Ads." });
  }
});

router.post("/search", async (req, res) => {
  const provider: SearchProvider = req.body?.provider === "dataforseo" ? "dataforseo" : "serpapi";
  const keyword = String(req.body?.keyword || "").trim();
  const city = String(req.body?.city || "").trim();

  if (provider === "serpapi" && !process.env.SERP_API) return res.status(500).json({ error: "Lipsește SERP_API din .env." });
  if (provider === "dataforseo" && (!process.env.API_LOGIN_DATAFORSEO || !process.env.API_DATAFORSEO_PASSWORD)) {
    return res.status(500).json({ error: "Lipsesc API_LOGIN_DATAFORSEO și API_DATAFORSEO_PASSWORD din .env." });
  }
  if (!keyword) return res.status(400).json({ error: "Keyword-ul este obligatoriu." });

  try {
    const { payload, metadata } = provider === "dataforseo"
      ? await searchDataForSeo(keyword, city)
      : await searchSerpApi(keyword, city, process.env.SERP_API!);

    const organicResults = (Array.isArray(payload.organic_results) ? payload.organic_results : []).slice(0, 10).map((rawItem: unknown, index: number) => {
      const item = asRecord(rawItem);
      const url = stringValue(item, "link");
      return {
      position: numberValue(item, "position", index + 1),
      title: stringValue(item, "title"),
      url,
      domain: domainOf(url || stringValue(item, "displayed_link")),
      snippet: stringValue(item, "snippet"),
      };
    });
    const ads = (Array.isArray(payload.ads) ? payload.ads : Array.isArray(payload.top_ads) ? payload.top_ads : []).map((rawItem: unknown) => {
      const item = asRecord(rawItem);
      const url = stringValue(item, "link") || stringValue(item, "redirect_link");
      return {
      title: stringValue(item, "title"),
      url,
      domain: domainOf(url || stringValue(item, "displayed_link")),
      };
    });
    const capturedAt = new Date().toISOString();
    const own = ownResult(organicResults);
    const key = queryKey(keyword, city, provider);
    const previousHistory = await getHistory(key);
    const previous = previousHistory.at(-1);
    const previousPosition = previous?.ownDomainPosition ?? null;
    const positionChange = own && previousPosition !== null ? previousPosition - own.position : null;

    await firestore().collection(HISTORY_COLLECTION).add({
      queryKey: key,
      keyword,
      city,
      provider,
      capturedAt,
      searchedAt: FieldValue.serverTimestamp(),
      organicResults,
      ads,
      localPack: hasLocalPack(payload.local_results),
      ownDomainPosition: own?.position ?? null,
      ownDomainUrl: own?.url ?? null,
      previousPosition,
      positionChange,
    });

    const history = await getHistory(key);
    const linkedPosts = (await getLinkedPosts(key)).map((post) => ({
      ...post,
      ...linkedPostStatus(post, organicResults, own?.position ?? null, own?.url ?? null),
    }));

    res.json({
      keyword,
      city,
      capturedAt,
      source: provider,
      organicResults,
      ads,
      localPack: hasLocalPack(payload.local_results),
      ownDomainPosition: own?.position ?? null,
      ownDomainUrl: own?.url ?? null,
      previousPosition,
      positionChange,
      history,
      linkedPosts,
      metadata,
    });
  } catch (error) {
    console.error("[seo-radar] search error:", error);
    const detail = error instanceof Error ? error.message : "";
    res.status(502).json({ error: detail ? `Scanarea a eșuat: ${detail}` : `Nu am putut interoga ${provider === "dataforseo" ? "DataForSEO" : "SerpApi"}.` });
  }
});

router.post("/analyze", async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "Lipsește ANTHROPIC_API_KEY din .env." });

  const keyword = typeof req.body?.keyword === "string" ? req.body.keyword.trim() : "";
  const city = typeof req.body?.city === "string" ? req.body.city.trim() : "";
  const source = req.body?.source === "dataforseo" ? "DataForSEO" : "SerpApi";
  const results = Array.isArray(req.body?.organicResults) ? req.body.organicResults.slice(0, 10).map((item: unknown) => {
    const result = asRecord(item);
    return { position: numberValue(result, "position", 0), title: stringValue(result, "title"), url: stringValue(result, "url"), domain: stringValue(result, "domain"), snippet: stringValue(result, "snippet") };
  }) : [];

  if (!keyword) return res.status(400).json({ error: "Keyword-ul este obligatoriu." });

  try {
    const message = await anthropicLong.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1800,
      messages: [{
        role: "user",
        content: `Ești consultantul SEO pentru AncaVisuals, studio românesc de fotografie și videografie. Analizează SERP-ul de mai jos și creează un plan concret de conținut.

Keyword: ${keyword}
Locație: ${city || "România"}
Sursă: ${source}
Domeniul nostru: ancavisuals.ro
Rezultate organice:
${JSON.stringify(results, null, 2)}

Dacă domeniul ancavisuals.ro nu apare în rezultate, explică ce intenție de căutare domină și recomandă o pagină nouă sau o îmbunătățire a unei pagini existente. Nu inventa date despre concurenți; bazează-te strict pe titlurile, URL-urile și descrierile primite. URL-ul canonic trebuie să fie absolut, pe ancavisuals.ro, fără diacritice și cu slug realist. Ține cont că paginile locale existente folosesc tipare precum /fotograf-nunta-oras și /foto-video-serviciu-oras.

Răspunde STRICT cu JSON valid, fără markdown, exact în această structură:
{
  "visibility": "not_found | found",
  "summary": "concluzia în 1-2 propoziții",
  "searchIntent": "intenția dominantă",
  "recommendation": "ce trebuie făcut concret",
  "priority": "high | medium | low",
  "pageType": "landing_page | blog_post | improve_existing_page",
  "canonicalUrl": "https://ancavisuals.ro/...",
  "suggestedTitle": "titlu SEO",
  "metaDescription": "descriere meta de maximum 155 caractere",
  "blogPost": {
    "needed": true,
    "title": "titlu articol dacă este necesar, altfel string gol",
    "slug": "slug fără slash la început",
    "angle": "unghiul editorial",
    "outline": ["H2 ...", "H2 ...", "H2 ..."]
  },
  "onPageActions": ["acțiune concretă 1", "acțiune concretă 2"],
  "internalLinks": ["ce pagină existentă ar trebui să trimită link către aceasta"],
  "faq": ["întrebare FAQ relevantă 1", "întrebare FAQ relevantă 2"]
}`,
      }],
    });
    const text = message.content.filter((block): block is Anthropic.TextBlock => block.type === "text").map(block => block.text).join("").trim();
    const jsonText = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
    res.json({ analysis: JSON.parse(jsonText) });
  } catch (error) {
    console.error("[seo-radar] AI analysis error:", error);
    res.status(502).json({ error: "Nu am putut genera recomandarea SEO cu Claude." });
  }
});

router.post("/generate-post", async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "Lipsește ANTHROPIC_API_KEY din .env." });
  const keyword = typeof req.body?.keyword === "string" ? req.body.keyword.trim() : "";
  const city = typeof req.body?.city === "string" ? req.body.city.trim() : "";
  const results = Array.isArray(req.body?.organicResults) ? req.body.organicResults.slice(0, 10) : [];
  const variantIndex = Number.isInteger(req.body?.variantIndex) ? Number(req.body.variantIndex) : null;
  const targetKeyword = typeof req.body?.targetKeyword === "string" ? req.body.targetKeyword.trim() : "";
  const secondaryKeywords: string[] = Array.isArray(req.body?.secondaryKeywords)
    ? req.body.secondaryKeywords.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0).map((item: string) => item.trim()).slice(0, 15)
    : [];
  if (!keyword) return res.status(400).json({ error: "Keyword-ul este obligatoriu." });
  try {
    const planInstructions = [
      targetKeyword && targetKeyword !== keyword
        ? `Deși căutarea inițială a fost pentru "${keyword}", vizează precis termenul "${targetKeyword}" ca temă principală a articolului (titlu, slug, meta, unghi).`
        : "",
      secondaryKeywords.length
        ? `Include natural, fără keyword stuffing, și aceste keyword-uri secundare: ${secondaryKeywords.join(", ")}. Folosește-le ca bază pentru "tags" din răspuns și țese-le firesc în title/metaDescription/body unde are sens real.`
        : "",
    ].filter(Boolean).join("\n");
    const message = await anthropicLong.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 6000,
      messages: [{ role: "user", content: `Ești expert SEO și copywriter pentru AncaVisuals, studio românesc de fotografie, videografie și fotocabină. Creează ${variantIndex === null ? "3 variante distincte" : "o singură variantă distinctă"} de pagină/articol în limba română pentru keywordul "${keyword}" în ${city || "România"}.

SERP-ul analizat: ${JSON.stringify(results)}
Domeniu: ancavisuals.ro. Paginile locale existente folosesc tipare precum /fotograf-nunta-oras și /foto-video-serviciu-oras. Nu inventa recenzii, premii sau informații care nu apar în date. Fiecare variantă trebuie să fie suficient de diferită (unghi, titlu, structură), utilă pentru oameni și naturală SEO, nu keyword stuffing.
${planInstructions ? `\n${planInstructions}\n` : ""}
Răspunde STRICT cu un JSON array, fără markdown, cu exact ${variantIndex === null ? 3 : 1} ${variantIndex === null ? "obiecte" : "obiect"}:
[{"title":"titlu SEO","slug":"slug-fara-diacritice","canonicalUrl":"https://ancavisuals.ro/blog/slug-fara-diacritice","metaDescription":"maxim 155 caractere","seoTitle":"titlu pentru title tag, maxim 60 caractere","tags":["tag1","tag2"],"category":"categorie","angle":"unghiul variantei","bodyHtml":"","faq":[{"question":"întrebare","answer":"răspuns"}],"internalLinks":["pagină recomandată pentru link intern"],"priority":"high | medium | low"}]
Nu genera bodyHtml în acest pas: body-ul va fi creat separat doar după ce administratorul introduce contextul. Poți menționa serviciile AncaVisuals în metadata, dar nu inventa prețuri: lasă un loc clar de completat precum [PREȚ DE COMPLETAT] dacă este relevant.` }],
    });
    const text = message.content.filter((block): block is Anthropic.TextBlock => block.type === "text").map(block => block.text).join("").trim();
    const jsonText = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
    const variants = JSON.parse(jsonrepair(jsonText));
    if (!Array.isArray(variants) || variants.length !== (variantIndex === null ? 3 : 1)) throw new Error("Claude nu a returnat numărul corect de variante.");
    res.json({ variants });
  } catch (error) {
    console.error("[seo-radar] post generation error:", error);
    res.status(502).json({ error: "Nu am putut genera cele 3 variante SEO cu Claude." });
  }
});

router.post("/generate-body", async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "Lipsește ANTHROPIC_API_KEY din .env." });
  const instruction = typeof req.body?.instruction === "string" ? req.body.instruction.trim() : "";
  const context = typeof req.body?.context === "string" ? req.body.context.slice(0, 3000) : "";
  if (!instruction) return res.status(400).json({ error: "Scrie instrucțiunea pentru textul dorit." });
  try {
    const message = await anthropicLong.messages.create({ model: "claude-sonnet-4-6", max_tokens: 2400, messages: [{ role: "user", content: `Scrie 3 variante distincte în română pentru o secțiune de articol SEO AncaVisuals. Instrucțiunea administratorului: "${instruction}". Contextul articolului: "${context}".

Stil obligatoriu: concentrează-te strict pe produs, servicii și feature-uri concrete oferite. Scrie scurt, clar și direct, orientat spre decizia vizitatorului și spre ce primește efectiv clientul. Evită textele siropoase, clișeele, metaforele, promisiunile generale, introducerile lungi și orice umplutură. Nu inventa prețuri, beneficii, recenzii sau dotări; păstrează exact placeholder-ele primite.

Răspunde STRICT cu JSON array de exact 3 obiecte {"title":"scurtă etichetă","html":"text HTML de 1-4 paragrafe folosind doar p,strong,em,ul,li,br"}, fără markdown.` }] });
    const text = message.content.filter((block): block is Anthropic.TextBlock => block.type === "text").map(block => block.text).join("").trim();
    const variants = JSON.parse(jsonrepair(text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "")));
    res.json({ variants });
  } catch (error) {
    console.error("[seo-radar] body generation error:", error);
    res.status(502).json({ error: "Nu am putut genera variantele de text cu Claude." });
  }
});

router.post("/check-canonical", async (req, res) => {
  const value = typeof req.body?.url === "string" ? req.body.url.trim() : "";
  let url: URL;
  try { url = new URL(value); } catch { return res.status(400).json({ error: "URL-ul nu este valid." }); }
  if (url.protocol !== "https:" || (url.hostname !== OWN_DOMAIN && !url.hostname.endsWith(`.${OWN_DOMAIN}`))) {
    return res.status(400).json({ error: "Poți verifica doar URL-uri HTTPS de pe ancavisuals.ro." });
  }
  try {
    const response = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(10_000) });
    res.json({ exists: response.ok, status: response.status, finalUrl: response.url });
  } catch (error) {
    console.error("[seo-radar] canonical check error:", error);
    res.json({ exists: false, status: null, finalUrl: url.toString(), error: "URL-ul nu a putut fi accesat." });
  }
});

router.post("/keyword-suggestions", async (req, res) => {
  const startedAt = Date.now();
  console.info("[seo-radar] keyword suggestions request received");
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "Lipsește ANTHROPIC_API_KEY din .env." });
  const parts = [req.body?.serviceOne, req.body?.serviceTwo, req.body?.event, req.body?.custom]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0).map(part => part.trim());
  const similar = req.body?.similar === true;
  try {
    const message = await anthropic.messages.create({ model: "claude-haiku-4-5-20251001", max_tokens: 500, messages: [{ role: "user", content: `${similar ? "Generează un set nou de 6 keyword-uri SEO asemănătoare, dar nu identice, pornind de la" : "Generează 6 keyword-uri SEO naturale pornind de la"} componentele alese de administrator: ${parts.join(", ") || "niciuna"}. Scrie în limba română pentru servicii foto-video locale. Păstrează orașul sau intenția locală dacă există, variază ordinea și sinonimele naturale, folosește maximum 5 cuvinte și evită keyword stuffing. Răspunde STRICT cu JSON array de 6 stringuri, fără explicații.` }] });
    const text = message.content.filter((block): block is Anthropic.TextBlock => block.type === "text").map(block => block.text).join("").trim();
    const suggestions = JSON.parse(text.replace(/^```json\s*/i, "").replace(/\s*```$/i, ""));
    if (!Array.isArray(suggestions)) throw new Error("Invalid keyword suggestions");
    const cleanSuggestions = suggestions.filter((suggestion): suggestion is string => typeof suggestion === "string").slice(0, 6);
    console.info(`[seo-radar] keyword suggestions completed in ${Date.now() - startedAt}ms`);
    res.json({ suggestions: cleanSuggestions });
  } catch (error) {
    console.error(`[seo-radar] keyword suggestions error after ${Date.now() - startedAt}ms:`, error);
    res.status(502).json({ error: "Nu am putut genera sugestiile de keyword cu Claude." });
  }
});

router.post("/diacritics", async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "Lipsește ANTHROPIC_API_KEY din .env." });
  const input = typeof req.body?.input === "string" ? req.body.input.trim().slice(0, 500) : "";
  if (!input) return res.status(400).json({ error: "Introdu cuvântul sau textul pentru corectare." });
  try {
    const message = await anthropic.messages.create({ model: "claude-haiku-4-5-20251001", max_tokens: 700, messages: [{ role: "user", content: `Pentru textul românesc de mai jos, generează toate variantele plauzibile de scriere cu și fără diacritice, modificând doar diacriticele (ă â î ș ț) și păstrând exact restul textului. Elimină duplicatele și sortează varianta corectă cu diacritice prima. Text: "${input}". Răspunde STRICT cu JSON array de stringuri, fără explicații.` }] });
    const text = message.content.filter((block): block is Anthropic.TextBlock => block.type === "text").map(block => block.text).join("").trim();
    const variants = JSON.parse(jsonrepair(text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "")));
    if (!Array.isArray(variants)) throw new Error("Invalid diacritics response");
    res.json({ variants: variants.filter((variant): variant is string => typeof variant === "string").slice(0, 100) });
  } catch (error) {
    console.error("[seo-radar] diacritics error:", error);
    res.status(502).json({ error: "Nu am putut genera variantele cu diacritice." });
  }
});

router.post("/keyword-alternatives", async (req, res) => {
  const login = process.env.API_LOGIN_DATAFORSEO;
  const password = process.env.API_DATAFORSEO_PASSWORD;
  if (!login || !password) return res.status(500).json({ error: "Lipsesc API_LOGIN_DATAFORSEO și API_DATAFORSEO_PASSWORD din .env." });

  const baseKeyword = typeof req.body?.baseKeyword === "string" ? req.body.baseKeyword.trim() : "";
  const city = typeof req.body?.city === "string" ? req.body.city.trim() : "";
  if (!baseKeyword) return res.status(400).json({ error: "Keyword-ul de bază este obligatoriu." });

  const seed = city ? `${baseKeyword} ${city}` : baseKeyword;
  const seedNorm = normalizeKeyword(seed);
  const credentials = Buffer.from(`${login}:${password}`).toString("base64");
  const headers = { "Content-Type": "application/json", Authorization: `Basic ${credentials}` };

  // Combined "serviciu + oraș" seeds return a lot of noise from Labs (generic city queries
  // that have nothing to do with the service). Require the suggestion to still carry a real
  // word from the service term itself — a no-op when baseKeyword has no city attached.
  const baseWords = normalizeKeyword(baseKeyword).split(" ").filter((word) => word.length >= 3);
  const isRelevant = (keyword: string): boolean => {
    if (!baseWords.length) return true;
    const norm = normalizeKeyword(keyword);
    return baseWords.some((word) => norm.includes(word));
  };

  const suggestions = new Map<string, { keyword: string; volume: number | null; trendScore: number | null; rising: boolean }>();
  const upsert = (keyword: string, patch: { volume?: number | null; trendScore?: number | null; rising?: boolean }) => {
    const norm = normalizeKeyword(keyword);
    if (!norm || norm === seedNorm || !isRelevant(keyword)) return;
    const current = suggestions.get(norm) ?? { keyword: keyword.trim(), volume: null, trendScore: null, rising: false };
    if (patch.volume !== undefined && patch.volume !== null) current.volume = patch.volume;
    if (patch.trendScore !== undefined && patch.trendScore !== null) current.trendScore = Math.max(current.trendScore ?? 0, patch.trendScore);
    if (patch.rising) current.rising = true;
    suggestions.set(norm, current);
  };

  const results = await Promise.allSettled([
    fetch("https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live", {
      method: "POST", headers,
      body: JSON.stringify([{ keyword: seed, location_code: DATAFORSEO_ROMANIA_LOCATION_CODE, language_code: "ro", depth: 1, limit: 20 }]),
    }).then(r => r.json()),
    fetch("https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live", {
      method: "POST", headers,
      body: JSON.stringify([{ keywords: [seed], location_code: DATAFORSEO_ROMANIA_LOCATION_CODE, language_code: "ro", limit: 20 }]),
    }).then(r => r.json()),
    fetch("https://api.dataforseo.com/v3/keywords_data/google_trends/explore/live", {
      method: "POST", headers,
      body: JSON.stringify([{ keywords: [seed], location_code: DATAFORSEO_ROMANIA_LOCATION_CODE, language_code: "ro", type: "web", item_types: ["google_trends_queries_list"] }]),
    }).then(r => r.json()),
  ]);

  let succeeded = 0;
  const [relatedResult, ideasResult, trendsResult] = results;

  if (relatedResult.status === "fulfilled") {
    try {
      const items = (relatedResult.value as JsonRecord).tasks;
      const list = Array.isArray(items) ? asRecord(asRecord(items[0]).result && (asRecord(items[0]).result as unknown[])[0]) : {};
      const rows = Array.isArray(list.items) ? list.items : [];
      for (const row of rows) {
        const kwData = asRecord(asRecord(row).keyword_data);
        const keyword = stringValue(kwData, "keyword");
        const info = asRecord(kwData.keyword_info);
        const volume = typeof info.search_volume === "number" ? info.search_volume : null;
        if (keyword) upsert(keyword, { volume });
      }
      succeeded++;
    } catch (error) {
      console.error("[seo-radar] related_keywords parse error:", error);
    }
  }

  if (ideasResult.status === "fulfilled") {
    try {
      const tasks = (ideasResult.value as JsonRecord).tasks;
      const list = Array.isArray(tasks) ? asRecord(asRecord(tasks[0]).result && (asRecord(tasks[0]).result as unknown[])[0]) : {};
      const rows = Array.isArray(list.items) ? list.items : [];
      for (const row of rows) {
        const item = asRecord(row);
        const keyword = stringValue(item, "keyword");
        const info = asRecord(item.keyword_info);
        const volume = typeof info.search_volume === "number" ? info.search_volume : null;
        if (keyword) upsert(keyword, { volume });
      }
      succeeded++;
    } catch (error) {
      console.error("[seo-radar] keyword_ideas parse error:", error);
    }
  }

  if (trendsResult.status === "fulfilled") {
    try {
      const tasks = (trendsResult.value as JsonRecord).tasks;
      const list = Array.isArray(tasks) ? asRecord(asRecord(tasks[0]).result && (asRecord(tasks[0]).result as unknown[])[0]) : {};
      const items = Array.isArray(list.items) ? list.items : [];
      const queriesItem = items.map(asRecord).find(item => stringValue(item, "type") === "google_trends_queries_list");
      const data = asRecord(queriesItem?.data);
      const top = Array.isArray(data.top) ? data.top : [];
      const rising = Array.isArray(data.rising) ? data.rising : [];
      for (const row of top) {
        const item = asRecord(row);
        const keyword = stringValue(item, "query");
        if (keyword) upsert(keyword, { trendScore: numberValue(item, "value", 0) });
      }
      for (const row of rising) {
        const item = asRecord(row);
        const keyword = stringValue(item, "query");
        if (keyword) upsert(keyword, { trendScore: numberValue(item, "value", 0), rising: true });
      }
      succeeded++;
    } catch (error) {
      console.error("[seo-radar] google_trends parse error:", error);
    }
  }

  if (succeeded === 0) {
    return res.status(502).json({ error: "Nu am putut găsi sugestii de keyword-uri." });
  }

  const sorted = Array.from(suggestions.values()).sort((a, b) => {
    if (a.volume !== null && b.volume !== null) return b.volume - a.volume;
    if (a.volume !== null) return -1;
    if (b.volume !== null) return 1;
    return (b.trendScore ?? 0) - (a.trendScore ?? 0);
  }).slice(0, 20);

  res.json({ suggestions: sorted });
});

async function searchSerpApi(keyword: string, city: string, apiKey: string): Promise<{ payload: JsonRecord; metadata: JsonRecord }> {
  const params = new URLSearchParams({ engine: "google", q: keyword, hl: "ro", gl: "ro", google_domain: "google.ro", api_key: apiKey });
  const resolvedLocation = city ? await resolveLocation(city, apiKey) : null;
  if (resolvedLocation) params.set("location", resolvedLocation);

  let response = await fetch(`https://serpapi.com/search.json?${params}`);
  let payload = await response.json() as JsonRecord;
  if (payload.error && city && /location/i.test(String(payload.error))) {
    params.delete("location");
    response = await fetch(`https://serpapi.com/search.json?${params}`);
    payload = await response.json() as JsonRecord;
  }
  if (!response.ok || payload.error) throw new Error(String(payload.error || "SerpApi request failed"));
  return { payload, metadata: { id: stringValue(asRecord(payload.search_metadata), "id") || null, status: stringValue(asRecord(payload.search_metadata), "status") || null } };
}

async function searchDataForSeo(keyword: string, city: string): Promise<{ payload: JsonRecord; metadata: JsonRecord }> {
  const credentials = Buffer.from(`${process.env.API_LOGIN_DATAFORSEO}:${process.env.API_DATAFORSEO_PASSWORD}`).toString("base64");
  const locationCode = await resolveDataForSeoLocation(city, credentials);
  const response = await fetch("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${credentials}` },
    body: JSON.stringify([{ keyword, location_code: locationCode, language_code: "ro", device: "desktop", os: "windows", depth: 10 }]),
  });
  const payload = await response.json() as JsonRecord;
  const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  const task = asRecord(tasks[0]);
  const taskResult = Array.isArray(task.result) ? asRecord(task.result[0]) : {};
  if (!response.ok || numberValue(task, "status_code", 20000) !== 20000 || payload.status_code && payload.status_code !== 20000) {
    throw new Error(stringValue(task, "status_message") || stringValue(payload, "status_message") || "DataForSEO request failed");
  }

  const items = Array.isArray(taskResult.items) ? taskResult.items : [];
  const organicResults = items.filter((item) => stringValue(asRecord(item), "type") === "organic").slice(0, 10).map((rawItem, index) => {
    const item = asRecord(rawItem);
    const url = stringValue(item, "url");
    return { position: numberValue(item, "rank_group", index + 1), title: stringValue(item, "title"), url, domain: domainOf(url || stringValue(item, "domain")), snippet: stringValue(item, "description") };
  });
  const ads = items.filter((item) => stringValue(asRecord(item), "type") === "paid").map(rawItem => {
    const item = asRecord(rawItem);
    const url = stringValue(item, "url");
    return { title: stringValue(item, "title"), url, domain: domainOf(url || stringValue(item, "domain")) };
  });
  return {
    payload: { organic_results: organicResults, ads, local_results: items.filter(item => stringValue(asRecord(item), "type") === "local_pack") },
    metadata: { id: stringValue(task, "id") || null, status: stringValue(task, "status_message") || "ok" },
  };
}

async function resolveDataForSeoLocation(city: string, credentials: string): Promise<number> {
  if (!city) return DATAFORSEO_ROMANIA_LOCATION_CODE;

  try {
    const response = await fetch("https://api.dataforseo.com/v3/serp/google/locations/ro", {
      headers: { Authorization: `Basic ${credentials}` },
    });
    if (!response.ok) return DATAFORSEO_ROMANIA_LOCATION_CODE;

    const payload = await response.json() as JsonRecord;
    const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
    const task = asRecord(tasks[0]);
    const locations = Array.isArray(task.result) ? task.result : [];
    const normalizedCity = normalizeLocationName(city);
    const match = locations.map(asRecord).find((location) => {
      const name = normalizeLocationName(stringValue(location, "location_name"));
      return name === normalizedCity || name.split(",").some(part => part.trim() === normalizedCity);
    });
    const code = match?.location_code;
    return typeof code === "number" ? code : DATAFORSEO_ROMANIA_LOCATION_CODE;
  } catch {
    return DATAFORSEO_ROMANIA_LOCATION_CODE;
  }
}

function normalizeLocationName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

async function resolveLocation(city: string, apiKey: string): Promise<string | null> {
  const params = new URLSearchParams({ q: `${city}, Romania`, limit: "10", api_key: apiKey });
  const response = await fetch(`https://serpapi.com/locations.json?${params}`);
  if (!response.ok) return null;
  const locations = await response.json() as unknown[];
  if (!Array.isArray(locations)) return null;
  const exact = locations.map(asRecord).find((item) => stringValue(item, "country_code") === "RO" && stringValue(item, "name").toLowerCase() === city.toLowerCase());
  return exact ? stringValue(exact, "canonical_name") || stringValue(exact, "id") || null : null;
}

function domainOf(value: string): string {
  try { return new URL(value.startsWith("http") ? value : `https://${value}`).hostname.replace(/^www\./, ""); }
  catch { return ""; }
}

export default router;
