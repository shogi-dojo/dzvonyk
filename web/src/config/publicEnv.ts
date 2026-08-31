type RequiredPublicEnvKey =
  | 'VITE_FIREBASE_API_KEY'
  | 'VITE_FIREBASE_AUTH_DOMAIN'
  | 'VITE_FIREBASE_PROJECT_ID'
  | 'VITE_FIREBASE_STORAGE_BUCKET'
  | 'VITE_FIREBASE_MESSAGING_SENDER_ID'
  | 'VITE_FIREBASE_APP_ID'
  | 'VITE_FIREBASE_MEASUREMENT_ID'
  | 'VITE_FIREBASE_FUNCTIONS_REGION'
  | 'VITE_FEEDBACK_EMAIL';

export function requirePublicEnv(name: RequiredPublicEnvKey, value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(
      `[Config] Missing ${name}. Copy web/.env.example to web/.env for local work, ` +
        'or inject the variable into the Vite build environment.'
    );
  }
  return normalized;
}

export function optionalPublicEnv(value: string | undefined): string {
  return value?.trim() ?? '';
}

const feedbackEmail = requirePublicEnv('VITE_FEEDBACK_EMAIL', import.meta.env.VITE_FEEDBACK_EMAIL);
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(feedbackEmail)) {
  throw new Error('[Config] VITE_FEEDBACK_EMAIL must be a valid email address.');
}

const donateUrl = optionalPublicEnv(import.meta.env.VITE_DONATE_URL);
if (donateUrl && !donateUrl.startsWith('https://')) {
  throw new Error('[Config] VITE_DONATE_URL must use HTTPS.');
}

export const publicEnv = Object.freeze({
  firebase: Object.freeze({
    apiKey: requirePublicEnv('VITE_FIREBASE_API_KEY', import.meta.env.VITE_FIREBASE_API_KEY),
    authDomain: requirePublicEnv(
      'VITE_FIREBASE_AUTH_DOMAIN',
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
    ),
    projectId: requirePublicEnv('VITE_FIREBASE_PROJECT_ID', import.meta.env.VITE_FIREBASE_PROJECT_ID),
    storageBucket: requirePublicEnv(
      'VITE_FIREBASE_STORAGE_BUCKET',
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET
    ),
    messagingSenderId: requirePublicEnv(
      'VITE_FIREBASE_MESSAGING_SENDER_ID',
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
    ),
    appId: requirePublicEnv('VITE_FIREBASE_APP_ID', import.meta.env.VITE_FIREBASE_APP_ID),
    measurementId: requirePublicEnv(
      'VITE_FIREBASE_MEASUREMENT_ID',
      import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
    ),
    functionsRegion: requirePublicEnv(
      'VITE_FIREBASE_FUNCTIONS_REGION',
      import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION
    ),
  }),
  appCheckSiteKey: optionalPublicEnv(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
  feedbackEmail,
  donateUrl,
});
