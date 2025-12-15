// src/server/firestoreInit.ts
import 'dotenv/config';
import type { ServiceAccount } from 'firebase-admin/app';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

let _db: Firestore | null = null;

function init() {
  if (getApps().length) return;

  const json = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '';
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';
  const pathFromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '';

  if (json || b64) {
    const raw = json || Buffer.from(b64, 'base64').toString('utf8');
    const sa = JSON.parse(raw) as ServiceAccount;
    const anySa = sa as unknown as { private_key?: string; project_id?: string };
    if (typeof anySa.private_key === 'string') anySa.private_key = anySa.private_key.replace(/\\n/g, '\n');
    initializeApp({ credential: cert(sa), projectId: process.env.FIREBASE_PROJECT_ID || anySa.project_id });
    console.log('[firebase-admin] initialized from SERVICE_ACCOUNT env');
  } else if (gac) {
    initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID || undefined });
    console.log('[firebase-admin] initialized from GOOGLE_APPLICATION_CREDENTIALS');
  } else if (pathFromEnv) {
    const sa = JSON.parse(readFileSync(pathFromEnv, 'utf8')) as ServiceAccount;
    const anySa = sa as unknown as { private_key?: string; project_id?: string };
    if (typeof anySa.private_key === 'string') anySa.private_key = anySa.private_key.replace(/\\n/g, '\n');
    initializeApp({ credential: cert(sa), projectId: process.env.FIREBASE_PROJECT_ID || anySa.project_id });
    console.log('[firebase-admin] initialized from PATH');
  } else {
    throw new Error('No Firebase Admin credentials.');
  }
  console.log("[firebase-admin] projectId:", getApps()[0].options.projectId);

}

export function firestore(): Firestore {
  if (!_db) {
    init();
    _db = getFirestore();
  }
  return _db;
}

// 🔧 compat: păstrează `import { db } from '../firestoreInit.js'`
export const db = new Proxy({} as Firestore, {
  get(_t, prop, recv) {
    if (!_db) {
      init();
      _db = getFirestore();
    }
    // @ts-ignore
    return Reflect.get(_db, prop, recv);
  },
}) as Firestore;
