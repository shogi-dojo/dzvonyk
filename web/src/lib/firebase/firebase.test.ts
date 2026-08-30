import { describe, it, expect, vi, beforeEach } from 'vitest';
import { firebaseConfig } from './config';
import { app, auth, db, storage, functions, initEmulators } from './client';
import { setupAppCheck } from './appCheck';

describe('Firebase Platform Foundation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('provides valid default firebase config for dzvonyk', () => {
    expect(firebaseConfig.projectId).toBe('dzvonyk');
    expect(firebaseConfig.authDomain).toBe('dzvonyk.firebaseapp.com');
    expect(firebaseConfig.storageBucket).toBe('dzvonyk.firebasestorage.app');
    expect(firebaseConfig.appId).toBe('1:395917789018:web:0ef3b1a1a4b6c680d5d563');
  });

  it('initializes core Firebase services with correct regions', () => {
    expect(app).toBeDefined();
    expect(auth).toBeDefined();
    expect(db).toBeDefined();
    expect(storage).toBeDefined();
    expect(functions).toBeDefined();
    expect(functions.region).toBe('europe-central2');
  });

  it('handles App Check monitor mode gracefully without throwing', () => {
    expect(() => setupAppCheck(app)).not.toThrow();
  });

  it('handles emulator initialization safely', () => {
    expect(() => initEmulators()).not.toThrow();
  });
});
