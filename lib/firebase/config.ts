import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app"
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, setLogLevel, type Firestore } from "firebase/firestore"
import { getStorage, type FirebaseStorage } from "firebase/storage"
import { getAuth, type Auth } from "firebase/auth"

const requiredEnvVars = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Object.values(requiredEnvVars).every((value) => value && value.trim() !== "")

const firebaseConfig = requiredEnvVars

// Suppress noisy Firestore transport errors (auto-reconnects)
try { setLogLevel("error") } catch {}

let app: FirebaseApp | null = null
let db: Firestore | null = null
let storage: FirebaseStorage | null = null
let auth: Auth | null = null

// Initialize Firebase lazily - only when actually needed
export const getFirebaseApp = (): FirebaseApp | null => {
  if (!isFirebaseConfigured) return null
  if (!app) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
  }
  return app
}

export const getFirebaseDb = (): Firestore | null => {
  if (!isFirebaseConfigured) return null
  if (!db) {
    const firebaseApp = getFirebaseApp()
    if (firebaseApp) {
      try {
        db = initializeFirestore(firebaseApp, {
          cache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        })
      } catch {
        db = getFirestore(firebaseApp)
      }
    }
  }
  return db
}

export const getFirebaseStorage = (): FirebaseStorage | null => {
  if (!isFirebaseConfigured) return null
  if (!storage) {
    const firebaseApp = getFirebaseApp()
    if (firebaseApp) {
      storage = getStorage(firebaseApp)
    }
  }
  return storage
}

export const getFirebaseAuth = (): Auth | null => {
  if (!isFirebaseConfigured) return null
  if (!auth) {
    const firebaseApp = getFirebaseApp()
    if (firebaseApp) {
      auth = getAuth(firebaseApp)
    }
  }
  return auth
}

// For backward compatibility - these will be null if not configured
export { app, db, storage, auth }
