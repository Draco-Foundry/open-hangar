'use strict';
// Private-files guard (scripts/check-private.mjs): CLAUDE.local.md and files from the
// private rules repo never reach this public repo. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');

const lib = () => import('../scripts/check-private.mjs');

test('a CLAUDE.local.md anywhere fails, whatever it holds', async () => {
  const { privateProblems } = await lib();
  const read = () => '@../claude-private/open-hangar.md';
  assert.equal(privateProblems(['CLAUDE.local.md'], read).length, 1);
  assert.equal(privateProblems(['docs/claude.local.md'], read).length, 1);
});

test('a file carrying the private marker fails', async () => {
  const { privateProblems, MARKER } = await lib();
  const files = {
    'docs/notes.md': `<!-- ${MARKER} -->\n# Notes\n`,
    'README.md': '# Open Hangar\n',
  };
  const problems = privateProblems(Object.keys(files), (f) => files[f]);
  assert.deepEqual(problems.length, 1);
  assert.match(problems[0], /^docs\/notes\.md:/);
});

test('ordinary files, CLAUDE.md and unreadable files pass', async () => {
  const { privateProblems } = await lib();
  const read = (f) => {
    if (f === 'gone.md') throw new Error('ENOENT');
    return 'Rules for anyone changing this public repo.';
  };
  assert.deepEqual(privateProblems(['CLAUDE.md', 'AGENTS.md', 'gone.md'], read), []);
});

test('the repo itself is clean', async () => {
  const { execFileSync } = require('node:child_process');
  const path = require('node:path');
  const out = execFileSync('node', [path.join('scripts', 'check-private.mjs')], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
  });
  assert.match(out, /^check-private: ok/);
});
