import { signBunnyUrl } from "../../../src/utils/signBunnyUrl";
import { listFiles,checkPreviewExist} from "./bunny.service";
import type { Album } from "./../../client/pages/MediaDownload/AlbumTypes";

export async function loadAlbum(slug: string): Promise<Album | null> {
  const basePath = slug;

  try {
    await listFiles(basePath);
  } catch {
    return null;
  }

  const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const loadSection = async (section: string, isVideo = false) => {
    try {
      const objects = await listFiles(`${slug}/${section}`);
      if (objects.length === 0) return isVideo ? null : [];
      if (isVideo) return signBunnyUrl(`/${slug}/${section}/${objects[0].ObjectName}`);
      return objects.map((o: any) => signBunnyUrl(`/${slug}/${section}/${o.ObjectName}`));
    } catch {
      return isVideo ? null : [];
    }
  };

  const hasPreview = await checkPreviewExist(slug);

  const photos = hasPreview ? await loadSection("photos_preview") : await loadSection("photos");
  const originalPhoto = await loadSection("photos");

  return {
    slug,
    title,
    featured: await loadSection("featured"),
    photos,
    originalPhoto,
    shortvideo: await loadSection("shortvideo", true),
    longvideo: await loadSection("longvideo", true),
  };
}

