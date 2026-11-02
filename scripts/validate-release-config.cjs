const { iosGoogleScheme } = require('./public-env.cjs');
const { nativeFirebaseConfig } = require('./native-firebase-config.cjs');

const GOOGLE_CLIENT_NAMES = ['GOOGLE_WEB_CLIENT_ID', 'GOOGLE_IOS_CLIENT_ID', 'GOOGLE_ANDROID_CLIENT_ID'];
const NATIVE_FILE_NAMES = { android: 'GOOGLE_SERVICES_JSON', ios: 'GOOGLE_SERVICES_PLIST' };
const value = (env, name) => typeof env[name] === 'string' ? env[name].trim() : '';
const supplied = (env, name) => env[name] != null && (typeof env[name] !== 'string' || Boolean(env[name].trim()));

function publicHostname(hostname) {
  const host = hostname.toLowerCase();
  return host.length <= 253 && host.split('.').length >= 2 &&
    host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) &&
    /\.[a-z][a-z0-9-]+$/.test(host) &&
    !/(^|\.)(localhost|example|invalid|test|local|internal|lan)$/.test(host) &&
    !/(^|\.)example\.(com|org|net)$/.test(host);
}

// Core builds have no native App Check dependency. Validate every file that is
// supplied, including a non-target platform file, without requiring absent ones.
function nativeReleaseConfig(env = process.env, { serverFeaturesEnabled = false, platform = env.EAS_BUILD_PLATFORM, nativeConfigOptions } = {}) {
  const result = { identities: {}, files: {}, issues: [] };
  if (serverFeaturesEnabled && platform && !['android', 'ios'].includes(platform)) {
    result.issues.push('Native App Check release targets must be android or ios');
  }
  const platforms = Object.keys(NATIVE_FILE_NAMES).filter(os =>
    supplied(env, NATIVE_FILE_NAMES[os]) || (serverFeaturesEnabled && (!platform || platform === os)));
  const normalizedEnv = Object.fromEntries(Object.entries(env).map(([name, raw]) => [name, typeof raw === 'string' ? raw.trim() : raw]));
  for (const os of platforms) {
    const name = NATIVE_FILE_NAMES[os];
    if (supplied(env, name) && typeof env[name] !== 'string') {
      result.issues.push(`${name} must be an existing, readable native Firebase configuration file`);
      continue;
    }
    const native = nativeFirebaseConfig(normalizedEnv, { ...nativeConfigOptions, platform: os });
    Object.assign(result.identities, native.identities);
    Object.assign(result.files, native.files);
    result.issues.push(...native.issues);
  }
  return result;
}

