// Web build: expo export → add PWA tags to index.html → generate the service worker.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

run('expo export -p web');

const HEAD_TAGS = [
  '<link rel="manifest" href="/manifest.webmanifest" />',
  '<meta name="theme-color" content="#2E7D32" />',
  '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-title" content="SpendWise" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
].join('\n    ');

const indexPath = 'dist/index.html';
const html = readFileSync(indexPath, 'utf8');
if (!html.includes('</head>')) throw new Error('dist/index.html has no </head>');
if (!html.includes('rel="manifest"')) writeFileSync(indexPath, html.replace('</head>', `    ${HEAD_TAGS}\n  </head>`));

run('workbox generateSW workbox-config.cjs');
