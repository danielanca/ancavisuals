import { signBunnyUrl } from "../utils/signBunnyUrl";
import { listFiles, checkPreviewExist, checkFileExists } from "./bunny.service";
import { BUNNY_DEFAULT_ARCHIVE_NAME } from "../constants/bunny";
import type { Album } from "./../../client/pages/MediaDownload/AlbumTypes";

type BunnyObject = {
  ObjectName: string;
};

type AlbumMediaList = string[];
type AlbumVideo = string | null;

export async function loadAlbum(slug: string): Promise<Album | null> {
  const basePath = slug;

  try {
    const rootFiles = await listFiles(basePath);
    console.log(`[album] root listing pentru "${slug}":`, rootFiles.map((f: BunnyObject) => f.ObjectName));
  } catch (error) {
    console.error(`[album] EROARE root listing "${slug}":`, error);
    return null;
  }

  const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const loadSection = async (section: string): Promise<AlbumMediaList> => {
    try {
      const objects = await listFiles(`${slug}/${section}`);
      console.log(`[album] "${slug}/${section}": ${objects.length} fișiere`);
      if (objects.length === 0) return [];
      return objects.map((object: BunnyObject) => signBunnyUrl(`/${slug}/${section}/${object.ObjectName}`));
    } catch (error) {
      console.warn(`[album] "${slug}/${section}" eroare sau gol:`, error);
      return [];
    }
  };

  const loadVideoSection = async (section: string): Promise<AlbumVideo> => {
    try {
      const objects = await listFiles(`${slug}/${section}`);
      if (objects.length === 0) return null;
      return signBunnyUrl(`/${slug}/${section}/${objects[0].ObjectName}`);
    } catch {
      return null;
    }
  };

  const [hasPreview, zipReady] = await Promise.all([
    checkPreviewExist(slug),
    checkFileExists(slug, BUNNY_DEFAULT_ARCHIVE_NAME),
  ]);
  console.log(`[album] "${slug}" — hasPreview=${hasPreview}, zipReady=${zipReady}`);

  const photos = hasPreview ? await loadSection("photos_preview") : await loadSection("photos");
  console.log(`[album] "${slug}" — ${photos.length} poze returnate (din ${hasPreview ? "photos_preview" : "photos"})`);
  const originalPhoto = await loadSection("photos");

  return {
    slug,
    title,
    featured: await loadSection("featured"),
    photos,
    originalPhoto,
    shortvideo: await loadVideoSection("shortvideo"),
    longvideo: await loadVideoSection("longvideo"),
    zipReady,
  };
}
