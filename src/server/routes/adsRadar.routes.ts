import { Router } from "express";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { dataforSeoCredentials, fetchKeywordSuggestions, fetchSearchVolumes, KeywordIdeasError, normalizeKeyword, type KeywordSuggestion } from "../lib/dataforseoKeywords";

const MAX_SEEDS = 5;
const MAX_VOLUME_KEYWORDS = 20;

const router = Router();
router.use(requireFirebaseAuth, requireSupremeAdmin);

// Pornind de la câțiva termeni (servicii, tip eveniment, oraș), interoghează DataForSEO Labs
// pentru fiecare termen separat și combină rezultatele într-o singură listă de sugestii —
// util pentru Ads, unde vrei cât mai multe variante reale de căutare, nu doar una singură.
router.post("/suggestions", async (req, res) => {
  const credentials = dataforSeoCredentials();
  if (!credentials) return res.status(500).json({ error: "Lipsesc API_LOGIN_DATAFORSEO și API_DATAFORSEO_PASSWORD din .env." });

  const seeds = Array.isArray(req.body?.seeds)
    ? req.body.seeds.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0).map((item: string) => item.trim()).slice(0, MAX_SEEDS)
    : [];
  const city = typeof req.body?.city === "string" ? req.body.city.trim() : "";
  if (!seeds.length) return res.status(400).json({ error: "Adaugă cel puțin un termen de pornire." });

  const results = await Promise.allSettled(seeds.map((seed: string) => fetchKeywordSuggestions(seed, city, credentials)));

  const merged = new Map<string, KeywordSuggestion>();
  let succeeded = 0;
  let lastError: unknown = null;
  for (const result of results) {
    if (result.status !== "fulfilled") { lastError = result.reason; continue; }
    succeeded++;
    for (const item of result.value) {
      const norm = normalizeKeyword(item.keyword);
      const current = merged.get(norm) ?? { keyword: item.keyword, volume: null, trendScore: null, rising: false };
      if (item.volume !== null) current.volume = current.volume !== null ? Math.max(current.volume, item.volume) : item.volume;
      if (item.trendScore !== null) current.trendScore = Math.max(current.trendScore ?? 0, item.trendScore);
      if (item.rising) current.rising = true;
      merged.set(norm, current);
    }
  }

  if (succeeded === 0) {
    if (lastError instanceof KeywordIdeasError) return res.status(502).json({ error: lastError.message });
    console.error("[ads-radar] suggestions error:", lastError);
    return res.status(502).json({ error: "Nu am putut găsi sugestii de keyword-uri." });
  }

  const sorted = Array.from(merged.values()).sort((a, b) => {
    if (a.volume !== null && b.volume !== null) return b.volume - a.volume;
    if (a.volume !== null) return -1;
    if (b.volume !== null) return 1;
    return (b.trendScore ?? 0) - (a.trendScore ?? 0);
  }).slice(0, 40);

  res.json({ suggestions: sorted });
});

// Volumul real de căutări Google Ads (Keyword Planner) pentru keyword-urile alese — un
// singur apel DataForSEO pentru toate, ca să nu ardem credit pe interogări individuale.
router.post("/volume", async (req, res) => {
  const credentials = dataforSeoCredentials();
  if (!credentials) return res.status(500).json({ error: "Lipsesc API_LOGIN_DATAFORSEO și API_DATAFORSEO_PASSWORD din .env." });

  const keywords = Array.isArray(req.body?.keywords)
    ? Array.from(new Set(req.body.keywords.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0).map((item: string) => item.trim())))
    : [];
  if (!keywords.length) return res.status(400).json({ error: "Selectează cel puțin un keyword." });
  if (keywords.length > MAX_VOLUME_KEYWORDS) return res.status(400).json({ error: `Poți verifica maximum ${MAX_VOLUME_KEYWORDS} keyword-uri deodată.` });

  try {
    const rows = await fetchSearchVolumes(keywords as string[], credentials);
    const byKeyword = new Map(rows.map((row) => [normalizeKeyword(row.keyword), row]));
    const results = (keywords as string[]).map((keyword) => byKeyword.get(normalizeKeyword(keyword)) ?? {
      keyword, volume: null, cpc: null, competition: null, competitionIndex: null, lowBid: null, highBid: null,
    });
    res.json({ results });
  } catch (error) {
    console.error("[ads-radar] volume error:", error);
    res.status(502).json({ error: "Nu am putut încărca volumul de căutări." });
  }
});

export default router;
