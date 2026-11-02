const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const { patchSource } = require('../scripts/patch-rnfirebase-app-check.cjs');

const source = fs.readFileSync(path.join(__dirname, '../utils/appCheck.js'), 'utf8');
const { code } = babel.transformSync(source, { filename: 'utils/appCheck.js', configFile: false, babelrc: false,
  plugins: ['@babel/plugin-transform-modules-commonjs'] });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = () => new Promise(resolve => setImmediate(resolve));

function harness(platform = 'android', backend) {
  const events = [];
  const expected = { projectId: 'demo-expenzo', messagingSenderId: '123', appId: `1:123:${platform}:abc123`, applicationId: 'com.nustudent.expenzo' };
  const nativeApp = { name: '[DEFAULT]', options: { ...expected } };
  const jsApp = { options: { projectId: expected.projectId, messagingSenderId: '123', appId: '1:123:web:abc123' } };
  const constants = { executionEnvironment: 'standalone', expoConfig: { extra: { nativeAppCheck: { [platform]: expected } } } };
  let registered;
  const sdk = {
    ReactNativeFirebaseAppCheckProvider: class {
      configure(options) { this.providerOptions = options; events.push(['configure', options]); }
    },
    initializeAppCheck: (app, options) => { events.push(['initialize', app, options]); return { app }; },
    getToken: async (_, refresh) => { events.push(['getToken', refresh]); return { token: 'synthetic-attestation-result' }; },
  };
  const modules = {
    'react-native': { Platform: { OS: platform } }, 'expo-constants': { __esModule: true, default: constants },
    '../config/firebase': { __esModule: true, default: jsApp },
    '../services/backendClient': backend || { setBackendAppCheckTokenProvider: provider => { registered = provider; } },
    '@react-native-firebase/app': { getApps: () => [nativeApp], getApp: () => nativeApp },
    '@react-native-firebase/app-check': sdk,
  };
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require(name) {
    if (name.startsWith('@react-native-firebase/')) events.push(['import', name]);
    if (!(name in modules)) throw new Error('Unmocked dependency');
    return modules[name];
  }, console: { log() { throw new Error('Unexpected token logging'); }, warn() { throw new Error('Unexpected token logging'); }, error() { throw new Error('Unexpected token logging'); } } });
  return { api: module.exports, events, sdk, modules, expected, nativeApp, jsApp, constants, registered: () => registered };
}

test('registration is inert; token requests use real native providers with auto-refresh disabled', async () => {
  for (const platform of ['android', 'ios']) {
    const h = harness(platform);
    h.api.registerBackendAppCheck();
    h.api.registerBackendAppCheck();
    assert.equal(h.events.length, 0);
    assert.equal(await h.registered()(), 'synthetic-attestation-result');
    const config = h.events.find(event => event[0] === 'configure')[1];
    assert.equal(config.android.provider, 'playIntegrity');
    assert.equal(config.apple.provider, 'appAttestWithDeviceCheckFallback');
    assert.equal('debugToken' in config.android, false);
    assert.equal('debugToken' in config.apple, false);
    assert.equal(h.events.find(event => event[0] === 'initialize')[2].isTokenAutoRefreshEnabled, false);
    assert.equal(h.events.find(event => event[0] === 'getToken')[1], false);
  }
});

test('concurrent requests share initialization and token retrieval; later requests use SDK cache', async () => {
  const h = harness();
  const waiting = deferred();
  let tokens = 0;
  h.sdk.getToken = () => { tokens++; return waiting.promise; };
  const first = h.api.getBackendAppCheckToken();
  const second = h.api.getBackendAppCheckToken();
  await flush();
  assert.equal(tokens, 1);
  assert.equal(h.events.filter(event => event[0] === 'initialize').length, 1);
  waiting.resolve({ token: 'synthetic-shared-result' });
  assert.equal(await first, await second);
  await h.api.getBackendAppCheckToken();
  assert.equal(tokens, 2);
  assert.equal(h.events.filter(event => event[0] === 'initialize').length, 1);
});

test('unsupported environments never load native App Check or attempt tokens', async () => {
  for (const mutate of [
    h => { h.constants.executionEnvironment = 'storeClient'; },
    h => { h.constants.expoConfig.extra.nativeAppCheck = {}; },
    h => { h.modules['react-native'].Platform.OS = 'web'; },
    h => { h.modules['@react-native-firebase/app'].getApps = () => []; },
    h => { h.modules['@react-native-firebase/app'].getApps = () => { throw new Error('missing module'); }; },
  ]) {
    const h = harness(); mutate(h);
    await assert.rejects(h.api.getBackendAppCheckToken(), { code: 'app-check/unsupported' });
    assert.equal(h.events.some(event => event[0] === 'initialize' || event[1] === '@react-native-firebase/app-check'), false);
  }
});

test('native identity must match the provisioned app and JS Firebase project before any attestation', async () => {
  for (const mutate of [
    h => { h.jsApp.options.projectId = 'another-project'; },
    h => { h.jsApp.options.messagingSenderId = '999'; },
    h => { h.nativeApp.options.appId = '1:123:android:bad'; },
    h => { h.nativeApp.options.projectId = 'another-project'; },
    h => { h.expected.appId = '1:123:web:abc123'; },
  ]) {
    const h = harness(); mutate(h);
    await assert.rejects(h.api.getBackendAppCheckToken(), { code: 'app-check/configuration-mismatch' });
    assert.equal(h.events.some(event => event[0] === 'initialize'), false);
  }
});

