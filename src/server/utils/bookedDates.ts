/*
 * Purpose: loads and caches booked dates from the shared storage file, expands
 * date ranges into day keys and answers whether a given date is unavailable.
 */
import { getStorage } from "firebase-admin/storage";
import { firestore } from "../firestoreInit";
import { BOOKED_DATES_FILE_PATH, FIREBASE_STORAGE_BUCKET } from "../constants/firebase";

export type BookedDate =
  | {
      date: string; // "2026-05-16"
      type?: string;
      label?: string;
      price?: string;
      phone?: string; // doar intern
      status?: "booked" | "unavailable";
    }
  | {
      startDate: string;
      endDate: string;
      type?: string;
      label?: string;
      price?: string;
      phone?: string;
      status?: "booked-range" | "unavailable";
    };

export interface BookedDatesFile {
  updatedAt?: string;
  dates: BookedDate[];
}

// cache simplu in-memory
let bookedDatesCache: Set<string> | null = null;

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function expandToKeys(file: BookedDatesFile): Set<string> {
  const keys = new Set<string>();

  for (const entry of file.dates || []) {
    if ("date" in entry && entry.date) {
      keys.add(entry.date);
    } else if ("startDate" in entry && "endDate" in entry) {
      const start = new Date(entry.startDate);
      const end = new Date(entry.endDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const cur = new Date(start);
        while (cur <= end) {
          keys.add(toDateKey(cur));
          cur.setDate(cur.getDate() + 1);
        }
      }
    }
  }

  return keys;
}

export async function loadBookedDates(): Promise<Set<string>> {
  if (bookedDatesCache) return bookedDatesCache;

  try {
    firestore();
    const bucket = getStorage().bucket(FIREBASE_STORAGE_BUCKET);
    const [contents] = await bucket.file(BOOKED_DATES_FILE_PATH).download();
    const data = JSON.parse(contents.toString()) as BookedDatesFile;

    bookedDatesCache = expandToKeys(data);
    return bookedDatesCache;
  } catch (error) {
    console.error("Error loading booked dates:", error);
    bookedDatesCache = new Set();
    return bookedDatesCache;
  }
}

/**
 * Verifică dacă o dată (Date sau string "YYYY-MM-DD") este ocupată.
 */
export async function isDateBooked(input: Date | string): Promise<boolean> {
  const key = typeof input === "string" ? input : toDateKey(input);
  const set = await loadBookedDates();
  return set.has(key);
}
