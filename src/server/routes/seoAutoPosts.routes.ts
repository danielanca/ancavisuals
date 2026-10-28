import { Router } from "express";
import type { Request, Response } from "express";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { findAbsentKeywords, forgetFailedSeoAutoPost, getSeoAutoPostsOverview, keywordKey, publishSeoPostFor, runSeoAutoPosts } from "../services/seoAutoPosts.service";

// Articole SEO automate pentru cuvintele „Absent” din SEO Radar (mounted at /api/admin/seo-auto-posts).
// Writing takes minutes, so the runs start in the background and the page polls GET /.
const router = Router();

router.get("/", requireFirebaseAuth, requireSupremeAdmin, async (_req: Request, res: Response) => {
  try {
    res.json(await getSeoAutoPostsOverview());
  } catch (error) {
    console.error("[seo-auto-posts] overview failed:", error);
    res.status(500).json({ error: "Nu am putut încărca articolele automate." });
  }
});

router.post("/run", requireFirebaseAuth, requireSupremeAdmin, (req: Request, res: Response) => {
  const limit = req.body?.limit === 1 ? 1 : 2;
  void runSeoAutoPosts("buton SEO Radar", limit).catch((error) => console.error("[seo-auto-posts] manual run failed:", error));
  res.status(202).json({ started: true });
});

// One specific absent keyword (button on its row).
router.post("/keyword", requireFirebaseAuth, requireSupremeAdmin, async (req: Request, res: Response) => {
  const keyword = typeof req.body?.keyword === "string" ? req.body.keyword.trim() : "";
  if (!keyword) {
    res.status(400).json({ error: "Alege un cuvânt cheie." });
    return;
  }
  try {
    await forgetFailedSeoAutoPost(keyword);
    const target = (await findAbsentKeywords()).find((item) => keywordKey(item.keyword) === keywordKey(keyword));
    if (!target) {
      res.status(409).json({ error: "Pentru acest cuvânt apărem deja în top 10 sau are deja un articol." });
      return;
    }
    void publishSeoPostFor(target, "buton SEO Radar").catch((error) => console.error("[seo-auto-posts] keyword run failed:", error));
    res.status(202).json({ started: true });
  } catch (error) {
    console.error("[seo-auto-posts] keyword start failed:", error);
    res.status(500).json({ error: "Nu am putut porni articolul." });
  }
});

export default router;
