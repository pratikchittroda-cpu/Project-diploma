// The core release uses the Firebase JS SDK for Auth and Firestore. RNFirebase's
// App Check TurboModule asks the native Firebase SDK for the default app while
// React Native is creating its module registry, so linking it without a native
// Firebase configuration crashes the app before the JS error boundary mounts.
//
// EAS file environment variables are paths to the reviewed native Firebase
// configuration. Keep the native modules available only for those builds.
const hasNativeFile = name => typeof process.env[name] === 'string' && process.env[name].trim();
const disabledPlatforms = {
  ...(hasNativeFile('GOOGLE_SERVICES_JSON') ? {} : { android: null }),
  ...(hasNativeFile('GOOGLE_SERVICES_PLIST') ? {} : { ios: null }),
};
const nativeFirebaseConfigured = Object.keys(disabledPlatforms).length === 0;

module.exports = {
  dependencies: nativeFirebaseConfigured ? {} : {
    '@react-native-firebase/app': { platforms: disabledPlatforms },
    '@react-native-firebase/app-check': { platforms: disabledPlatforms },
  },
};
