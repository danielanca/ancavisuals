import { Router } from "express";
import express from "express";
import { getAlbum, downloadSelectedPhotos, postPrintSelection, downloadAll, deletePhoto, downloadPrintDynamic, addDeliveryAddress, getDeliveryAddress, addSwissLink } from "../controllers/album.controller";
import { getAlbumStats } from "../services/album.stats";

const router = Router();

router.get("/:slug", getAlbum);
router.get("/:slug/stats", getAlbumStats);

router.post("/:slug/download-selected", express.urlencoded({ extended: false }), downloadSelectedPhotos);
router.post("/:slug/print-selection", express.json(), postPrintSelection);
router.post("/:slug/download-all", downloadAll);
router.post("/:slug/delete-photo", express.json(), deletePhoto);
router.post("/:slug/download-print-dynamic", downloadPrintDynamic);
router.post("/:slug/delivery-address", express.json(), addDeliveryAddress);
router.get("/:slug/delivery-address", getDeliveryAddress);
router.post("/:slug/swisslink", express.json(), addSwissLink);

export default router;
