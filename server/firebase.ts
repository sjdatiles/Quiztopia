import fs from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { LocalFirestoreDb } from './localDb.ts';

interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
}

function loadFirebaseConfig(): FirebaseAppletConfig {
  const candidates = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(import.meta.dirname ?? process.cwd(), '..', 'firebase-applet-config.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8')) as FirebaseAppletConfig;
    }
  }
  throw new Error('firebase-applet-config.json not found.');
}

const firebaseConfig = loadFirebaseConfig();

function parseServiceAccount(): Record<string, any> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    let parsed: any = JSON.parse(raw);
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    if (parsed && typeof parsed.private_key === 'string') {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

const serviceAccount = parseServiceAccount();

const app = getApps().length
  ? getApps()[0]
  : initializeApp(
      serviceAccount
        ? {
            credential: cert(serviceAccount),
            projectId: firebaseConfig.projectId,
          }
        : {
            projectId: firebaseConfig.projectId,
          }
    );

export const adminAuth = getAuth(app);

// Use live Cloud Firestore Admin SDK when service account credentials are provided
// (GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON on Vercel);
// otherwise use the ACID SQLite/JSON Firestore-compatible store.
const useRemoteFirestore = Boolean(serviceAccount || process.env.GOOGLE_APPLICATION_CREDENTIALS);

export const adminDb: Firestore = useRemoteFirestore
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : (new LocalFirestoreDb() as unknown as Firestore);

export { firebaseConfig };
