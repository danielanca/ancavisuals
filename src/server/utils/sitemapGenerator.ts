import { writeFileSync, readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { firestore } from "../firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITEMAP_PATH = join(__dirname, "../../../public/sitemap.xml");
const COLLECTION = "sitemapEntries";

export interface SitemapEntry {
  loc: string;
  changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: string;
}

export async function getSitemapEntries(): Promise<SitemapEntry[]> {
  const snapshot = await firestore().collection(COLLECTION).get();
  return snapshot.docs
    .map(doc => doc.data() as SitemapEntry)
    .filter(entry => typeof entry.loc === "string" && entry.loc.length > 0)
    .sort((a, b) => a.loc.localeCompare(b.loc));
}

// Parsează sitemap.xml existent și extrage toate intrările
function parseSitemapXml(xmlContent: string): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  const urlRegex = /<url>([\s\S]*?)<\/url>/g;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(xmlContent)) !== null) {
    const block = match[1];
    const loc = block.match(/<loc>(.*?)<\/loc>/)?.[1] ?? "";
    const changefreq = (block.match(/<changefreq>(.*?)<\/changefreq>/)?.[1] ?? "monthly") as SitemapEntry["changefreq"];
    const priority = block.match(/<priority>(.*?)<\/priority>/)?.[1] ?? "0.5";
    if (loc) entries.push({ loc, changefreq, priority });
  }

  return entries;
}

// Seed Firestore din sitemap.xml curent (rulat o singură dată când colecția e goală)
async function seedFromCurrentSitemap() {
  if (!existsSync(SITEMAP_PATH)) {
    console.warn("[sitemap] sitemap.xml nu există pe disk — seed sărit");
    return;
  }

  const xmlContent = readFileSync(SITEMAP_PATH, "utf-8");
  const entries = parseSitemapXml(xmlContent);

  if (entries.length === 0) {
    console.warn("[sitemap] sitemap.xml e gol — seed sărit");
    return;
  }

  console.log(`[sitemap] Seed inițial: ${entries.length} URL-uri → Firestore...`);

  const db = firestore();
  let batch = db.batch();
  let batchCount = 0;
  let totalSeeded = 0;

  for (const entry of entries) {
    const docId = entry.loc
      .replace("https://www.ancavisuals.ro", "")
      .replace(/\//g, "_")
      .replace(/^_/, "") || "home";

    batch.set(db.collection(COLLECTION).doc(docId), entry);
    batchCount++;
    totalSeeded++;

    // Firestore batch limit e 500 — creăm un batch nou după fiecare commit
    if (batchCount === 499) {
      await batch.commit();
      console.log(`[sitemap]   → batch intermediar salvat (${totalSeeded} până acum)`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) await batch.commit();

  console.log(`[sitemap] ✓ Seed complet: ${totalSeeded} URL-uri salvate în Firestore`);
}

// Citește toate intrările din Firestore și rescrie sitemap.xml
export async function generateSitemapFromDb(): Promise<void> {
  console.log("[sitemap] Pornire generare sitemap.xml...");

  const db = firestore();
  const snapshot = await db.collection(COLLECTION).get();

  if (snapshot.empty) {
    console.log("[sitemap] Colecția sitemapEntries e goală — pornesc seed din sitemap.xml curent...");
    await seedFromCurrentSitemap();
    const seededSnapshot = await db.collection(COLLECTION).get();
    if (seededSnapshot.empty) {
      console.warn("[sitemap] ✗ Nimic de seed-uit — generare anulată");
      return;
    }
    return generateSitemapFromDb();
  }

  console.log(`[sitemap] Citit ${snapshot.size} intrări din Firestore`);

  const entries = snapshot.docs.map(doc => doc.data() as SitemapEntry);
  const blogSnapshot = await db.collection("blogPosts").get();
  const sitemapLocations = new Set(entries.map(entry => entry.loc));
  for (const doc of blogSnapshot.docs) {
    const blog = doc.data();
    if (blog.status !== "published" || typeof blog.slug !== "string" || !blog.slug.trim()) continue;
    const loc = `https://www.ancavisuals.ro/blog/${blog.slug.trim()}`;
    if (sitemapLocations.has(loc)) continue;
    entries.push({ loc, changefreq: "monthly", priority: "0.7" });
    sitemapLocations.add(loc);
  }
  console.log(`[sitemap] Adăugate ${entries.length - snapshot.size} articole de blog publicate`);

  entries.sort((entryA, entryB) => {
    const priorityDiff = parseFloat(entryB.priority) - parseFloat(entryA.priority);
    if (priorityDiff !== 0) return priorityDiff;
    return entryA.loc.localeCompare(entryB.loc);
  });

  const urlBlocks = entries.map(entry => `  <url>
    <loc>${entry.loc}</loc>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlBlocks}
</urlset>`;

  writeFileSync(SITEMAP_PATH, xml, "utf-8");
  console.log(`[sitemap] ✓ sitemap.xml scris cu succes — ${entries.length} URL-uri`);
}

// Adaugă o intrare nouă în Firestore (și regenerează sitemap-ul)
export async function addSitemapEntry(entry: SitemapEntry): Promise<void> {
  const db = firestore();
  const docId = entry.loc
    .replace("https://www.ancavisuals.ro", "")
    .replace(/\//g, "_")
    .replace(/^_/, "") || "home";

  console.log(`[sitemap] Adăugare intrare nouă: ${entry.loc}`);
  await db.collection(COLLECTION).doc(docId).set(entry);
}

// Adaugă mai multe intrări simultan (pentru generator)
export async function addSitemapEntries(entries: SitemapEntry[]): Promise<void> {
  const db = firestore();
  const batch = db.batch();

  console.log(`[sitemap] Adăugare ${entries.length} intrări noi în Firestore...`);

  for (const entry of entries) {
    const docId = entry.loc
      .replace("https://www.ancavisuals.ro", "")
      .replace(/\//g, "_")
      .replace(/^_/, "") || "home";

    batch.set(db.collection(COLLECTION).doc(docId), entry);
  }

  await batch.commit();
  console.log(`[sitemap] ✓ ${entries.length} intrări salvate — regenerez sitemap.xml...`);
  await generateSitemapFromDb();
}
