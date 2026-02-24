/**
 * Firebase client SDK — initialise app, auth, and provider.
 *
 * The config below is public / non-secret (Firebase Web SDK design).
 * All sensitive operations happen server-side via firebase-admin.
 *
 * IMPORTANT: Lazy-initialised to avoid SSR prerender errors.
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "optioni.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "optioni",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "optioni.firebasestorage.app",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

function getApp(): FirebaseApp {
    if (!_app) {
        _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    }
    return _app;
}

export function getFirebaseAuth(): Auth {
    if (!_auth) {
        _auth = getAuth(getApp());
    }
    return _auth;
}

export const googleProvider = new GoogleAuthProvider();
