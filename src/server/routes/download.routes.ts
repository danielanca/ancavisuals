import { Router } from "express";
import { Readable } from "stream";
import { signBunnyUrl } from "../utils/signBunnyUrl";

const router = Router();

const sanitizeName = (name: string, fallback: string) =>
  (name || fallback)
    .replace(/[\r\n"]/g, "")
    .replace(/[\/\\]/g, "_")
    .trim()
    .slice(0, 180);

const isAllowedExt = (p: string) => /\.(mp4|zip)$/i.test(p);

router.get("/", async (req, res) => {
  const path = String(req.query.path || "").replace(/^\/+/, "");
  if (!path || path.includes("..")) return res.status(400).send("Bad path");
  if (!isAllowedExt(path)) return res.status(403).send("Only mp4 or zip");

  const isZip = /\.zip$/i.test(path);
  const fallbackName = isZip ? "photos.zip" : "video.mp4";
  const name = sanitizeName(String(req.query.name || ""), fallbackName);

  const signed = signBunnyUrl(`/${path}`);
  const upstream = await fetch(signed);

  if (!upstream.ok || !upstream.body) return res.status(502).send("Upstream failed");

  const contentType =
    upstream.headers.get("content-type") ||
    (isZip ? "application/zip" : "application/octet-stream");

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.setHeader("Cache-Control", "no-store");

  const readable = Readable.fromWeb(upstream.body as any);
  readable.on("error", (err) => {
    console.error("Download stream error:", err);
    if (!res.headersSent) res.status(502).send("Stream failed");
    else res.destroy();
  });
  readable.pipe(res);
});

export default router;
