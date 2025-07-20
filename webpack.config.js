const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function(env, argv) {
  const config = await createExpoWebpackConfigAsync(
    {
      ...env,
      babel: {
        dangerouslyAddModulePathsToTranspile: [
          '@solana/web3.js',
          '@solana/spl-token',
          'solana-agent-kit'
        ]
      },
    },
    argv
  );
  
  // Customize the config before returning it
  // Fix polyfill issues
  if (config.resolve.alias) {
    config.resolve.alias['crypto'] = require.resolve('crypto-browserify');
    config.resolve.alias['stream'] = require.resolve('stream-browserify');
    config.resolve.alias['buffer'] = require.resolve('buffer');
    
    // Add aliases for node: protocol imports
    config.resolve.alias['node:process'] = require.resolve('process/browser');
    config.resolve.alias['node:buffer'] = require.resolve('buffer');
    config.resolve.alias['node:stream'] = require.resolve('stream-browserify');
    config.resolve.alias['node:util'] = require.resolve('util');
    config.resolve.alias['node:events'] = require.resolve('events');
  }

  // Force expo-modules-core resolution
  if (config.resolve.alias) {
    config.resolve.alias['expo-modules-core'] = require.resolve('expo-modules-core');
  }

  // Add fallbacks for node modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    buffer: require.resolve('buffer'),
    process: require.resolve('process/browser'),
    zlib: require.resolve('browserify-zlib'),
    path: require.resolve('path-browserify'),
    util: require.resolve('util'),
    assert: require.resolve('assert'),
    os: require.resolve('os-browserify'),
  };

  return config;
}; 