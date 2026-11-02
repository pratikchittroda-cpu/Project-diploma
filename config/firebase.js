import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SERVER_FEATURES_ENABLED } from './releaseFeatures';
import {
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID,
  FIREBASE_MEASUREMENT_ID
} from '@env';

// Public Web Firebase configuration also supports native JS Auth/Firestore.
const publicValue = value => typeof value === 'string' ? value.trim() : undefined;
const firebaseConfig = {
  apiKey: publicValue(FIREBASE_API_KEY),
  authDomain: publicValue(FIREBASE_AUTH_DOMAIN),
  projectId: publicValue(FIREBASE_PROJECT_ID),
  storageBucket: publicValue(FIREBASE_STORAGE_BUCKET),
  messagingSenderId: publicValue(FIREBASE_MESSAGING_SENDER_ID),
  appId: publicValue(FIREBASE_APP_ID),
  measurementId: publicValue(FIREBASE_MEASUREMENT_ID)
};

// An unconfigured checkout may bundle, but cannot silently connect to a fabricated project.
export const firebaseConfigured = ['apiKey', 'authDomain', 'projectId', 'messagingSenderId', 'appId']
  .every(key => typeof firebaseConfig[key] === 'string' && firebaseConfig[key].trim().length > 0);
const app = firebaseConfigured ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null;

// Initialize Firebase Auth with AsyncStorage persistence
let auth = null;
if (app) {
  try {
    auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch (error) {
    // Fast Refresh may evaluate this module after Auth was already initialized.
    if (error.code !== 'auth/already-initialized') throw error;
    auth = getAuth(app);
  }
}

// Initialize Firestore
const db = app ? getFirestore(app) : null;

// The core release has no upload/Storage flow. Keep the dormant export for
// server-feature callers without creating an unused instance in core builds.
const storage = app && SERVER_FEATURES_ENABLED ? getStorage(app) : null;

export { auth, db, storage };
export default app;