test('token failure and malformed tokens fail closed without leaking provider details; user retry succeeds', async () => {
  for (const outcome of [() => { throw new Error('private provider payload'); }, () => ({}), () => ({ token: '' }), () => ({ token: 'two words' })]) {
    const h = harness();
    const getToken = h.sdk.getToken;
    h.sdk.getToken = outcome;
    await assert.rejects(h.api.getBackendAppCheckToken(), error => error.code === 'app-check/unavailable' && !error.message.includes('private provider payload'));
    h.sdk.getToken = getToken;
    assert.equal(await h.api.getBackendAppCheckToken(), 'synthetic-attestation-result');
    assert.equal(h.events.filter(event => event[0] === 'initialize').length, 1);
  }
});

test('failed native initialization is retried only by a later user request', async () => {
  const h = harness();
  const getToken = h.sdk.getToken;
  h.sdk.getToken = async () => { throw Object.assign(new Error('setup failure'), { code: 'app-check/initialization-failed' }); };
  await assert.rejects(h.api.getBackendAppCheckToken(), { code: 'app-check/unavailable' });
  assert.equal(h.events.filter(event => event[0] === 'initialize').length, 1);
  h.sdk.getToken = getToken;
  await h.api.getBackendAppCheckToken();
  assert.equal(h.events.filter(event => event[0] === 'initialize').length, 2);
});

test('registered adapter sends attestation through the real backend hook and failures never send an API request', async () => {
  const requests = [];
  const backendSource = fs.readFileSync(path.join(__dirname, '../services/backendClient.js'), 'utf8');
  const backendCode = babel.transformSync(backendSource, { filename: 'services/backendClient.js', configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'] }).code;
  const backendModule = { exports: {} };
  const mocks = {
    '../config/firebase': { auth: { currentUser: { uid: 'owner', getIdToken: async () => 'synthetic-auth-result' } } },
    '../config/publicConfig': { API_BASE_URL: 'https://fixture.cloudfunctions.net/ai' },
    // The real release stays disabled; this integration exercises the dormant adapter.
    '../config/releaseFeatures': { SERVER_FEATURES_ENABLED: true },
  };
  vm.runInNewContext(backendCode, { module: backendModule, exports: backendModule.exports,
    require(name) { if (!(name in mocks)) throw new Error('Unmocked backend import'); return mocks[name]; },
    AbortController, setTimeout, clearTimeout, URL,
    fetch: async (url, options) => { requests.push({ url, options }); return { ok: true, status: 200, text: async () => '{"ok":true}' }; },
  });
  const backend = backendModule.exports;
  const h = harness('android', backend);
  h.api.registerBackendAppCheck();
  const result = await backend.requestBackend('/financial-chat', { message: 'test' });
  assert.equal(result.ok, true);
  assert.equal(requests[0].options.headers['X-Firebase-AppCheck'], 'synthetic-attestation-result');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer synthetic-auth-result');
  h.sdk.getToken = async () => { throw new Error('provider failure'); };
  await assert.rejects(backend.requestBackend('/financial-chat', { message: 'test' }), { code: 'app-check/unavailable' });
  const unconfigured = harness('android', backend);
  unconfigured.constants.expoConfig.extra.nativeAppCheck = {};
  unconfigured.api.registerBackendAppCheck();
  await assert.rejects(backend.requestBackend('/financial-chat', { message: 'test' }), { code: 'app-check/unsupported' });
  assert.equal(requests.length, 1);
});

function patchedSdkHarness(initialize) {
  const file = path.join(path.dirname(require.resolve('@react-native-firebase/app-check/package.json')), 'dist/module/index.js');
  const patched = patchSource(fs.readFileSync(file, 'utf8'));
  assert.equal(patchSource(patched), patched, 'install patch is idempotent');
  const section = patched.slice(patched.indexOf('// Expenzo: await native App Check readiness'), patched.indexOf('setReactNativeModule(nativeModuleName, fallBackModule);'));
  let requests = 0;
  const instance = { initializeAppCheck: initialize, getToken: async () => { requests++; return { token: 'synthetic-sdk-result' }; } };
  const context = { isObject: value => typeof value === 'object', validateProviderName() {}, getModularAppCheck: () => instance };
  vm.runInNewContext(section.replaceAll('export function ', 'function ') + '\nthis.sdk = {initializeAppCheck, getToken};', context);
  return { sdk: context.sdk, requests: () => requests };
}

test('actual pinned modular SDK patch waits for native provider setup before calling native getToken', async () => {
  const ready = deferred();
  const h = patchedSdkHarness(() => ready.promise);
  const appCheck = h.sdk.initializeAppCheck({}, {});
  const pending = h.sdk.getToken(appCheck, false);
  await flush();
  assert.equal(h.requests(), 0);
  ready.resolve();
  assert.equal((await pending).token, 'synthetic-sdk-result');
  assert.equal(h.requests(), 1);
});

test('actual SDK patch handles async initialization rejection and allows explicit reinitialization', async () => {
  let fail = true;
  const h = patchedSdkHarness(async () => { if (fail) throw new Error('private native details'); });
  const appCheck = h.sdk.initializeAppCheck({}, {});
  await flush(); // Must not surface an unhandled rejection before a token call.
  await assert.rejects(h.sdk.getToken(appCheck), error => error.code === 'app-check/initialization-failed' && !error.message.includes('private'));
  assert.equal(h.requests(), 0);
  fail = false;
  h.sdk.initializeAppCheck({}, {});
  await h.sdk.getToken(appCheck);
  assert.equal(h.requests(), 1);
  assert.throws(() => patchSource('new SDK shape'), /no longer matches/);
});
