import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = path.join(__dirname, "joculdetectivuluiFirebaseKEY.json");

// Initialize Firebase App
try {
  const serviceAccountJson = readFileSync(serviceAccountPath, "utf-8");
  const serviceAccount = JSON.parse(serviceAccountJson);

  initializeApp({
    credential: cert(serviceAccount),
  });

  console.log("Firebase Admin initialized successfully.");
} catch (error) {
  console.error("Error initializing Firebase Admin. Check firestoreInit.ts");
}

// Get and export Firestore instance
const db = getFirestore();

export { db };
