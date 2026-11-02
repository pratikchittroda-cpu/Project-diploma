const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { transformSync } = require('@babel/core');
const plist = require('@expo/plist').default;
const release = require('../scripts/validate-release-config.cjs');
const { iosGoogleScheme } = require('../scripts/public-env.cjs');

const root = path.resolve(__dirname, '..');
const coreConfig = () => ({
  FIREBASE_API_KEY: `AIza${'A'.repeat(35)}`,
  FIREBASE_AUTH_DOMAIN: 'expenzo-fixture.firebaseapp.com',
  FIREBASE_PROJECT_ID: 'expenzo-fixture',
  FIREBASE_MESSAGING_SENDER_ID: '123456789012',
  FIREBASE_APP_ID: '1:123456789012:web:abcdef1234567890',
  SUPPORT_EMAIL: 'support@expenzo.app', LEGAL_ENTITY_NAME: 'Fixture Publisher',
  DATA_RETENTION_SUMMARY: 'Records remain until the publisher processes an account deletion request.',
  PRIVACY_POLICY_URL: 'https://expenzo-fixture.web.app/privacy',
  ACCOUNT_DELETION_URL: 'https://expenzo-fixture.web.app/account-deletion',
});
const googleConfig = () => ({
  GOOGLE_WEB_CLIENT_ID: '123456789012-web.apps.googleusercontent.com',
  GOOGLE_IOS_CLIENT_ID: '123456789012-ios.apps.googleusercontent.com',
});
const configurationIssues = (env, options) => release.configurationIssues(env, { serverFeaturesEnabled: false, ...options });
const nativeConfigOptions = {
  isFile: () => true,
  readFile: file => {
    const env = coreConfig();
    return file.endsWith('.json') ? JSON.stringify({
      project_info: { project_id: env.FIREBASE_PROJECT_ID, project_number: env.FIREBASE_MESSAGING_SENDER_ID },
      client: [{ client_info: { android_client_info: { package_name: 'com.nustudent.expenzo' },
        mobilesdk_app_id: '1:123456789012:android:abcdef1234567890' }, api_key: [{ current_key: env.FIREBASE_API_KEY }] }],
    }) : plist.build({ PROJECT_ID: env.FIREBASE_PROJECT_ID, GCM_SENDER_ID: env.FIREBASE_MESSAGING_SENDER_ID,
      GOOGLE_APP_ID: '1:123456789012:ios:abcdef1234567890', BUNDLE_ID: 'com.nustudent.expenzo', API_KEY: env.FIREBASE_API_KEY });
  },
};

function load(file, mocks) {
  const { code } = transformSync(fs.readFileSync(path.join(root, file), 'utf8'), {
    filename: file, babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    throw new Error(`Unmocked import ${name} in ${file}`);
  } }, { filename: file });
  return module.exports;
}

function expoConfig(env, config, options = nativeConfigOptions) {
  const configure = load('app.config.js', {
    './scripts/public-env.cjs': { iosGoogleScheme: () => iosGoogleScheme(env) },
    './scripts/validate-release-config.cjs': {
      validateReleaseConfig: () => release.validateReleaseConfig(env, { nativeConfigOptions: options, warn() {} }),
      nativeReleaseConfig: () => release.nativeReleaseConfig(env, { nativeConfigOptions: options }),
    },
  });
  return configure({ config });
}

test('the default production contract accepts public WEB Firebase Auth/Firestore configuration alone', () => {
  for (const platform of [undefined, 'android', 'ios', 'web']) {
    assert.deepEqual(release.configurationIssues(coreConfig(), { platform }), []);
    assert.deepEqual(release.validateReleaseConfig(coreConfig(), { production: true, platform }), []);
  }
  const dormantRequirements = release.configurationIssues(coreConfig(), { serverFeaturesEnabled: true, platform: 'android' });
  for (const name of ['API_BASE_URL', 'FIREBASE_STORAGE_BUCKET', 'AI_PROVIDER_NAME', 'AI_PROVIDER_RETENTION_SUMMARY',
    'GOOGLE_WEB_CLIENT_ID', 'GOOGLE_SERVICES_JSON']) {
    assert.ok(dormantRequirements.some(issue => issue.startsWith(name)), name);
  }
});

test('core checks are side-effect-free without supplied native files and do not mutate public inputs', () => {
  const env = Object.freeze(coreConfig());
  const options = { nativeConfigOptions: { isFile() { throw new Error('Core must not access absent files'); } } };
  assert.deepEqual(configurationIssues(env, options), []);
  assert.deepEqual(release.nativeReleaseConfig(env, options), { identities: {}, files: {}, issues: [] });
});

