'use strict';

/* Updates page helpers (OH.compareVersions / parseChangelog / inlineMarkdown). Run: `npm test`. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = globalThis;
global.chrome = { storage: { local: { get: async () => ({}), set: async () => {} } } };
require('../src/lib.js');
const OH = globalThis.OH;

test('compareVersions orders numerically', () => {
  assert.ok(OH.compareVersions('0.2.10', '0.2.9') > 0);
  assert.ok(OH.compareVersions('0.2.8', '0.2.9') < 0);
  assert.equal(OH.compareVersions('0.3', '0.3.0'), 0);
});

test('parseChangelog reads versions, dates, intros and wrapped bullets', () => {
  const md = [
    '# Changelog',
    '',
    '## Unreleased',
    '',
    '- not shipped yet',
    '',
    '## 0.2.8 — 2026-09-28',
    '',
    'Intro line.',
    '',
    '- **Thing.** first line',
    '  continues here.',
    '- Second.',
    '',
    '## 0.2.0 – 0.2.6 — June 2026',
    '',
    '- **0.2.6:** hardening.',
  ].join('\n');
  const r = OH.parseChangelog(md);
  assert.equal(r.length, 2);
  assert.deepEqual(
    { v: r[0].version, d: r[0].date, intro: r[0].intro, items: r[0].items },
    {
      v: '0.2.8',
      d: '2026-09-28',
      intro: ['Intro line.'],
      items: ['**Thing.** first line continues here.', 'Second.'],
    },
  );
  assert.equal(r[1].title, '0.2.0 – 0.2.6');
  assert.equal(r[1].version, '0.2.0');
  assert.equal(r[1].date, 'June 2026');
});

test('the real CHANGELOG parses and has the current version', () => {
  const md = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
  const v = require('../manifest.json').version;
  const r = OH.parseChangelog(md);
  const cur = r.find((x) => x.version === v);
  assert.ok(cur, `CHANGELOG has a section for ${v}`);
  assert.ok(cur.items.length > 0);
  assert.ok(r.every((x) => !/unreleased/i.test(x.title)));
});

test('inlineMarkdown escapes and only links http(s)', () => {
  assert.equal(
    OH.inlineMarkdown('**Bold** `code` [site](https://openhangar.space) <b>'),
    '<strong>Bold</strong> <code>code</code> <a href="https://openhangar.space" target="_blank" rel="noopener">site</a> &lt;b&gt;',
  );
  assert.ok(!OH.inlineMarkdown('[x](javascript:alert(1))').includes('<a'));
});
