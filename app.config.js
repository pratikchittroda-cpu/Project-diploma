const { iosGoogleScheme } = require('./scripts/public-env.cjs');
const { validateReleaseConfig, nativeReleaseConfig } = require('./scripts/validate-release-config.cjs');

module.exports = ({ config }) => {
  validateReleaseConfig();
  const iosUrlScheme = iosGoogleScheme();
  const native = nativeReleaseConfig();
  // Explicit but invalid native files must not silently become an unconfigured build.
  if (native.issues.length) throw new Error(native.issues.join('\n'));
  const googlePlugins = iosUrlScheme
    ? [['@react-native-google-signin/google-signin', { iosUrlScheme }]]
    : [];
  // No native Firebase/App Check setup is injected for the JS Auth/Firestore core.
  // Android Google sign-in autolinks; iOS keeps its supplied public OAuth scheme.
  const hasNativeIdentity = Object.keys(native.identities).length > 0;
  const firebasePlugins = hasNativeIdentity
    ? [['@react-native-firebase/app', { ios: { disableSPM: true } }], '@react-native-firebase/app-check', './scripts/with-native-app-check.cjs']
    : [];
  return {
    ...config,
    android: { ...config.android, ...(native.files.android ? { googleServicesFile: native.files.android } : {}) },
    ios: { ...config.ios, ...(native.files.ios ? { googleServicesFile: native.files.ios } : {}) },
    extra: { ...config.extra, ...(hasNativeIdentity ? { nativeAppCheck: native.identities } : {}) },
    plugins: [...(config.plugins || []), ...googlePlugins, ...firebasePlugins],
  };
};
