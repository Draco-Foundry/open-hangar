// Private-files guard: fails if a maintainer's private Claude files would land in this
// public repo. Two kinds: a CLAUDE.local.md anywhere (each machine's gitignored import
// of the private rules), and any file carrying the private repo's marker line (every
// file there starts with it). CI runs it on the checkout (.github/workflows/ci.yml);
// the pre-commit hook runs it on what's staged (scripts/hooks/pre-commit).
//
//   node scripts/check-private.mjs           tracked files
//   node scripts/check-private.mjs --staged  files staged for the next commit
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Split so this file doesn't match itself.
export const MARKER = 'claude-private' + ': never commit';

export function privateProblems(files, read) {
  const problems = [];
  for (const file of files) {
    if (/(^|\/)CLAUDE\.local\.md$/i.test(file)) {
      problems.push(`${file}: CLAUDE.local.md is local only (it's in .gitignore)`);
      continue;
    }
    let text;
    try {
      text = read(file);
    } catch {
      continue; // deleted or unreadable: nothing to leak
    }
    if (text.includes(MARKER)) problems.push(`${file}: a file from the private rules repo`);
  }
  return problems;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const staged = process.argv.includes('--staged');
  const files = (
    staged
      ? git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'])
      : git(['ls-files', '-z'])
  )
    .split('\0')
    .filter(Boolean);
  // Staged: read what's in the index, not the working copy.
  const read = staged ? (f) => git(['show', `:${f}`]) : (f) => readFileSync(f, 'utf8');
  const problems = privateProblems(files, read);
  if (problems.length) {
    for (const p of problems) console.error(`check-private: ${p}`);
    console.error('check-private: private Claude files never go in this public repo.');
    process.exit(1);
  }
  console.log(`check-private: ok (${files.length} files)`);
}
