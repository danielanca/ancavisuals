import { readFile, writeFile } from "node:fs/promises";

const CATALOG_PATH = "data/imageAltCatalog.json";
const OUTPUT_PATH = "public/image-sitemap.xml";
const SITE_ORIGIN = "https://www.ancavisuals.ro";

type ImageRecord = {
  sourceUrl: string;
  pageUrls: string[];
};

function escapeXml(value: string): string {
  return value.replace(/[<>&'\"]/g, character => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    "\"": "&quot;",
  })[character] || character);
}

function isPublicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.origin === SITE_ORIGIN || url.hostname.endsWith("b-cdn.net"));
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8")) as ImageRecord[];
  const pairs = new Map<string, { pageUrl: string; imageUrl: string }>();

  for (const record of catalog) {
    if (!isPublicUrl(record.sourceUrl)) continue;
    for (const pageUrl of record.pageUrls || []) {
      if (!isPublicUrl(pageUrl) || !pageUrl.startsWith(SITE_ORIGIN)) continue;
      pairs.set(`${pageUrl}\n${record.sourceUrl}`, { pageUrl, imageUrl: record.sourceUrl });
    }
  }

  const byPage = new Map<string, string[]>();
  for (const { pageUrl, imageUrl } of pairs.values()) {
    const images = byPage.get(pageUrl) || [];
    images.push(imageUrl);
    byPage.set(pageUrl, images);
  }

  const urls = [...byPage.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([pageUrl, images]) => `  <url>\n    <loc>${escapeXml(pageUrl)}</loc>\n${[...new Set(images)].sort().map(imageUrl => `    <image:image>\n      <image:loc>${escapeXml(imageUrl)}</image:loc>\n    </image:image>`).join("\n")}\n  </url>`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join("\n")}\n</urlset>\n`;

  await writeFile(OUTPUT_PATH, xml);
  console.log(`[image-sitemap] ${byPage.size} pagini, ${pairs.size} asocieri imagine-pagină scrise în ${OUTPUT_PATH}`);
}

main().catch(error => {
  console.error(`[image-sitemap] eroare: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
