import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "../client/firebase";

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
    const fileRef = ref(
      storage,
      "ancavisuals/bookedDates/bookedDates.json"
    );
    const url = await getDownloadURL(fileRef);
    const res = await fetch(url);
    const data = (await res.json()) as BookedDatesFile;

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
  const key =
    typeof input === "string" ? input : toDateKey(input);
  const set = await loadBookedDates();
  return set.has(key);
}
