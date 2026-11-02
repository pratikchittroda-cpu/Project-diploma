import { Platform } from 'react-native';
import Constants from 'expo-constants';
import firebaseApp from '../config/firebase';
import { setBackendAppCheckTokenProvider } from '../services/backendClient';

let initialization;
let tokenRequest;

function failure(code, message) {
  return Object.assign(new Error(message), { code });
}

async function initializeNativeAppCheck() {
  const platform = Platform.OS;
  const expected = Constants.expoConfig?.extra?.nativeAppCheck?.[platform];
  if (!['android', 'ios'].includes(platform) || Constants.executionEnvironment === 'storeClient' || !expected || !firebaseApp) {
    throw failure('app-check/unsupported', 'This build does not support verified backend services. Use a configured native Expenzo build.');
  }
  const js = firebaseApp.options;
  if (!/^\d+$/.test(js.messagingSenderId || '') || expected.projectId !== js.projectId || expected.messagingSenderId !== js.messagingSenderId ||
      !new RegExp(`^1:${js.messagingSenderId}:${platform}:[a-fA-F0-9]+$`).test(expected.appId)) {
    throw failure('app-check/configuration-mismatch', 'Native and sign-in Firebase configuration must use the same project. Rebuild this app.');
  }

  let nativeApp;
  try {
    // Lazy imports preserve the JS Firebase development flow when native modules/config are absent.
    const { getApps, getApp } = require('@react-native-firebase/app');
    if (!getApps().some(app => app.name === '[DEFAULT]')) throw new Error('missing native app');
    nativeApp = getApp();
  } catch {
    throw failure('app-check/unsupported', 'Native Firebase is unavailable. Install a configured native Expenzo build.');
  }
  for (const key of ['projectId', 'messagingSenderId', 'appId']) {
    if (nativeApp?.options?.[key] !== expected[key]) {
      throw failure('app-check/configuration-mismatch', 'Native Firebase identity does not match this build. Rebuild this app.');
    }
  }
  try {
    const sdk = require('@react-native-firebase/app-check');
    const provider = new sdk.ReactNativeFirebaseAppCheckProvider();
    provider.configure({
      android: { provider: 'playIntegrity' },
      apple: { provider: 'appAttestWithDeviceCheckFallback' },
    });
    const appCheck = sdk.initializeAppCheck(nativeApp, { provider, isTokenAutoRefreshEnabled: false });
    // The version-checked install patch makes modular getToken await native initialization.
    return { sdk, appCheck };
  } catch {
    throw failure('app-check/unavailable', 'Device verification could not initialize. Please try again.');
  }
}

export async function getBackendAppCheckToken() {
  if (tokenRequest) return tokenRequest;
  tokenRequest = (async () => {
    if (!initialization) initialization = initializeNativeAppCheck();
    let initialized;
    try {
      initialized = await initialization;
    } catch (error) {
      initialization = undefined;
      throw error;
    }
    try {
      // Native SDK caches/refreshes its token. Never persist it in app storage or log SDK errors.
      const result = await initialized.sdk.getToken(initialized.appCheck, false);
      if (typeof result?.token !== 'string' || !result.token.trim() || /\s/.test(result.token)) throw new Error('empty token');
      return result.token;
    } catch (error) {
      // Keep the initialized provider. A later user request may retry token retrieval without reinitializing.
      if (error?.code === 'app-check/initialization-failed') initialization = undefined;
      throw failure('app-check/unavailable', 'Device verification failed. Check your connection and use a supported physical-device build, then try again.');
    }
  })();
  try { return await tokenRequest; } finally { tokenRequest = undefined; }
}

// Registration is synchronous and inert: no SDK import, attestation, timers, or network work at launch.
export function registerBackendAppCheck() {
  setBackendAppCheckTokenProvider(getBackendAppCheckToken);
}
