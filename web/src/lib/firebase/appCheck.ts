import { initializeAppCheck, ReCaptchaV3Provider, CustomProvider, type AppCheck } from 'firebase/app-check';
import type { FirebaseApp } from 'firebase/app';

let appCheckInstance: AppCheck | null = null;

interface WindowWithAppCheck extends Window {
  FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
}

export function setupAppCheck(app: FirebaseApp): AppCheck | null {
  if (typeof window === 'undefined') return null;
  if (appCheckInstance) return appCheckInstance;

  try {
    const isDev = import.meta.env.DEV || window.location?.hostname === 'localhost' || window.location?.hostname === '127.0.0.1';
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    const win = window as unknown as WindowWithAppCheck;

    if (isDev) {
      // In dev/localhost, enable debug token if not already set
      if (!win.FIREBASE_APPCHECK_DEBUG_TOKEN) {
        win.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }
    }

    if (siteKey) {
      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } else if (isDev) {
      // Dev mode debug provider for monitor mode
      appCheckInstance = initializeAppCheck(app, {
        provider: new CustomProvider({
          getToken: async () => ({
            token: 'debug-token-placeholder',
            expireTimeMillis: Date.now() + 3600000,
          }),
        }),
        isTokenAutoRefreshEnabled: true,
      });
    }
  } catch (err) {
    // Monitor mode: App Check initialization failures do not break client functionality
    console.warn('[AppCheck] Monitor mode notice:', err);
  }

  return appCheckInstance;
}
