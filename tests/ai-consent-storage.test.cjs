const test = require('node:test');
const assert = require('node:assert/strict');
const { load, createHooks } = require('./helpers/react-ui.cjs');

function storage({ failWrites = false } = {}) {
  const items = new Map();
  return { items, AsyncStorage: { default: {
    getItem: async key => (items.has(key) ? items.get(key) : null),
    setItem: async (key, value) => { if (failWrites) throw new Error('disk full'); items.set(key, value); },
    removeItem: async key => { if (failWrites) throw new Error('disk full'); items.delete(key); },
  }, __esModule: true } };
}

test('chat consent is stored per account under a key the account cleanup removes', async () => {
  const store = storage();
  const consent = load('utils/aiConsent.js', { react: {}, '@react-native-async-storage/async-storage': store.AsyncStorage });
  assert.equal(consent.chatConsentKey('uid-1'), 'aiConsent:v3:uid-1');
  // Same pattern clearAccountLocalData matches on sign-out, account switch and deletion.
  assert.match(consent.chatConsentKey('uid-1'), /^aiConsent:v[0-9]+:uid-1$/);
  assert.equal(await consent.loadChatConsent('uid-1'), false);
  assert.equal(await consent.saveChatConsent('uid-1', true), true);
  assert.equal(await consent.loadChatConsent('uid-1'), true);
  assert.equal(await consent.loadChatConsent('uid-2'), false);
  assert.equal(await consent.saveChatConsent('uid-1', false), true);
  assert.equal(store.items.size, 0);
  assert.equal(await consent.loadChatConsent(null), false);
  assert.equal(await consent.saveChatConsent(null, true), false);
});

test('storage failures never assume consent and are reported to the caller', async () => {
  const broken = load('utils/aiConsent.js', { react: {}, '@react-native-async-storage/async-storage': { default: {
    getItem: async () => { throw new Error('unreadable'); } }, __esModule: true } });
  assert.equal(await broken.loadChatConsent('uid-1'), false);
  const full = load('utils/aiConsent.js', { react: {}, '@react-native-async-storage/async-storage': storage({ failWrites: true }).AsyncStorage });
  assert.equal(await full.saveChatConsent('uid-1', true), false);
});

test('screens showing consent update as soon as it changes elsewhere', async () => {
  const store = storage();
  store.items.set('aiConsent:v3:uid-1', 'granted');
  const hooks = createHooks();
  const consent = load('utils/aiConsent.js', { react: hooks.react, '@react-native-async-storage/async-storage': store.AsyncStorage });
  const read = () => hooks.render(() => consent.useStoredChatConsent('uid-1'));
  assert.equal(read(), false);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(read(), true);
  consent.saveChatConsent('uid-1', false);
  assert.equal(read(), false);
  consent.saveChatConsent('uid-2', true);
  assert.equal(read(), false);
  hooks.unmount();
  await new Promise(resolve => setImmediate(resolve));
});

test('transaction tools keep a separate remembered consent with its own cleanup-matched key', async () => {
  const items = new Map();
  const consent = load('utils/aiConsent.js', { react: {}, '@react-native-async-storage/async-storage': { default: {
    getItem: async key => (items.has(key) ? items.get(key) : null), setItem: async (key, value) => { items.set(key, value); },
    removeItem: async key => { items.delete(key); } }, __esModule: true } });
  assert.equal(consent.toolsConsentKey('uid-1'), 'aiToolsConsent:v1:uid-1');
  assert.equal(await consent.saveToolsConsent('uid-1', true), true);
  assert.equal(await consent.loadToolsConsent('uid-1'), true);
  // Agreeing for the tools does not agree for chat, and vice versa.
  assert.equal(await consent.loadChatConsent('uid-1'), false);
  await consent.saveChatConsent('uid-2', true);
  assert.equal(await consent.loadToolsConsent('uid-2'), false);
  assert.equal(await consent.saveToolsConsent('uid-1', false), true);
  assert.deepEqual([...items.keys()], ['aiConsent:v3:uid-2']);
});
