import type { Request, Response } from "express";
import { Router } from "express";
import { getAllPosts, getPostBySlug } from "../utils/blogUtils";

const blogRouter = Router();

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
