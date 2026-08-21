import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import { chromium } from "playwright";

const DEFAULT_SITE = "https://www.ancavisuals.ro";
const OUTPUT_PATH = "data/imageAltCatalog.json";
const MODEL = "claude-sonnet-4-6";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const PUBLIC_PAGE_LIMIT = 100;

type AltRecord = {
  id: string;
  sourceUrl: string;
  key: string;
  alt: string;
  pageUrls: string[];
  existingAlts: string[];
  mediaType?: string;
  status: "generated" | "skipped" | "error" | "pending";
  error?: string;
  model?: string;
  generatedAt: string;
};

type DiscoveredImage = {
  sourceUrl: string;
  pageUrls: string[];
  existingAlts: string[];
};

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function imageKey(sourceUrl: string): string {
  try {
    const url = new URL(sourceUrl);
    // Bunny image optimization parameters create many URLs for the same photo.
    for (const parameter of ["width", "height", "quality", "format", "sharpen"]) {
      url.searchParams.delete(parameter);
    }
    return url.toString();
  } catch {
    return sourceUrl;
  }
}

function imageId(key: string): string {
  return createHash("sha1").update(key).digest("hex").slice(0, 16);
}

function isUsefulImage(sourceUrl: string): boolean {
  if (sourceUrl.startsWith("data:") || sourceUrl.endsWith(".svg")) return false;
  try {
    const url = new URL(sourceUrl);
    const path = decodeURIComponent(url.pathname).toLowerCase();
    // /media contains private client albums and must never enter the SEO/AI catalog.
    if (/(^|\/)media(\/|$)/.test(path)) return false;
    if (path.includes("favicon") || path.includes("icon") || path.includes("logo")) return false;
    return /\.(jpe?g|png|webp|gif|avif)$/.test(path) || url.hostname.includes("firebasestorage") || url.hostname.includes("b-cdn.net");
  } catch {
    return false;
  }
}

async function discoverPages(site: string): Promise<string[]> {
  const sitemap = await fetch(`${site}/sitemap.xml`).then(response => {
    if (!response.ok) throw new Error(`Sitemap HTTP ${response.status}`);
    return response.text();
  });
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  const filtered = urls.filter(url => !/\/(media|admin|contract|revin|backup|invitatie|qr-moments)(\/|$)/i.test(new URL(url).pathname));
  return hasFlag("--all") ? filtered : filtered.slice(0, Number(arg("--pages", String(PUBLIC_PAGE_LIMIT))));
}