test('the CLI defaults to production core checks and makes backend checks explicitly opt-in', () => {
  const env = { ...coreConfig(), EAS_BUILD_PLATFORM: 'android', EAS_BUILD_PROFILE: 'production' };
  const run = args => spawnSync(process.execPath, ['scripts/validate-release-config.cjs', ...args], { cwd: root, env, encoding: 'utf8' });
  const core = run([]);
  assert.equal(core.error, undefined);
  assert.equal(core.status, 0, core.stderr);
  assert.equal(core.stdout, '');
  assert.equal(core.stderr, '');
  const server = run(['--server-features']);
  assert.equal(server.status, 1);
  assert.match(server.stderr, /Server-feature release configuration incomplete/);
  assert.match(server.stderr, /API_BASE_URL/);
  delete env.LEGAL_ENTITY_NAME;
  const missing = run([]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Core release configuration incomplete/);
});

test('every Firebase, publisher, support, retention and public-policy input is required in core', () => {
  const required = Object.keys(coreConfig());
  for (const name of required) {
    for (const value of [undefined, '', '  ', 'TODO supply public value']) {
      const env = { ...coreConfig(), [name]: value };
      assert.ok(configurationIssues(env).some(issue => issue.startsWith(name)), name);
      assert.throws(() => release.validateReleaseConfig(env, { production: true }), /Core release configuration incomplete/);
    }
  }
  const missing = configurationIssues({});
  for (const name of ['API_BASE_URL', 'FIREBASE_STORAGE_BUCKET', 'GOOGLE_', 'AI_PROVIDER_', 'GOOGLE_SERVICES_']) {
    assert.ok(!missing.some(issue => issue.startsWith(name)), name);
  }
});

test('malformed Firebase identifiers and a sender/app mismatch fail the core contract', () => {
  const malformed = {
    FIREBASE_API_KEY: ['synthetic-public-key', 'AIza-short', 'a-private-provider-key', true],
    FIREBASE_AUTH_DOMAIN: ['https://expenzo.app', 'localhost', 'example.com', 'project.test', '127.0.0.1', 'expenzo.app/path', 'expenzo.app:443'],
    FIREBASE_PROJECT_ID: ['demo', 'Project-With-Capitals', 'bad/project', 'project with spaces'],
    FIREBASE_MESSAGING_SENDER_ID: ['not-numeric', '123', '000000000000'],
    FIREBASE_APP_ID: ['not-an-app-id', '1:123456789012:web:not-hex', '1:987654321012:web:abcdef'],
  };
  for (const [name, values] of Object.entries(malformed)) {
    for (const value of values) assert.ok(configurationIssues({ ...coreConfig(), [name]: value }).some(issue => issue.startsWith(name)), name);
  }
  assert.deepEqual(configurationIssues({ ...coreConfig(), FIREBASE_AUTH_DOMAIN: 'auth.expenzo.app' }), []);
});

test('core requires public HTTPS policy/deletion URLs and a public support address', () => {
  for (const name of ['PRIVACY_POLICY_URL', 'ACCOUNT_DELETION_URL']) {
    for (const value of ['http://expenzo.app/privacy', 'https://example.com/privacy', 'https://a.example.org',
      'https://localhost/privacy', 'https://project.test/privacy', 'https://127.0.0.1/privacy', 'https://[::1]/privacy',
      'https://user:password@expenzo.app/privacy', 'https://host.internal/privacy']) {
      assert.ok(configurationIssues({ ...coreConfig(), [name]: value }).some(issue => issue.startsWith(name)), name);
    }
  }
  for (const SUPPORT_EMAIL of ['invalid', 'support@localhost', 'support@example.com', 'support@expenzo.test', 'has space@expenzo.app']) {
    assert.ok(configurationIssues({ ...coreConfig(), SUPPORT_EMAIL }).some(issue => issue.startsWith('SUPPORT_EMAIL')));
  }
});

test('absent Google OAuth IDs honestly disable the existing native Google flow', () => {
  for (const OS of ['android', 'ios']) {
    const google = load('utils/googleAuth.js', {
      '@env': {}, 'react-native': { Platform: { OS } }, 'expo-constants': { appOwnership: 'standalone' },
    });
    const setup = google.getGoogleAuthSetup();
    assert.equal(setup.isConfigured, false);
    assert.match(setup.reason, /not configured.*email and password/);
  }
});

test('a supplied hosted AI base URL is public HTTPS without credentials, queries or fragments', () => {
  assert.deepEqual(configurationIssues({ ...coreConfig(), AI_API_BASE_URL: 'https://fixture.expo.app/api' }), []);
  for (const AI_API_BASE_URL of ['http://fixture.expo.app/api', 'https://user:password@fixture.expo.app/api',
    'https://fixture.expo.app/api?key=synthetic', 'https://fixture.expo.app/api#fragment',
    'https://localhost/api', 'https://127.0.0.1/api', 'https://example.com/api']) {
    assert.ok(configurationIssues({ ...coreConfig(), AI_API_BASE_URL }).some(issue => issue.startsWith('AI_API_BASE_URL')));
  }
});

