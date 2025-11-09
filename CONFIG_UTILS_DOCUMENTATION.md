# ⚙️ Configuration & Utils Documentation - Setup & Helper Functions

## 🎯 **What is Configuration?**
Configuration files contain settings and setup code that the app needs to work properly, like connecting to Firebase.

## 🎯 **What are Utils?**
Utils (utilities) are helper functions that perform common tasks throughout the app, like formatting currency or dates.

## 📁 **Config Folder Structure**
```
config/
└── 🔥 firebase.js              # Firebase connection setup
```

## 📁 **Utils Folder Structure**
```
utils/
└── 🔐 googleAuth.js            # Google authentication helper
```

## 📁 **Theme Folder Structure**
```
theme/
└── 🎨 colors.js                # Color definitions
```

## 🔥 **firebase.js - Firebase Configuration**

### **Purpose:**
This file sets up the connection between your app and Firebase services (authentication, database, storage).

### **What Firebase Provides:**
- **Authentication** - User login/logout/registration
- **Firestore Database** - Store user data, transactions, budgets
- **Storage** - Store files like profile pictures
- **Analytics** - Track app usage (optional)

### **Configuration Setup:**
```javascript
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your Firebase project configuration
// These values come from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyCgV8bBb8T9StW4iCslNhGU3U-VZNKh-RQ",
  authDomain: "project1-7a465.firebaseapp.com",
  projectId: "project1-7a465",
  storageBucket: "project1-7a465.firebasestorage.app",
  messagingSenderId: "383550841233",
  appId: "1:383550841233:web:3f51f02af07c1e2f823a30",
  measurementId: "G-TK0T6YT5W7"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Authentication with persistence
// This means users stay logged in even after closing the app
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize Firestore Database
const db = getFirestore(app);

// Initialize Storage for files
const storage = getStorage(app);

// Export for use in other files
export { auth, db, storage };
export default app;
```

### **How to Get Firebase Config:**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project or select existing one
3. Go to Project Settings → General
4. Scroll down to "Your apps" section
5. Click "Add app" → Web app
6. Copy the config object

### **What Each Service Does:**

#### **Firebase Auth (`auth`):**
```javascript
// Used in authService.js
import { auth } from '../config/firebase';

// Create account
await createUserWithEmailAndPassword(auth, email, password);

// Sign in
await signInWithEmailAndPassword(auth, email, password);

// Sign out
await signOut(auth);
```

#### **Firestore Database (`db`):**
```javascript
// Used in services for data storage
import { db } from '../config/firebase';

// Save data
await setDoc(doc(db, 'users', userId), userData);

// Get data
const userDoc = await getDoc(doc(db, 'users', userId));

// Query data
const transactions = await getDocs(collection(db, 'transactions'));
```

#### **Storage (`storage`):**
```javascript
// Used for file uploads (profile pictures, receipts)
import { storage } from '../config/firebase';

// Upload file
const storageRef = ref(storage, 'profiles/' + userId);
await uploadBytes(storageRef, file);
```

### **Security Rules:**
Firebase requires security rules to protect your data:

#### **Firestore Rules:**
```javascript
// In Firebase Console → Firestore → Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Transactions belong to specific users
    match /transactions/{transactionId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    // Budgets belong to specific users
    match /budgets/{budgetId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
  }
}
```

#### **Storage Rules:**
```javascript
// In Firebase Console → Storage → Rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Users can only access their own files
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 🔐 **googleAuth.js - Google Authentication Helper**

### **Purpose:**
Provides Google Sign-In functionality as an alternative to email/password authentication.

### **Setup Required:**
```bash
# Install Google Sign-In
npm install @react-native-google-signin/google-signin

# For Expo
expo install expo-auth-session expo-crypto
```

### **Configuration:**
```javascript
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: 'your-web-client-id.googleusercontent.com', // From Firebase
  offlineAccess: true,
  hostedDomain: '', // Optional
  forceCodeForRefreshToken: true,
});

