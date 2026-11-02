import { GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID } from '@env';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

let nativeModule;
let configured = false;
const publicId = (value) => typeof value === 'string' && value.endsWith('.apps.googleusercontent.com') && !value.includes('YOUR_');

export const getGoogleAuthSetup = () => {
  if (Constants.appOwnership === 'expo') return { isConfigured: false, reason: 'Google sign-in requires an installed development or release build.' };
  if (!['android', 'ios'].includes(Platform.OS)) return { isConfigured: false, reason: 'Google sign-in is available in the Android and iOS app.' };
  if (!publicId(GOOGLE_WEB_CLIENT_ID) || (Platform.OS === 'ios' && !publicId(GOOGLE_IOS_CLIENT_ID))) {
    return { isConfigured: false, reason: 'Google sign-in is not configured for this build. You can use email and password.' };
  }
  try {
    // Load lazily so an unconfigured build offers email login without a native-module crash.
    nativeModule = nativeModule || require('@react-native-google-signin/google-signin');
    if (!configured) {
      nativeModule.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID.trim(),
        ...(Platform.OS === 'ios' ? { iosClientId: GOOGLE_IOS_CLIENT_ID.trim() } : {}) });
      configured = true;
    }
    return { isConfigured: true, reason: null };
  } catch (_) {
    return { isConfigured: false, reason: 'Native Google sign-in is unavailable in this build. Use email and password.' };
  }
};

export const signInToGoogle = async () => {
  const setup = getGoogleAuthSetup();
  if (!setup.isConfigured) throw new Error(setup.reason);
  const { GoogleSignin, statusCodes } = nativeModule;
  try {
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') return null;
    const token = response.data?.idToken || response.idToken;
    if (!token) throw new Error('Google did not return an identity token. Check the native OAuth configuration.');
    return token;
  } catch (error) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) return null;
    throw new Error('Google sign-in failed. Check your connection and try again, or use email and password.');
  }
};

export const signOutOfGoogle = async () => {
  if (nativeModule) {
    try { await nativeModule.GoogleSignin.signOut(); } catch (_) { /* Firebase sign-out remains authoritative. */ }
  }
};
