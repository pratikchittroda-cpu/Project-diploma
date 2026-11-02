const PUBLIC_ENV_NAMES = Object.freeze([
  'FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET', 'FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_APP_ID',
  'FIREBASE_MEASUREMENT_ID', 'GOOGLE_WEB_CLIENT_ID', 'GOOGLE_IOS_CLIENT_ID',
  'GOOGLE_ANDROID_CLIENT_ID', 'API_BASE_URL', 'AI_API_BASE_URL', 'PRIVACY_POLICY_URL',
  'ACCOUNT_DELETION_URL', 'SUPPORT_EMAIL',
]);

// Native file paths stay build-only: the app receives only validated public identity fields.
const NATIVE_FIREBASE_FILE_ENV_NAMES = Object.freeze(['GOOGLE_SERVICES_JSON', 'GOOGLE_SERVICES_PLIST']);

function iosGoogleScheme(env = process.env) {
  const id = (env.GOOGLE_IOS_CLIENT_ID || '').trim();
  if (!id) return null;
  if (!/^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/.test(id)) {
    throw new Error('GOOGLE_IOS_CLIENT_ID must be a public iOS OAuth client ID.');
  }
  return `com.googleusercontent.apps.${id.replace('.apps.googleusercontent.com', '')}`;
}

module.exports = { PUBLIC_ENV_NAMES, NATIVE_FIREBASE_FILE_ENV_NAMES, iosGoogleScheme };
