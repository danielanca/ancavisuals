// pages/api/album/[slug].ts
import type { NextApiRequest, NextApiResponse } from "next";
import { listFiles, buildCdnUrl } from "./../services/bunny";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const slug = req.query.slug as string;
  const basePath = `ancavisuals-romania/${slug}/`;

  try {
    const rootItems = await listFiles(basePath);
    const folders = rootItems.filter((x: any) => x.IsDirectory).map((x: any) => x.ObjectName);

    const album: any = {
      title: slug.replace(/-/g, " "),
      featured: [],
      photos: [],
      shortvideo: null,
      longvideo: null
    };

    // FEATURED
    if (folders.includes("featured")) {
      const files = await listFiles(`${basePath}featured/`);
      album.featured = files
        .filter((f: any) => !f.IsDirectory)
        .map((f: any) => buildCdnUrl(`${basePath}featured/${f.ObjectName}`));
    }

    // PHOTOS
    if (folders.includes("photos")) {
      const files = await listFiles(`${basePath}photos/`);
      album.photos = files
        .filter((f: any) => !f.IsDirectory)
        .map((f: any) => buildCdnUrl(`${basePath}photos/${f.ObjectName}`));
    }

    // SHORT VIDEO
    if (folders.includes("shortvideo")) {
      const files = await listFiles(`${basePath}shortvideo/`);
      if (files.length > 0) {
        album.shortvideo = buildCdnUrl(`${basePath}shortvideo/${files[0].ObjectName}`);
      }
    }

    // LONG VIDEO
    if (folders.includes("longvideo")) {
      const files = await listFiles(`${basePath}longvideo/`);
      if (files.length > 0) {
        album.longvideo = buildCdnUrl(`${basePath}longvideo/${files[0].ObjectName}`);
      }
    }

    res.status(200).json(album);
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: "Album not found" });
  }
}