test('optional Google configuration must be valid and complete for its target', () => {
  assert.deepEqual(configurationIssues({ ...coreConfig(), ...googleConfig() }), []);
  const android = { ...coreConfig(), GOOGLE_WEB_CLIENT_ID: googleConfig().GOOGLE_WEB_CLIENT_ID };
  assert.deepEqual(configurationIssues(android, { platform: 'android' }), []);
  assert.ok(configurationIssues(android, { platform: 'ios' }).some(issue => issue.startsWith('GOOGLE_IOS_CLIENT_ID')));
  const iosOnly = { ...coreConfig(), GOOGLE_IOS_CLIENT_ID: googleConfig().GOOGLE_IOS_CLIENT_ID };
  assert.ok(configurationIssues(iosOnly).some(issue => issue.startsWith('GOOGLE_WEB_CLIENT_ID')));
  for (const name of ['GOOGLE_WEB_CLIENT_ID', 'GOOGLE_IOS_CLIENT_ID', 'GOOGLE_ANDROID_CLIENT_ID']) {
    for (const value of ['javascript:bad', 'fake.apps.googleusercontent.com', true]) {
      assert.ok(configurationIssues({ ...coreConfig(), ...googleConfig(), [name]: value }).some(issue => issue.startsWith(name)), name);
    }
  }
});

test('supplied native files are validated in core, even when they belong to a non-target platform', () => {
  for (const name of ['GOOGLE_SERVICES_JSON', 'GOOGLE_SERVICES_PLIST']) {
    const env = { ...coreConfig(), [name]: name.endsWith('JSON') ? '/fixture/google-services.json' : '/fixture/GoogleService-Info.plist' };
    assert.deepEqual(configurationIssues(env, { platform: 'android', nativeConfigOptions }), []);
    for (const options of [{ isFile: () => false }, { isFile: () => true, readFile: () => 'malformed-file' },
      { isFile: () => true, readFile: () => name.endsWith('JSON') ? '{}' : plist.build({ PROJECT_ID: 'another-project' }) }]) {
      const issues = configurationIssues(env, { platform: 'android', nativeConfigOptions: options });
      assert.ok(issues.some(issue => issue.startsWith(name)), name);
      assert.ok(!JSON.stringify(issues).includes('/fixture/'));
      assert.ok(!JSON.stringify(issues).includes('malformed-file'));
    }
    assert.ok(configurationIssues({ ...env, [name]: true }).some(issue => issue.startsWith(name)));
  }
});

test('Expo core config does not add missing-file references, App Check identities or native plugins', () => {
  const config = { android: { package: 'com.nustudent.expenzo' }, ios: { bundleIdentifier: 'com.nustudent.expenzo' },
    extra: { eas: { projectId: 'fixture-project' } }, plugins: ['expo-font'] };
  const result = expoConfig({ ...coreConfig(), APP_VARIANT: 'production' }, config);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), config);
  assert.equal(Object.hasOwn(result.extra, 'nativeAppCheck'), false);
});

test('Expo preserves the legitimate supplied iOS Google scheme without requiring native Firebase', () => {
  const result = expoConfig({ ...coreConfig(), ...googleConfig(), APP_VARIANT: 'production' }, { plugins: ['expo-font'] });
  const google = result.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === '@react-native-google-signin/google-signin');
  assert.equal(google[1].iosUrlScheme, 'com.googleusercontent.apps.123456789012-ios');
  assert.equal(Object.hasOwn(result.extra, 'nativeAppCheck'), false);
  assert.ok(!result.plugins.some(plugin => String(plugin).includes('firebase') || String(plugin).includes('app-check')));
});

test('Expo accepts only validated supplied native identities and rejects bad files even in development', () => {
  const env = { ...coreConfig(), GOOGLE_SERVICES_JSON: '/fixture/google-services.json' };
  const result = expoConfig({ ...env, APP_VARIANT: 'production' }, {});
  assert.equal(result.android.googleServicesFile, '/fixture/google-services.json');
  assert.equal(result.extra.nativeAppCheck.android.projectId, env.FIREBASE_PROJECT_ID);
  assert.equal(result.extra.nativeAppCheck.android.appId, '1:123456789012:android:abcdef1234567890');
  assert.ok(!JSON.stringify(result.extra).includes(env.FIREBASE_API_KEY));
  assert.equal(Object.hasOwn(result.extra.nativeAppCheck, 'ios'), false);
  assert.throws(() => expoConfig(env, {}, { isFile: () => false }), /existing, readable/);
});

