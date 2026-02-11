import {
  GOOGLE_EXPO_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID
} from '@env';

// Exported client IDs for use in components/hooks
// Exported client IDs with fallbacks to avoid undefined crashes
export const GOOGLE_CLIENT_IDS = {
  expoClientId: GOOGLE_EXPO_CLIENT_ID || '',
  iosClientId: GOOGLE_IOS_CLIENT_ID || '',
  androidClientId: GOOGLE_ANDROID_CLIENT_ID || '',
  webClientId: GOOGLE_WEB_CLIENT_ID || '',
};

// Force cache bust: 2024-02-06T14:02:00
console.log('[GoogleAuth] Loaded IDs from environment');

// Validation for development
if (__DEV__) {
  Object.entries(GOOGLE_CLIENT_IDS).forEach(([key, value]) => {
    if (!value || value.includes('YOUR_')) {
      console.warn(`[GoogleAuth] ${key} is missing or has a placeholder value: "${value}"`);
    }
  });
}
