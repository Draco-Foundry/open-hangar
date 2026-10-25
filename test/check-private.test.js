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

test('.env files fail, templates pass', async () => {
  const { privateProblems } = await lib();
  const read = () => 'A=1';
  assert.equal(privateProblems(['.env', '.env.local', 'server/.env.production'], read).length, 3);
  assert.deepEqual(privateProblems(['.env.example', 'docs/environment.md'], read), []);
});

test('key-shaped text fails', async () => {
  const { privateProblems } = await lib();
  const keys = {
    'a.txt': '-----BEGIN RSA PRIVATE ' + 'KEY-----\nabc',
    'b.txt': 'id AKIA' + 'ABCDEFGHIJKLMNOP',
    'c.txt': 'ghp_' + 'a'.repeat(36),
    'd.txt': 'sk-ant-' + 'x'.repeat(40),
    'e.txt': 'xoxb-' + '1'.repeat(24),
    'ok.txt': 'a sketch-of-a-plan with AKIA in prose',
  };
  const problems = privateProblems(Object.keys(keys), (f) => keys[f]);
  assert.equal(problems.length, 5);
  assert.ok(problems.every((p) => !p.startsWith('ok.txt')));
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
