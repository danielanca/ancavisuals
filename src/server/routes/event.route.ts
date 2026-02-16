import { Router } from "express";
import { createEvent,getEvent,getAllEvents,verifyGuest,bookEventDate } from "../services/event.services";



const router = Router();

router.post("/",createEvent);
router.get("/",getAllEvents);
router.get( "/:slug",getEvent);
router.post("/:slug/verify-guest", verifyGuest);
router.post("/booked",bookEventDate)

export default router;