const { withAndroidManifest } = require('expo/config-plugins');

function disableAutomaticCollection(manifest) {
  const application = manifest.manifest.application[0];
  application['meta-data'] ||= [];
  manifest.manifest.$['xmlns:tools'] ||= 'http://schemas.android.com/tools';
  for (const name of ['firebase_data_collection_default_enabled', 'app_data_collection_default_enabled', 'app_check_token_auto_refresh']) {
    const existing = application['meta-data'].find(item => item.$['android:name'] === name);
    const attributes = { 'android:name': name, 'android:value': 'false', 'tools:replace': 'android:value' };
    if (existing) existing.$ = { ...existing.$, ...attributes };
    else application['meta-data'].push({ $: attributes });
  }
  return manifest;
}

module.exports = config => withAndroidManifest(config, mod => {
  mod.modResults = disableAutomaticCollection(mod.modResults);
  return mod;
});
module.exports.disableAutomaticCollection = disableAutomaticCollection;
