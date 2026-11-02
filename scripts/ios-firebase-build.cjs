// Xcode build phase: validate before copying the provisioned file into the app.
// Release archives cannot succeed merely because a stale plist remains in DerivedData.
const fs = require('node:fs');
const path = require('node:path');
const { validateReleaseConfig } = require('./validate-release-config.cjs');
const { nativeFirebaseConfig } = require('./native-firebase-config.cjs');
const { verifyIosNativeSetup } = require('./sync-ios.cjs');

function prepareIosFirebase(env = process.env, io = fs) {
  const production = !env.CONFIGURATION?.includes('Debug');
  validateReleaseConfig(env, { production, platform: 'ios' });
  verifyIosNativeSetup();
  const native = nativeFirebaseConfig(env, { platform: 'ios' });
  if (env.GOOGLE_SERVICES_PLIST && native.issues.length) throw new Error(native.issues.join('\n'));
  if (!env.TARGET_BUILD_DIR || !env.UNLOCALIZED_RESOURCES_FOLDER_PATH) throw new Error('Run native Firebase preparation from the Xcode build phase.');
  const destination = path.join(env.TARGET_BUILD_DIR, env.UNLOCALIZED_RESOURCES_FOLDER_PATH, 'GoogleService-Info.plist');
  if (native.files.ios) {
    io.mkdirSync(path.dirname(destination), { recursive: true });
    io.copyFileSync(native.files.ios, destination);
  } else {
    io.rmSync(destination, { force: true });
    console.warn('Native Firebase is not configured; backend services are unsupported in this development build.');
  }
}

if (require.main === module) {
  try { prepareIosFirebase(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { prepareIosFirebase };
