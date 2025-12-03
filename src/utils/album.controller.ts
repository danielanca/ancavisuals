import { Request, Response } from "express";
import { loadAlbum } from "./../server/services/album.services";

export async function getAlbum(req: Request, res: Response) {
  const slug = req.params.slug;

  const album = await loadAlbum(slug);

  if (!album) {
    return res.status(404).json({ error: "Album not found" });
  }

  return res.json(album);
}
