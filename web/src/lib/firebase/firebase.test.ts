import { describe, it, expect, vi, beforeEach } from 'vitest';
import { firebaseConfig } from './config';
import { app, auth, db, storage, functions, initEmulators } from './client';
import { setupAppCheck } from './appCheck';

describe('Firebase Platform Foundation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('maps Firebase config from Vite environment variables', () => {
    expect(firebaseConfig).toEqual({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
    });
  });

  it('initializes core Firebase services with correct regions', () => {
    expect(app).toBeDefined();
    expect(auth).toBeDefined();
    expect(db).toBeDefined();
    expect(storage).toBeDefined();
    expect(functions).toBeDefined();
    expect(functions.region).toBe(import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION);
  });

  it('handles App Check monitor mode gracefully without throwing', () => {
    expect(() => setupAppCheck(app)).not.toThrow();
  });

  it('handles emulator initialization safely', () => {
    expect(() => initEmulators()).not.toThrow();
  });
});
