// Web build: expo export → add PWA tags to index.html → generate the service worker.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

run('expo export -p web');

const HEAD_TAGS = [
  '<link rel="manifest" href="/manifest.webmanifest" />',
  // Match the app's header (Paper surface) so the browser chrome blends in.
  '<meta name="theme-color" content="#F1F5EB" media="(prefers-color-scheme: light)" />',
  '<meta name="theme-color" content="#0B0F0A" media="(prefers-color-scheme: dark)" />',
  '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-title" content="SpendWise" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
  // Feel like an installed app rather than a page: background before the JS
  // loads (no white flash in dark mode), no double-tap zoom on the keypad, no
  // whole-page bounce, no grey tap flash, native scrollbars per theme, and no text selection or long-press
  // callout on buttons (text fields stay selectable).
  '<style>' +
    ':root{color-scheme:light dark}html,body{background:#F1F5EB;touch-action:manipulation;overscroll-behavior:none;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}' +
    'input,textarea,[contenteditable]{-webkit-user-select:text;user-select:text}' +
    '@media (prefers-color-scheme:dark){html,body{background:#0B0F0A}}' +
    '</style>',
].join('\n    ');

// viewport-fit=cover lets the app draw behind the iPhone home indicator; the
// tab bar and docked panels pad themselves with the safe-area insets.
const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />';

const indexPath = 'dist/index.html';
let html = readFileSync(indexPath, 'utf8');
if (!html.includes('</head>')) throw new Error('dist/index.html has no </head>');
if (!html.includes('rel="manifest"')) {
  html = html.replace(/<meta name="viewport"[^>]*>/, VIEWPORT);
  if (!html.includes('viewport-fit=cover')) throw new Error('dist/index.html has no viewport meta to replace');
  writeFileSync(indexPath, html.replace('</head>', `    ${HEAD_TAGS}\n  </head>`));
}

run('workbox generateSW workbox-config.cjs');
