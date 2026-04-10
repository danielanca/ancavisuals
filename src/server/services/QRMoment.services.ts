/*
 * Purpose: validates whether a QR Moments event route is usable by checking both
 * the Firestore event document and the corresponding Bunny storage folder.
 */
import type { Request, Response } from "express";
import { firestore } from "../firestoreInit";
import {
  BUNNY_ACCESS_KEY_HEADER,
  buildBunnyDirectoryUrl,
  getBunnyStorageKey,
} from "../constants/bunny";

const storageKey = getBunnyStorageKey();

type BunnyDirectoryEntry = {
  ObjectName: string;
  IsDirectory?: boolean;
};

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
  const url = buildBunnyDirectoryUrl(eventDate);

  const response = await fetch(url, {
    headers: { [BUNNY_ACCESS_KEY_HEADER]: storageKey },
  });

  if (!response.ok) return false;

  const data = await response.json() as BunnyDirectoryEntry[];
  return Array.isArray(data) && data.length > 0;
}
