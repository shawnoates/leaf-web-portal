"use client";

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, signInWithCustomToken, Auth } from "firebase/auth";
import { getDatabase, Database } from "firebase/database";

// Web portal connects to the same Firebase project the iOS app uses.
// Database URL matches leaflets-server/helpers/firebase.js default.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "leaf-6f756.firebaseapp.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://leaf-6f756-default-rtdb.firebaseio.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "leaf-6f756",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Database | null = null;

function ensureApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  cachedApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return cachedApp;
}

export function getChatAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(ensureApp());
  return cachedAuth;
}

export function getChatDatabase(): Database {
  if (cachedDb) return cachedDb;
  cachedDb = getDatabase(ensureApp());
  return cachedDb;
}

// Sign into Firebase using a custom token minted by the leaflets-server
// `getChatToken` cloud function. Required before any RTDB read/write so the
// auth.uid claim can be enforced once Firebase RTDB rules are tightened
// (see WEB_CHAT_V1_SPEC.md — RTDB rules tightening deferred).
export async function signInToChat(firebaseToken: string): Promise<void> {
  const auth = getChatAuth();
  await signInWithCustomToken(auth, firebaseToken);
}
