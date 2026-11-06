// Lets this standalone app import P1/P2's shared package straight from
// ../packages/shared (the same code apps/mobile uses), without joining the
// root npm workspaces. Shared code resolves its dependencies (supabase-js)
// from this app's node_modules.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '../packages/shared');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [...(config.watchFolders ?? []), sharedRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  '@communitylink/shared': path.resolve(sharedRoot, 'src'),
};

module.exports = config;
