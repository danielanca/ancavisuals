import { signBunnyUrl } from "../../../src/utils/signBunnyUrl";
import { listFiles } from "./bunny.service";
import type { Album } from "./../../client/pages/MediaDownload/AlbumTypes";

export async function loadAlbum(slug: string): Promise<Album | null> {
  const basePath = slug;

  let folder;
  try {
    folder = await listFiles(basePath);
  } catch (err) {
    console.error("Album not found:", slug);
    return null;
  }

  const title = slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  async function loadSection(section: string, isVideo = false) {
    try {
      const objects = (await listFiles(`${basePath}/${section}`)).filter((o: any) => !o.IsDirectory);

      if (objects.length === 0) return isVideo ? null : [];

      if (isVideo) {
        return signBunnyUrl(`/${slug}/${section}/${objects[0].ObjectName}`);
      }

      return objects.map((o: any) => signBunnyUrl(`/${slug}/${section}/${o.ObjectName}`));
    } catch {
      return isVideo ? null : [];
    }
  }

  return {
    slug,
    title,
    featured: await loadSection("featured"),
    photos: await loadSection("photos_preview"),
    shortvideo: await loadSection("shortvideo", true),
    longvideo: await loadSection("longvideo", true),
  };
}
