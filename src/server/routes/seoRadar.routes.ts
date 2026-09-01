import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";
import { FieldValue } from "firebase-admin/firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { firestore } from "../firestore.js";

const HISTORY_COLLECTION = "seoRadarSearches";
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

function ownResult(results: SerpResult[]): SerpResult | null {
  return results.find((item) => item.domain === OWN_DOMAIN || item.domain.endsWith(`.${OWN_DOMAIN}`)) ?? null;
}

async function getHistory(key: string) {
  const snapshot = await firestore().collection(HISTORY_COLLECTION).where("queryKey", "==", key).get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as HistoryRecord))
    .sort((a, b) => String(a.capturedAt).localeCompare(String(b.capturedAt)));
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
    const history = await getHistory(queryKey(keyword, city, provider));
    res.json({ keyword, city, history });
  } catch (error) {
    console.error("[seo-radar] history error:", error);
    res.status(500).json({ error: "Nu am putut încărca istoricul." });
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
      metadata,
    });
  } catch (error) {
    console.error("[seo-radar] search error:", error);
    res.status(502).json({ error: "Nu am putut interoga SerpApi." });
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
  if (!keyword) return res.status(400).json({ error: "Keyword-ul este obligatoriu." });
  try {
    const message = await anthropicLong.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 6000,
      messages: [{ role: "user", content: `Ești expert SEO și copywriter pentru AncaVisuals, studio românesc de fotografie, videografie și fotocabină. Creează ${variantIndex === null ? "3 variante distincte" : "o singură variantă distinctă"} de pagină/articol în limba română pentru keywordul "${keyword}" în ${city || "România"}.

SERP-ul analizat: ${JSON.stringify(results)}
Domeniu: ancavisuals.ro. Paginile locale existente folosesc tipare precum /fotograf-nunta-oras și /foto-video-serviciu-oras. Nu inventa recenzii, premii sau informații care nu apar în date. Fiecare variantă trebuie să fie suficient de diferită (unghi, titlu, structură), utilă pentru oameni și naturală SEO, nu keyword stuffing.

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
