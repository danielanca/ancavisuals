import { Router } from "express";
import { getAlbum, downloadSelectedPhotos } from "./../../utils/album.controller";
import express from "express"
import { postPrintSelection } from "../../utils/album.controller";
const router = Router();

router.get("/:slug", getAlbum);

router.post(
  "/:slug/download-selected",
  express.urlencoded({ extended: false }),
  downloadSelectedPhotos
);

router.post(
  "/:slug/print-selection",
  express.json(),
  postPrintSelection
);


export default router;
