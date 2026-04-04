import {
  GOOGLE_EXPO_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID
} from '@env';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { makeRedirectUri } from 'expo-auth-session';

// Exported client IDs for use in components/hooks
// Exported client IDs with fallbacks to avoid undefined crashes
export const GOOGLE_CLIENT_IDS = {
  expoClientId: (GOOGLE_EXPO_CLIENT_ID || '').trim(),
  iosClientId: ((GOOGLE_IOS_CLIENT_ID || '').trim()),
  androidClientId: ((GOOGLE_ANDROID_CLIENT_ID || '').trim()),
  webClientId: ((GOOGLE_WEB_CLIENT_ID || GOOGLE_EXPO_CLIENT_ID || '').trim()),
  clientId: ((GOOGLE_EXPO_CLIENT_ID || GOOGLE_WEB_CLIENT_ID || '').trim()),
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

const baseRequestConfig = {
  scopes: ['openid', 'profile', 'email'],
  selectAccount: true,
};

const getNativeRedirectScheme = (clientId) => {
  const normalized = (clientId || '').trim();
  if (!normalized) return null;

  const suffix = '.apps.googleusercontent.com';
  if (!normalized.endsWith(suffix)) return null;

  const prefix = normalized.slice(0, -suffix.length);
  return `com.googleusercontent.apps.${prefix}`;
};

export const getGoogleAuthSetup = () => {
  const isExpoGo = Constants.appOwnership === 'expo';
  const nativeClientId = Platform.OS === 'ios' ? GOOGLE_CLIENT_IDS.iosClientId : GOOGLE_CLIENT_IDS.androidClientId;
  const proxyClientId = GOOGLE_CLIENT_IDS.expoClientId || GOOGLE_CLIENT_IDS.webClientId;
  const shouldUseProxy = false;
  const fallbackClientId = proxyClientId || nativeClientId || GOOGLE_CLIENT_IDS.clientId || 'MISSING_GOOGLE_CLIENT_ID';
  const nativeRedirectScheme = getNativeRedirectScheme(nativeClientId) || 'expenzo';
  const safeRequestConfig = {
    ...baseRequestConfig,
    redirectUri: makeRedirectUri({
      native: `${nativeRedirectScheme}:/oauthredirect`,
    }),
    expoClientId: GOOGLE_CLIENT_IDS.expoClientId || proxyClientId || fallbackClientId,
    iosClientId: GOOGLE_CLIENT_IDS.iosClientId || fallbackClientId,
    androidClientId: GOOGLE_CLIENT_IDS.androidClientId || fallbackClientId,
    webClientId: GOOGLE_CLIENT_IDS.webClientId || proxyClientId || fallbackClientId,
  };

  if (__DEV__) {
    console.log('[GoogleAuth] Native platform config', {
      platform: Platform.OS,
      appOwnership: Constants.appOwnership,
      nativeClientId,
      redirectUri: safeRequestConfig.redirectUri,
      nativeRedirectScheme,
      hasWebClientId: !!GOOGLE_CLIENT_IDS.webClientId,
    });
  }

  if (isExpoGo) {
    return {
      isConfigured: false,
      requestConfig: safeRequestConfig,
      promptOptions: undefined,
      reason: 'Google sign-in is not supported in Expo Go. Use an Android/iOS development build',
    };
  }

  if (shouldUseProxy && !proxyClientId) {
    return {
      isConfigured: false,
      requestConfig: safeRequestConfig,
      promptOptions: { useProxy: true },
      reason: 'Missing GOOGLE_EXPO_CLIENT_ID or GOOGLE_WEB_CLIENT_ID',
    };
  }

  if (!nativeClientId) {
    return {
      isConfigured: false,
      requestConfig: safeRequestConfig,
      promptOptions: undefined,
      reason: Platform.OS === 'ios'
        ? 'Missing GOOGLE_IOS_CLIENT_ID'
        : 'Missing GOOGLE_ANDROID_CLIENT_ID',
    };
  }

  if (shouldUseProxy) {
    return {
      isConfigured: true,
      requestConfig: safeRequestConfig,
      promptOptions: { useProxy: true },
      reason: null,
    };
  }

  return {
    isConfigured: true,
    requestConfig: safeRequestConfig,
    promptOptions: undefined,
    reason: null,
  };
};

export const hasValidGoogleClientId = (request) => {
  if (!request?.url) return false;
  try {
    const url = new URL(request.url);
    return !!url.searchParams.get('client_id');
  } catch (error) {
    const match = request.url.match(/[?&]client_id=([^&]+)/);
    return !!(match && match[1]);
  }
};