// The shipped release is Auth/Firestore only. Backend requirements are opt-in;
// this checks configuration, not deployment, OAuth provisioning or store approval.
function configurationIssues(env = process.env, { serverFeaturesEnabled = false, platform = env.EAS_BUILD_PLATFORM, nativeConfigOptions } = {}) {
  const issues = [];
  const required = [
    'FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID',
    'FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_APP_ID', 'SUPPORT_EMAIL',
    // Build-time attestation fields: these are deliberately NOT client allowlisted.
    'LEGAL_ENTITY_NAME', 'DATA_RETENTION_SUMMARY',
  ];
  if (serverFeaturesEnabled) required.push('FIREBASE_STORAGE_BUCKET', 'AI_PROVIDER_NAME', 'AI_PROVIDER_RETENTION_SUMMARY');
  // With no OAuth IDs, the existing runtime explicitly offers email/password
  // only. A supplied Google configuration must be complete for its build target.
  if (serverFeaturesEnabled || GOOGLE_CLIENT_NAMES.some(name => supplied(env, name))) {
    required.push('GOOGLE_WEB_CLIENT_ID');
    if (platform !== 'android') required.push('GOOGLE_IOS_CLIENT_ID');
  }
  for (const name of required) {
    if (!value(env, name) || /^(TODO|TBD|replace|your[_ -]|<)/i.test(value(env, name))) issues.push(`${name} is required`);
  }
  const formats = {
    FIREBASE_API_KEY: [/^AIza[0-9A-Za-z_-]{35}$/, 'must be a public Firebase Web API key'],
    FIREBASE_PROJECT_ID: [/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/, 'must be a valid Firebase project ID'],
    FIREBASE_MESSAGING_SENDER_ID: [/^[1-9]\d{5,19}$/, 'must be a numeric Firebase project/sender ID'],
    FIREBASE_APP_ID: [/^1:[1-9]\d{5,19}:(web|android|ios):[a-fA-F0-9]+$/, 'must be a public Firebase app ID'],
  };
  for (const [name, [format, message]] of Object.entries(formats)) {
    if (supplied(env, name) && !format.test(value(env, name))) issues.push(`${name} ${message}`);
  }
  if (supplied(env, 'FIREBASE_AUTH_DOMAIN') && !publicHostname(value(env, 'FIREBASE_AUTH_DOMAIN'))) {
    issues.push('FIREBASE_AUTH_DOMAIN must be a public auth hostname without a URL scheme, port or path');
  }
  const appIdSender = value(env, 'FIREBASE_APP_ID').split(':')[1];
  if (appIdSender && value(env, 'FIREBASE_MESSAGING_SENDER_ID') && appIdSender !== value(env, 'FIREBASE_MESSAGING_SENDER_ID')) {
    issues.push('FIREBASE_APP_ID must match FIREBASE_MESSAGING_SENDER_ID');
  }
  for (const name of ['PRIVACY_POLICY_URL', 'ACCOUNT_DELETION_URL', ...(serverFeaturesEnabled ? ['API_BASE_URL'] : []), ...(supplied(env, 'AI_API_BASE_URL') ? ['AI_API_BASE_URL'] : [])]) {
    try {
      const url = new URL(value(env, name));
      if (url.protocol !== 'https:' || url.username || url.password || !publicHostname(url.hostname)) throw new Error();
      if (name === 'AI_API_BASE_URL' && (url.search || url.hash || /\s/.test(value(env, name)))) throw new Error();
    } catch { issues.push(`${name} must be a real public HTTPS URL`); }
  }
  if (supplied(env, 'SUPPORT_EMAIL') && (!/^[^\s@]+@[^\s@]+$/.test(value(env, 'SUPPORT_EMAIL')) ||
      !publicHostname(value(env, 'SUPPORT_EMAIL').split('@')[1] || ''))) issues.push('SUPPORT_EMAIL must be a valid public email address');
  for (const name of GOOGLE_CLIENT_NAMES) {
    if (supplied(env, name) && !/^\d+-[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/.test(value(env, name))) {
      const type = name === 'GOOGLE_WEB_CLIENT_ID' ? 'Web' : name === 'GOOGLE_IOS_CLIENT_ID' ? 'iOS' : 'Android';
      issues.push(`${name} must be a public ${type} OAuth client ID`);
    }
  }
  if (typeof env.GOOGLE_IOS_CLIENT_ID === 'string') {
    try { iosGoogleScheme(env); } catch (error) { if (!issues.some(issue => issue.startsWith('GOOGLE_IOS_CLIENT_ID'))) issues.push(error.message); }
  }
  issues.push(...nativeReleaseConfig(env, { serverFeaturesEnabled, platform, nativeConfigOptions }).issues);
  // Never build a debug-attestation bypass, including on developer machines.
  if (env.FIREBASE_APP_CHECK_DEBUG_TOKEN) issues.push('Debug App Check tokens are not supported by this app');
  return issues;
}

function validateReleaseConfig(env = process.env, { production = env.APP_VARIANT === 'production' || env.EAS_BUILD_PROFILE === 'production', serverFeaturesEnabled = false, platform, warn = console.warn, nativeConfigOptions } = {}) {
  if (env.FIREBASE_APP_CHECK_DEBUG_TOKEN) throw new Error('Debug App Check tokens are not supported by this app');
  const issues = configurationIssues(env, { serverFeaturesEnabled, platform, nativeConfigOptions });
  if (issues.length) {
    const message = `${serverFeaturesEnabled ? 'Server-feature' : 'Core'} release configuration incomplete:\n- ${issues.join('\n- ')}`;
    if (production) throw new Error(message);
    warn(`${message}\nDevelopment/test bundling is allowed; this configuration cannot be released.`);
  }
  return issues;
}

if (require.main === module) {
  try {
    validateReleaseConfig(process.env, {
      production: process.argv.includes('--production') || process.env.APP_VARIANT === 'production' || process.env.EAS_BUILD_PROFILE === 'production',
      serverFeaturesEnabled: process.argv.includes('--server-features'),
    });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { configurationIssues, validateReleaseConfig, nativeReleaseConfig };
