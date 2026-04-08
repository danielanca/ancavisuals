import { Router } from "express";
import { createEvent,getEvent,getAllEvents,verifyGuest,bookDate, checkAvailability } from "../services/event.services";



const router = Router();

router.post("/",createEvent);
router.get("/",getAllEvents);
router.get( "/:slug",getEvent);
router.post("/:slug/verify-guest", verifyGuest);
router.post("/register-event",bookDate)
router.post("/date-available",checkAvailability)

export default router;