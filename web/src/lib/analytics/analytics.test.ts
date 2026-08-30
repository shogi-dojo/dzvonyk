import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CONSENT_STORAGE_KEY,
  CONSENT_CHANGED_EVENT,
  getConsentStatus,
  setConsentStatus,
  isAnalyticsAllowed,
  sanitizeParams,
  trackPageView,
  trackEvent,
} from './analytics';

vi.mock('firebase/analytics', () => ({
  getAnalytics: vi.fn(() => ({})),
  isSupported: vi.fn(async () => true),
  logEvent: vi.fn(),
  setAnalyticsCollectionEnabled: vi.fn(),
  setConsent: vi.fn(),
}));

describe('Consent-gated Analytics & Privacy', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('starts with null consent by default and disallows tracking', () => {
    expect(getConsentStatus()).toBeNull();
    expect(isAnalyticsAllowed()).toBe(false);
  });

  it('sets and retrieves granted consent, firing custom event', async () => {
    const eventListener = vi.fn();
    window.addEventListener(CONSENT_CHANGED_EVENT, eventListener);

    await setConsentStatus('granted');

    expect(getConsentStatus()).toBe('granted');
    expect(isAnalyticsAllowed()).toBe(true);
    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBe('granted');
    expect(eventListener).toHaveBeenCalledTimes(1);

    window.removeEventListener(CONSENT_CHANGED_EVENT, eventListener);
  });

  it('sets and retrieves denied consent', async () => {
    await setConsentStatus('denied');

    expect(getConsentStatus()).toBe('denied');
    expect(isAnalyticsAllowed()).toBe(false);
    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBe('denied');
  });

  it('sanitizes parameters and strictly strips PII and forbidden fields', () => {
    const raw = {
      institutionName: 'School #1',
      teacherName: 'Ivanov Ivan',
      fileName: 'secret_schedule.fet',
      userEmail: 'user@example.com',
      studentName: 'Petro',
      mode: 0,
      activity_count: 42,
      duration_ms: 1200,
      is_complete: true,
      format: 'pdf',
      dirtyString: 'Clean <script>alert(1)</script> string "with quotes"',
    };

    const sanitized = sanitizeParams(raw);

    // Forbidden keys must be stripped
    expect(sanitized).not.toHaveProperty('institutionName');
    expect(sanitized).not.toHaveProperty('teacherName');
    expect(sanitized).not.toHaveProperty('fileName');
    expect(sanitized).not.toHaveProperty('userEmail');
    expect(sanitized).not.toHaveProperty('studentName');

    // Allowed fields preserved
    expect(sanitized.mode).toBe(0);
    expect(sanitized.activity_count).toBe(42);
    expect(sanitized.duration_ms).toBe(1200);
    expect(sanitized.is_complete).toBe(true);
    expect(sanitized.format).toBe('pdf');
    expect(sanitized.dirtyString).not.toContain('<');
    expect(sanitized.dirtyString).not.toContain('>');
  });

  it('trackPageView and trackEvent are safe no-ops when consent is not granted', () => {
    expect(() => {
      trackPageView('/teachers?search=Ivanov#test');
      trackEvent('timetable_imported', { source_type: 'fet', activity_count: 10 });
    }).not.toThrow();
  });
});
