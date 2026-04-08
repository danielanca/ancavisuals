import { Router } from "express";
import {checkRoute} from "../services/QRMoment.services.js";

const router = Router();

router.get("/:eventDate",checkRoute);

export default router;