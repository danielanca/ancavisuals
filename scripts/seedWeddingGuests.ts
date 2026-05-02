import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

// ── Config ────────────────────────────────────────────────────────────────────
const COUPLE_EMAIL = "ancadaniel1994@gmail.com";       // schimbă
const COUPLE_PASSWORD = "bagXan2024!";         // schimbă
const API_BASE = "http://127.0.0.1:1994";
const GUEST_COUNT = 200;
// ─────────────────────────────────────────────────────────────────────────────


const FIRST_NAMES = [
  "Alexandru", "Andrei", "Bogdan", "Cătălin", "Cristian", "Daniel", "Dragoș",
  "Eduard", "Florin", "Gabriel", "Ionuț", "Lucian", "Mihai", "Nicolae", "Octavian",
  "Paul", "Radu", "Sebastian", "Teodor", "Vlad", "Maria", "Ana", "Elena", "Ioana",
  "Andreea", "Cristina", "Diana", "Gabriela", "Laura", "Mihaela", "Nicoleta",
  "Raluca", "Simona", "Teodora", "Valentina", "Alina", "Bianca", "Carmen",
  "Daniela", "Florentina", "Larisa", "Monica", "Roxana", "Sorina", "Claudia",
];

const LAST_NAMES = [
  "Popescu", "Ionescu", "Popa", "Stan", "Gheorghe", "Stoica", "Dumitrescu",
  "Constantin", "Marin", "Florescu", "Dinu", "Radu", "Matei", "Niculescu",
  "Barbu", "Moldovan", "Lupu", "Oprea", "Petrescu", "Sandu", "Vlad", "Tudor",
  "Iordache", "Ciobanu", "Nica", "Dobre", "Andrei", "Mihai", "Badea", "Voicu",
];

const NOTES = [
  "Alergic la nuci", "Vegetarian", "Vine din Cluj", "Nașul mare",
  "Prieten de la facultate", "Coleg de muncă", "Văr primar", "Martor",
  "", "", "", "", "", "", // mostly empty notes
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPhone(): string {
  const prefixes = ["072", "073", "074", "075", "076", "077", "078"];
  const prefix = randomFrom(prefixes);
  const rest = Math.floor(Math.random() * 9000000 + 1000000).toString();
  return `${prefix}${rest}`;
}

function randomEmail(first: string, last: string, index: number): string {
  const normalized = (s: string) =>
    s.toLowerCase()
      .replace(/ă/g, "a").replace(/â/g, "a").replace(/î/g, "i")
      .replace(/ș/g, "s").replace(/ț/g, "t");
  return `${normalized(first)}.${normalized(last)}${index}@example.com`;
}

async function main() {
  // Load .env manually since we're running outside Vite
  const firebaseConfig = {
    apiKey: "AIzaSyAK1PxPnxLzGocve2OeKappgBHaKqmaijE",
    authDomain: "joculdetectivului.firebaseapp.com",
    projectId: "joculdetectivului",
  };

  const app = initializeApp(firebaseConfig, "seed-script");
  const auth = getAuth(app);

  console.log(`🔐  Autentificare ca ${COUPLE_EMAIL}...`);
  let token: string;
  try {
    const credential = await signInWithEmailAndPassword(auth, COUPLE_EMAIL, COUPLE_PASSWORD);
    token = await credential.user.getIdToken();
    console.log("✅  Token obținut\n");
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error("❌  Login eșuat:", error.message);
    process.exit(1);
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < GUEST_COUNT; i++) {
    const firstName = randomFrom(FIRST_NAMES);
    const lastName = randomFrom(LAST_NAMES);
    const adultsCount = Math.random() < 0.7 ? 1 : 2;
    const childrenCount = Math.random() < 0.15 ? Math.floor(Math.random() * 2) + 1 : 0;

    const body = {
      firstName,
      lastName,
      phone: Math.random() > 0.2 ? randomPhone() : "",
      email: Math.random() > 0.4 ? randomEmail(firstName, lastName, i) : "",
      notes: randomFrom(NOTES),
      adultsCount,
      childrenCount,
    };

    try {
      const response = await fetch(`${API_BASE}/api/wedding-hub/guests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        success++;
        process.stdout.write(`\r  ${success}/${GUEST_COUNT} invitați adăugați...`);
      } else {
        const error = await response.json();
        console.error(`\n❌  [${i + 1}] ${firstName} ${lastName}: ${error.error}`);
        failed++;
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error(`\n❌  [${i + 1}] Request eșuat: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n\n✅  Done — ${success} adăugați, ${failed} eșuați`);
  process.exit(0);
}

main();
