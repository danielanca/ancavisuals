import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const COUPLE_EMAIL = "ancadaniel1994@gmail.com";
const COUPLE_PASSWORD = "bagXan2024!";
const API_BASE = "http://127.0.0.1:1994";

const MODE = "sequential" as "sequential" | "clear";
const ONLY_CONFIRMED = true;
const CLEAR_EXISTING = true;
const CREATE_MISSING_TABLES = true;
const TARGET_TABLE_COUNT = 12;
const DEFAULT_TABLE_CAPACITY = 10;
const TABLE_NAME_PREFIX = "Masa";

type WeddingGuest = {
  id: string;
  firstName: string;
  lastName: string;
  tableId: string | null;
  rsvpStatus: "asteptare" | "confirmat" | "refuzat";
};

type WeddingTable = {
  id: string;
  tableName: string;
  capacity: number;
};

function tableLabel(index: number): string {
  return `${TABLE_NAME_PREFIX} ${index + 1}`;
}

async function signInAndGetToken(): Promise<string> {
  const firebaseConfig = {
    apiKey: "AIzaSyAK1PxPnxLzGocve2OeKappgBHaKqmaijE",
    authDomain: "joculdetectivului.firebaseapp.com",
    projectId: "joculdetectivului",
  };

  const app = initializeApp(firebaseConfig, "seed-wedding-seating");
  const auth = getAuth(app);

  console.log(`🔐  Autentificare ca ${COUPLE_EMAIL}...`);
  const credential = await signInWithEmailAndPassword(auth, COUPLE_EMAIL, COUPLE_PASSWORD);
  console.log("✅  Token obținut");
  return credential.user.getIdToken();
}

async function authedFetch(token: string, path: string, init: RequestInit = {}) {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
}

async function loadWeddingData(token: string): Promise<{ guests: WeddingGuest[]; tables: WeddingTable[] }> {
  const response = await authedFetch(token, "/api/wedding-hub/me", { method: "GET" });
  if (!response.ok) {
    throw new Error("Nu s-au putut încărca datele nunții.");
  }
  return response.json() as Promise<{ guests: WeddingGuest[]; tables: WeddingTable[] }>;
}

async function ensureTables(token: string, existingTables: WeddingTable[]): Promise<WeddingTable[]> {
  if (!CREATE_MISSING_TABLES || existingTables.length >= TARGET_TABLE_COUNT) {
    return existingTables;
  }

  const missingCount = TARGET_TABLE_COUNT - existingTables.length;
  console.log(`🪑  Se creează ${missingCount} mese noi...`);

  for (let index = 0; index < missingCount; index += 1) {
    const response = await authedFetch(token, "/api/wedding-hub/tables", {
      method: "POST",
      body: JSON.stringify({
        tableName: tableLabel(existingTables.length + index),
        capacity: DEFAULT_TABLE_CAPACITY,
      }),
    });

    if (!response.ok) {
      const error = await response.json() as { error?: string };
      throw new Error(error.error ?? "Nu s-a putut crea masa.");
    }
  }

  const refreshed = await loadWeddingData(token);
  return refreshed.tables;
}

async function bulkUpdateGuests(
  token: string,
  updates: Array<Record<string, unknown>>,
): Promise<void> {
  if (updates.length === 0) return;

  const response = await authedFetch(token, "/api/wedding-hub/guests/bulk-update", {
    method: "POST",
    body: JSON.stringify({ updates }),
  });

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(error.error ?? "Bulk update eșuat.");
  }
}

function buildSequentialAssignments(guests: WeddingGuest[], tables: WeddingTable[]) {
  const assignments: Array<{ guestId: string; tableId: string }> = [];
  let guestIndex = 0;

  for (const table of tables) {
    for (let seatIndex = 0; seatIndex < table.capacity; seatIndex += 1) {
      const guest = guests[guestIndex];
      if (!guest) return assignments;

      assignments.push({ guestId: guest.id, tableId: table.id });
      guestIndex += 1;
    }
  }

  return assignments;
}

async function main() {
  const token = await signInAndGetToken();
  const initial = await loadWeddingData(token);
  const tables = await ensureTables(token, initial.tables);
  const targetGuests = initial.guests.filter((guest) => !ONLY_CONFIRMED || guest.rsvpStatus === "confirmat");

  console.log(`👥  Invitați țintă: ${targetGuests.length}`);
  console.log(`🪑  Mese disponibile: ${tables.length}`);

  if (MODE === "clear") {
    await bulkUpdateGuests(
      token,
      targetGuests.map((guest) => ({ guestId: guest.id, tableId: null })),
    );
    console.log("✅  Toți invitații selectați au fost scoși din mese.");
    process.exit(0);
  }

  if (CLEAR_EXISTING) {
    await bulkUpdateGuests(
      token,
      targetGuests.map((guest) => ({ guestId: guest.id, tableId: null })),
    );
    console.log("🧹  Seating curent resetat pentru invitații selectați.");
  }

  const assignments = buildSequentialAssignments(targetGuests, tables);
  const unassignedCount = Math.max(targetGuests.length - assignments.length, 0);

  await bulkUpdateGuests(
    token,
    assignments.map((assignment) => ({
      guestId: assignment.guestId,
      tableId: assignment.tableId,
    })),
  );

  console.log(`✅  ${assignments.length} invitați au fost așezați automat.`);
  if (unassignedCount > 0) {
    console.log(`⚠️  ${unassignedCount} invitați au rămas fără locuri disponibile.`);
  }
}

main().catch((error: unknown) => {
  console.error("❌  seedWeddingSeating a eșuat:", (error as { message?: string }).message ?? error);
  process.exit(1);
});
