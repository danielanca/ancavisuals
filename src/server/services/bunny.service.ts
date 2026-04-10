import dotenv from "dotenv";
import {
  BUNNY_ACCESS_KEY_HEADER,
  BUNNY_PREVIEW_FOLDER,
  buildBunnyDirectoryUrl,
  getBunnyStorageKey,
  getBunnyStorageZone,
} from "../constants/bunny";

dotenv.config();

export const storageZone = getBunnyStorageZone();
const apiKey = getBunnyStorageKey();

type BunnyObject = {
  ObjectName: string;
};

type BunnyDirectoryResponse = BunnyObject[] | { Objects?: BunnyObject[] };

if (!storageZone || !apiKey) {
  console.error("Missing Bunny Storage ENV variables!");
  console.error("Make sure .env contains:");
  console.error("BUNNY_STORAGE_ZONE=xxxxx");
  console.error("BUNNY_STORAGE_KEY=xxxxx");
  process.exit(1);
}

export async function listFiles(path: string) {
  const url = buildBunnyDirectoryUrl(path);

  const response = await fetch(url, {
    headers: { [BUNNY_ACCESS_KEY_HEADER]: apiKey },
  });

  if (!response.ok) return [];

  const data = await response.json() as BunnyDirectoryResponse;
  return Array.isArray(data) ? data : data?.Objects ?? [];
}

export async function checkPreviewExist(slug: string) {
  const url = buildBunnyDirectoryUrl(slug, BUNNY_PREVIEW_FOLDER);

  const response = await fetch(url, {
    headers: { [BUNNY_ACCESS_KEY_HEADER]: apiKey },
  });

  if (!response.ok) return false;

  const data = await response.json() as BunnyObject[];
  return Array.isArray(data) && data.length > 0;
}
