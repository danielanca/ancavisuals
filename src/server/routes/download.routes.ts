import { Router } from "express";
import { Readable } from "stream";
import { signBunnyUrl } from "../../utils/signBunnyUrl";

const router = Router();

const sanitizeName = (name: string) =>
  (name || "video.mp4")
    .replace(/[\r\n"]/g, "")
    .replace(/[\/\\]/g, "_")
    .trim()
    .slice(0, 180);

router.get("/", async (req, res) => {
  const path = String(req.query.path || "").replace(/^\/+/, "");
  const name = sanitizeName(String(req.query.name || ""));

  if (!path || path.includes("..")) return res.status(400).send("Bad path");
  if (!path.toLowerCase().endsWith(".mp4")) return res.status(403).send("Only mp4");

  const signed = signBunnyUrl(`/${path}`);
  const upstream = await fetch(signed);

  if (!upstream.ok || !upstream.body) return res.status(502).send("Upstream failed");

  res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.setHeader("Cache-Control", "no-store");

  Readable.fromWeb(upstream.body as any).pipe(res);
});

export default router;
