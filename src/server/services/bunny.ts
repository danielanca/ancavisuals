// lib/bunny.ts
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

export const storageZone = process.env.BUNNY_STORAGE_ZONE!;
const apiKey = process.env.BUNNY_STORAGE_KEY!;
const cdnBase = process.env.BUNNY_CDN_URL!; // ex: https://ancavisuals.b-cdn.net/

if (!storageZone || !apiKey || !cdnBase) {
  throw new Error("Missing Bunny ENV variables");
}

const storageClient = axios.create({
  baseURL: `https://storage.bunnycdn.com/${storageZone}`,
  headers: { AccessKey: apiKey },
});

export async function listFiles(path: string) {
  const cleanPath = path.replace(/^\/+/, "") + "/"; // ALWAYS end with /

  const res = await storageClient.get(cleanPath);
  return Array.isArray(res.data)
    ? res.data
    : res.data?.Objects ?? [];
}

export function buildCdnUrl(path: string) {
  return `${cdnBase.replace(/\/$/, "")}/${path.replace(/^\/+/, "")}`;
}
