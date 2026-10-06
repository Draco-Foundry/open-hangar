'use strict';
// Known Issues page (OH.shapeKnownIssues, #175): openhangar.space's known-issues
// feed, checked: only bug / scan-broken issues of this repo, scan-broken first.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = globalThis;
global.chrome = { storage: { local: { get: async () => ({}), set: async () => {} } } };
require('../src/lib.js');
const OH = globalThis.OH;

const issue = (number, labels, created, extra = {}) => ({
  number,
  title: `Issue ${number}`,
  url: `https://github.com/Draco-Foundry/open-hangar/issues/${number}`,
  createdAt: created,
  labels,
  ...extra,
});

test('keeps bug and scan-broken issues, scan-broken first, then newest', () => {
  const out = OH.shapeKnownIssues([
    issue(1, ['bug'], '2026-09-01T00:00:00Z'),
    issue(2, ['enhancement'], '2026-09-20T00:00:00Z'),
    issue(3, ['bug'], '2026-09-25T00:00:00Z'),
    issue(4, ['scan-broken'], '2026-08-01T00:00:00Z'),
  ]);
  assert.deepEqual(
    out.map((i) => i.number),
    [4, 3, 1],
  );
  assert.equal(out[0].url, 'https://github.com/Draco-Foundry/open-hangar/issues/4');
});

test('anything odd is dropped, not shown', () => {
  assert.deepEqual(OH.shapeKnownIssues(null), []);
  assert.deepEqual(OH.shapeKnownIssues({ error: 'Feed offline.' }), []);
  const bad = OH.shapeKnownIssues([
    issue(7, ['bug'], '2026-09-01T00:00:00Z', { url: 'javascript:alert(1)' }),
    issue(8, ['bug'], '2026-09-01T00:00:00Z', { url: 'https://github.com/someone/else/issues/8' }),
    { title: 'no number', labels: ['bug'] },
  ]);
  assert.deepEqual(bad, []);
});

test('getKnownIssues: a 503 with Retry-After keeps quiet until then, no error shown', async () => {
  const mem = {};
  global.chrome.storage.local.get = async (k) => (k in mem ? { [k]: mem[k] } : {});
  global.chrome.storage.local.set = async (o) => Object.assign(mem, o);
  let calls = 0;
  const busy = async () => {
    calls++;
    return new Response('{"error":"Feed offline."}', {
      status: 503,
      headers: { 'retry-after': '300' },
    });
  };
  assert.equal(await OH.getKnownIssues({ fetchFn: busy }), null);
  assert.equal(await OH.getKnownIssues({ fetchFn: busy, force: true }), null);
  assert.equal(calls, 1, 'waits out Retry-After, even when asked again');
  assert.ok(mem.feedIssues.retryAt - Date.now() > 290e3);
});
