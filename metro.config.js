const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drizzle migrations are .sql files bundled as source.
config.resolver.sourceExts.push('sql');
// expo-sqlite on web loads SQLite as WebAssembly.
config.resolver.assetExts.push('wasm');

// SQLite-WASM needs SharedArrayBuffer, which needs these headers in dev too.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  return middleware(req, res, next);
};

module.exports = config;
