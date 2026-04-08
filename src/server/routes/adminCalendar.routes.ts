import { Router } from "express";
import { getStorage } from "firebase-admin/storage";
import { firestore } from "../firestoreInit";

async function getBookedDates(): Promise<{ date?: string; startDate?: string; endDate?: string; note?: string }[]> {
  firestore();
  const bucket = getStorage().bucket("joculdetectivului.appspot.com");
  const [contents] = await bucket.file("ancavisuals/bookedDates/bookedDates.json").download();
  const data = JSON.parse(contents.toString());
  return data?.dates ?? [];
}

const router = Router();

router.get("/booked-dates", async (_req, res) => {
  try {
    const dates = await getBookedDates();
    res.json({ dates });
  } catch (e) {
    console.error("[adminCalendar] getBookedDates failed:", e);
    res.status(500).json({ error: "Nu s-au putut încărca datele." });
  }
});

export default router;
