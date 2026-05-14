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
    await listFiles(basePath);
  } catch {
    return null;
  }

  const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const loadSection = async (section: string): Promise<AlbumMediaList> => {
    try {
      const objects = await listFiles(`${slug}/${section}`);
      if (objects.length === 0) return [];
      return objects.map((object: BunnyObject) => signBunnyUrl(`/${slug}/${section}/${object.ObjectName}`));
    } catch {
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

  const photos = hasPreview ? await loadSection("photos_preview") : await loadSection("photos");
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
