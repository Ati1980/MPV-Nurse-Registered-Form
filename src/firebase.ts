import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';

interface FirebaseWebConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket: string;
  messagingSenderId: string;
  measurementId?: string;
}

const configModules = import.meta.glob<{ default: Partial<FirebaseWebConfig> }>(
  '/firebase-applet-config.json',
  { eager: true }
);
const localConfig = configModules['/firebase-applet-config.json']?.default ?? {};

const firebaseConfig: FirebaseWebConfig = {
  projectId:
    (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) ||
    localConfig.projectId ||
    '',
  appId:
    (import.meta.env.VITE_FIREBASE_APP_ID as string | undefined) ||
    localConfig.appId ||
    '',
  apiKey:
    (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined) ||
    localConfig.apiKey ||
    '',
  authDomain:
    (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) ||
    localConfig.authDomain ||
    '',
  firestoreDatabaseId:
    (import.meta.env.VITE_FIREBASE_DATABASE_ID as string | undefined) ||
    localConfig.firestoreDatabaseId ||
    '',
  storageBucket:
    (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined) ||
    localConfig.storageBucket ||
    '',
  messagingSenderId:
    (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined) ||
    localConfig.messagingSenderId ||
    '',
  measurementId:
    (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined) ||
    localConfig.measurementId ||
    '',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function signInHrWithGoogle(): Promise<User> {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

export async function signOutHrGoogle(): Promise<void> {
  await signOut(auth);
}
