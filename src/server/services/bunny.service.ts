import dotenv from "dotenv";

dotenv.config();

const BUNNY_STORAGE_BASE_URL = "https://storage.bunnycdn.com";

export const storageZone = process.env.BUNNY_STORAGE_ZONE!;
const apiKey = process.env.BUNNY_STORAGE_KEY!;

if (!storageZone || !apiKey) {
  console.error("Missing Bunny Storage ENV variables!");
  console.error("Make sure .env contains:");
  console.error("BUNNY_STORAGE_ZONE=xxxxx");
  console.error("BUNNY_STORAGE_KEY=xxxxx");
  process.exit(1);
}

export async function listFiles(path: string) {
  const cleanPath = path.replace(/^\/+/, "").replace(/\/+$/, "");
  const url = `${BUNNY_STORAGE_BASE_URL}/${storageZone}/${cleanPath}/`;

  const response = await fetch(url, {
    headers: { AccessKey: apiKey },
  });

  if (!response.ok) return [];

  const data = await response.json() as any;
  return Array.isArray(data) ? data : data?.Objects ?? [];
}

export async function checkPreviewExist(slug: string) {
  const url = `${BUNNY_STORAGE_BASE_URL}/${storageZone}/${slug}/photos_preview/`;

  const response = await fetch(url, {
    headers: { AccessKey: apiKey },
  });

  if (!response.ok) return false;

  const data = await response.json() as any[];
  return Array.isArray(data) && data.length > 0;
}
