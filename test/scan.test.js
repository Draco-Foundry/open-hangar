'use strict';

/*
 * Scan-resilience tests for src/lib.js (OH.scanSource): transient RSI failures
 * are retried, auth failures are not, and a scan cut short mid-way keeps what
 * it gathered — but never overwrites a bigger earlier scan. Run: `npm test`.
 *
 * lib.js is a browser script, so we give it a minimal fake window/chrome and a
 * scripted fetch. Retry backoff sleeps are skipped (setTimeout runs at once).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// --- fake browser ----------------------------------------------------------
global.window = globalThis;
const store = {};
global.chrome = {
  storage: {
    local: {
      get: async (k) => {
        const keys = k == null ? Object.keys(store) : [].concat(k);
        return Object.fromEntries(keys.filter((x) => x in store).map((x) => [x, store[x]]));
      },
      set: async (o) => Object.assign(store, JSON.parse(JSON.stringify(o))),
      remove: async (k) => [].concat(k).forEach((x) => delete store[x]),
    },
  },
};
// Pages are served as JSON arrays; "parse" just reads them back.
global.OpenHangar = { parsePledges: (html) => JSON.parse(html || '[]') };
global.setTimeout = (fn) => (queueMicrotask(fn), 0);

const PLEDGES = /\/account\/pledges\?page=(\d+)/;
let script; // (page, callNo) => { status, body } | 'network'
let calls;
global.fetch = async (url) => {
  const m = String(url).match(PLEDGES);
  if (!m) return new Response('', { status: 404 }); // account lookups etc.
  const page = Number(m[1]);
  calls[page] = (calls[page] || 0) + 1;
  const r = script(page, calls[page]);
  if (r === 'network') throw new TypeError('Failed to fetch');
  return new Response(r.body ?? '[]', { status: r.status ?? 200 });
};

require('../src/lib.js');
const OH = globalThis.OH;

const items = (page, n = 10) =>
  JSON.stringify(Array.from({ length: n }, (_, i) => ({ id: `p${page}-${i}`, name: `Ship ${i}` })));
// 3 full pages, then RSI clamps to the last page (no new ids → stop).
const healthy = (page) => ({ body: items(Math.min(page, 3)) });

async function reset(prevItems) {
  for (const k of Object.keys(store)) delete store[k];
  calls = {};
  if (prevItems) {
    store.db = { schemaVersion: 2, sources: { hangar: { items: prevItems, scannedAt: 1 } } };
  }
}

test('healthy scan collects every page', async () => {
  await reset();
  script = healthy;
  const r = await OH.scanSource('hangar');
  assert.equal(r.ok, true);
  assert.equal(r.items.length, 30);
  assert.equal(r.partial, undefined);
});

test('transient 503 and network errors are retried, then the scan completes', async () => {
  await reset();
  script = (page, n) => {
    if (page === 2 && n === 1) return { status: 503 };
    if (page === 2 && n === 2) return 'network';
    return healthy(page);
  };
  const retries = [];
  const r = await OH.scanSource('hangar', (page, c, retry) => retry && retries.push(retry));
  assert.equal(r.ok, true);
  assert.equal(r.items.length, 30);
  assert.equal(calls[2], 3); // 1 try + 2 retries
  assert.deepEqual(retries, [
    { attempt: 1, of: 3 },
    { attempt: 2, of: 3 },
  ]);
});

test('401 fails fast without retrying', async () => {
  await reset();
  script = (page) => (page === 1 ? { status: 401 } : healthy(page));
  const r = await OH.scanSource('hangar');
  assert.equal(r.ok, false);
  assert.match(r.error, /session may have expired/);
  assert.equal(calls[1], 1);
});

test('persistent failure on page 1 is an error (nothing gathered)', async () => {
  await reset();
  script = () => ({ status: 500 });
  const r = await OH.scanSource('hangar');
  assert.equal(r.ok, false);
  assert.match(r.error, /RSI responded 500/);
  assert.equal(calls[1], 4); // 1 try + 3 retries
});

test('mid-scan failure keeps the partial result when there is no bigger earlier scan', async () => {
  await reset();
  script = (page) => (page === 3 ? { status: 502 } : healthy(page));
  const r = await OH.scanSource('hangar');
  assert.equal(r.ok, true);
  assert.equal(r.items.length, 20);
  assert.match(r.partial, /stopped at page 3/);
  assert.equal(store.db.sources.hangar.items.length, 20);
});

test('mid-scan failure never overwrites a bigger earlier scan', async () => {
  const previous = JSON.parse(items(9, 25));
  await reset(previous);
  script = (page) => (page === 2 ? 'network' : healthy(page));
  const r = await OH.scanSource('hangar');
  assert.equal(r.ok, false);
  assert.match(r.error, /kept your previous scan of 25/);
  assert.equal(store.db.sources.hangar.items.length, 25); // untouched
});

test('429 is retried (rate limit)', async () => {
  await reset();
  script = (page, n) => (page === 1 && n === 1 ? { status: 429 } : healthy(page));
  const r = await OH.scanSource('hangar');
  assert.equal(r.ok, true);
  assert.equal(calls[1], 2);
});
