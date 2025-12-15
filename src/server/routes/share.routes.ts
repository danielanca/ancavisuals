import { Router } from "express";
import { createShare, getShare, downloadShareZip } from "../../utils/share.controller";

const router = Router();

router.post("/", createShare);
router.get("/:id", getShare);
router.get("/:id/download", downloadShareZip);

export default router;
