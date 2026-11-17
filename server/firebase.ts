import fs from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import embeddedFirebaseConfig from '../firebase-applet-config.json' with { type: 'json' };
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
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf-8')) as FirebaseAppletConfig;
      }
    } catch {
      // Fall back to embedded config
    }
  }
  return embeddedFirebaseConfig as FirebaseAppletConfig;
}

const firebaseConfig = loadFirebaseConfig();

function parseServiceAccount(): { account: Record<string, any> | null; error: string | null } {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return { account: null, error: null };
  try {
    let parsed: any = JSON.parse(raw);
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    if (!parsed || typeof parsed !== 'object') {
      return { account: null, error: 'FIREBASE_SERVICE_ACCOUNT_JSON must be a JSON object.' };
    }
    if (typeof parsed.private_key === 'string') {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    if (typeof parsed.private_key !== 'string' || typeof parsed.client_email !== 'string') {
      return {
        account: null,
        error: 'FIREBASE_SERVICE_ACCOUNT_JSON is missing required client_email or private_key fields.',
      };
    }
    return { account: parsed, error: null };
  } catch (err: any) {
    return {
      account: null,
      error: `Invalid FIREBASE_SERVICE_ACCOUNT_JSON: ${err?.message || 'JSON parse error'}`,
    };
  }
}

const { account: serviceAccount, error: serviceAccountParseError } = parseServiceAccount();
let firebaseInitError: string | null = serviceAccountParseError;

let app: App;
let hasCredential = false;

try {
  if (getApps().length > 0) {
    app = getApps()[0];
    hasCredential = Boolean(serviceAccount || process.env.GOOGLE_APPLICATION_CREDENTIALS);
  } else if (serviceAccount) {
    app = initializeApp({
      credential: cert(serviceAccount),
      projectId: firebaseConfig.projectId,
    });
    hasCredential = true;
  } else {
    app = initializeApp({
      projectId: firebaseConfig.projectId,
    });
    hasCredential = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  }
} catch (err: any) {
  firebaseInitError = err?.message || 'Firebase Admin initialization failed.';
  console.error('Firebase Admin initialization error:', firebaseInitError);
  app = getApps().length
    ? getApps()[0]
    : initializeApp({ projectId: firebaseConfig.projectId }, 'quiztopia-fallback');
  hasCredential = false;
}

export const adminAuth = getAuth(app);

// Use live Cloud Firestore Admin SDK when valid service account credentials are provided
// (GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON on Vercel);
// otherwise use the ACID SQLite/JSON Firestore-compatible store.
let remoteDb: Firestore | null = null;
if (hasCredential) {
  try {
    remoteDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  } catch (err: any) {
    firebaseInitError = err?.message || 'Cloud Firestore client initialization failed.';
    console.error('Cloud Firestore initialization error:', firebaseInitError);
    remoteDb = null;
  }
}

export const useRemoteFirestore = Boolean(remoteDb);
export const adminDb: Firestore = remoteDb ?? (new LocalFirestoreDb() as unknown as Firestore);
export { firebaseConfig, firebaseInitError };

