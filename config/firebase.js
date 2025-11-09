import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your Firebase configuration
// Replace these values with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyCgV8bBb8T9StW4iCslNhGU3U-VZNKh-RQ",
  authDomain: "project1-7a465.firebaseapp.com",
  projectId: "project1-7a465",
  storageBucket: "project1-7a465.firebasestorage.app",
  messagingSenderId: "383550841233",
  appId: "1:383550841233:web:3f51f02af07c1e2f823a30",
  measurementId: "G-TK0T6YT5W7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with AsyncStorage persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize Firestore
const db = getFirestore(app);

// Initialize Storage
const storage = getStorage(app);

export { auth, db, storage };
export default app;