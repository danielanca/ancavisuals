/*
 * Purpose: every upload from the site goes to upload.ancavisuals.ro (DNS-only in Cloudflare, so no
 * 100 MB cap per request) — for the browser a cross-origin request from the page on
 * ancavisuals.ro / www. This lets the site's own pages make it on any route (preflight included),
 * so a new upload needs no CORS code of its own. Other origins get nothing extra.
 */
import type { NextFunction, Request, Response } from "express";

export const SITE_ORIGINS = new Set(["https://ancavisuals.ro", "https://www.ancavisuals.ro"]);

export function uploadOriginCors(req: Request, res: Response, next: NextFunction) {
  const origin = String(req.headers.origin ?? "");
  if (!SITE_ORIGINS.has(origin)) return next();
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  // Whatever the page asks for (Authorization, X-File-Name, X-Album-Zip-Manifest, …).
  const requested = req.headers["access-control-request-headers"];
  res.setHeader("Access-Control-Allow-Headers", typeof requested === "string" && requested ? requested : "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "600");
  if (req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
}
