// The iOS project is maintained in git. Apply only reviewed public plist fields;
// never run a destructive prebuild over that project.
const fs = require('node:fs');
const path = require('node:path');
const plist = require('@expo/plist').default;
const { iosGoogleScheme } = require('./public-env.cjs');
const { validateReleaseConfig } = require('./validate-release-config.cjs');
const { nativeFirebaseConfig, IDS } = require('./native-firebase-config.cjs');

function applyIosPublicConfig(info, env = process.env) {
  info = { ...info };
  const scheme = iosGoogleScheme(env);
  // Replace only Google schemes; preserve other native URL handlers.
  info.CFBundleURLTypes = (info.CFBundleURLTypes || []).map(type => ({
    ...type, CFBundleURLSchemes: (type.CFBundleURLSchemes || []).filter(value => !value.startsWith('com.googleusercontent.apps.')),
  })).filter(type => type.CFBundleURLSchemes.length);
  if (scheme) info.CFBundleURLTypes.push({ CFBundleURLSchemes: [scheme] });
  info.NSPhotoLibraryUsageDescription = 'Choose a profile picture to upload to your Expenzo account.';
  info.UIUserInterfaceStyle = 'Automatic';
  info.FirebaseAppCheckTokenAutoRefreshEnabled = false;
  info.FirebaseDataCollectionDefaultEnabled = false;
  delete info.NSCameraUsageDescription;
  delete info.NSMicrophoneUsageDescription;
  return info;
}

function syncIos(env = process.env) {
  validateReleaseConfig(env, { platform: 'ios' });
  const native = nativeFirebaseConfig(env, { platform: 'ios' });
  if (env.GOOGLE_SERVICES_PLIST && native.issues.length) throw new Error(native.issues.join('\n'));
  verifyIosNativeSetup();
  const file = path.join(__dirname, '../ios/Expenzo/Info.plist');
  const info = applyIosPublicConfig(plist.parse(fs.readFileSync(file, 'utf8')), env);
  fs.writeFileSync(file, plist.build(info));
  console.log('Synchronized iOS public configuration; App Check auto-refresh is disabled. Run pod install before a native build.');
  if (!native.files.ios) console.warn('Native Firebase is absent: backend services are unsupported; JS Firebase development remains available.');
}

function verifyIosNativeSetup() {
  const root = path.join(__dirname, '../ios');
  const delegate = fs.readFileSync(path.join(root, 'Expenzo/AppDelegate.swift'), 'utf8');
  const bridge = fs.readFileSync(path.join(root, 'Expenzo/Expenzo-Bridging-Header.h'), 'utf8');
  const podfile = fs.readFileSync(path.join(root, 'Podfile'), 'utf8');
  const properties = JSON.parse(fs.readFileSync(path.join(root, 'Podfile.properties.json'), 'utf8'));
  const project = fs.readFileSync(path.join(root, 'Expenzo.xcodeproj/project.pbxproj'), 'utf8');
  const entitlements = plist.parse(fs.readFileSync(path.join(root, 'Expenzo/Expenzo.entitlements'), 'utf8'));

  const issues = [];
  if (!delegate.includes('import FirebaseCore')) issues.push('delegate missing import FirebaseCore');
  if (!bridge.includes('#import "RNFBAppCheckModule.h"')) issues.push('bridge missing RNFBAppCheckModule.h');
  if (!delegate.includes('RNFBAppCheckModule.sharedInstance()')) issues.push('delegate missing RNFBAppCheckModule.sharedInstance()');
  if (delegate.indexOf('RNFBAppCheckModule.sharedInstance()') > delegate.indexOf('FirebaseApp.configure()')) issues.push('delegate wrong order');
  if (!podfile.includes('$RNFirebaseDisableSPM = true')) issues.push('podfile missing $RNFirebaseDisableSPM');
  if (!podfile.includes('$RNFirebaseAsStaticFramework = true')) issues.push('podfile missing $RNFirebaseAsStaticFramework');
  if (properties['ios.useFrameworks'] !== 'static') issues.push(`properties.ios.useFrameworks is '${properties['ios.useFrameworks']}' (expected 'static')`);
  if (!['RNFBApp', 'RNFBAppCheck'].every(name => JSON.parse(properties['ios.forceStaticLinking'] || '[]').includes(name))) issues.push(`properties.forceStaticLinking is '${properties['ios.forceStaticLinking']}'`);
  if (!project.includes('ios-firebase-build.cjs')) issues.push('project missing ios-firebase-build.cjs');
  if (!project.includes(`PRODUCT_BUNDLE_IDENTIFIER = "${IDS.ios}";`)) issues.push(`project missing bundleId ${IDS.ios}`);
  if (entitlements['com.apple.developer.devicecheck.appattest-environment'] !== 'production') issues.push(`entitlements appattest is '${entitlements['com.apple.developer.devicecheck.appattest-environment']}'`);

  if (issues.length) {
    throw new Error('Tracked iOS Firebase/App Check setup is incomplete: ' + issues.join('; ') + '. Restore the reviewed native integration before building.');
  }
}

if (require.main === module) syncIos();
module.exports = { syncIos, applyIosPublicConfig, verifyIosNativeSetup };
