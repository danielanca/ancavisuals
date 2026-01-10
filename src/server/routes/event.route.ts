import { Router } from "express";
import { createEvent,seeEvent } from "../services/event.services";



const router = Router();

router.post("/",createEvent);
router.get( "/:slug/:phone",seeEvent);


export default router;