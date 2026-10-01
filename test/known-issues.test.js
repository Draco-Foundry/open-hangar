'use strict';
// Known Issues page (OH.parseKnownIssues, #175): only open bug / scan-broken
// issues from GitHub's list, never pull requests, scan-broken first.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = globalThis;
global.chrome = { storage: { local: { get: async () => ({}), set: async () => {} } } };
require('../src/lib.js');
const OH = globalThis.OH;

const issue = (number, labels, created, extra = {}) => ({
  number,
  title: `Issue ${number}`,
  html_url: `https://github.com/Draco-Foundry/open-hangar/issues/${number}`,
  created_at: created,
  labels: labels.map((name) => ({ name })),
  ...extra,
});

test('keeps bug and scan-broken issues, scan-broken first, then newest', () => {
  const out = OH.parseKnownIssues([
    issue(1, ['bug'], '2026-09-01T00:00:00Z'),
    issue(2, ['enhancement'], '2026-09-20T00:00:00Z'),
    issue(3, ['bug'], '2026-09-25T00:00:00Z'),
    issue(4, ['scan-broken'], '2026-08-01T00:00:00Z'),
    issue(5, ['bug'], '2026-09-30T00:00:00Z', { pull_request: {} }),
  ]);
  assert.deepEqual(
    out.map((i) => i.number),
    [4, 3, 1],
  );
  assert.equal(out[0].url, 'https://github.com/Draco-Foundry/open-hangar/issues/4');
});

test('anything odd is dropped, not shown', () => {
  assert.deepEqual(OH.parseKnownIssues(null), []);
  assert.deepEqual(OH.parseKnownIssues({ message: 'API rate limit exceeded' }), []);
  const bad = OH.parseKnownIssues([
    issue(7, ['bug'], '2026-09-01T00:00:00Z', { html_url: 'javascript:alert(1)' }),
    { title: 'no number', labels: [{ name: 'bug' }] },
  ]);
  assert.deepEqual(bad, []);
});
