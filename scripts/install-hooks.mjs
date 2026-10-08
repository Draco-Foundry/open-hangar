// `npm install` / `npm ci` runs this (package.json "prepare"): points git at
// scripts/hooks, so `git push` runs the fast checks first (scripts/hooks/pre-push).
// Same as `git config core.hooksPath scripts/hooks`. Outside a git checkout (a
// source zip, a tarball) it quietly does nothing.
import { execFileSync } from 'node:child_process';

try {
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
  execFileSync('git', ['config', 'core.hooksPath', 'scripts/hooks'], { stdio: 'ignore' });
} catch {
  // Not a git checkout, or no git: nothing to install.
}