function firebaseRuntime(env, { serverFeaturesEnabled = false, alreadyInitialized = false, authError } = {}) {
  const events = [];
  const app = {}, auth = {}, db = {}, storage = {}, asyncStorage = {};
  const runtime = load('config/firebase.js', {
    '@env': env, './releaseFeatures': { SERVER_FEATURES_ENABLED: serverFeaturesEnabled },
    '@react-native-async-storage/async-storage': asyncStorage,
    'firebase/app': { getApps: () => alreadyInitialized ? [app] : [], getApp: () => app,
      initializeApp: config => { events.push(['app', config]); return app; } },
    'firebase/auth': {
      getReactNativePersistence: input => { assert.equal(input, asyncStorage); return 'persistent-auth'; },
      initializeAuth: (input, options) => { assert.equal(input, app); assert.equal(options.persistence, 'persistent-auth');
        events.push(['auth']); if (authError) throw authError; return auth; },
      getAuth: input => { assert.equal(input, app); events.push(['existing-auth']); return auth; },
    },
    'firebase/firestore': { getFirestore: input => { assert.equal(input, app); events.push(['firestore']); return db; } },
    'firebase/storage': { getStorage: input => { assert.equal(input, app); events.push(['storage']); return storage; } },
  });
  return { runtime, events, app, auth, db, storage };
}

test('core Firebase initializes persistent Auth and Firestore from WEB config without a Storage bucket/instance', () => {
  const flags = load('config/releaseFeatures.js', {});
  assert.equal(flags.SERVER_FEATURES_ENABLED, false);
  for (const env of [coreConfig(), { ...coreConfig(), FIREBASE_STORAGE_BUCKET: 'expenzo-fixture.appspot.com' }]) {
    const h = firebaseRuntime(env, { serverFeaturesEnabled: flags.SERVER_FEATURES_ENABLED });
    assert.equal(h.runtime.firebaseConfigured, true);
    assert.equal(h.runtime.default, h.app);
    assert.equal(h.runtime.auth, h.auth);
    assert.equal(h.runtime.db, h.db);
    assert.equal(h.runtime.storage, null);
    assert.equal(h.events[0][1].appId, env.FIREBASE_APP_ID);
    assert.deepEqual(h.events.map(event => event[0]), ['app', 'auth', 'firestore']);
  }
  const env = Object.fromEntries(Object.entries(coreConfig()).map(([key, value]) => [key, ` ${value} `]));
  assert.deepEqual(configurationIssues(env), []);
  const h = firebaseRuntime(env);
  for (const [key, name] of [['apiKey', 'FIREBASE_API_KEY'], ['authDomain', 'FIREBASE_AUTH_DOMAIN'], ['projectId', 'FIREBASE_PROJECT_ID'],
    ['messagingSenderId', 'FIREBASE_MESSAGING_SENDER_ID'], ['appId', 'FIREBASE_APP_ID']]) {
    assert.equal(h.events[0][1][key], coreConfig()[name]);
  }
});

test('an incomplete core Firebase config does not create any Firebase instance', () => {
  for (const name of ['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID', 'FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_APP_ID']) {
    const env = coreConfig(); delete env[name];
    const h = firebaseRuntime(env);
    assert.equal(h.runtime.firebaseConfigured, false);
    for (const key of ['default', 'auth', 'db', 'storage']) assert.equal(h.runtime[key], null);
    assert.deepEqual(h.events, []);
  }
});

test('Firebase Fast Refresh still reuses Auth, propagates unexpected failures, and keeps Storage opt-in', () => {
  const h = firebaseRuntime(coreConfig(), { alreadyInitialized: true, authError: { code: 'auth/already-initialized' } });
  assert.equal(h.runtime.auth, h.auth);
  assert.deepEqual(h.events.map(event => event[0]), ['auth', 'existing-auth', 'firestore']);
  assert.throws(() => firebaseRuntime(coreConfig(), { authError: new Error('unexpected-auth-error') }), /unexpected-auth-error/);
  const server = firebaseRuntime({ ...coreConfig(), FIREBASE_STORAGE_BUCKET: 'expenzo-fixture.appspot.com' }, { serverFeaturesEnabled: true });
  assert.equal(server.runtime.storage, server.storage);
  assert.ok(server.events.some(event => event[0] === 'storage'));
});

test('core mode still forbids debug attestation tokens and only warns for incomplete development config', () => {
  const env = { ...coreConfig(), FIREBASE_APP_CHECK_DEBUG_TOKEN: 'forbidden-fixture-token' };
  assert.throws(() => release.validateReleaseConfig(env, { production: false }), /not supported/);
  assert.deepEqual(configurationIssues(env), ['Debug App Check tokens are not supported by this app']);
  const warnings = [];
  assert.ok(release.validateReleaseConfig({}, { production: false, warn: message => warnings.push(message) }).length > 0);
  assert.match(warnings[0], /Core release configuration incomplete/);
  assert.doesNotMatch(warnings[0], /Play.ready/i);
});
