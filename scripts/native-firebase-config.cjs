const fs = require('node:fs');
const path = require('node:path');
const plist = require('@expo/plist').default;

const ROOT = path.resolve(__dirname, '..');
const expo = require('../app.json').expo;
const IDS = { android: expo.android.package, ios: expo.ios.bundleIdentifier };

function nativeFirebaseConfig(env = process.env, { platform, readFile = fs.readFileSync, isFile = file => fs.statSync(file).isFile() } = {}) {
  const identities = {};
  const files = {};
  const issues = [];
  if (platform && !['android', 'ios'].includes(platform)) issues.push('Native App Check release targets must be android or ios');
  for (const os of platform ? [platform] : ['android', 'ios']) {
    if (!IDS[os]) continue;
    const variable = os === 'android' ? 'GOOGLE_SERVICES_JSON' : 'GOOGLE_SERVICES_PLIST';
    const value = env[variable]?.trim();
    if (!value) { issues.push(`${variable} must point to the provisioned native Firebase configuration file`); continue; }
    let data;
    try {
      files[os] = path.resolve(ROOT, value);
      if (!isFile(files[os])) throw new Error();
      // These files contain public native identifiers. Never emit file contents or keys in errors.
      const source = readFile(files[os], 'utf8');
      data = os === 'android' ? JSON.parse(source) : plist.parse(source);
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    } catch {
      delete files[os];
      issues.push(`${variable} must be an existing, readable native Firebase configuration file`);
      continue;
    }
    const client = os === 'android' && Array.isArray(data.client)
      ? data.client.find(item => item?.client_info?.android_client_info?.package_name === IDS.android)
      : null;
    const identity = os === 'android' ? {
      appId: client?.client_info?.mobilesdk_app_id,
      projectId: data.project_info?.project_id,
      messagingSenderId: String(data.project_info?.project_number || ''),
      applicationId: client?.client_info?.android_client_info?.package_name,
    } : {
      appId: data.GOOGLE_APP_ID,
      projectId: data.PROJECT_ID,
      messagingSenderId: String(data.GCM_SENDER_ID || ''),
      applicationId: data.BUNDLE_ID,
    };
    const validIdentity = identity.applicationId === IDS[os] &&
      identity.projectId === env.FIREBASE_PROJECT_ID &&
      identity.messagingSenderId === env.FIREBASE_MESSAGING_SENDER_ID &&
      /^\d+$/.test(identity.messagingSenderId) &&
      new RegExp(`^1:${identity.messagingSenderId}:${os}:[a-fA-F0-9]+$`).test(identity.appId || '') &&
      new RegExp(`^1:${identity.messagingSenderId}:(web|android|ios):[a-fA-F0-9]+$`).test(env.FIREBASE_APP_ID || '');
    const hasPublicKey = os === 'android'
      ? Array.isArray(client?.api_key) && client.api_key.some(key => typeof key?.current_key === 'string' && key.current_key.trim())
      : typeof data.API_KEY === 'string' && data.API_KEY.trim();
    if (!validIdentity || !hasPublicKey) {
      issues.push(`${variable} must contain the ${IDS[os]} native app identity and match the JS Firebase project/sender`);
      delete files[os];
      continue;
    }
    identities[os] = identity;
  }
  return { identities, files, issues };
}

module.exports = { nativeFirebaseConfig, IDS };
