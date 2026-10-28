/*
 * Purpose: automatic SEO articles for the SEO Radar "Absent" keywords — the ones we scanned and
 * don't appear for in the top 10 ("—" in "Unde apărem și unde nu"). For up to 2 such keywords at a
 * time, without an article yet, Claude writes a Romanian blog post that is published straight to
 * /blog, added to the sitemap and llms.txt, and linked to the keyword in SEO Radar (so the Monday
 * rescan tracks whether it starts ranking). Runs once after a deploy (when the last run is a week
 * old), every Monday after the rescan, and from the button in SEO Radar.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";
import { Timestamp } from "firebase-admin/firestore";
import { createAnthropicClient } from "../lib/anthropicClient";
import { firestore } from "../firestore";
import { saveBlogPost, slugExists } from "../utils/blogUtils";
import { addSitemapEntry, generateSitemapFromDb, getSitemapEntries } from "../utils/sitemapGenerator";
import { syncLlmsTxtWithPost } from "../utils/llmsTxtGenerator";

const HISTORY_COLLECTION = "seoRadarSearches";
const LINKED_COLLECTION = "seoRadarLinkedPosts";
const RUNS_COLLECTION = "seoAutoPosts";
const SETTINGS_DOC = () => firestore().collection("settings").doc("seoAutoPosts");
const SITE = "https://www.ancavisuals.ro";
export const SEO_AUTO_POSTS_PER_RUN = 2;
const RUN_EVERY_MS = 6 * 24 * 3_600_000;
const LEASE_MS = 20 * 60_000;

const anthropic = createAnthropicClient("Articole SEO automate", { apiKey: process.env.ANTHROPIC_API_KEY, timeout: 300_000, maxRetries: 1 });

/** Same word set → same keyword ("fotocabină Huedin" = "fotocabina huedin"). */
export const keywordKey = (keyword: string) =>
  keyword.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/\s+/).filter(Boolean).sort().join(" ");

export const slugify = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/g, "");

export type AbsentKeyword = { keyword: string; city: string; provider: "serpapi" | "dataforseo"; queryKey: string; lastScanAt: string };

/** Keywords whose latest scan has us outside the top 10 and that have no article linked yet. */
export async function findAbsentKeywords(): Promise<AbsentKeyword[]> {
  const db = firestore();
  const [scans, links, runs] = await Promise.all([
    db.collection(HISTORY_COLLECTION).select("queryKey", "keyword", "city", "provider", "capturedAt", "ownDomainPosition").orderBy("capturedAt", "desc").limit(2000).get(),
    db.collection(LINKED_COLLECTION).select("keyword").get(),
    db.collection(RUNS_COLLECTION).select("keywordKey", "status").get(),
  ]);
  const covered = new Set<string>([
    ...links.docs.map((doc) => keywordKey(String(doc.data().keyword ?? ""))),
    // A keyword whose article was already written (or keeps failing) isn't retried automatically.
    ...runs.docs.filter((doc) => doc.data().status === "published" || doc.data().status === "failed").map((doc) => String(doc.data().keywordKey ?? "")),
  ]);
  const latest = new Map<string, AbsentKeyword & { position: number | null }>();
  for (const doc of scans.docs) {
    const data = doc.data();
    const keyword = String(data.keyword ?? "").trim();
    const key = keywordKey(keyword);
    if (!key || latest.has(key)) continue; // newest first: the first one seen is the latest scan
    latest.set(key, {
      keyword,
      city: String(data.city ?? "").trim(),
      provider: data.provider === "dataforseo" ? "dataforseo" : "serpapi",
      queryKey: String(data.queryKey ?? ""),
      lastScanAt: String(data.capturedAt ?? ""),
      position: typeof data.ownDomainPosition === "number" ? data.ownDomainPosition : null,
    });
  }
  return [...latest.entries()]
    .filter(([key, item]) => item.position === null && !covered.has(key) && item.queryKey)
    .map(([, { position: _position, ...item }]) => item);
}

/** Real pages of the site Claude may link to: the core ones plus those about the keyword's city/service. */
async function internalPages(keyword: string, city: string): Promise<string[]> {
  const words = keywordKey(`${keyword} ${city}`).split(" ").filter((word) => word.length > 3).map(slugify);
  const core = ["/", "/contact", "/portofoliu", "/oferta/olx", "/foto-video-nunta", "/blog", "/ghidul-mirilor-pdf"];
  const paths = (await getSitemapEntries().catch(() => []))
    .map((entry) => entry.loc.replace(/^https?:\/\/(www\.)?ancavisuals\.ro/, "") || "/")
    .filter((path) => !path.startsWith("/blog/"));
  // With a city, only that city's pages (a Turda article shouldn't send readers to Cluj).
  const citySlug = slugify(city);
  const relevant = citySlug ? paths.filter((path) => path.includes(citySlug)) : paths.filter((path) => words.some((word) => path.includes(word)));
  return Array.from(new Set([...core.filter((path) => paths.includes(path) || path === "/"), ...relevant])).slice(0, 40);
}

