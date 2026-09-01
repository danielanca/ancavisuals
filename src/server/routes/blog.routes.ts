import type { Request, Response } from "express";
import { Router } from "express";
import { getAllPosts, getEditablePosts, getPostBySlug, importMarkdownPosts, saveBlogPost } from "../utils/blogUtils";
import { addSitemapEntry, generateSitemapFromDb } from "../utils/sitemapGenerator";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import Anthropic from "@anthropic-ai/sdk";

const blogRouter = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const normalizeSlug = (value: string): string => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

function parsePostBody(body: Record<string, unknown>, fallbackSlug?: string) {
  const slug = normalizeSlug(typeof body.slug === "string" ? body.slug : fallbackSlug ?? "");
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content : "";
  if (!slug || !title || !content) return null;
  const status: "draft" | "published" = body.status === "draft" ? "draft" : "published";
  return {
    slug,
    title,
    description: typeof body.description === "string" ? body.description.trim() : "",
    date: typeof body.date === "string" && body.date ? body.date : new Date().toISOString().slice(0, 10),
    category: typeof body.category === "string" && body.category ? body.category.trim() : "general",
    tags: Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean) : [],
    city: typeof body.city === "string" ? body.city.trim() || undefined : undefined,
    coverImage: typeof body.coverImage === "string" ? body.coverImage.trim() || undefined : undefined,
    content,
    status,
  };
}

blogRouter.get("/admin/posts", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  res.json({ posts: await getEditablePosts() });
});

blogRouter.post("/admin/import", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    res.json({ imported: await importMarkdownPosts() });
  } catch (error) {
    console.error("[blog] Markdown import failed:", error);
    res.status(500).json({ error: "Importul articolelor a eșuat." });
  }
});

blogRouter.post("/admin/title-suggestions", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const category = typeof req.body?.category === "string" ? req.body.category.trim() : "";
  const city = typeof req.body?.city === "string" ? req.body.city.trim() : "";

  if (!title) {
    res.status(400).json({ error: "Scrie mai întâi un titlu." });
    return;
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `Generează exact 4 variante de titlu pentru un articol de blog în limba română.
Titlul inițial: "${title}"
Categoria: "${category || "general"}"
Oraș SEO (dacă există): "${city || "nespecificat"}"

Păstrează intenția articolului, fă variantele naturale și utile pentru SEO, fără clickbait.
Răspunde strict cu un JSON array de 4 stringuri, fără markdown sau explicații.`,
      }],
    });

    const text = response.content.find((block) => block.type === "text");
    const match = text?.type === "text" ? text.text.match(/\[[\s\S]*\]/) : null;
    const suggestions = match ? JSON.parse(match[0]) : [];
    if (!Array.isArray(suggestions)) throw new Error("AI response is not an array");

    res.json({ suggestions: suggestions.filter((suggestion): suggestion is string => typeof suggestion === "string" && suggestion.trim().length > 0).slice(0, 4) });
  } catch (error) {
    console.error("[blog] title suggestions failed:", error);
    res.status(500).json({ error: "Sugestiile de titlu nu au putut fi generate." });
  }
});

blogRouter.post("/admin/metadata-suggestions", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const kind = req.body?.kind === "tags" ? "tags" : "description";
  const category = typeof req.body?.category === "string" ? req.body.category.trim() : "general";
  const city = typeof req.body?.city === "string" ? req.body.city.trim() : "";

  if (!title) {
    res.status(400).json({ error: "Scrie mai întâi un titlu." });
    return;
  }

  try {
    const format = kind === "tags"
      ? "Răspunde strict cu un JSON array de 4 array-uri, fiecare cu 5-8 etichete scurte."
      : "Răspunde strict cu un JSON array de 4 descrieri SEO, fiecare de maximum 155 de caractere.";
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 700,
      messages: [{
        role: "user",
        content: `Generează sugestii pentru un articol de blog în limba română.
Titlul: "${title}"
Categoria: "${category}"
Oraș SEO (dacă există): "${city || "nespecificat"}"
${format}
${kind === "tags" ? "Etichetele trebuie să fie relevante pentru titlu și SEO, fără duplicate." : "Descrierile trebuie să fie clare, naturale și să includă intenția de căutare fără clickbait."}
Nu include markdown sau explicații.`,
      }],
    });

    const text = response.content.find((block) => block.type === "text");
    const match = text?.type === "text" ? text.text.match(/\[[\s\S]*\]/) : null;
    const suggestions = match ? JSON.parse(match[0]) : [];
    if (!Array.isArray(suggestions)) throw new Error("AI response is not an array");

    if (kind === "tags") {
      res.json({ suggestions: suggestions.filter((set): set is string[] => Array.isArray(set)).map((set) => set.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0).slice(0, 8)).slice(0, 4) });
    } else {
      res.json({ suggestions: suggestions.filter((suggestion): suggestion is string => typeof suggestion === "string" && suggestion.trim().length > 0).slice(0, 4) });
    }
  } catch (error) {
    console.error(`[blog] ${kind} suggestions failed:`, error);
    res.status(500).json({ error: "Sugestiile nu au putut fi generate." });
  }
});

blogRouter.put("/admin/posts/:slug", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const post = parsePostBody(req.body as Record<string, unknown>, req.params.slug);
  if (!post) {
    res.status(400).json({ error: "Titlul și conținutul sunt obligatorii." });
    return;
  }
  if (post.slug !== normalizeSlug(req.params.slug)) {
    res.status(400).json({ error: "Slug-ul nu poate fi schimbat din editor." });
    return;
  }
  try {
    const savedPost = await saveBlogPost(post);
    if (post.status === "published") {
      await addSitemapEntry({
        loc: `https://www.ancavisuals.ro/blog/${post.slug}`,
        changefreq: "monthly",
        priority: "0.7",
      });
      await generateSitemapFromDb();
    }
    res.json({ post: savedPost });
  } catch (error) {
    console.error("[blog] Save failed:", error);
    res.status(500).json({ error: "Articolul nu a putut fi salvat." });
  }
});

blogRouter.get("/", async (_req: Request, res: Response) => {
  const posts = await getAllPosts();
  res.json(posts);
});

blogRouter.get("/:slug", async (req: Request, res: Response) => {
  const post = await getPostBySlug(req.params.slug);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.json(post);
});

export default blogRouter;
