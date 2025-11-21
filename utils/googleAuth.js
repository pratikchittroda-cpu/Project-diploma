import * as Google from 'expo-auth-session/providers/google';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { setDoc, doc, getDoc } from 'firebase/firestore';

// You must provide your own client IDs from Google Cloud Console
export const GOOGLE_CLIENT_IDS = {
  expoClientId: 'YOUR_EXPO_CLIENT_ID.apps.googleusercontent.com',
  iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
  androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
  webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
};

export async function signInWithGoogleAsync(setAlert, navigation) {
  try {
    // Start Google Auth flow
    const [, , promptAsync] = Google.useAuthRequest({
      expoClientId: GOOGLE_CLIENT_IDS.expoClientId,
      iosClientId: GOOGLE_CLIENT_IDS.iosClientId,
      androidClientId: GOOGLE_CLIENT_IDS.androidClientId,
      webClientId: GOOGLE_CLIENT_IDS.webClientId,
    });

    const result = await promptAsync();

    if (result.type === 'success') {
      const { id_token } = result.params;
      const credential = GoogleAuthProvider.credential(id_token);
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;

      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        // If not, create user in Firestore
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          phone: user.phoneNumber || '',
          createdAt: new Date().toISOString(),
          provider: 'google',
        });
      }
      setAlert({
        visible: true,
        title: 'Success',
        message: 'Logged in with Google!',
        type: 'success',
      });
      setTimeout(() => {
        setAlert({ visible: false });
        navigation.replace('MainApp');
      }, 1200);
    } else {
      setAlert({
        visible: true,
        title: 'Cancelled',
        message: 'Google sign-in was cancelled.',
        type: 'info',
      });
    }
  } catch (error) {
    setAlert({
      visible: true,
      title: 'Error',
      message: error.message,
      type: 'error',
    });
  }
} 