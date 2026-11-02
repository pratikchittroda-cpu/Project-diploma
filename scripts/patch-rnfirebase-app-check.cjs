// RNFirebase 26.4.0 discards the native initialize promise in its modular API.
// Keep that API synchronous, but serialize getToken behind initialization and
// handle rejection immediately. Remove/review this patch when upgrading RNFB.
const fs = require('node:fs');
const path = require('node:path');
const MARKER = '// Expenzo: await native App Check readiness';

function patchSource(source, typescript = false) {
  if (source.includes(MARKER)) return source;
  const initialize = typescript
    ? 'void (appCheck as AppCheckInternal).initializeAppCheck(options);'
    : 'void appCheck.initializeAppCheck(options);';
  const token = typescript
    ? 'return (appCheckInstance as AppCheckInternal).getToken(forceRefresh);'
    : 'return appCheckInstance.getToken(forceRefresh);';
  if (!source.includes(initialize) || !source.includes(token)) throw new Error('RNFirebase App Check readiness patch no longer matches; review the SDK before building.');
  const map = typescript ? 'new WeakMap<AppCheck, Promise<void>>()' : 'new WeakMap()';
  const call = typescript ? '(appCheck as AppCheckInternal)' : 'appCheck';
  // Failed initialization is surfaced by getToken; the next request can retry initialization.
  return source.replace('export function initializeAppCheck(', `${MARKER}\nconst nativeReadiness = ${map};\nexport function initializeAppCheck(`)
    .replace(initialize, `const ready = Promise.resolve().then(() => ${call}.initializeAppCheck(options)).catch(() => {\n    throw Object.assign(new Error('Native App Check initialization failed'), { code: 'app-check/initialization-failed' });\n  });\n  nativeReadiness.set(appCheck, ready);\n  void ready.catch(() => {});`)
    .replace(token, `return Promise.resolve(nativeReadiness.get(appCheckInstance)).then(() => { ${token} });`);
}

function patchInstalledSdk() {
  const location = path.dirname(require.resolve('@react-native-firebase/app-check/package.json'));
  if (JSON.parse(fs.readFileSync(path.join(location, 'package.json'), 'utf8')).version !== '26.4.0') {
    throw new Error('Review the RNFirebase App Check readiness patch for the installed version.');
  }
  for (const [file, ts] of [['lib/index.ts', true], ['dist/module/index.js', false]]) {
    const fullPath = path.join(location, file);
    const original = fs.readFileSync(fullPath, 'utf8');
    const patched = patchSource(original, ts);
    if (patched !== original) fs.writeFileSync(fullPath, patched);
  }
}

if (require.main === module) patchInstalledSdk();
module.exports = { patchSource, patchInstalledSdk };
