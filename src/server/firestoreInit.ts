import 'dotenv/config'; // <- PRIMA linie!
import { readFileSync, existsSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Poți seta o cale absolută din ENV pe server (recomandat):
//   FIREBASE_SERVICE_ACCOUNT_PATH=/var/www/secure/joculdetectivuluiFirebaseKEY.json
const fallbackPath = path.join(__dirname, 'joculdetectivuluiFirebaseKEY.json');
const KEY_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || fallbackPath;

// --- LOGGING DE DIAGNOSTIC ---
console.log('[firestoreInit] import.meta.url =', import.meta.url);
console.log('[firestoreInit] __dirname       =', __dirname);
console.log('[firestoreInit] process.cwd()   =', process.cwd());
console.log('[firestoreInit] KEY_PATH        =', KEY_PATH);
console.log('[firestoreInit] KEY exists?     =', existsSync(KEY_PATH));

if (existsSync(KEY_PATH)) {
  try {
    const size = statSync(KEY_PATH).size;
    console.log('[firestoreInit] KEY size (bytes) =', size);
  } catch (e) {
    console.warn('[firestoreInit] Unable to stat KEY file:', e);
  }
}

// --- INITIALIZARE APP ---
try {
  if (!existsSync(KEY_PATH)) {
    throw new Error(
      `Service account JSON not found at KEY_PATH: ${KEY_PATH}. ` +
        `Tip: setați FIREBASE_SERVICE_ACCOUNT_PATH la o cale ABSOLUTĂ în producție.`
    );
  }

  const serviceAccountJson = readFileSync(KEY_PATH, 'utf-8');
  const serviceAccount = JSON.parse(serviceAccountJson);

  // sanity logs non-sensibile
  console.log('[firestoreInit] serviceAccount.project_id =', serviceAccount.project_id);
  console.log('[firestoreInit] serviceAccount.client_email =', serviceAccount.client_email);

  // (de obicei nu e nevoie pentru fișier, dar nu strică)
  if (typeof serviceAccount.private_key === 'string') {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
  });

  console.log('[firestoreInit] Firebase Admin initialized. getApps().length =', getApps().length);
} catch (error) {
  console.error('Error initializing Firebase Admin. Check firestoreInit.ts');
  console.error(error); // NU mai ascundem eroarea; vrem stack & mesajul real (ex: ENOENT)
}

// --- VERIFICARE & EXPORT DB ---
if (getApps().length === 0) {
  // Aici explicăm clar de ce nu continuăm:
  console.error(
    '[firestoreInit] Firebase Admin is NOT initialized -> will NOT call getFirestore(). ' +
      'See logs above for the real cause (missing file, wrong path, permissions, etc).'
  );
  // Aruncăm eroare ca să se oprească pornirea cu un mesaj util
  throw new Error('Firebase Admin NOT initialized. Aborting Firestore binding.');
}

const db = getFirestore();
console.log('[firestoreInit] Firestore instance acquired OK.');
export { db };
