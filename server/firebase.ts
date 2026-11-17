import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };
import { LocalFirestoreDb } from './localDb.ts';

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      projectId: firebaseConfig.projectId,
    });

export const adminAuth = getAuth(app);

// Use live Firestore Admin SDK when service account credentials are provided;
// otherwise use the ACID SQLite-backed Firestore-compatible store so preview/dev
// runtimes without GCP service-account IAM keys stay 100% persistent and transactional.
const useRemoteFirestore = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);

export const adminDb: Firestore = useRemoteFirestore
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : (new LocalFirestoreDb() as unknown as Firestore);

export { firebaseConfig };
