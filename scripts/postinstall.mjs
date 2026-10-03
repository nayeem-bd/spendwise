// Applies patches/ with patch-package. If that fails, the installed copy of a
// patched package is probably stale: a cached node_modules (e.g. Netlify's
// build cache) can hold a package already patched by an OLDER version of its
// patch, which the new patch can't apply on top of. Reinstall those packages
// from the lockfile and try once more.
import { execSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

// "expo-sqlite+57.0.3.patch" -> "expo-sqlite"; "@scope+name+1.0.0.patch" -> "@scope/name"
const patchedPackages = () =>
  readdirSync('patches')
    .filter((f) => f.endsWith('.patch'))
    .map((f) => f.replace(/\+[^+]*\.patch$/, '').replace('+', '/'));

try {
  run('patch-package --error-on-fail');
} catch {
  console.warn('\npatch-package failed; reinstalling patched packages from the lockfile and retrying.\n');
  for (const pkg of patchedPackages()) rmSync(`node_modules/${pkg}`, { recursive: true, force: true });
  run('npm install --no-save --ignore-scripts --no-audit --no-fund');
  run('patch-package --error-on-fail');
}
