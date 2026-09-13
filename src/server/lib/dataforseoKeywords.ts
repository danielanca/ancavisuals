const DATAFORSEO_ROMANIA_LOCATION_CODE = 2642;

export type JsonRecord = Record<string, unknown>;
export type KeywordSuggestion = { keyword: string; volume: number | null; trendScore: number | null; rising: boolean };

export function dataforSeoCredentials(): string | null {
  const login = process.env.API_LOGIN_DATAFORSEO;
  const password = process.env.API_DATAFORSEO_PASSWORD;
  if (!login || !password) return null;
  return Buffer.from(`${login}:${password}`).toString("base64");
}

export class KeywordIdeasError extends Error {}

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(record: JsonRecord, key: string): string {
  return typeof record[key] === "string" ? record[key] as string : "";
}

function numberValue(record: JsonRecord, key: string, fallback: number): number {
  return typeof record[key] === "number" ? record[key] as number : fallback;
}

// Diacritics/case/whitespace-insensitive form, order preserved — used to de-dupe keyword
// suggestions and to exclude seed terms from their own alternatives.
export function normalizeKeyword(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Pulls keyword ideas for one seed term from DataForSEO Labs (related keywords + keyword
// ideas) and Google Trends, merging them by normalized keyword. Throws KeywordIdeasError only
// when every source failed — a partial result (e.g. trends down but Labs up) still returns data.
export async function fetchKeywordSuggestions(baseKeyword: string, city: string, credentials: string): Promise<KeywordSuggestion[]> {
  const seed = city ? `${baseKeyword} ${city}` : baseKeyword;
  const seedNorm = normalizeKeyword(seed);
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

  const suggestions = new Map<string, KeywordSuggestion>();
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
      console.error("[dataforseo-keywords] related_keywords parse error:", error);
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
      console.error("[dataforseo-keywords] keyword_ideas parse error:", error);
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
      console.error("[dataforseo-keywords] google_trends parse error:", error);
    }
  }

  if (succeeded === 0) throw new KeywordIdeasError("Nu am putut găsi sugestii de keyword-uri.");

  return Array.from(suggestions.values()).sort((a, b) => {
    if (a.volume !== null && b.volume !== null) return b.volume - a.volume;
    if (a.volume !== null) return -1;
    if (b.volume !== null) return 1;
    return (b.trendScore ?? 0) - (a.trendScore ?? 0);
  });
}

export type SearchVolumeRow = {
  keyword: string;
  volume: number | null;
  cpc: number | null;
  competition: string | null;
  competitionIndex: number | null;
  lowBid: number | null;
  highBid: number | null;
};

// Google Ads search-volume figures (real Keyword Planner data) for up to 20 keywords in one call.
export async function fetchSearchVolumes(keywords: string[], credentials: string): Promise<SearchVolumeRow[]> {
  const response = await fetch("https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${credentials}` },
    body: JSON.stringify([{ keywords, location_code: DATAFORSEO_ROMANIA_LOCATION_CODE, language_code: "ro" }]),
  });
  const payload = await response.json() as JsonRecord;
  const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  const task = asRecord(tasks[0]);
  if (!response.ok || numberValue(task, "status_code", 20000) !== 20000) {
    throw new Error(stringValue(task, "status_message") || "DataForSEO request failed");
  }
  const rows = Array.isArray(task.result) ? task.result : [];
  return rows.map((rawRow) => {
    const row = asRecord(rawRow);
    return {
      keyword: stringValue(row, "keyword"),
      volume: typeof row.search_volume === "number" ? row.search_volume : null,
      cpc: typeof row.cpc === "number" ? row.cpc : null,
      competition: typeof row.competition === "string" ? row.competition : null,
      competitionIndex: typeof row.competition_index === "number" ? row.competition_index : null,
      lowBid: typeof row.low_top_of_page_bid === "number" ? row.low_top_of_page_bid : null,
      highBid: typeof row.high_top_of_page_bid === "number" ? row.high_top_of_page_bid : null,
    };
  });
}
