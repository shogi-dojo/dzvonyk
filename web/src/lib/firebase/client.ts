import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, type Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, type FirebaseStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, type Functions, connectFunctionsEmulator } from 'firebase/functions';
import { firebaseConfig } from './config';
import { setupAppCheck } from './appCheck';

export const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth: Auth = getAuth(app);
export const db: Firestore = initializeFirestore(app, { ignoreUndefinedProperties: true });
export const storage: FirebaseStorage = getStorage(app);
export const functions: Functions = getFunctions(app, 'europe-central2');

// Initialize App Check in monitor mode
setupAppCheck(app);

let emulatorsConnected = false;

interface WindowWithEmulator extends Window {
  __USE_FIREBASE_EMULATOR?: boolean;
}

export function initEmulators() {
  if (emulatorsConnected || typeof window === 'undefined') return;

  const win = window as unknown as WindowWithEmulator;
  const shouldUseEmulator =
    Boolean(win.__USE_FIREBASE_EMULATOR) ||
    Boolean(typeof window !== 'undefined' && window.location?.search?.includes('emulator=true')) ||
    Boolean(typeof process !== 'undefined' && process.env?.USE_FIREBASE_EMULATOR === 'true') ||
    import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

  if (shouldUseEmulator) {
    try {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
      connectStorageEmulator(storage, '127.0.0.1', 9199);
      connectFunctionsEmulator(functions, '127.0.0.1', 5001);
      emulatorsConnected = true;
    } catch {
      // Emulators might already be connected
    }
  }
}

if (typeof window !== 'undefined') {
  initEmulators();
}
