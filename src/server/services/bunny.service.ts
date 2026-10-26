import dotenv from "dotenv";
import {
  BUNNY_ACCESS_KEY_HEADER,
  BUNNY_PREVIEW_FOLDER,
  buildBunnyStorageUrlForZone,
  getBunnySecondStorageKey,
  getBunnyStorageKey,
  getBunnyStorageZone,
  getBunnyStorageZoneSecondary,
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

// Migrare in curs: incearca zona principala (BUNNY_STORAGE_ZONE), iar daca directorul
// nu exista/e gol acolo, incearca zona secundara (BUNNY_SECOND_STORAGE_KEY). Fallback-ul
// e no-op pana se completeaza cheia zonei secundare in .env.
async function listFilesInZone(zone: string, key: string, dirPath: string): Promise<BunnyObject[]> {
  const url = `${buildBunnyStorageUrlForZone(zone, dirPath)}/`;
  const response = await fetch(url, { headers: { [BUNNY_ACCESS_KEY_HEADER]: key } });
  if (!response.ok) return [];
  const data = await response.json() as BunnyDirectoryResponse;
  return Array.isArray(data) ? data : data?.Objects ?? [];
}

export async function listFiles(path: string) {
  const primary = await listFilesInZone(storageZone, apiKey, path);
  if (primary.length > 0) return primary;

  const secondaryZone = getBunnyStorageZoneSecondary();
  const secondaryKey = getBunnySecondStorageKey();
  if (!secondaryKey || secondaryZone === storageZone) return primary;

  return listFilesInZone(secondaryZone, secondaryKey, path);
}

export async function checkFileExists(dir: string, fileName: string): Promise<boolean> {
  const files = await listFiles(dir);
  return files.some((f) => (f as BunnyObject).ObjectName === fileName);
}

export async function checkPreviewExist(slug: string) {
  const files = await listFiles(`${slug}/${BUNNY_PREVIEW_FOLDER}`);
  return files.length > 0;
}
