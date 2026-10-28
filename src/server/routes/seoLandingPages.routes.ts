import { Router } from "express";
import type { Request, Response } from "express";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import {
  findSeoPageForKeyword, getPublishedSeoPage, getSeoPageContext, listSeoPages, planSeoPage, saveSeoPage, writeSeoPage,
} from "../services/seoLandingPages.service";
import type { SeoPagePlan } from "../../shared/seoLandingPages";

// Pagini SEO speciale: the creator in /admin/seo-radar/pagina (admin router, mounted at
// /api/admin/seo-pages) and the public /servicii/:slug data (public router, /api/seo-pages).
export const adminSeoPagesRouter = Router();
export const publicSeoPagesRouter = Router();

const keywordOf = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 120) : "");
const aiReady = (res: Response) => {
  if (process.env.ANTHROPIC_API_KEY) return true;
  res.status(500).json({ error: "Lipsește ANTHROPIC_API_KEY din .env." });
  return false;
};

adminSeoPagesRouter.get("/", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    res.json({ pages: await listSeoPages() });
  } catch (error) {
    console.error("[seo-pages] list failed:", error);
    res.status(500).json({ error: "Nu am putut încărca paginile." });
  }
});

// What Google shows for the keyword + an existing page (draft or published) for it.
adminSeoPagesRouter.get("/context", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const keyword = keywordOf(req.query.keyword);
  const city = keywordOf(req.query.city);
  if (!keyword) {
    res.status(400).json({ error: "Lipsește cuvântul cheie." });
    return;
  }
  try {
    const [context, page] = await Promise.all([getSeoPageContext(keyword, city), findSeoPageForKeyword(keyword)]);
    res.json({ context, page });
  } catch (error) {
    console.error("[seo-pages] context failed:", error);
    res.status(500).json({ error: "Nu am putut încărca datele pentru acest cuvânt." });
  }
});

adminSeoPagesRouter.post("/plan", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  if (!aiReady(res)) return;
  const keyword = keywordOf(req.body?.keyword);
  if (!keyword) {
    res.status(400).json({ error: "Lipsește cuvântul cheie." });
    return;
  }
  try {
    const context = await getSeoPageContext(keyword, keywordOf(req.body?.city));
    res.json({ plan: await planSeoPage(context) });
  } catch (error) {
    console.error("[seo-pages] plan failed:", error);
    res.status(502).json({ error: "AI-ul nu a putut analiza cuvântul. Încearcă din nou." });
  }
});

adminSeoPagesRouter.post("/write", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  if (!aiReady(res)) return;
  const keyword = keywordOf(req.body?.keyword);
  const plan = req.body?.plan as SeoPagePlan | undefined;
  if (!keyword || !plan || typeof plan !== "object") {
    res.status(400).json({ error: "Fă întâi analiza (pasul 1)." });
    return;
  }
  const answers = (Array.isArray(req.body?.answers) ? req.body.answers : [])
    .slice(0, 10)
    .map((item: { question?: unknown; answer?: unknown }) => ({ question: String(item?.question ?? "").slice(0, 300), answer: String(item?.answer ?? "").slice(0, 2000) }));
  const notes = typeof req.body?.notes === "string" ? req.body.notes.slice(0, 4000) : "";
  try {
    const context = await getSeoPageContext(keyword, keywordOf(req.body?.city));
    res.json({ page: await writeSeoPage(context, plan, answers, notes) });
  } catch (error) {
    console.error("[seo-pages] write failed:", error);
    res.status(502).json({ error: error instanceof Error && error.message.includes("incompletă") ? error.message : "AI-ul nu a putut scrie pagina. Încearcă din nou." });
  }
});

adminSeoPagesRouter.put("/", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const page = req.body?.page;
  const status = req.body?.status === "published" ? "published" : "draft";
  if (!page || typeof page !== "object" || !keywordOf(page.keyword)) {
    res.status(400).json({ error: "Pagina nu e completă." });
    return;
  }
  try {
    const result = await saveSeoPage(page, status, typeof req.body?.previousSlug === "string" ? req.body.previousSlug : undefined);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ page: result.page });
  } catch (error) {
    console.error("[seo-pages] save failed:", error);
    res.status(500).json({ error: "Pagina nu a putut fi salvată." });
  }
});

publicSeoPagesRouter.get("/:slug", async (req: Request, res: Response) => {
  try {
    const page = await getPublishedSeoPage(req.params.slug);
    if (!page) {
      res.status(404).json({ error: "Pagina nu există." });
      return;
    }
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({ page });
  } catch (error) {
    console.error("[seo-pages] public page failed:", error);
    res.status(500).json({ error: "Pagina nu a putut fi încărcată." });
  }
});
