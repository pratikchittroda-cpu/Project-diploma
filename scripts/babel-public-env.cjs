const dotenv = require('react-native-dotenv');
const { PUBLIC_ENV_NAMES } = require('./public-env.cjs');

module.exports = (api, options) => {
  const plugin = dotenv(api, { ...options, allowlist: PUBLIC_ENV_NAMES });
  // react-native-dotenv's allowlist covers @env imports, but NOT process.env.X.
  // Disable that unsafe secondary path. Metro handles NODE_ENV itself.
  plugin.visitor.MemberExpression = path => {
    if (path.hub.file.opts.filename?.includes('node_modules')) return;
    if (!path.get('object').matchesPattern('process.env')) return;
    const key = path.toComputedKey();
    if (!api.types.isStringLiteral(key) || key.value !== 'NODE_ENV') {
      throw path.buildCodeFrameError('Client configuration must use an allowlisted named import from @env.');
    }
  };
  return plugin;
};
