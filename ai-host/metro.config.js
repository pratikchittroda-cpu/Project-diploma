const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const repositoryRoot = path.resolve(projectRoot, '..');
const config = getDefaultConfig(projectRoot);

// Shared server-only functions/lib modules live outside this standalone project.
config.watchFolders = [...new Set([...config.watchFolders, repositoryRoot])];
config.resolver.nodeModulesPaths = [
  ...new Set([
    path.join(projectRoot, 'node_modules'),
    path.join(repositoryRoot, 'node_modules'),
    ...config.resolver.nodeModulesPaths,
  ]),
];

module.exports = config;
