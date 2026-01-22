import { Request, Response } from "express";
import crypto from "crypto";
import { generateEventSlug } from "../../utils/eventUrl"; // assuming you have this
import { firestore } from "../firestoreInit";
import admin from "firebase-admin";
import { getDateAndHour } from "../constants/utils";

export async function checkRoute(req:Request,res:Response){
    const param = req.params;
 
   const eventsRef = firestore().collection("qr-moments").doc(param.eventDate!);
       const snapshot = await eventsRef.get();

       if (!snapshot.exists) {
         return res.status(200).json({
           success: true,
           urlFound : false,
           data: [],
           message: "No events found",
         });
       }else{
       const result = snapshot.data();
    
       return res.status(200).json({
         success: true,
         urlFound : true,
         data: result,
       });
      }
       
}
