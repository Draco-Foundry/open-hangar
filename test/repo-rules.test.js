'use strict';
// Rules from CLAUDE.md that are cheap to check: no remote code, classic scripts with no
// imports in src/*.js, and npm only with one lockfile. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, out);
    else if (exts.includes(path.extname(e.name))) out.push(p);
  }
  return out;
}

// What remote code looks like: a remote script src, importScripts of a URL, eval, new Function.
const REMOTE = [
  [/<script[^>]*\ssrc\s*=\s*["']?(https?:)?\/\//i, 'a <script src> of a remote URL'],
  [/importScripts\([^)]*["'`](https?:)?\/\//, 'importScripts of a remote URL'],
  [/\beval\s*\(/, 'eval'],
  [/\bnew\s+Function\b/, 'new Function'],
];

function remoteCodeIn(files) {
  const hits = [];
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    for (const [re, what] of REMOTE) {
      if (re.test(text)) hits.push(`${path.relative(root, f)}: ${what}`);
    }
  }
  return hits;
}

test('remote-code patterns are spotted', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-remote-'));
  const f = path.join(tmp, 'x.js');
  fs.writeFileSync(f, "importScripts('https://example.com/a.js');");
  assert.equal(remoteCodeIn([f]).length, 1);
  fs.writeFileSync(f, "importScripts('flags.js');");
  assert.equal(remoteCodeIn([f]).length, 0);
  fs.rmSync(tmp, { recursive: true });
});

test('src/ loads no remote code and uses no eval or new Function', () => {
  assert.deepEqual(remoteCodeIn(walk(path.join(root, 'src'), ['.js', '.html'])), []);
});

test('a built dist/ loads no remote code either (when one exists)', () => {
  assert.deepEqual(remoteCodeIn(walk(path.join(root, 'dist'), ['.js', '.html'])), []);
});

test('src/*.js are classic scripts: no top-level import or export', () => {
  const bad = [];
  for (const name of fs.readdirSync(path.join(root, 'src'))) {
    if (!name.endsWith('.js')) continue;
    const text = fs.readFileSync(path.join(root, 'src', name), 'utf8');
    if (/^(import\s|import\(|import\{|export\s)/m.test(text)) bad.push(name);
  }
  assert.deepEqual(bad, []);
});

test('npm only: one package-lock.json at the root, no other lockfile', () => {
  const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const locks = tracked.filter((f) =>
    /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|npm-shrinkwrap\.json)$/.test(
      f,
    ),
  );
  assert.deepEqual(locks, ['package-lock.json']);
});
