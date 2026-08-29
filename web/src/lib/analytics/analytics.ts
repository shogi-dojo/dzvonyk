import { getAnalytics, isSupported, logEvent, setConsent, type Analytics } from 'firebase/analytics';
import { app } from '../firebase/client';
import type { AnalyticsEventMap, ConsentStatus } from './types';

export const CONSENT_STORAGE_KEY = 'dzvonyk_analytics_consent';
export const CONSENT_CHANGED_EVENT = 'dzvonyk_consent_changed';

let analyticsInstance: Analytics | null = null;
let initialized = false;

// Forbidden parameter substrings to prevent any accidental PII leakage
const FORBIDDEN_KEYS = [
  'name',
  'teacher',
  'school',
  'institution',
  'filename',
  'file',
  'email',
  'uid',
  'user',
  'comment',
  'password',
  'token',
];

export function getConsentStatus(): ConsentStatus | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
  if (stored === 'granted' || stored === 'denied') {
    return stored;
  }
  return null;
}

export function isAnalyticsAllowed(): boolean {
  return getConsentStatus() === 'granted';
}

export async function initAnalytics(): Promise<Analytics | null> {
  if (typeof window === 'undefined') return null;
  if (initialized) return analyticsInstance;

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    initialized = true;
    return null;
  }

  const consent = getConsentStatus();
  
  // Set default GA4 consent mode: denied unless explicitly granted
  try {
    setConsent({
      analytics_storage: consent === 'granted' ? 'granted' : 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functionality_storage: 'granted',
      security_storage: 'granted',
    });
  } catch (err) {
    console.warn('[Analytics] Consent init warning:', err);
  }

  if (consent === 'granted') {
    try {
      analyticsInstance = getAnalytics(app);
    } catch (err) {
      console.warn('[Analytics] Initialization error:', err);
    }
  }

  initialized = true;
  return analyticsInstance;
}

export async function setConsentStatus(status: ConsentStatus): Promise<void> {
  if (typeof window === 'undefined') return;

  localStorage.setItem(CONSENT_STORAGE_KEY, status);

  try {
    setConsent({
      analytics_storage: status,
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functionality_storage: 'granted',
      security_storage: 'granted',
    });
  } catch (err) {
    console.warn('[Analytics] setConsent error:', err);
  }

  if (status === 'granted') {
    const supported = await isSupported().catch(() => false);
    if (supported && !analyticsInstance) {
      try {
        analyticsInstance = getAnalytics(app);
      } catch (err) {
        console.warn('[Analytics] Analytics activation error:', err);
      }
    }
  } else {
    analyticsInstance = null;
  }

  // Notify components across the app
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: status }));

  if (status === 'granted') {
    trackEvent('consent_changed', { status });
  }
}

export function sanitizeParams(params?: Record<string, unknown>): Record<string, string | number | boolean> {
  if (!params) return {};

  const clean: Record<string, string | number | boolean> = {};

  for (const [key, rawValue] of Object.entries(params)) {
    const lowerKey = key.toLowerCase();
    const isForbidden = FORBIDDEN_KEYS.some((fk) => lowerKey.includes(fk));
    if (isForbidden) {
      continue;
    }

    if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
      clean[key] = rawValue;
    } else if (typeof rawValue === 'string') {
      // Strip potential sensitive query strings, emails or excessive length
      const sanitized = rawValue.replace(/[<>\\"]/g, '').slice(0, 64);
      clean[key] = sanitized;
    }
  }

  return clean;
}

export function trackEvent<E extends keyof AnalyticsEventMap>(
  event: E,
  params?: AnalyticsEventMap[E]
): void {
  if (!isAnalyticsAllowed() || !analyticsInstance) return;

  try {
    const cleanParams = sanitizeParams(params as Record<string, unknown>);
    logEvent(analyticsInstance, event as string, cleanParams);
  } catch (err) {
    console.warn(`[Analytics] Failed to log event ${event}:`, err);
  }
}

export function trackPageView(path: string): void {
  if (!isAnalyticsAllowed()) return;

  // Clean route path to avoid tracking any IDs or query strings
  const cleanPath = path.split('?')[0].split('#')[0] || '/';
  trackEvent('page_view', { page_path: cleanPath });
}
