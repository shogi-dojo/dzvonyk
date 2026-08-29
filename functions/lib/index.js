"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUserAccount = exports.healthCheck = void 0;
const v2_1 = require("firebase-functions/v2");
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
(0, v2_1.setGlobalOptions)({ region: 'europe-central2', maxInstances: 10 });
/**
 * Basic health check endpoint
 */
exports.healthCheck = (0, https_1.onRequest)((_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
/**
 * Callable function to completely purge all user data across Firestore, Storage, and Auth
 * (Will be expanded in Task 9 / Privacy controls)
 */
exports.deleteUserAccount = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated to delete account.');
    }
    const uid = request.auth.uid;
    const firestore = admin.firestore();
    const storage = admin.storage();
    // 1. Delete user documents from Firestore
    const userRef = firestore.collection('users').doc(uid);
    await firestore.recursiveDelete(userRef);
    // 2. Delete user storage files if bucket exists
    try {
        const bucket = storage.bucket();
        await bucket.deleteFiles({ prefix: `snapshots/${uid}/` });
    }
    catch (err) {
        console.warn(`Storage cleanup notice for ${uid}:`, err);
    }
    // 3. Delete user from Firebase Authentication
    await admin.auth().deleteUser(uid);
    return { success: true };
});
//# sourceMappingURL=index.js.map