import { Request, Response } from "express";
import { firestore } from "../firestoreInit";

const BUNNY_STORAGE_BASE_URL = "https://storage.bunnycdn.com";
const storageZone = process.env.BUNNY_STORAGE_ZONE!;
const storageKey = process.env.BUNNY_STORAGE_KEY!;

export async function checkRoute(req: Request, res: Response) {
  const param = req.params;

  const eventsRef = firestore().collection("qr-moments").doc(param.eventDate!);
  const snapshot = await eventsRef.get();

  const checkFolder = await checkFolderExist(param.eventDate!);
  if (!snapshot.exists || !checkFolder) {
    return res.status(200).json({
      success: true,
      urlFound: false,
      data: [],
      message: "No events found",
    });
  } else {
    const result = snapshot.data();
    return res.status(200).json({
      success: true,
      urlFound: true,
      data: result,
    });
  }
}

async function checkFolderExist(eventDate: string) {
  const url = `${BUNNY_STORAGE_BASE_URL}/${storageZone}/${eventDate}/`;

  const response = await fetch(url, {
    headers: { AccessKey: storageKey },
  });

  if (!response.ok) return false;

  const data = await response.json() as any[];
  return Array.isArray(data) && data.length > 0;
}
