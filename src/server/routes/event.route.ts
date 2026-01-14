import { Router } from "express";
import { createEvent,getEvent,getAllEvents } from "../services/event.services";



const router = Router();

router.post("/",createEvent);
router.get("/",getAllEvents);
router.get( "/:slug",getEvent);


export default router;