/** Links to our own site that aren't real pages become plain text (no 404s from the AI). */
export function keepOnlyKnownLinks(markdown: string, allowed: readonly string[]): string {
  const known = new Set(allowed);
  return markdown.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, text: string, href: string) => {
    const own = href.match(/^(?:https?:\/\/(?:www\.)?ancavisuals\.ro)?(\/[^#?\s]*)?$/);
    if (!own) return match; // external links are kept
    const path = own[1] || "/";
    return known.has(path) ? `[${text}](${path})` : text;
  });
}

type GeneratedPost = { title: string; slug: string; description: string; category: string; tags: string[]; content: string };

const ARTICLE_RULES = `Ești copywriter SEO pentru AncaVisuals (ancavisuals.ro), studio de fotografie și video de nuntă din România (foto, video, fotocabină, evenimente). Scrii articole de blog în română, utile pentru cupluri și familii care caută servicii.

Reguli:
- Articolul răspunde clar intenției de căutare a keyword-ului; keyword-ul apare natural în titlu, în primul paragraf și în cel puțin un subtitlu, fără keyword stuffing.
- 900–1300 de cuvinte, Markdown: paragrafe scurte, subtitluri ## și ###, liste unde ajută, la final o secțiune „## Întrebări frecvente” cu 3–5 întrebări (### întrebare + răspuns).
- NU inventa: prețuri, recenzii, premii, nume de clienți, nume de locații/restaurante, statistici, ani de experiență sau numere de nunți. Despre AncaVisuals spune doar că face fotografie, video și fotocabină pentru nunți și evenimente. Pentru preț și disponibilitate trimite cititorul la ofertă sau contact.
- Linkuri interne: 3–5, DOAR din lista de pagini primită, în forma [text](/cale). Fără alte linkuri.
- Scrie natural, ca un om: fără clișee de AI („în era digitală”, „nu doar…, ci și…”, „călătorie”), fără liniuțe lungi (—), fără emoji.
- Nu pune titlul articolului ca # în conținut (îl afișează pagina).
Răspunde DOAR cu un obiect JSON: {"title":"titlu de maxim 65 de caractere","slug":"slug-fara-diacritice","description":"meta description de maxim 155 de caractere","category":"categorie scurtă","tags":["5-8 etichete"],"content":"articolul în Markdown"}`;

async function writePost(keyword: string, city: string, pages: string[]): Promise<GeneratedPost> {
  const response = await anthropic.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 12000,
    system: [{ type: "text", text: ARTICLE_RULES, cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: `Keyword: "${keyword}"${city ? `\nOraș: ${city}` : ""}\nNu apărem în primele 10 rezultate Google pentru acest keyword; articolul trebuie să fie cea mai bună pagină pentru el.\n\nPagini existente pentru linkuri interne:\n${pages.map((path) => `- ${path}`).join("\n")}`,
    }],
  });
  if (response.stop_reason === "refusal") throw new Error("Claude a refuzat articolul.");
  const text = response.content.filter((block): block is Anthropic.TextBlock => block.type === "text").map((block) => block.text).join("").trim();
  const json = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const data = JSON.parse(jsonrepair(json.slice(json.indexOf("{")))) as Partial<GeneratedPost>;
  if (typeof data.title !== "string" || typeof data.content !== "string" || data.content.length < 1500) throw new Error("Articolul generat e incomplet.");
  return {
    title: data.title.trim(),
    slug: slugify(typeof data.slug === "string" && data.slug ? data.slug : data.title),
    description: typeof data.description === "string" ? data.description.trim().slice(0, 160) : "",
    category: typeof data.category === "string" && data.category.trim() ? data.category.trim() : "nunta",
    tags: Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0).map((tag) => tag.trim()).slice(0, 8) : [],
    content: data.content.trim(),
  };
}

async function uniqueSlug(base: string): Promise<string> {
  const root = base || "articol";
  for (let n = 1; n < 20; n++) {
    const slug = n === 1 ? root : `${root}-${n}`;
    if (!(await slugExists(slug))) return slug;
  }
  return `${root}-${Date.now()}`;
}

export type SeoAutoPostResult = { keyword: string; status: "published" | "failed"; slug?: string; title?: string; url?: string; error?: string };

