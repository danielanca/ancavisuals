import { Router } from "express";
import {
  bookDate,
  checkAvailability,
  createEvent,
  getAllEvents,
  getEvent,
  verifyGuest,
} from "../services/event.service";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";

const router = Router();

router.post("/", requireFirebaseAuth, requireSupremeAdmin, createEvent);
router.get("/", requireFirebaseAuth, requireSupremeAdmin, getAllEvents);
router.get("/:slug", getEvent);
router.post("/:slug/verify-guest", verifyGuest);
router.post("/register-event", requireFirebaseAuth, requireSupremeAdmin, bookDate);
router.post("/date-available", requireFirebaseAuth, requireSupremeAdmin, checkAvailability);

export default router;
