// Web build: expo export → add PWA tags to index.html → generate the service worker.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

run('expo export -p web');

const HEAD_TAGS = [
  '<link rel="manifest" href="/manifest.webmanifest" />',
  // Match the app's header (Paper surface) so the browser chrome blends in.
  '<meta name="theme-color" content="#FFFBFE" media="(prefers-color-scheme: light)" />',
  '<meta name="theme-color" content="#1C1B1F" media="(prefers-color-scheme: dark)" />',
  '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-title" content="SpendWise" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
  // Background before the JS loads (no white flash in dark mode). touch-action
  // stops iOS Safari zooming in when keypad keys are tapped quickly.
  '<style>html,body{background:#FFFBFE;touch-action:manipulation}@media (prefers-color-scheme:dark){html,body{background:#1C1B1F}}</style>',
].join('\n    ');

const indexPath = 'dist/index.html';
const html = readFileSync(indexPath, 'utf8');
if (!html.includes('</head>')) throw new Error('dist/index.html has no </head>');
if (!html.includes('rel="manifest"')) writeFileSync(indexPath, html.replace('</head>', `    ${HEAD_TAGS}\n  </head>`));

run('workbox generateSW workbox-config.cjs');
