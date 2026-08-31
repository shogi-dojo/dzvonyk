import { publicEnv } from '@/config/publicEnv';

export interface FirebaseAppConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
}

export const firebaseConfig: FirebaseAppConfig = {
  apiKey: publicEnv.firebase.apiKey,
  authDomain: publicEnv.firebase.authDomain,
  projectId: publicEnv.firebase.projectId,
  storageBucket: publicEnv.firebase.storageBucket,
  messagingSenderId: publicEnv.firebase.messagingSenderId,
  appId: publicEnv.firebase.appId,
  measurementId: publicEnv.firebase.measurementId,
};
