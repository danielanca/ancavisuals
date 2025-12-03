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

  const title = slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  async function loadSection(section: string, isVideo = false) {
    try {
      const files = await listFiles(`${basePath}/${section}`);
      const objects = files.Objects.filter((obj) => !obj.IsDirectory);

      if (objects.length === 0) return isVideo ? null : [];

      if (isVideo) {
        const file = objects[0].ObjectName;
        return signBunnyUrl(`/${slug}/${section}/${file}`);
      }

      return objects.map((o) =>
        signBunnyUrl(`/${slug}/${section}/${o.ObjectName}`)
      );
    } catch {
      return isVideo ? null : [];
    }
  }

  return {
    slug,
    title,
    featured: await loadSection("featured"),
    photos: await loadSection("photos"),
    shortvideo: await loadSection("shortvideo", true),
    longvideo: await loadSection("longvideo", true),
  };
}
