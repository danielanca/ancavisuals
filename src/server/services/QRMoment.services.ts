import { Request, Response } from "express";
import axios from "axios";
import crypto from "crypto";
import { generateEventSlug } from "../../utils/eventUrl"; // assuming you have this
import { firestore } from "../firestoreInit";
import admin from "firebase-admin";
import { getDateAndHour } from "../constants/utils";

const storageZone = process.env.BUNNY_STORAGE_ZONE!;
const storageKey = process.env.BUNNY_STORAGE_KEY!;

export async function checkRoute(req:Request,res:Response){
    const param = req.params;
 
   const eventsRef = firestore().collection("qr-moments").doc(param.eventDate!);
       const snapshot = await eventsRef.get();
       
       const checkFolder = await checkFolderExist(param.eventDate!);
       if (!snapshot.exists || !checkFolder) {
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

async function checkFolderExist(eventDate:string){
  const bunnyApiUrl = `https://storage.bunnycdn.com/${storageZone}/${eventDate}/`;

  const result = await axios.get(bunnyApiUrl, {
    headers: { AccessKey: storageKey },
    validateStatus: () => true,
  });
  if(result.status == 200 && result.data.length > 0){
      return true;
  } 

  return false;



}