import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const COUPLE_EMAIL = "ancadaniel1994@gmail.com";
const COUPLE_PASSWORD = "bagXan2024!";
const API_BASE = "http://127.0.0.1:1994";

const MENU_OPTIONS = ["carne", "vegetarian", "vegan", "mixt"] as const;
type Menu = typeof MENU_OPTIONS[number];

function randomMenu(): Menu {
  const weights = [0.65, 0.15, 0.05, 0.15]; // carne dominant
  const rand = Math.random();
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (rand < cumulative) return MENU_OPTIONS[i];
  }
  return "carne";
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  const firebaseConfig = {
    apiKey: "AIzaSyAK1PxPnxLzGocve2OeKappgBHaKqmaijE",
    authDomain: "joculdetectivului.firebaseapp.com",
    projectId: "joculdetectivului",
  };

  const app = initializeApp(firebaseConfig, "seed-rsvp");
  const auth = getAuth(app);

  console.log(`🔐  Autentificare ca ${COUPLE_EMAIL}...`);
  let token: string;
  try {
    const credential = await signInWithEmailAndPassword(auth, COUPLE_EMAIL, COUPLE_PASSWORD);
    token = await credential.user.getIdToken();
    console.log("✅  Token obținut\n");
  } catch (err: unknown) {
    console.error("❌  Login eșuat:", (err as { message?: string }).message);
    process.exit(1);
  }

  // Fetch all guests
  console.log("📋  Se încarcă invitații...");
  const meResponse = await fetch(`${API_BASE}/api/wedding-hub/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!meResponse.ok) {
    console.error("❌  Nu s-au putut încărca invitații");
    process.exit(1);
  }

  const { guests } = await meResponse.json() as { guests: Array<{ id: string; firstName: string; lastName: string; childrenCount: number }> };
  console.log(`✅  ${guests.length} invitați găsiți\n`);

  let confirmed = 0;
  let refused = 0;
  let pending = 0;
  let failed = 0;

  for (let i = 0; i < guests.length; i++) {
    const guest = guests[i];
    const rand = Math.random();

    let body: Record<string, unknown>;

    if (rand < 0.80) {
      // 80% confirmă
      body = {
        rsvpStatus: "confirmat",
        menuPreference: randomMenu(),
        childrenMenuPreference: guest.childrenCount > 0 ? randomMenu() : null,
      };
      confirmed++;
    } else if (rand < 0.90) {
      // 10% refuză
      body = { rsvpStatus: "refuzat" };
      refused++;
    } else {
      // 10% rămân în așteptare
      pending++;
      process.stdout.write(`\r  ${i + 1}/${guests.length} procesați...`);
      continue;
    }

    try {
      const response = await fetch(`${API_BASE}/api/wedding-hub/guests/${guest.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json() as { error?: string };
        console.error(`\n❌  ${guest.firstName} ${guest.lastName}: ${error.error}`);
        failed++;
      }
    } catch (err: unknown) {
      console.error(`\n❌  Request eșuat: ${(err as { message?: string }).message}`);
      failed++;
    }

    process.stdout.write(`\r  ${i + 1}/${guests.length} procesați...`);
  }

  console.log(`\n
📊  Rezultat:
   ✅  Confirmați:   ${confirmed}
   ❌  Refuzați:     ${refused}
   ⏳  Așteptare:    ${pending}
   💥  Erori:        ${failed}
`);

  process.exit(0);
}

main();
