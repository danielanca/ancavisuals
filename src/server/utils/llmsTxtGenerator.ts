import { writeFileSync, readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { firestore } from "../firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LLMS_PATH = join(__dirname, "../../../public/llms.txt");
const SECTION_HEADER = "## Articole editoriale de blog";
const SITE = "https://www.ancavisuals.ro";
const URL_IN_SECTION_RE = /\(https:\/\/www\.ancavisuals\.ro\/blog\/([a-z0-9-]+)\)/g;

interface BlogEntry {
  slug: string;
  title: string;
  description?: string;
}

function entryLine(post: BlogEntry): string {
  const description = (post.description || post.title).trim().replace(/\.+$/, "");
  return `- [${post.title}](${SITE}/blog/${post.slug}): ${description}.`;
}

// Only ever touches the "## Articole editoriale de blog" section — everything else in the
// hand-curated file (pricing, hubs, legal) is left byte-for-byte untouched.
function mergeBlogSection(content: string, posts: BlogEntry[]): { content: string; added: number } {
  const headerIndex = content.indexOf(SECTION_HEADER);
  if (headerIndex === -1) return { content, added: 0 };

  const bodyStart = headerIndex + SECTION_HEADER.length;
  const nextHeadingMatch = content.slice(bodyStart).match(/\n## /);
  const bodyEnd = nextHeadingMatch && typeof nextHeadingMatch.index === "number" ? bodyStart + nextHeadingMatch.index : content.length;
  const body = content.slice(bodyStart, bodyEnd);

  const existingSlugs = new Set<string>();
  for (const match of body.matchAll(URL_IN_SECTION_RE)) existingSlugs.add(match[1]);

  const missing = posts.filter(post => post.slug && !existingSlugs.has(post.slug));
  if (missing.length === 0) return { content, added: 0 };

  const newLines = missing.map(entryLine).join("\n");
  const trimmedBody = body.replace(/\s+$/, "");
  const nextBody = `${trimmedBody}\n${newLines}\n\n`;

  return { content: content.slice(0, bodyStart) + nextBody + content.slice(bodyEnd), added: missing.length };
}

// Called right after a post is published — appends it to llms.txt if it isn't there yet.
// No-op (never throws) if the file is missing or the post isn't published, so it can never
// block a publish.
export async function syncLlmsTxtWithPost(post: { slug: string; title: string; description?: string; status: string }): Promise<void> {
  if (post.status !== "published" || !existsSync(LLMS_PATH)) return;
  try {
    const content = readFileSync(LLMS_PATH, "utf-8");
    const { content: next, added } = mergeBlogSection(content, [post]);
    if (added > 0) writeFileSync(LLMS_PATH, next, "utf-8");
  } catch (error) {
    console.error("[llms.txt] sync failed:", error);
  }
}

// Manual backfill: adds every currently-published post missing from llms.txt in one pass.
export async function regenerateLlmsTxtFromDb(): Promise<{ added: number; total: number }> {
  if (!existsSync(LLMS_PATH)) throw new Error("llms.txt nu există pe disk.");

  const snapshot = await firestore().collection("blogPosts").get();
  const posts = snapshot.docs
    .map(doc => doc.data() as { slug?: unknown; title?: unknown; description?: unknown; status?: unknown })
    .filter((post): post is { slug: string; title: string; description?: string; status: string } =>
      post.status === "published" && typeof post.slug === "string" && post.slug.trim().length > 0 && typeof post.title === "string")
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const content = readFileSync(LLMS_PATH, "utf-8");
  const { content: next, added } = mergeBlogSection(content, posts);
  if (added > 0) writeFileSync(LLMS_PATH, next, "utf-8");
  return { added, total: posts.length };
}
