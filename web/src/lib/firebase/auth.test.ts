import { describe, it, expect } from 'vitest';
import { toAuthUserProfile } from './auth';

describe('Firebase Auth Service', () => {
  it('converts Firebase User object to safe serializable AuthUserProfile', () => {
    const mockUser = {
      uid: 'user-123',
      email: 'teacher@school.ua',
      displayName: 'Олена Петрівна',
      photoURL: 'https://lh3.googleusercontent.com/a/photo.jpg',
    } as unknown as Parameters<typeof toAuthUserProfile>[0];

    const profile = toAuthUserProfile(mockUser);
    expect(profile).toEqual({
      uid: 'user-123',
      email: 'teacher@school.ua',
      displayName: 'Олена Петрівна',
      photoURL: 'https://lh3.googleusercontent.com/a/photo.jpg',
    });
  });

  it('handles null user gracefully', () => {
    const profile = toAuthUserProfile(null);
    expect(profile).toBeNull();
  });
});
