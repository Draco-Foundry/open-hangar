'use strict';
// Your Subscriber Store (#418, the subStore build flag): the parser on invented answers
// in RSI's shape (no real data), the reader's rules (only for a signed-in subscriber,
// once a day, pages until totalCount, page size 100 with RSI's 20 as the fallback, stop
// on a refusal, never a short list over a fuller one), and what sync sends: only the
// item keys the sync format allows, never the account. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');

let store = {};
global.window = globalThis;
global.chrome = {
  storage: {
    local: {
      get: async (k) => {
        const keys = k == null ? Object.keys(store) : Array.isArray(k) ? k : [k];
        return Object.fromEntries(
          keys.filter((x) => x in store).map((x) => [x, structuredClone(store[x])]),
        );
      },
      set: async (o) => Object.assign(store, structuredClone(o)),
      remove: async (k) => [].concat(k).forEach((x) => delete store[x]),
    },
  },
  runtime: { getManifest: () => ({ version: '0.0.0' }) },
};
require('../src/flags.js');
require('../src/lib.js');
const OH = globalThis.OH;
const SHAPE = require('../src/hangar-shape.js');
test.beforeEach(() => {
  store = {};
});

const SUB = { loggedIn: true, nickname: 'TestPilot', subscriber: { type: 'Imperator' } };
const noPause = () => Promise.resolve();

// One invented SKU in the shape RSI answers, with the fields we never keep.
const sku = (n, extra = {}) => ({
  id: 900000 + n,
  slug: `test-item-${n}`,
  name: `Test Item ${n}`,
  title: `Test Item ${n}`,
  subtitle: 'Subscribers Store',
  url: `/pledge/Subscribers-Store/Test-Item-${n}`,
  excerpt: 'An invented item.',
  media: { thumbnail: { storeSmall: `https://media.robertsspaceindustries.com/t${n}/s.jpg` } },
  nativePrice: { amount: 3000, discounted: 2100, discountDescription: '30% off' },
  price: { amount: 3300, discounted: null },
  stock: { available: true, unlimited: false, show: true, level: 'AVAILABLE', qty: 7 },
  tags: [{ name: 'Kits' }],
  isWarbond: false,
  isPackage: true,
  isVip: false,
  ...extra,
});
const answer = (resources, totalCount) => [
  { data: { store: { listing: { resources, count: resources.length, totalCount } } } },
  // RSI's page batches account queries with it; none of that is ever kept.
  { data: { account: { badges: [1, 2], displayName: 'TestPilot' } } },
];

test('parseSubStore: only the kept fields, in whole cents (invented answer)', () => {
  const out = OH.parseSubStore(
    answer(
      [
        sku(1),
        sku(2, {
          title: '',
          nativePrice: { amount: 500, discounted: null },
          stock: { unlimited: true },
          isPackage: false,
        }),
        sku(3, {
          url: 'javascript:alert(1)',
          media: { thumbnail: { storeSmall: 'http://x.test/a' } },
        }),
        sku(4, { id: 'not-a-number' }),
        sku(5, { name: '', title: '' }),
        null,
      ],
      5,
    ),
  );
  assert.equal(out.totalCount, 5);
  assert.equal(out.items.length, 3);
  assert.deepEqual(out.items[0], {
    id: '900001',
    name: 'Test Item 1',
    url: 'https://robertsspaceindustries.com/pledge/Subscribers-Store/Test-Item-1',
    img: 'https://media.robertsspaceindustries.com/t1/s.jpg',
    price: 2100, // nativePrice (USD) first, not the taxed price
    was: 3000,
    pack: true,
    inStock: true,
  });
  assert.equal(out.items[1].name, 'Test Item 2'); // title empty: name
  assert.equal(out.items[1].price, 500);
  assert.equal(out.items[1].was, null);
  assert.equal(out.items[1].inStock, true); // unlimited stock
  assert.equal(out.items[2].url, null); // never a javascript: link
  assert.equal(out.items[2].img, null); // never off RSI
  assert.doesNotMatch(JSON.stringify(out), /badges|displayName|isVip|excerpt|30% off/);
});

test('parseSubStore: not a listing → null', () => {
  assert.equal(OH.parseSubStore(null), null);
  assert.equal(OH.parseSubStore({ data: { store: null } }), null);
  assert.equal(OH.parseSubStore([{ errors: [{ message: 'x' }] }]), null);
});

// A fake RSI: `total` items, its own page size `size`, refusing sizes over `maxAsk`.
function fakeRsi({ total = 250, size = Infinity, maxAsk = Infinity, fail = {} } = {}) {
  const calls = [];
  const fetchFn = async (url, init) => {
    const body = JSON.parse(init.body)[0];
    const { page, limit } = body.variables.query;
    calls.push({ url, page, limit, op: body.operationName, init });
    if (fail[page]) return new Response('', { status: fail[page] });
    if (limit > maxAsk) return Response.json([{ errors: [{ message: 'limit' }] }]);
    const per = Math.min(limit, size);
    const from = (page - 1) * per;
    const n = Math.max(0, Math.min(per, total - from));
    return Response.json(
      answer(
        Array.from({ length: n }, (_, i) => sku(from + i + 1)),
        total,
      ),
    );
  };
  return { calls, fetchFn };
}

test('getSubStore: signed out or not a subscriber, RSI is never asked', async () => {
  const rsi = fakeRsi();
  const opts = { fetchFn: rsi.fetchFn, pause: noPause };
  assert.equal(
    (await OH.getSubStore({ ...opts, account: { loggedIn: false } })).error,
    'signed-out',
  );
  const plain = { loggedIn: true, nickname: 'TestPilot', subscriber: null };
  assert.equal((await OH.getSubStore({ ...opts, account: plain })).error, 'not-subscriber');
  assert.equal(rsi.calls.length, 0);
});