export const googleSignIn = async () => {
  try {
    // Check if device supports Google Play
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    
    // Get user info from Google
    const { idToken } = await GoogleSignin.signIn();
    
    // Create Firebase credential
    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    
    // Sign in to Firebase with Google credential
    const userCredential = await auth().signInWithCredential(googleCredential);
    
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const googleSignOut = async () => {
  try {
    await GoogleSignin.signOut();
    await auth().signOut();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
```

### **Usage in Screens:**
```javascript
// In LoginScreen.js
import { googleSignIn } from '../utils/googleAuth';

const handleGoogleSignIn = async () => {
  setLoading(true);
  const result = await googleSignIn();
  
  if (result.success) {
    // User signed in successfully
    navigation.replace('Dashboard');
  } else {
    Alert.alert('Error', result.error);
  }
  setLoading(false);
};

// Add Google Sign-In button
<TouchableOpacity onPress={handleGoogleSignIn}>
  <Text>Sign in with Google</Text>
</TouchableOpacity>
```

## 🎨 **colors.js - Color Definitions**

### **Purpose:**
Centralized color definitions that can be used throughout the app for consistency.

### **Color Structure:**
```javascript
// Base color palette
export const colors = {
  // Primary brand colors
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',  // Main primary color
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },

  // Neutral colors
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },

  // Status colors
  success: {
    light: '#d1fae5',
    main: '#10b981',
    dark: '#047857',
  },
  
  error: {
    light: '#fee2e2',
    main: '#ef4444',
    dark: '#dc2626',
  },
  
  warning: {
    light: '#fef3c7',
    main: '#f59e0b',
    dark: '#d97706',
  },
  
  info: {
    light: '#dbeafe',
    main: '#3b82f6',
    dark: '#1d4ed8',
  },

  // Category colors for transactions
  categories: {
    food: '#ff9800',
    bills: '#607d8b',
    shopping: '#9c27b0',
    transport: '#2196f3',
    entertainment: '#ff5722',
    healthcare: '#4caf50',
    education: '#795548',
    business: '#34495e',
    gifts: '#e91e63',
    other: '#9e9e9e',
  },
};

// Theme-specific color combinations
export const lightTheme = {
  background: colors.neutral[50],
  surface: colors.neutral[100],
  text: colors.neutral[900],
  textSecondary: colors.neutral[600],
  border: colors.neutral[200],
  primary: colors.primary[500],
};

export const darkTheme = {
  background: colors.neutral[900],
  surface: colors.neutral[800],
  text: colors.neutral[50],
  textSecondary: colors.neutral[400],
  border: colors.neutral[700],
  primary: colors.primary[400],
};
```

### **Usage in Components:**
```javascript
// Import colors
import { colors, lightTheme, darkTheme } from '../theme/colors';

// Use in styles
const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral[50],
  },
  primaryButton: {
    backgroundColor: colors.primary[500],
  },
  successText: {
    color: colors.success.main,
  },
  categoryFood: {
    backgroundColor: colors.categories.food,
  },
});
```

## 🛠️ **Common Utility Functions**

### **Currency Formatting:**
```javascript
// utils/formatters.js
export const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

// Usage: formatCurrency(1234.56) → "$1,234.56"
```

### **Date Formatting:**
```javascript
export const formatDate = (date, format = 'short') => {
  const dateObj = new Date(date);
  
  switch (format) {
    case 'short':
      return dateObj.toLocaleDateString(); // "12/25/2024"
    case 'long':
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }); // "December 25, 2024"
    case 'time':
      return dateObj.toLocaleTimeString(); // "2:30:45 PM"
    default:
      return dateObj.toLocaleDateString();
  }
};
```

### **Validation Helpers:**
```javascript
// utils/validators.js
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password) => {
  return password.length >= 6;
};

export const validateAmount = (amount) => {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0;
};
```

### **Storage Helpers:**
```javascript
// utils/storage.js
import AsyncStorage from '@react-native-async-storage/async-storage';

export const storeData = async (key, value) => {
  try {
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(key, jsonValue);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getData = async (key) => {
  try {
    const jsonValue = await AsyncStorage.getItem(key);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (error) {
    return null;
  }
};
```

## 📱 **App.js & index.js - Entry Points**

### **index.js - React Native Entry Point:**
```javascript
// This is the very first file that runs
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Register the main App component
AppRegistry.registerComponent(appName, () => App);
```

### **App.js - Main App Component:**
```javascript
// Main app wrapper with providers
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AppNavigator from './navigation/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppNavigator />
      </ThemeProvider>
    </AuthProvider>
  );
}
```

### **What This Structure Does:**
1. **index.js** - Registers the app with React Native
2. **App.js** - Sets up global providers and navigation
3. **Providers** - Make auth and theme available everywhere
4. **AppNavigator** - Controls all screen navigation

This configuration and utilities setup provides the foundation that makes everything else in the app work smoothly and consistently.