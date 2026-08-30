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
 * Uses popup by default (works reliably in desktop browsers and PWAs).
 */
export async function signInWithGoogle(): Promise<AuthUserProfile> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    trackEvent('auth_login', { method: 'google' });
    const profile = toAuthUserProfile(cred.user);
    if (!profile) throw new Error('User profile is null after sign in');
    return profile;
  } catch (err: unknown) {
    const errorObj = err as { code?: string; message?: string };
    console.warn('[Auth] signInWithPopup code:', errorObj?.code, errorObj?.message);

    // If popup was explicitly blocked by the browser, fallback to redirect
    if (errorObj?.code === 'auth/popup-blocked') {
      console.log('[Auth] Popup was blocked, attempting signInWithRedirect...');
      await signInWithRedirect(auth, googleProvider);
      return new Promise(() => {});
    }

    if (errorObj?.code === 'auth/popup-closed-by-user' || errorObj?.code === 'auth/cancelled-popup-request') {
      console.log('[Auth] Sign-in popup was closed by user.');
      throw new Error('Вікно авторизації було закрито.');
    }

    if (errorObj?.code === 'auth/unauthorized-domain') {
      throw new Error('Домен застосунку не додано до списку авторизованих у Firebase Console (Authorized Domains).');
    }

    if (errorObj?.code === 'auth/operation-not-allowed') {
      throw new Error('Провайдер Google не увімкнено у Firebase Console (Authentication -> Sign-in method).');
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
