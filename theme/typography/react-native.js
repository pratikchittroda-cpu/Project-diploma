// Metro serves this module for app code's `import ... from 'react-native'` (see metro.config.js):
// everything is the real react-native except Text and TextInput, which carry the brand fonts.
// A Proxy forwards every other name lazily and only lists Text/TextInput as its own keys, so
// dev tooling that walks module exports never triggers react-native's lazy getters (some load
// native modules that Expo Go doesn't ship).
const ReactNative = require('react-native');
const { Text, TextInput } = require('./index');

const overrides = { Text, TextInput };

module.exports = new Proxy(overrides, {
  get: (target, name) => (name in target ? target[name] : ReactNative[name]),
  has: (target, name) => name in target || name in ReactNative,
});
