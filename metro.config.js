const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Brand typography: route the app's own `react-native` imports through a shim whose Text and
// TextInput apply Manrope/Syne and the blue x. Library code and the typography directory itself
// get the real module. Metro caches resolutions per directory, so the exclusion is by directory.
const typographyDir = path.resolve(__dirname, 'theme/typography');
const shim = path.join(typographyDir, 'react-native.js');
const nodeModules = `${path.sep}node_modules${path.sep}`;
const upstream = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const origin = context.originModulePath || '';
  if (moduleName === 'react-native' && origin.startsWith(__dirname + path.sep) && !origin.includes(nodeModules)
    && path.dirname(origin) !== typographyDir) {
    return { type: 'sourceFile', filePath: shim };
  }
  return (upstream || context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
