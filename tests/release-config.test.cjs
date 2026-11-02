const test = require('node:test');
const assert = require('node:assert/strict');
const { transformSync } = require('@babel/core');
const { iosGoogleScheme, PUBLIC_ENV_NAMES } = require('../scripts/public-env.cjs');
const release = require('../scripts/validate-release-config.cjs');
const plist = require('@expo/plist').default;
const { nativeFirebaseConfig } = require('../scripts/native-firebase-config.cjs');
const { applyIosPublicConfig } = require('../scripts/sync-ios.cjs');

const publicKeyFixture = `AIza${'A'.repeat(35)}`;
const androidFixture = { project_info: { project_id: 'expenzo-fixture', project_number: '123456789012' }, client: [{
  client_info: { android_client_info: { package_name: 'com.nustudent.expenzo' }, mobilesdk_app_id: '1:123456789012:android:abc' },
  api_key: [{ current_key: publicKeyFixture }],
}] };
const iosFixture = { PROJECT_ID: 'expenzo-fixture', GCM_SENDER_ID: '123456789012', GOOGLE_APP_ID: '1:123456789012:ios:abc', BUNDLE_ID: 'com.nustudent.expenzo', API_KEY: publicKeyFixture };
const nativeConfigOptions = {
  isFile: () => true,
  readFile: file => file.endsWith('.json') ? JSON.stringify(androidFixture) : plist.build(iosFixture),
};
// Dormant backend contract: these tests deliberately opt into requirements that
// must not be imposed on the shipped Auth/Firestore-only core release.
const configurationIssues = (env, options) => release.configurationIssues(env, { serverFeaturesEnabled: true, nativeConfigOptions, ...options });
const validateReleaseConfig = (env, options) => release.validateReleaseConfig(env, { serverFeaturesEnabled: true, nativeConfigOptions, ...options });

const testConfig = () => ({
  FIREBASE_API_KEY: publicKeyFixture, FIREBASE_AUTH_DOMAIN: 'expenzo-fixture.firebaseapp.com',
  FIREBASE_PROJECT_ID: 'expenzo-fixture', FIREBASE_STORAGE_BUCKET: 'expenzo-fixture.appspot.com',
  FIREBASE_MESSAGING_SENDER_ID: '123456789012', FIREBASE_APP_ID: '1:123456789012:android:abc',
  GOOGLE_WEB_CLIENT_ID: '123-web.apps.googleusercontent.com',
  GOOGLE_IOS_CLIENT_ID: '123-ios.apps.googleusercontent.com',
  SUPPORT_EMAIL: 'support@expenzo.app', LEGAL_ENTITY_NAME: 'Synthetic test entity',
  DATA_RETENTION_SUMMARY: 'Test only', AI_PROVIDER_NAME: 'Test only', AI_PROVIDER_RETENTION_SUMMARY: 'Test only',
  API_BASE_URL: 'https://test-service.cloudfunctions.net/ai',
  PRIVACY_POLICY_URL: 'https://test-service.web.app/privacy',
  ACCOUNT_DELETION_URL: 'https://test-service.web.app/delete',
  GOOGLE_SERVICES_JSON: '/synthetic-fixture/google-services.json',
  GOOGLE_SERVICES_PLIST: '/synthetic-fixture/GoogleService-Info.plist',
});

test('server-feature production fails closed when public/legal/AI/retention configuration is absent', () => {
  assert.throws(() => validateReleaseConfig({}, { production: true }), /LEGAL_ENTITY_NAME/);
  assert.deepEqual(configurationIssues(testConfig()), []);
  for (const name of ['API_BASE_URL', 'PRIVACY_POLICY_URL', 'ACCOUNT_DELETION_URL', 'SUPPORT_EMAIL', 'AI_PROVIDER_NAME', 'AI_PROVIDER_RETENTION_SUMMARY',
    'FIREBASE_STORAGE_BUCKET', 'GOOGLE_WEB_CLIENT_ID', 'GOOGLE_IOS_CLIENT_ID']) {
    const env = testConfig(); delete env[name];
    assert.throws(() => validateReleaseConfig(env, { production: true }));
  }
});

test('development remains bundleable but reports missing configuration', () => {
  const warnings = [];
  const issues = validateReleaseConfig({}, { production: false, warn: value => warnings.push(value) });
  assert.ok(issues.length > 0);
  assert.match(warnings[0], /cannot be released/);
});

test('release rejects placeholder or unsafe resource URLs', () => {
  for (const value of ['http://site.com', 'https://example.com/privacy', 'https://localhost/x', 'https://a:b@site.com', 'https://127.0.0.1']) {
    assert.ok(configurationIssues({ ...testConfig(), PRIVACY_POLICY_URL: value }).some(issue => issue.startsWith('PRIVACY_POLICY_URL')));
  }
});

test('iOS scheme is derived only from the public iOS OAuth client', () => {
  assert.equal(iosGoogleScheme({}), null);
  assert.equal(iosGoogleScheme(testConfig()), 'com.googleusercontent.apps.123-ios');
  assert.throws(() => iosGoogleScheme({ GOOGLE_IOS_CLIENT_ID: 'javascript:bad' }));
  const android = testConfig(); delete android.GOOGLE_IOS_CLIENT_ID;
  assert.deepEqual(configurationIssues(android, { platform: 'android' }), []);
});

