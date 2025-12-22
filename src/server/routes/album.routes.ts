import { Router } from "express";
import { getAlbum, downloadSelectedPhotos } from "./../../utils/album.controller";
import express from "express";
import { postPrintSelection } from "../../utils/album.controller";
import { downloadAll } from "./../../utils/album.controller";
import { getAlbumStats } from "../services/album.stats";


const router = Router();

router.get("/:slug", getAlbum);
router.get("/:slug/stats", getAlbumStats);

router.post("/:slug/download-selected", express.urlencoded({ extended: false }), downloadSelectedPhotos);
router.post("/:slug/print-selection", express.json(), postPrintSelection);
router.post("/:slug/download-all", downloadAll);

export default router;
