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

test('fetchShipCatalog throws when any page fails (so nothing half-empty is cached)', async () => {
  const page = (data, last) => ({
    ok: true,
    json: async () => ({ data, meta: { last_page: last } }),
  });
  const ship = { name: 'Gladius', slug: 'gladius', msrp: 90 };
  // Game-file list OK, ship matrix down.
  const matrixDown = async (url) =>
    /shipmatrix/.test(url) ? { ok: false, status: 503 } : page([ship], 1);
  await assert.rejects(OH.fetchShipCatalog(matrixDown), /HTTP 503/);
  delete store.netDown; // a new outage below, not the one above
  // Second page of the game-file list fails.
  const midWalk = async (url) =>
    /number%5D=2/.test(url) && !/shipmatrix/.test(url)
      ? { ok: false, status: 429 }
      : page([ship], 2);
  await assert.rejects(OH.fetchShipCatalog(midWalk), /HTTP 429/);
});

test('wikiImageUrls caches nothing when the request fails', async () => {
  delete store.wikiFiles;
  const down = async () => ({ ok: false, status: 503 });
  assert.deepEqual(await OH.wikiImageUrls(['Referral Pulse.jpg'], down), {});
  assert.equal(store.wikiFiles, undefined);
  let calls = 0;
  const up = async () => {
    calls++;
    return {
      ok: true,
      json: async () => ({
        query: {
          pages: { 1: { title: 'File:Referral Pulse.jpg', imageinfo: [{ thumburl: 'u' }] } },
        },
      }),
    };
  };
  // Right after an outage the site is left alone for a while: no request at all.
  assert.deepEqual(await OH.wikiImageUrls(['Referral Pulse.jpg'], up), {});
  assert.equal(calls, 0);
  delete store.netDown; // ten minutes later
  assert.deepEqual(await OH.wikiImageUrls(['Referral Pulse.jpg'], up), {
    'Referral Pulse.jpg': 'u',
  });
  assert.equal(calls, 1); // retried after the failure, not stuck on a cached miss
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
