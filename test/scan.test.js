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
// Backoff sleeps run at once; their lengths are kept in `waits` to check them.
let waits = [];
global.setTimeout = (fn, ms) => (waits.push(ms), queueMicrotask(fn), 0);

const PLEDGES = /\/account\/pledges\?page=(\d+)/;
let script; // (page, callNo) => { status, body } | 'network'
let calls;
let other = []; // every non-pledge request (account lookups etc.)
global.fetch = async (url) => {
  const m = String(url).match(PLEDGES);
  if (!m) {
    other.push(String(url));
    return new Response('', { status: 404 });
  }
  const page = Number(m[1]);
  calls[page] = (calls[page] || 0) + 1;
  const r = script(page, calls[page]);
  if (r === 'network') throw new TypeError('Failed to fetch');
  return new Response(r.body ?? '[]', { status: r.status ?? 200, headers: r.headers });
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
  other = [];
  waits = [];
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

test('a scan given the account makes no account requests and stamps the owner', async () => {
  await reset();
  script = healthy;
  const account = { loggedIn: true, nickname: 'DemoCitizen', displayname: 'Demo Citizen' };
  const r = await OH.scanSource('hangar', null, { account });
  assert.equal(r.ok, true);
  assert.deepEqual(
    other.filter((u) => /\/account\/dashboard|\/citizens\//.test(u)),
    [],
  );
  assert.deepEqual(store.db.owner, { nickname: 'DemoCitizen', displayname: 'Demo Citizen' });
});

test('without the account, the save still looks it up itself', async () => {
  await reset();
  script = healthy;
  await OH.scanSource('hangar');
  assert.ok(other.some((u) => /\/account\/dashboard/.test(u)));
});

test('429: RSI gets 5 s, 10 s, 15 s... of breathing room, then the scan completes (#298)', async () => {
  await reset();
  script = (page, n) => (page === 1 && n <= 4 ? { status: 429 } : healthy(page));
  const r = await OH.scanSource('hangar');
  assert.equal(r.ok, true);
  assert.equal(calls[1], 5);
  assert.deepEqual(
    waits.filter((ms) => ms >= 5000),
    [5000, 10000, 15000, 20000],
  );
});

test('429: a longer Retry-After from RSI is honoured, up to 30 s (#298)', async () => {
  await reset();
  script = (page, n) =>
    page === 1 && n === 1 ? { status: 429, headers: { 'retry-after': '20' } } : healthy(page);
  await OH.scanSource('hangar');
  assert.ok(waits.includes(20000));
});

test('429: after 5 tries the scan gives up instead of pushing on (#298)', async () => {
  await reset();
  script = (page) => (page === 1 ? { status: 429 } : healthy(page));
  const r = await OH.scanSource('hangar');
  assert.equal(r.ok, false);
  assert.match(r.error, /slow down/);
  assert.equal(calls[1], 6);
});

test('scanShape: how completely a scan read the page, and untyped items (#295, #296)', () => {
  const s = OH.scanShape([
    { date: '2020-01-01', value: 10, image: 'x', contents: [{ kind: 'Ship' }, { kind: '' }] },
    { date: null, value: 0, image: null, contents: [{ kind: 'Ship', guessed: true }] },
  ]);
  assert.deepEqual(s, {
    n: 2,
    date: 0.5,
    value: 1,
    contents: 1,
    image: 0.5,
    tiles: 3,
    untyped: 2,
    guessed: 1,
  });
});

test('shapeDrops: flags a field that went from most pledges to none (#295)', () => {
  const prev = { n: 40, date: 0.98, value: 1, contents: 0.9, image: 0.95 };
  assert.deepEqual(OH.shapeDrops(prev, { ...prev, date: 0 }), [
    { field: 'date', label: 'pledge dates', was: 0.98 },
  ]);
  assert.deepEqual(OH.shapeDrops(prev, { ...prev, date: 0.4 }), [], 'a dip is not a drop');
  assert.deepEqual(OH.shapeDrops(prev, { ...prev, n: 3, date: 0 }), [], 'too small to tell');
  assert.deepEqual(OH.shapeDrops(null, { ...prev, date: 0 }), [], 'first scan');
});

test('a hangar scan keeps its shape and warns when RSI stops giving dates (#295)', async () => {
  await reset(Array.from({ length: 25 }, (_, i) => ({ id: `old${i}`, name: 'Old' })));
  store.db.sources.hangar.meta = { shape: { n: 25, date: 0.96, value: 1, contents: 1, image: 1 } };
  script = healthy;
  const r = await OH.scanSource('hangar');
  assert.equal(r.ok, true);
  assert.equal(store.db.sources.hangar.meta.shape.n, 30);
  const log = await OH.getLog();
  assert.ok(log.some((l) => /read no pledge dates/.test(l.msg || l.message || JSON.stringify(l))));
});

// --- Skipping an unchanged hangar (#294) -----------------------------------
// A hangar served from a list, 10 per page, clamping past the end like RSI does.
const pledges = (n, from = 0) =>
  Array.from({ length: n }, (_, i) => ({ id: `h${from + i}`, name: `Pledge ${from + i}` }));
const serve = (list) => (page) => {
  const last = Math.max(1, Math.ceil(list.length / 10));
  const p = Math.min(page, last);
  return { body: JSON.stringify(list.slice((p - 1) * 10, p * 10)) };
};
// A first full scan, then a fresh request count for the rescan.
async function scannedOnce(list) {
  await reset();
  script = serve(list);
  const first = await OH.scanSource('hangar');
  assert.equal(first.ok, true);
  calls = {};
}

test('an unchanged hangar is checked with 3 requests, not every page (#294)', async () => {
  const list = pledges(50);
  await scannedOnce(list);
  assert.equal(store.db.sources.hangar.meta.probe.n, 50);
  const snaps = store.dbHistory.length;
  const r = await OH.scanSource('hangar');
  assert.equal(r.ok, true);
  assert.equal(r.unchanged, true);
  assert.deepEqual(r.items, list);
  assert.deepEqual(calls, { 1: 1, 5: 1, 6: 1 }); // first, last, and RSI clamping after it
  assert.equal(store.dbHistory.length, snaps); // same snapshot, just re-checked
  assert.ok(store.dbHistory.at(-1).checkedAt);
});

test('a short last page needs no clamp check (#294)', async () => {
  await scannedOnce(pledges(45));
  const r = await OH.scanSource('hangar');
  assert.equal(r.unchanged, true);
  assert.deepEqual(calls, { 1: 1, 5: 1 });
});

test('a new pledge on top means a full scan (#294)', async () => {
  const list = pledges(50);
  await scannedOnce(list);
  script = serve([{ id: 'new', name: 'Fresh Pledge' }, ...list]);
  const r = await OH.scanSource('hangar');
  assert.equal(r.unchanged, undefined);
  assert.equal(r.items.length, 51);
  assert.equal(calls[2], 1);
});

test('a pledge melted deep in the hangar means a full scan (#294)', async () => {
  const list = pledges(50);
  await scannedOnce(list);
  script = serve(list.filter((p) => p.id !== 'h23'));
  const r = await OH.scanSource('hangar');
  assert.equal(r.unchanged, undefined);
  assert.equal(r.items.length, 49);
  assert.ok(!r.items.some((p) => p.id === 'h23'));
});

test('a pledge added after a full last page means a full scan (#294)', async () => {
  const list = pledges(50);
  await scannedOnce(list);
  script = serve([...list, { id: 'old', name: 'Reclaimed Oldie' }]);
  const r = await OH.scanSource('hangar');
  assert.equal(r.unchanged, undefined);
  assert.equal(r.items.length, 51);
});

test('a changed pledge on the last page means a full scan (#294)', async () => {
  const list = pledges(45);
  await scannedOnce(list);
  script = serve(list.map((p) => (p.id === 'h44' ? { ...p, name: 'Upgraded' } : p)));
  const r = await OH.scanSource('hangar');
  assert.equal(r.unchanged, undefined);
  assert.equal(r.items.at(-1).name, 'Upgraded');
});

test('a day after the last full scan, the hangar is read in full again (#294)', async () => {
  await scannedOnce(pledges(50));
  store.db.sources.hangar.meta.probe.at -= 25 * 3600e3;
  const r = await OH.scanSource('hangar');
  assert.equal(r.unchanged, undefined);
  assert.equal(calls[2], 1);
  // That full scan starts a fresh day: the next rescan can skip again.
  calls = {};
  assert.equal((await OH.scanSource('hangar')).unchanged, true);
});

test('saved data the probe does not vouch for gets a full scan (#294)', async () => {
  // Made by another version (maybe an older parser).
  await scannedOnce(pledges(50));
  store.db.sources.hangar.meta.probe.v = '0.0.1';
  assert.equal((await OH.scanSource('hangar')).unchanged, undefined);
  // Saved items swapped out (say, a backup restored) since that scan.
  await scannedOnce(pledges(50));
  store.db.sources.hangar.items[3].name = 'Edited';
  assert.equal((await OH.scanSource('hangar')).unchanged, undefined);
  // An earlier version's scan, with no probe at all.
  await scannedOnce(pledges(50));
  delete store.db.sources.hangar.meta.probe;
  assert.equal((await OH.scanSource('hangar')).unchanged, undefined);
});

test('small hangars always get the full scan, it is just as quick (#294)', async () => {
  await scannedOnce(pledges(20));
  const r = await OH.scanSource('hangar');
  assert.equal(r.unchanged, undefined);
  assert.equal(calls[2], 1);
});

test('a hiccup while checking falls back to the full scan (#294)', async () => {
  const list = pledges(50);
  await scannedOnce(list);
  script = (page, n) => (page === 5 && n === 1 ? { status: 403 } : serve(list)(page));
  const r = await OH.scanSource('hangar');
  assert.equal(r.ok, true);
  assert.equal(r.unchanged, undefined);
  assert.equal(r.items.length, 50);
});

test('a partial scan leaves nothing for the next one to skip on (#294)', async () => {
  const list = pledges(50);
  await reset();
  script = (page) => (page === 4 ? { status: 502 } : serve(list)(page));
  const r = await OH.scanSource('hangar');
  assert.ok(r.partial);
  assert.equal(store.db.sources.hangar.meta?.probe, undefined);
});