test('manual iOS sync preserves native customizations and replaces stale Google schemes', () => {
  const original = { customNativeSetting: true, NSCameraUsageDescription: 'obsolete', CFBundleURLTypes: [
    { CFBundleURLSchemes: ['expenzo', 'com.googleusercontent.apps.stale'] },
  ] };
  const updated = applyIosPublicConfig(original, testConfig());
  assert.equal(updated.customNativeSetting, true);
  assert.equal(updated.NSCameraUsageDescription, undefined);
  assert.deepEqual(updated.CFBundleURLTypes.flatMap(type => type.CFBundleURLSchemes), ['expenzo', 'com.googleusercontent.apps.123-ios']);
  assert.ok(original.NSCameraUsageDescription, 'pure configuration transform leaves the original intact');
  assert.equal(updated.FirebaseAppCheckTokenAutoRefreshEnabled, false);
  assert.equal(updated.FirebaseDataCollectionDefaultEnabled, false);
});

function compile(source) {
  return transformSync(source, {
    filename: 'release-env-fixture.js', configFile: false, babelrc: false,
    plugins: [[require('../scripts/babel-public-env.cjs'), { moduleName: '@env', path: '.env.disabled-test-fixture', allowUndefined: true }]],
  }).code;
}

test('Babel rejects provider imports AND the dotenv process.env bypass', () => {
  for (const name of ['NVIDIA_API_KEY', 'HUGGINGFACE_API_KEY', 'OPENAI_API_KEY', 'PRIVATE_KEY', 'GOOGLE_SERVICES_JSON', 'GOOGLE_SERVICES_PLIST',
    'FIREBASE_APP_CHECK_DEBUG_TOKEN', 'LEGAL_ENTITY_NAME', 'DATA_RETENTION_SUMMARY', 'AI_PROVIDER_NAME', 'AI_PROVIDER_RETENTION_SUMMARY']) {
    assert.ok(!PUBLIC_ENV_NAMES.includes(name));
    assert.throws(() => compile(`import { ${name} } from '@env'; console.log(${name});`), /allowlist/);
    assert.throws(() => compile(`console.log(process.env.${name});`), /allowlisted/);
  }
  assert.throws(() => compile('console.log(process.env[secretName]);'), /allowlisted/);
  assert.doesNotThrow(() => compile("import { API_BASE_URL } from '@env'; console.log(API_BASE_URL);"));
});

test('server-feature production requires the provisioned target platform file and validates its native identity', () => {
  for (const platform of ['android', 'ios']) {
    const env = testConfig();
    delete env[platform === 'android' ? 'GOOGLE_SERVICES_JSON' : 'GOOGLE_SERVICES_PLIST'];
    assert.throws(() => validateReleaseConfig(env, { production: true, platform }), /must point to/);
    assert.throws(() => validateReleaseConfig(testConfig(), { production: true, platform, nativeConfigOptions: { isFile: () => false } }), /existing, readable/);
  }
  const android = testConfig(); delete android.GOOGLE_SERVICES_PLIST;
  assert.deepEqual(configurationIssues(android, { platform: 'android' }), []);
  const ios = testConfig(); delete ios.GOOGLE_SERVICES_JSON;
  assert.deepEqual(configurationIssues(ios, { platform: 'ios' }), []);
  for (const key of ['FIREBASE_PROJECT_ID', 'FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_APP_ID']) {
    assert.ok(configurationIssues({ ...testConfig(), [key]: 'different' }).some(issue => issue.includes('native app identity')));
  }
});

test('native identity validation never exposes file contents, keys, or paths in diagnostics', () => {
  const secretLookingData = 'private-fixture-content';
  const result = nativeFirebaseConfig(testConfig(), { isFile: () => true, readFile: () => secretLookingData });
  assert.equal(result.issues.length, 2);
  assert.ok(!JSON.stringify(result.issues).includes(secretLookingData));
  assert.ok(!JSON.stringify(result.issues).includes('/synthetic-fixture'));
  assert.deepEqual(result.identities, {});
});

test('validated Expo identity includes only public identity fields, never file contents or API keys', () => {
  const result = nativeFirebaseConfig(testConfig(), nativeConfigOptions);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(Object.keys(result.identities.android).sort(), ['appId', 'applicationId', 'messagingSenderId', 'projectId']);
  assert.equal(result.identities.ios.applicationId, 'com.nustudent.expenzo');
  assert.ok(!JSON.stringify(result.identities).includes(publicKeyFixture));
});

test('no debug-attestation override is accepted even in development', () => {
  assert.throws(() => validateReleaseConfig({ ...testConfig(), FIREBASE_APP_CHECK_DEBUG_TOKEN: true }, { production: false }), /not supported/);
});

test('wrong package/bundle, missing API key, malformed structure and unsupported release targets fail closed', () => {
  for (const android of [null, [], { client: 'invalid' }, { ...androidFixture, client: [] },
    { ...androidFixture, client: [{ ...androidFixture.client[0], api_key: [] }] }]) {
    assert.ok(nativeFirebaseConfig(testConfig(), { platform: 'android', isFile: () => true, readFile: () => JSON.stringify(android) }).issues.length > 0);
  }
  for (const ios of [{ ...iosFixture, BUNDLE_ID: 'another.app' }, { ...iosFixture, API_KEY: '' }, { ...iosFixture, GOOGLE_APP_ID: '1:123456789012:web:abc' }]) {
    assert.ok(nativeFirebaseConfig(testConfig(), { platform: 'ios', isFile: () => true, readFile: () => plist.build(ios) }).issues.length > 0);
  }
  assert.throws(() => validateReleaseConfig(testConfig(), { production: true, platform: 'web' }), /android or ios/);
});
