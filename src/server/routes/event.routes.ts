import { Router } from "express";
import {
  bookDate,
  checkAvailability,
  createEvent,
  getAllEvents,
  getEvent,
  verifyGuest,
} from "../services/event.service";

const router = Router();

router.post("/", createEvent);
router.get("/", getAllEvents);
router.get("/:slug", getEvent);
router.post("/:slug/verify-guest", verifyGuest);
router.post("/register-event", bookDate);
router.post("/date-available", checkAvailability);

export default router;
