import { setGlobalOptions } from 'firebase-functions/v2';
import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

admin.initializeApp();

setGlobalOptions({ region: 'europe-central2', maxInstances: 10 });

/**
 * Basic health check endpoint
 */
export const healthCheck = onRequest((_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Callable function to completely purge all user data across Firestore, Storage, and Auth
 * (Will be expanded in Task 9 / Privacy controls)
 */
export const deleteUserAccount = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to delete account.');
  }

  const uid = request.auth.uid;
  const firestore = admin.firestore();
  const storage = admin.storage();

  // 1. Delete user documents from Firestore
  const userRef = firestore.collection('users').doc(uid);
  await firestore.recursiveDelete(userRef);

  // 2. Delete user storage files. Do not swallow failures: keeping the Auth
  // identity lets the user safely retry instead of orphaning private data.
  const bucket = storage.bucket();
  await bucket.deleteFiles({ prefix: `snapshots/${uid}/` });

  // 3. Delete user from Firebase Authentication
  await admin.auth().deleteUser(uid);

  return { success: true };
});
