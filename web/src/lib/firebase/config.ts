export interface FirebaseAppConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export const firebaseConfig: FirebaseAppConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAnryKBMgwBrLLutDyzl1ygKfBAVxHD8Ag',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'dzvonyk.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'dzvonyk',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'dzvonyk.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '395917789018',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:395917789018:web:0ef3b1a1a4b6c680d5d563',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-L9H6X6T3SZ',
};
