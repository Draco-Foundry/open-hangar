// Private-files guard: fails if a maintainer's private Claude files or secrets would land
// in this public repo. Four kinds: a CLAUDE.local.md anywhere (each machine's gitignored
// import of the private rules), any file carrying the private repo's marker line (every
// file there starts with it), a .env file (.env.example and the like are fine), and
// text shaped like a key or token. CI runs it on the checkout (.github/workflows/ci.yml);
// the pre-commit hook runs it on what's staged (scripts/hooks/pre-commit).
//
//   node scripts/check-private.mjs           tracked files
//   node scripts/check-private.mjs --staged  files staged for the next commit
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Split so this file doesn't match itself.
export const MARKER = 'claude-private' + ': never commit';

// Key and token shapes. The private key one is split so this file doesn't match itself.
export const SECRET_SHAPES = [
  ['a private key block', new RegExp('-----BEGIN [A-Z ]*PRIVATE ' + 'KEY-----')],
  ['an AWS access key id', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['a GitHub token', /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})/],
  ['an Anthropic or OpenAI key', /\bsk-(ant-)?[A-Za-z0-9_-]{32,}/],
  ['a Slack token', /\bxox[abprs]-[A-Za-z0-9-]{20,}/],
];

const ENV_FILE = /(^|\/)\.env(\.[^/]*)?$/i;
const ENV_TEMPLATE = /\.(example|sample|template|dist)$/i;

export function privateProblems(files, read) {
  const problems = [];
  for (const file of files) {
    if (ENV_FILE.test(file) && !ENV_TEMPLATE.test(file)) {
      problems.push(`${file}: .env files hold secrets and stay local (they're in .gitignore)`);
      continue;
    }
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
    for (const [what, shape] of SECRET_SHAPES)
      if (shape.test(text)) problems.push(`${file}: looks like it holds ${what}`);
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
