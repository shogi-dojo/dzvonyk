import { describe, expect, it } from 'vitest';
import { optionalPublicEnv, requirePublicEnv } from './publicEnv';

describe('public environment configuration', () => {
  it('trims required values', () => {
    expect(requirePublicEnv('VITE_FIREBASE_PROJECT_ID', '  school-app  ')).toBe('school-app');
  });

  it('fails fast when a required value is missing', () => {
    expect(() => requirePublicEnv('VITE_FIREBASE_API_KEY', undefined)).toThrow(
      'Missing VITE_FIREBASE_API_KEY'
    );
    expect(() => requirePublicEnv('VITE_FIREBASE_API_KEY', '   ')).toThrow(
      'Missing VITE_FIREBASE_API_KEY'
    );
  });

  it('normalizes optional values to an empty string', () => {
    expect(optionalPublicEnv(undefined)).toBe('');
    expect(optionalPublicEnv('  https://example.com  ')).toBe('https://example.com');
  });
});