/** Writes, publishes and links one article for an absent keyword. */
export async function publishSeoPostFor(target: AbsentKeyword, trigger: string): Promise<SeoAutoPostResult> {
  const runRef = firestore().collection(RUNS_COLLECTION).doc(keywordKey(target.keyword).replace(/[^a-z0-9 ]/g, "").replace(/ /g, "-").slice(0, 120) || "keyword");
  try {
    const pages = await internalPages(target.keyword, target.city);
    const post = await writePost(target.keyword, target.city, pages);
    const slug = await uniqueSlug(post.slug);
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Bucharest" });
    const saved = await saveBlogPost({
      slug,
      title: post.title,
      description: post.description,
      date: today,
      category: post.category,
      tags: post.tags,
      city: target.city || undefined,
      content: keepOnlyKnownLinks(post.content, pages),
      status: "published",
    });
    await addSitemapEntry({ loc: `${SITE}/blog/${slug}`, changefreq: "monthly", priority: "0.7" });
    await generateSitemapFromDb();
    await syncLlmsTxtWithPost(saved);
    const url = `https://ancavisuals.ro/blog/${slug}`;
    // Linked in SEO Radar: the Monday rescan follows the keyword and shows if the article ranks.
    await firestore().collection(LINKED_COLLECTION).doc(`${target.queryKey}::${slug}`).set({
      queryKey: target.queryKey, keyword: target.keyword, city: target.city, provider: target.provider,
      slug, title: post.title, url, date: today, linkedAt: Timestamp.now(), createdBy: "seo-auto-posts",
    }, { merge: true });
    await runRef.set({ keyword: target.keyword, keywordKey: keywordKey(target.keyword), city: target.city, status: "published", slug, title: post.title, url, trigger, at: new Date().toISOString() });
    return { keyword: target.keyword, status: "published", slug, title: post.title, url };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[seo-auto-posts] "${target.keyword}" failed:`, error);
    await runRef.set({ keyword: target.keyword, keywordKey: keywordKey(target.keyword), city: target.city, status: "failed", error: message.slice(0, 500), trigger, at: new Date().toISOString() }).catch(() => undefined);
    return { keyword: target.keyword, status: "failed", error: message };
  }
}

/** Up to `limit` articles for the most recently scanned absent keywords; one run at a time. */
export async function runSeoAutoPosts(trigger: string, limit = SEO_AUTO_POSTS_PER_RUN): Promise<{ results: SeoAutoPostResult[]; skipped?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { results: [], skipped: "Lipsește ANTHROPIC_API_KEY." };
  const now = Date.now();
  const acquired = await firestore().runTransaction(async (tx) => {
    const doc = await tx.get(SETTINGS_DOC());
    if (Number(doc.data()?.leaseUntil ?? 0) > now) return false;
    tx.set(SETTINGS_DOC(), { leaseUntil: now + LEASE_MS }, { merge: true });
    return true;
  });
  if (!acquired) return { results: [], skipped: "Se scriu deja articole. Mai așteaptă câteva minute." };
  try {
    const targets = (await findAbsentKeywords()).slice(0, limit);
    const results: SeoAutoPostResult[] = [];
    for (const target of targets) results.push(await publishSeoPostFor(target, trigger));
    await SETTINGS_DOC().set({ lastRunAt: new Date().toISOString(), lastTrigger: trigger, leaseUntil: 0 }, { merge: true });
    return { results, ...(targets.length === 0 ? { skipped: "Nu există cuvinte „Absent” fără articol." } : {}) };
  } catch (error) {
    await SETTINGS_DOC().set({ leaseUntil: 0 }, { merge: true }).catch(() => undefined);
    throw error;
  }
}

/** After a deploy (server start) and on Mondays: run only if the last run is about a week old. */
export async function runSeoAutoPostsIfDue(trigger: string): Promise<void> {
  const last = Date.parse(String((await SETTINGS_DOC().get()).data()?.lastRunAt ?? ""));
  if (Number.isFinite(last) && Date.now() - last < RUN_EVERY_MS) return;
  const { results, skipped } = await runSeoAutoPosts(trigger);
  console.log(`[seo-auto-posts] ${trigger}: ${skipped ?? results.map((r) => `${r.status} ${r.keyword}${r.slug ? ` → /blog/${r.slug}` : ""}`).join("; ")}`);
}

export type SeoAutoPostsOverview = {
  lastRunAt: string | null;
  /** Articles are being written right now (the run takes a few minutes). */
  running: boolean;
  absent: AbsentKeyword[];
  posts: { keyword: string; status: string; slug?: string; title?: string; url?: string; error?: string; at: string; trigger: string }[];
};

export async function getSeoAutoPostsOverview(): Promise<SeoAutoPostsOverview> {
  const [settings, absent, runs] = await Promise.all([SETTINGS_DOC().get(), findAbsentKeywords(), firestore().collection(RUNS_COLLECTION).get()]);
  return {
    lastRunAt: typeof settings.data()?.lastRunAt === "string" ? settings.data()!.lastRunAt : null,
    running: Number(settings.data()?.leaseUntil ?? 0) > Date.now(),
    absent,
    posts: runs.docs
      .map((doc) => doc.data() as SeoAutoPostsOverview["posts"][number])
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, 50),
  };
}

/** A failed keyword can be tried again from SEO Radar. */
export async function forgetFailedSeoAutoPost(keyword: string): Promise<void> {
  const snapshot = await firestore().collection(RUNS_COLLECTION).where("keywordKey", "==", keywordKey(keyword)).get();
  await Promise.all(snapshot.docs.filter((doc) => doc.data().status === "failed").map((doc) => doc.ref.delete()));
}
