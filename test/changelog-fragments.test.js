'use strict';
// Changelog fragments (scripts/changelog-fragments.mjs, scripts/check-changelog-fragment.mjs):
// reading, ordering, folding, and the warn-only CI check. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const lib = () => import('../scripts/changelog-fragments.mjs');
const check = () => import('../scripts/check-changelog-fragment.mjs');
const FIXTURE = path.join(__dirname, 'fixtures', 'changelog-fragments', '0.5.2');

function tmp(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-frag-'));
  for (const [n, t] of Object.entries(files)) fs.writeFileSync(path.join(dir, n), t);
  return dir;
}

test('fragments sort by the number the name starts with, then by name; README is skipped', async () => {
  const { readFragments } = await lib();
  const dir = tmp({
    'README.md': '# not a fragment',
    '12-b.md': '- New: b',
    '2-a.md': '- Fixed: a',
    '12-a.md': '- Changed: c',
    'zz-nonumber.md': '- Improved: z',
  });
  assert.deepEqual(
    readFragments(dir).map((f) => f.name),
    ['2-a.md', '12-a.md', '12-b.md', 'zz-nonumber.md'],
  );
});

test('a fragment without a New:/Improved:/Changed:/Fixed: prefix is refused', async () => {
  const { readFragments } = await lib();
  assert.throws(() => readFragments(tmp({ '1-x.md': '- Added: nope' })), /1-x\.md/);
  assert.throws(() => readFragments(tmp({ '1-x.md': '' })), /1-x\.md/);
});

test('no folder means no fragments, and the log comes back unchanged', async () => {
  const { readFragments, foldInto } = await lib();
  const frags = readFragments(path.join(os.tmpdir(), 'oh-no-such-dir'));
  assert.deepEqual(frags, []);
  const log = '# Changelog\n\n## Unreleased\n\n## 1.0.0 — 2026-01-01\n\n- Fixed: x\n';
  assert.equal(foldInto(log, frags), log);
});

test('folding goes after the bullets already under Unreleased and leaves the rest alone', async () => {
  const { foldInto } = await lib();
  const log = '# C\n\n## Unreleased\n\n- Fixed: old\n\n## 1.0.0 — 2026-01-01\n\n- Fixed: x\n';
  const out = foldInto(log, [{ name: '1-a.md', bullets: ['- New: a', '- Changed: b'] }]);
  assert.equal(
    out,
    '# C\n\n## Unreleased\n\n- Fixed: old\n- New: a\n- Changed: b\n\n## 1.0.0 — 2026-01-01\n\n- Fixed: x\n',
  );
});

test('the 0.5.2 lines as fragments fold to the 0.5.2 section in CHANGELOG.md', async () => {
  const { readFragments, foldInto } = await lib();
  const log = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
  const section = (text, heading) => {
    const start = text.search(new RegExp(`^## ${heading}`, 'm'));
    const rest = text.slice(start + 3);
    const end = rest.search(/^## /m);
    return text.slice(start, end < 0 ? undefined : start + 3 + end);
  };
  const released = section(log, '0[.]5[.]2 — ')
    .replace(/^## .*\n\n/, '')
    .trim();
  const folded = foldInto(
    '# C\n\n## Unreleased\n\n## 0.5.1 — 2026-10-20\n',
    readFragments(FIXTURE),
  );
  assert.equal(
    section(folded, 'Unreleased')
      .replace(/^## .*\n\n/, '')
      .trim(),
    released,
  );
});

test('the CI check warns for src/, ui/popup/ or ui/basic/ without a fragment, and for nothing else', async () => {
  const { needsFragment } = await check();
  assert.equal(needsFragment(['src/lib.js']), true);
  assert.equal(needsFragment(['src/lib.js', 'changelog.d/760-x.md']), false);
  assert.equal(needsFragment(['ui/popup/Home.svelte']), true);
  assert.equal(needsFragment(['ui/basic/copy.js']), true);
  assert.equal(needsFragment(['ui/scan/runner.js']), false);
  assert.equal(needsFragment(['src/lib.js', 'changelog.d/README.md']), true);
  assert.equal(needsFragment(['docs/dev/git.md', 'ui/scan/runner.js']), false);
});

test('the CI check exits 0 even when it warns', async () => {
  const { execFileSync } = require('node:child_process');
  const dir = tmp({ 'files.json': JSON.stringify([{ filename: 'src/lib.js' }]) });
  const out = execFileSync(
    'node',
    [
      path.join(__dirname, '..', 'scripts', 'check-changelog-fragment.mjs'),
      path.join(dir, 'files.json'),
    ],
    { encoding: 'utf8' },
  );
  assert.match(out, /^::warning /);
});
