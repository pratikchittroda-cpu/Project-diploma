module.exports = function (api) {
  // Public configuration is part of the bundle. Never allow a provider secret here.
  const { PUBLIC_ENV_NAMES } = require('./scripts/public-env.cjs');
  api.cache.using(() => [process.env.EAS_BUILD, process.env.CI, process.env.EXPO_NO_DOTENV, ...PUBLIC_ENV_NAMES.map(name => process.env[name] || '')].join('|'));
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['./scripts/babel-public-env.cjs', {
        moduleName: '@env',
        // Only local development reads .env. EAS/CI use provisioned environment values.
        path: process.env.EAS_BUILD || process.env.CI || process.env.EXPO_NO_DOTENV ? '.env.disabled' : '.env',
        allowlist: PUBLIC_ENV_NAMES,
        allowUndefined: true,
      }]
    ],
  };
};
