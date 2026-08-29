import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from './client';
import { trackEvent } from '@/lib/analytics';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export interface AuthUserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export function toAuthUserProfile(user: User | null): AuthUserProfile | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

/**
 * Signs in user with Google Auth.
 * Uses popup by default with redirect fallback.
 */
export async function signInWithGoogle(): Promise<AuthUserProfile> {
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true);

  try {
    if (isStandalone) {
      await signInWithRedirect(auth, googleProvider);
      return new Promise(() => {}); // Wait for redirect to complete
    }

    const cred = await signInWithPopup(auth, googleProvider);
    trackEvent('auth_login', { method: 'google' });
    return toAuthUserProfile(cred.user)!;
  } catch (err: any) {
    // If popup was blocked, fallback to redirect
    if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/popup-closed-by-user') {
      if (err.code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, googleProvider);
        return new Promise(() => {});
      }
    }
    throw err;
  }
}

/**
 * Checks for redirect sign-in result on page load
 */
export async function checkRedirectAuthResult(): Promise<AuthUserProfile | null> {
  try {
    const cred = await getRedirectResult(auth);
    if (cred?.user) {
      trackEvent('auth_login', { method: 'google' });
      return toAuthUserProfile(cred.user);
    }
  } catch (err) {
    console.warn('[Auth] Redirect result error:', err);
  }
  return null;
}

/**
 * Signs out the current user
 */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
  trackEvent('auth_logout', {});
}

/**
 * Subscribes to auth state changes
 */
export function subscribeToAuthState(callback: (user: AuthUserProfile | null) => void): () => void {
  return onAuthStateChanged(auth, (user) => {
    callback(toAuthUserProfile(user));
  });
}
