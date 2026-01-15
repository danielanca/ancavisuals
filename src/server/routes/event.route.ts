import { Router } from "express";
import { createEvent,getEvent,getAllEvents,verifyGuest } from "../services/event.services";



const router = Router();

router.post("/",createEvent);
router.get("/",getAllEvents);
router.get( "/:slug",getEvent);
router.post("/:slug/verify-guest", verifyGuest);


export default router;