async function discoverImages(site: string): Promise<DiscoveredImage[]> {
  const pages = await discoverPages(site);
  const found = new Map<string, DiscoveredImage>();

  const addImage = (sourceUrl: string, pageUrl: string, alt = "") => {
    if (!sourceUrl || !isUsefulImage(sourceUrl)) return;
    const key = imageKey(sourceUrl);
    const previous = found.get(key);
    if (previous) {
      previous.pageUrls = [...new Set([...previous.pageUrls, pageUrl])];
      if (alt && !previous.existingAlts.includes(alt)) previous.existingAlts.push(alt);
    } else {
      found.set(key, { sourceUrl, pageUrls: [pageUrl], existingAlts: alt ? [alt] : [] });
    }
  };

  const discoverFromHtml = async () => {
    for (const [index, pageUrl] of pages.entries()) {
      process.stdout.write(`[alts] SSR scan ${index + 1}/${pages.length}: ${pageUrl}\n`);
      try {
        const html = await fetch(pageUrl).then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.text();
        });
        const imageTags = [...html.matchAll(/<img\b([^>]+)>/gi)];
        for (const match of imageTags) {
          const attributes = match[1];
          const src = attributes.match(/\b(?:src|data-src)=["']([^"']+)["']/i)?.[1];
          const alt = attributes.match(/\balt=["']([^"']*)["']/i)?.[1] || "";
          if (src) addImage(new URL(src, pageUrl).toString(), pageUrl, alt);
        }
      } catch (error) {
        console.warn(`[alts] SSR page skipped: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // PortfolioGallery is loaded client-side from this public endpoint.
    try {
      const response = await fetch(`${site}/api/oferte/portfolio-images`);
      if (response.ok) {
        const data = await response.json() as { urls?: string[] };
        for (const sourceUrl of data.urls ?? []) {
          addImage(sourceUrl, `${site}/portofoliu`);
          addImage(sourceUrl, site);
        }
      }
    } catch (error) {
      console.warn(`[alts] portfolio endpoint skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    for (const [index, pageUrl] of pages.entries()) {
      process.stdout.write(`[alts] scan ${index + 1}/${pages.length}: ${pageUrl}\n`);
      try {
        await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.waitForTimeout(1200);
        const images = await page.locator("img").evaluateAll(elements => elements.map(element => ({
          src: (element as HTMLImageElement).currentSrc || (element as HTMLImageElement).src,
          alt: (element as HTMLImageElement).alt || "",
        })));

        for (const image of images) {
          addImage(image.src, pageUrl, image.alt);
        }
      } catch (error) {
        console.warn(`[alts] page skipped: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } catch (error) {
    console.warn(`[alts] Playwright unavailable: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (browser) await browser.close();
  }

  if (!browser) {
    console.warn("[alts] Playwright indisponibil; folosesc fallback SSR + endpoint-uri publice.");
    await discoverFromHtml();
  }

  return [...found.values()];
}

async function readCatalog(): Promise<AltRecord[]> {
  try {
    return JSON.parse(await readFile(OUTPUT_PATH, "utf8")) as AltRecord[];
  } catch {
    return [];
  }
}

function parseClaudeJson(text: string): { alt: string; skip?: boolean } {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Claude nu a returnat JSON valid");
  const parsed = JSON.parse(match[0]) as { alt?: unknown; skip?: unknown };
  return {
    alt: typeof parsed.alt === "string" ? parsed.alt.trim() : "",
    skip: parsed.skip === true,
  };
}

async function generateAlt(client: Anthropic, image: DiscoveredImage): Promise<{ alt: string; skip: boolean; mediaType: string }> {
  const response = await fetch(image.sourceUrl);
  if (!response.ok) throw new Error(`Imagine HTTP ${response.status}`);
  const mediaType = (response.headers.get("content-type") || "image/jpeg").split(";")[0];
  if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mediaType)) {
    throw new Error(`Format nesuportat: ${mediaType}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error(`Imagine prea mare: ${buffer.byteLength} bytes`);

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 180,
    system: `Ești editor accesibilitate pentru un studio foto-video din România. Scrii texte alt în limba română pentru imagini publice de pe site. Descrie strict ce este vizibil. Dacă în imagine se vede clar un cuplu de nuntă — de exemplu un bărbat în costum formal și o femeie în rochie albă de mireasă, în context ceremonial sau romantic — numește-i „mire și mireasă”, nu doar „bărbat și femeie”. Nu folosi „mireasă” doar pentru că o femeie poartă alb și nu folosi „mire” doar pentru că un bărbat poartă costum; dacă contextul de nuntă nu este suficient de clar, rămâi neutru. Nu inventa nume, locații, orașe, evenimente sau relații între persoane. Nu îndesa cuvinte-cheie SEO. Un alt text trebuie să fie natural, concret și de maximum 125 de caractere. Pentru logo-uri, iconuri sau imagini pur decorative returnează skip=true și alt gol.`,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: buffer.toString("base64") },
        },
        {
          type: "text",
          text: `URL imagine: ${image.sourceUrl}\nPagini unde apare: ${image.pageUrls.join(", ")}\nAlt existent: ${image.existingAlts.join(" | ") || "niciunul"}\n\nReturnează DOAR JSON: {"alt":"...","skip":false}`,
        },
      ],
    }],
  });

  const text = message.content.find(block => block.type === "text");
  if (!text || text.type !== "text") throw new Error("Răspuns Claude fără text");
  const parsed = parseClaudeJson(text.text);
  return { ...parsed, mediaType };
}

async function main(): Promise<void> {
  const site = arg("--site", DEFAULT_SITE).replace(/\/$/, "");
  const previous = await readCatalog();
  const previousByKey = new Map(previous.map(record => [record.key, record]));
  const fromCatalog = hasFlag("--from-catalog");
  const images = fromCatalog
    ? previous
      .filter(record => record.pageUrls.some(pageUrl => {
        try {
          return new URL(pageUrl).pathname.replace(/\/$/, "") === "/portofoliu";
        } catch {
          return false;
        }
      }))
      .map(record => ({ sourceUrl: record.sourceUrl, pageUrls: record.pageUrls, existingAlts: record.existingAlts }))
    : await discoverImages(site);
  const recordsByKey = new Map<string, AltRecord>(previous.map(record => [record.key, record]));

  console.log(`[alts] imagini ${fromCatalog ? "din catalog pentru /portofoliu" : "unice descoperite"}: ${images.length}`);
  if (fromCatalog) console.log("[alts] modul catalog: nu se scanează sitemap-ul sau paginile site-ului");
  if (hasFlag("--discover-only")) {
    if (fromCatalog) throw new Error("--discover-only nu poate fi folosit împreună cu --from-catalog");
    for (const image of images) {
      recordsByKey.set(imageKey(image.sourceUrl), {
        id: imageId(imageKey(image.sourceUrl)),
        sourceUrl: image.sourceUrl,
        key: imageKey(image.sourceUrl),
        alt: previousByKey.get(imageKey(image.sourceUrl))?.alt || "",
        pageUrls: image.pageUrls,
        existingAlts: image.existingAlts,
        status: "pending",
        generatedAt: new Date().toISOString(),
      });
    }
    await writeFile(OUTPUT_PATH, `${JSON.stringify([...recordsByKey.values()], null, 2)}\n`);
    console.log(`[alts] catalog pending scris în ${OUTPUT_PATH}`);
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Lipsește ANTHROPIC_API_KEY");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const force = hasFlag("--force");
  const limit = Number(arg("--limit", String(images.length)));
  const pendingImages = fromCatalog
    ? images.filter(image => {
      const status = previousByKey.get(imageKey(image.sourceUrl))?.status;
      return force || status === "pending" || status === "error";
    })
    : images;
  const selectedImages = fromCatalog ? pendingImages.slice(0, limit) : images.slice(0, limit);

  for (const [index, image] of selectedImages.entries()) {
    const key = imageKey(image.sourceUrl);
    const cached = previousByKey.get(key);
    if (!fromCatalog && cached && !force && cached.status === "generated") {
      recordsByKey.set(key, { ...cached, pageUrls: image.pageUrls, existingAlts: image.existingAlts });
      continue;
    }

    process.stdout.write(`[alts] Claude ${index + 1}/${selectedImages.length}: ${image.sourceUrl}\n`);
    try {
      const generated = await generateAlt(client, image);
      recordsByKey.set(key, { id: imageId(key), sourceUrl: image.sourceUrl, key, alt: generated.skip ? "" : generated.alt, pageUrls: image.pageUrls, existingAlts: image.existingAlts, mediaType: generated.mediaType, status: generated.skip ? "skipped" : "generated", model: MODEL, generatedAt: new Date().toISOString() });
    } catch (error) {
      recordsByKey.set(key, { id: imageId(key), sourceUrl: image.sourceUrl, key, alt: "", pageUrls: image.pageUrls, existingAlts: image.existingAlts, status: "error", error: error instanceof Error ? error.message : String(error), generatedAt: new Date().toISOString() });
    }
    await writeFile(OUTPUT_PATH, `${JSON.stringify([...recordsByKey.values()], null, 2)}\n`);
  }

  await writeFile(OUTPUT_PATH, `${JSON.stringify([...recordsByKey.values()], null, 2)}\n`);
  console.log(`[alts] catalog final scris în ${OUTPUT_PATH}`);
}

main().catch(error => {
  console.error(`[alts] eroare: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
