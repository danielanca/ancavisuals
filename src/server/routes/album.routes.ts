import { Router } from "express";
import { getAlbum } from "./../../utils/album.controller";

const router = Router();

router.get("/:slug", getAlbum);

export default router;
