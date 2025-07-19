// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add essential polyfills for React Native compatibility
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  crypto: require.resolve('expo-crypto'),
  buffer: require.resolve('buffer'),
  process: require.resolve('process/browser'),
};

// Add resolver alias to exclude problematic MCP SDK modules
config.resolver.alias = {
  ...config.resolver.alias,
  // Exclude Node.js specific modules from MCP SDK
  '@modelcontextprotocol/sdk/dist/cjs/server/stdio': false,
  '@modelcontextprotocol/sdk/dist/cjs/server/tcp': false,
  '@modelcontextprotocol/sdk/dist/cjs/server/websocket': false,
  '@modelcontextprotocol/sdk/dist/cjs/server/stdio.js': false,
  '@modelcontextprotocol/sdk/dist/cjs/server/tcp.js': false,
  '@modelcontextprotocol/sdk/dist/cjs/server/websocket.js': false,
};

module.exports = config;
