// Service worker for offline web (PWA). Generated into dist/ after `expo export`
// by scripts/build-web.mjs. Precaches the whole app shell, including the
// SQLite WASM and icon fonts, so the app opens with no internet. Supabase
// requests are cross-origin and are never cached.
module.exports = {
  globDirectory: 'dist/',
  // Only the icon font the app uses; @expo/vector-icons ships every family.
  globPatterns: ['**/*.{html,js,css,wasm,png,ico,webmanifest}', '**/MaterialCommunityIcons.*.ttf'],
  globIgnores: ['sw.js', 'workbox-*.js'],
  swDest: 'dist/sw.js',
  navigateFallback: '/index.html',
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  // A new deploy takes over on the next load instead of waiting for every tab to close.
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  sourcemap: false,
};
