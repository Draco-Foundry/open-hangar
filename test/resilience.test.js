'use strict';
// Failures must never overwrite good data: incomplete downloads aren't cached,
// imports keep extras and drop junk rows, history stays within its size cap.
const test = require('node:test');
const assert = require('node:assert/strict');

const store = {};
global.window = globalThis;
global.chrome = {
  storage: {
    local: {
      get: async (k) => {
        if (k == null) return { ...store };
        const keys = Array.isArray(k) ? k : [k];
        return Object.fromEntries(keys.filter((x) => x in store).map((x) => [x, store[x]]));
      },
      set: async (o) => Object.assign(store, o),
      remove: async (k) => {
        for (const x of Array.isArray(k) ? k : [k]) delete store[x];
      },
    },
  },
};
require('../src/lib.js');
const OH = globalThis.OH;
// Each test simulates its own outages: forget the last test's 'site is down'.
test.beforeEach(() => delete store.netDown);

test('the ship-list script: fetchShipCatalog throws when any page fails (nothing half-empty written)', async () => {
  const { fetchShipCatalog } = await import('../scripts/update-ship-catalog.mjs');
  const pause = async () => {};
  const page = (data, last) => ({
    ok: true,
    json: async () => ({ data, meta: { last_page: last } }),
  });
  const ship = { name: 'Gladius', slug: 'gladius', msrp: 90 };
  // Game-file list OK, ship matrix down.
  const matrixDown = async (url) =>
    /shipmatrix/.test(url) ? { ok: false, status: 503 } : page([ship], 1);
  await assert.rejects(fetchShipCatalog(matrixDown, pause), /HTTP 503/);
  // Second page of the game-file list fails.
  const midWalk = async (url) =>
    /number%5D=2/.test(url) && !/shipmatrix/.test(url)
      ? { ok: false, status: 429 }
      : page([ship], 2);
  await assert.rejects(fetchShipCatalog(midWalk, pause), /HTTP 429/);
});

test('a feed that fails caches nothing new and keeps no stale "missing" answer', async () => {
  delete store.feedReferral;
  const down = async () => new Response('', { status: 503 });
  assert.deepEqual(await OH.wikiImageUrls(['Referral Pulse.jpg'], down), {});
  assert.equal(store.feedReferral.data, undefined);
  assert.ok(store.feedReferral.retryAt > Date.now()); // waits before asking again
  let calls = 0;
  const up = async () => {
    calls++;
    return Response.json({
      v: 1,
      events: [],
      images: { 'Referral Pulse.jpg': 'https://media.openhangar.space/pulse.jpg' },
    });
  };
  // Right after an outage the site is left alone for a while: no request at all.
  assert.deepEqual(await OH.wikiImageUrls(['Referral Pulse.jpg'], up), {});
  assert.equal(calls, 0);
  store.feedReferral.retryAt = Date.now() - 1; // ten minutes later
  assert.deepEqual(await OH.wikiImageUrls(['Referral Pulse.jpg'], up), {
    'Referral Pulse.jpg': 'https://media.openhangar.space/pulse.jpg',
  });
  assert.equal(calls, 1); // retried after the failure
});

test('mutateStored queues concurrent writes so none are lost', async () => {
  delete store.q;
  await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      OH.mutateStored('q', (cur = {}) => ({ ...cur, [i]: true })),
    ),
  );
  assert.equal(Object.keys(store.q).length, 20);
});

test('trimHistory keeps the newest snapshots within ~3 MB', () => {
  const big = (i) => ({
    at: i,
    items: Array.from({ length: 2000 }, (_, j) => [String(j), 'Standalone Ship - Something', 100]),
  });
  const hist = Array.from({ length: 100 }, (_, i) => big(i));
  const out = OH.trimHistory(hist);
  assert.ok(out.length < 100 && out.length >= 2);
  assert.equal(out[out.length - 1].at, 99); // newest kept
  assert.ok(out.reduce((n, s) => n + JSON.stringify(s).length, 0) <= 3e6);
  assert.equal(OH.trimHistory(hist.slice(0, 3).map((s) => ({ at: s.at, items: [] }))).length, 3);
});

test('importDB keeps buy-back tokens (meta) and drops junk rows', async () => {
  await OH.importDB({
    schemaVersion: 2,
    sources: {
      hangar: { items: [{ id: '1', name: 'A', value: 5 }, null, 7], scannedAt: 1 },
      buybacks: { items: [{ id: '9', name: 'B' }], scannedAt: 2, meta: { tokens: 2 } },
    },
  });
  const db = await OH.loadDB();
  assert.equal(db.sources.hangar.items.length, 1);
  assert.deepEqual(db.sources.buybacks.meta, { tokens: 2 });
});
