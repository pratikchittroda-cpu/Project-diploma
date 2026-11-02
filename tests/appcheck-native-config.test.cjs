const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const plist = require('@expo/plist').default;
const { disableAutomaticCollection } = require('../scripts/with-native-app-check.cjs');
const { verifyIosNativeSetup } = require('../scripts/sync-ios.cjs');
const { prepareIosFirebase } = require('../scripts/ios-firebase-build.cjs');

test('Android manifest disables collection before native initialization and preserves other metadata', () => {
  const manifest = { manifest: { $: {}, application: [{ 'meta-data': [
    { $: { 'android:name': 'app_check_token_auto_refresh', 'android:value': 'true' } },
    { $: { 'android:name': 'unrelated', 'android:value': 'preserved' } },
  ] }] } };
  disableAutomaticCollection(manifest);
  disableAutomaticCollection(manifest);
  const metadata = manifest.manifest.application[0]['meta-data'];
  assert.equal(metadata.length, 4);
  for (const name of ['firebase_data_collection_default_enabled', 'app_data_collection_default_enabled', 'app_check_token_auto_refresh']) {
    const entry = metadata.find(item => item.$['android:name'] === name);
    assert.equal(entry.$['android:value'], 'false');
    assert.equal(entry.$['tools:replace'], 'android:value');
  }
  assert.equal(metadata.find(item => item.$['android:name'] === 'unrelated').$['android:value'], 'preserved');
});

test('tracked iOS setup has provider-before-Firebase initialization, App Attest capability and static linking', () => {
  assert.doesNotThrow(verifyIosNativeSetup);
  const info = plist.parse(fs.readFileSync(path.join(__dirname, '../ios/Expenzo/Info.plist'), 'utf8'));
  assert.equal(info.FirebaseAppCheckTokenAutoRefreshEnabled, false);
  assert.equal(info.FirebaseDataCollectionDefaultEnabled, false);
});

test('iOS resource preparation rejects missing core configuration before copying files', () => {
  let copied = false;
  assert.throws(() => prepareIosFirebase({ CONFIGURATION: 'Release' }, { copyFileSync() { copied = true; } }), /Core release configuration incomplete/);
  assert.equal(copied, false);
});
