import { Router } from "express";
import { checkRoute } from "../services/qrMoment.service";

const router = Router();

router.get("/:eventDate", checkRoute);

export default router;
