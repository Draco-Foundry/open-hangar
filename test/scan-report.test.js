'use strict';
// "Report a Scan Problem" (OH.scanProblemUrl, #250): a prefilled Scan Broken
// issue that fits GitHub's URL limit and carries only what we put in.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = globalThis;
global.chrome = { storage: { local: { get: async () => ({}), set: async () => {} } } };
require('../src/lib.js');
const OH = globalThis.OH;

const header = [
  '```',
  'Open Hangar error report',
  'Version:   0.2.15 (Chrome build)',
  'Browser:   Chrome 141 on Windows',
  'Hangar:    120 items, scanned 2 min ago',
  'Buy-backs: 8 items, scanned 2 min ago',
  'History:   4 snapshots',
  'Set aside: nothing',
  'Catalog:   300 ships (v3, 1 day ago) · ship matrix 280',
  'Log:       last 25 of 25',
];
const report = (n) =>
  [
    ...header,
    ...Array.from({ length: n }, (_, i) => `00:00:${i}  ERROR  hangar  page ${i} failed`),
    '```',
  ].join('\n');

test('fills the Scan Broken template fields', () => {
  const url = new URL(
    OH.scanProblemUrl({
      summary: '120 pledges (partial: page 3)',
      report: report(3),
      version: '0.2.15',
    }),
  );
  assert.equal(
    url.origin + url.pathname,
    'https://github.com/Draco-Foundry/open-hangar/issues/new',
  );
  const p = url.searchParams;
  assert.equal(p.get('template'), 'scan_broken.yml');
  assert.equal(p.get('version'), 'v0.2.15');
  assert.match(p.get('what'), /partial: page 3/);
  assert.match(p.get('report'), /page 2 failed/);
});

test('the field ids exist in the template', () => {
  const tpl = fs.readFileSync(
    path.join(__dirname, '..', '.github', 'ISSUE_TEMPLATE', 'scan_broken.yml'),
    'utf8',
  );
  for (const id of ['what', 'report', 'version'])
    assert.ok(tpl.includes(`id: ${id}\n`) || tpl.includes(`id: ${id}\r\n`), id);
});

test('a long log is trimmed from the oldest end to fit', () => {
  const url = OH.scanProblemUrl({ summary: 'x', report: report(400), version: '1' });
  assert.ok(url.length <= OH.SCAN_REPORT_MAX_URL, `${url.length}`);
  const rep = new URL(url).searchParams.get('report');
  assert.match(rep, /Version:   0\.2\.15/); // header kept
  assert.match(rep, /page 399 failed/); // newest kept
  assert.doesNotMatch(rep, /page 0 failed/); // oldest dropped
  assert.match(rep, /older log lines trimmed/);
  assert.ok(rep.trimEnd().endsWith('```'));
});