test('getSubStore: pages of 100 in your session until totalCount, then once a day', async () => {
  const rsi = fakeRsi({ total: 250 });
  const r = await OH.getSubStore({ account: SUB, fetchFn: rsi.fetchFn, pause: noPause });
  assert.equal(r.ok, true);
  assert.equal(r.list.items.length, 250);
  assert.equal(r.list.total, 250);
  assert.equal(r.list.partial, false);
  assert.deepEqual(
    rsi.calls.map((c) => [c.page, c.limit]),
    [
      [1, 100],
      [2, 100],
      [3, 100],
    ],
  );
  assert.equal(rsi.calls[0].url, 'https://robertsspaceindustries.com/graphql');
  assert.equal(rsi.calls[0].op, 'GetBrowseSkusByFilter');
  assert.equal(rsi.calls[0].init.credentials, 'include');
  assert.equal(store.subStore.items.length, 250);
  assert.equal(store.subStore.nickname, 'TestPilot');
  // The same day: the saved list, no request.
  const again = await OH.getSubStore({ account: SUB, fetchFn: rsi.fetchFn, pause: noPause });
  assert.equal(again.list.items.length, 250);
  assert.equal(rsi.calls.length, 3);
  // Another account's saved list is never handed out.
  assert.equal(await OH.getSubStoreCached({ ...SUB, nickname: 'Someone' }), null);
});

test('getSubStore: RSI refuses 100 a page, so 20, then the size it really uses', async () => {
  const rsi = fakeRsi({ total: 45, maxAsk: 20 });
  const r = await OH.getSubStore({ account: SUB, fetchFn: rsi.fetchFn, pause: noPause });
  assert.equal(r.list.items.length, 45);
  assert.deepEqual(
    rsi.calls.map((c) => c.limit),
    [100, 20, 20, 20],
  );
});

test('getSubStore: a refusal keeps the last list and waits a day; a short read never wins', async () => {
  const good = fakeRsi({ total: 150 });
  await OH.getSubStore({ account: SUB, fetchFn: good.fetchFn, pause: noPause });
  // A day later, page 2 is refused: 100 of 150 never replaces the 150.
  store.subStore.at -= 25 * 3600e3;
  const short = fakeRsi({ total: 150, fail: { 2: 429 } });
  const r = await OH.getSubStore({ account: SUB, fetchFn: short.fetchFn, pause: noPause });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'busy');
  assert.equal(r.list.items.length, 150);
  assert.equal(store.subStore.items.length, 150);
  // The failed try counts for the day: no request again until it's up.
  const after = fakeRsi({ total: 150 });
  await OH.getSubStore({ account: SUB, fetchFn: after.fetchFn, pause: noPause });
  assert.equal(after.calls.length, 0);
  // Refused outright on page 1 (signed out on RSI's side): the old list stays. (The 429
  // above marked RSI down for a few minutes: that mark is gone by then.)
  store = { subStore: store.subStore };
  store.subStore.triedAt -= 25 * 3600e3;
  store.subStore.at -= 25 * 3600e3;
  const refused = fakeRsi({ fail: { 1: 403 } });
  const x = await OH.getSubStore({ account: SUB, fetchFn: refused.fetchFn, pause: noPause });
  assert.equal(x.error, 'refused');
  assert.equal(store.subStore.items.length, 150);
});

test('sync: sources.subStore carries the allowed keys only, and fits the sync format', async () => {
  const rsi = fakeRsi({ total: 3 });
  const { list } = await OH.getSubStore({ account: SUB, fetchFn: rsi.fetchFn, pause: noPause });
  // Something stored next to an item later never rides along.
  list.items[0].badges = [1];
  const db = { schemaVersion: SHAPE.DB_VERSION, sources: {} };
  const payload = SHAPE.exportPayload({ db, subStore: list, appVersion: '0.3.0', now: 0 });
  assert.deepEqual(Object.keys(payload.sources.subStore), ['items', 'scannedAt', 'meta']);
  assert.equal(payload.sources.subStore.scannedAt, list.at);
  assert.deepEqual(payload.sources.subStore.meta, { total: 3, complete: true });
  assert.equal(payload.sources.subStore.items.length, 3);
  assert.equal(payload.sources.subStore.items[0].badges, undefined);
  assert.equal(SHAPE.checkPayload(JSON.parse(JSON.stringify(SHAPE.syncPayload(payload)))), null);
  // Our hangar page's view leaves it out, and no list leaves sources as they were.
  assert.equal(SHAPE.hangarView(payload).sources.subStore, undefined);
  assert.equal(SHAPE.exportPayload({ db, now: 0 }).sources.subStore, undefined);
  // A partial read says so.
  const half = SHAPE.exportPayload({ db, subStore: { ...list, partial: true }, now: 0 });
  assert.equal(half.sources.subStore.meta.complete, false);
});

test('the read is the subStore flag: off in the repo, the sync leaves it out', async () => {
  assert.equal(OH.flags.subStore, false);
  await OH.getSubStore({ account: SUB, fetchFn: fakeRsi({ total: 2 }).fetchFn, pause: noPause });
  assert.ok(store.subStore);
  store.account = SUB;
  const payload = await OH.exportDB({ schemaVersion: SHAPE.DB_VERSION, sources: {} });
  assert.equal(payload.sources.subStore, undefined);
});
