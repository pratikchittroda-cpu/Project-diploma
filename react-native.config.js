// The core release uses the Firebase JS SDK for Auth and Firestore. On Android,
// RNFirebase's App Check TurboModule asks the native Firebase SDK for the default
// app while React Native initializes its package list, so linking it without
// google-services.json crashes the app before the JS error boundary mounts.
// On iOS, the native setup is guarded in AppDelegate.swift, but the native
// target requires the headers from Pods to compile.
const hasNativeFile = name => typeof process.env[name] === 'string' && process.env[name].trim();
const disabledPlatforms = {
  ...(hasNativeFile('GOOGLE_SERVICES_JSON') ? {} : { android: null }),
};
const nativeFirebaseConfigured = Object.keys(disabledPlatforms).length === 0;

module.exports = {
  dependencies: nativeFirebaseConfigured ? {} : {
    '@react-native-firebase/app': { platforms: disabledPlatforms },
    '@react-native-firebase/app-check': { platforms: disabledPlatforms },
  },
};
