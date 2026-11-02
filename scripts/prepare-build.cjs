const { validateReleaseConfig } = require('./validate-release-config.cjs');
require('./patch-rnfirebase-app-check.cjs').patchInstalledSdk();
validateReleaseConfig();
if (process.env.EAS_BUILD_PLATFORM === 'ios') require('./sync-ios.cjs').syncIos();
