'use strict';
// Your Subscriber Store (#418): parser on an invented fixture (no real data), and
// the reader's rules: only for a signed-in subscriber, once a day, pages until
// totalCount, page size 100 with RSI's 20 as the fallback, stop on a refusal,
// never a short list over a fuller one. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
require('../src/lib.js');
const OH = globalThis.OH;
test.beforeEach(() => {
  store = {};
});

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'sub-store-page.json'), 'utf8'),
);
const SUB = { loggedIn: true, nickname: 'Test_Pilot', subscriber: { type: 'Imperator' } };
const noPause = () => Promise.resolve();

test('parseSubStore: names, dollars, pictures, stock, chips (invented fixture)', () => {
  const out = OH.parseSubStore(fixture);
  assert.equal(out.totalCount, 5);
  assert.equal(out.items.length, 3); // the nameless one and the null are dropped
  const [paint, helmet, plush] = out.items;
  assert.deepEqual(paint, {
    id: '900001',
    name: 'Nebula Drift Paint',
    sub: 'Example Hauler',
    url: 'https://robertsspaceindustries.com/en/pledge/Subscribers-Store/Nebula-Drift-Paint',
    img: 'https://media.example-rsi.test/aaa/store_small/nebula.jpg',
    price: 5, // nativePrice (USD) first, not the taxed price
    was: null,
    warbond: false,
    pack: false,
    available: true,
    kind: 'Paints',
    tiers: ['Imperator'], // from its own tag
    tags: ['Paints', 'Imperator'],
  });
  assert.equal(helmet.name, 'Quasar Explorer Helmet'); // title empty: name
  assert.equal(helmet.img, 'https://robertsspaceindustries.com/media/bbb/store_small/helmet.jpg');
  assert.equal(helmet.price, 9); // the sale price
  assert.equal(helmet.was, 12);
  assert.equal(helmet.warbond, true);
  assert.equal(helmet.available, false);
  assert.equal(helmet.kind, 'Armor');
  assert.deepEqual(helmet.tiers, ['Centurion']); // from its label
  assert.equal(plush.url, null); // never a javascript: link
  assert.equal(plush.img, null);
  assert.equal(plush.price, 0);
  assert.equal(plush.available, true); // unlimited stock
  assert.equal(plush.kind, 'Flair'); // Decorations merged into Flair
  assert.deepEqual(plush.tiers, []); // nothing said: no tier guessed
});

test('parseSubStore: not a listing → null', () => {
  assert.equal(OH.parseSubStore(null), null);
  assert.equal(OH.parseSubStore({ data: { store: null } }), null);
  assert.equal(OH.parseSubStore([{ errors: [{ message: 'x' }] }]), null);
});

// Shelf sorting (#418): ~30 invented names in the shapes RSI uses, no tags, so
// only the name decides. Other must stay small.
test('subStoreKind: invented names land on the right shelf, Other stays small', () => {
  const cases = [
    ["Kastak Arms Inquisitor 'Star Kitten' Armor Set", 'Armor'],
    ['Star Kitten Kit', 'Kits and Bundles'],
    ['Banu Ochelo Set', 'Kits and Bundles'],
    ['Coin and Weapon Display Set', 'Flair'],
    ['Nebula Drift Paint', 'Paints'],
    ['Aurora Frostbite Livery', 'Paints'],
    ['Quasar Explorer Helmet', 'Armor'],
    ['Pembroke Undersuit Midnight', 'Armor'],
    ['Corbel Helmet and Armor Set', 'Armor'],
    ['Venture Backpack Sandstorm', 'Armor'],
    ['Gemini S71 Rifle Ember', 'Weapons'],
    ['Arclight Pistol Gold Edition', 'Weapons'],
    ['Devastator Shotgun Bloodline', 'Weapons'],
    ['Frontier Jacket Ochre', 'Clothing'],
    ['Stoneface Balaclava', 'Clothing'],
    ['Hangar Crew Cap', 'Clothing'],
    ['Deckhand Boots Charcoal', 'Clothing'],
    ['Lunar Gala Gown', 'Clothing'],
    ['Racer Flight Suit Crimson', 'Clothing'],
    ['Pilot Goggles Amber', 'Clothing'],
    ['Station Mug Blue', 'Flair'],
    ['Origin 890 Jump Model', 'Flair'],
    ['Tiny Hangar Plushie', 'Flair'],
    ['Racing Trophy 2955', 'Flair'],
    ['Weapon Rack Gunmetal', 'Flair'],
    ['Pico Penguin Dashbot', 'Flair'],
    ['Vanduul Skull Display Case', 'Flair'],
    ['Explorer Starter Pack', 'Kits and Bundles'],
    ['Frontier Fashion Collection', 'Kits and Bundles'],
    ['Standalone Ship Example Hauler', 'Ships'],
    ['Mystery Item 42', 'Other'],
  ];
  for (const [name, want] of cases) assert.equal(OH.subStoreKind({ name }), want, name);
  const other = cases.filter(([name]) => OH.subStoreKind({ name }) === 'Other').length;
  assert.ok(other <= 1, `Other has ${other}`);
  // Specific RSI tags win; a vague or mixed tag set falls back to the name.
  assert.equal(OH.subStoreKind({ tags: ['Paints', 'Imperator'], name: 'Mystery' }), 'Paints');
  assert.equal(OH.subStoreKind({ tags: ['Imperator'], name: 'Frontier Jacket' }), 'Clothing');
  assert.equal(
    OH.subStoreKind({ tags: ['Armor', 'Weapons'], name: 'Combat Ready Bundle' }),
    'Kits and Bundles',
  );
  // Word boundaries: "Kitten" is not a kit, "Arms" (a maker) is not armor.
  assert.equal(OH.subStoreKind({ name: 'Kitten Ears' }), 'Other');
  assert.equal(OH.subStoreKind({ name: 'Kastak Arms Coda' }), 'Other');
});

// A fake RSI: `total` items, honoring the asked limit up to `cap`.
function fakeRsi({ total, cap = 100, refuse = {}, status = {} }) {
  const calls = [];
  const fetchFn = async (url, init) => {
    const body = JSON.parse(init.body)[0];
    const { page, limit } = body.variables.query;
    calls.push({ url, page, limit, credentials: init.credentials, op: body.operationName });
    if (status[page]) return new Response('', { status: status[page] });
    if (refuse[limit])
      return Response.json([{ errors: [{ message: 'limit too large' }], data: null }]);
    const size = Math.min(limit, cap);
    const start = (page - 1) * size;
    const n = Math.max(0, Math.min(size, total - start));
    const resources = Array.from({ length: n }, (_, i) => ({
      id: start + i + 1,
      name: `Item ${start + i + 1}`,
      url: `/en/pledge/x/${start + i + 1}`,
      nativePrice: { amount: 1000, discounted: null },
      stock: { available: true },
      tags: [],
    }));
    return Response.json([
      { data: { store: { listing: { resources, count: n, totalCount: total } } } },
    ]);
  };
  return { calls, fetchFn };
}

test('getSubStore: signed out or not a subscriber → no request', async () => {
  const { calls, fetchFn } = fakeRsi({ total: 10 });
  const out = await OH.getSubStore({ account: { loggedIn: false }, fetchFn, pause: noPause });
  assert.equal(out.error, 'signed-out');
  const none = await OH.getSubStore({
    account: { loggedIn: true, nickname: 'A', subscriber: null },
    fetchFn,
    pause: noPause,
  });
  assert.equal(none.error, 'not-subscriber');
  assert.equal(calls.length, 0);
});

test('getSubStore: 100 per page until totalCount, the RSI graphql op, cached a day', async () => {
  const { calls, fetchFn } = fakeRsi({ total: 379 });
  const out = await OH.getSubStore({ account: SUB, fetchFn, pause: noPause });
  assert.equal(out.ok, true);
  assert.equal(out.list.items.length, 379);
  assert.equal(out.list.total, 379);
  assert.equal(out.list.pageSize, 100);
  assert.equal(out.list.nickname, 'Test_Pilot');
  assert.deepEqual(
    calls.map((c) => c.page),
    [1, 2, 3, 4],
  );
  assert.ok(calls.every((c) => c.url === 'https://robertsspaceindustries.com/graphql'));
  assert.ok(calls.every((c) => c.credentials === 'include' && c.op === 'GetBrowseSkusByFilter'));
  assert.equal(await OH.subStoreDue(), false);
  // Within the day: the cache, no request.
  const again = await OH.getSubStore({ account: SUB, fetchFn, pause: noPause });
  assert.equal(again.list.items.length, 379);
  assert.equal(calls.length, 4);
  // Another account never sees this one's list.
  assert.equal(await OH.getSubStoreCached({ ...SUB, nickname: 'Someone_Else' }), null);
});

test('getSubStore: RSI refuses 100 → asks again at 20', async () => {
  const { calls, fetchFn } = fakeRsi({ total: 45, refuse: { 100: true } });
  const out = await OH.getSubStore({ account: SUB, fetchFn, pause: noPause, force: true });
  assert.equal(out.list.items.length, 45);
  assert.equal(out.list.pageSize, 20);
  assert.deepEqual(
    calls.map((c) => `${c.page}@${c.limit}`),
    ['1@100', '1@20', '2@20', '3@20'],
  );
});

test('getSubStore: RSI quietly caps the page → pages at its size', async () => {
  const { calls, fetchFn } = fakeRsi({ total: 50, cap: 20 });
  const out = await OH.getSubStore({ account: SUB, fetchFn, pause: noPause, force: true });
  assert.equal(out.list.items.length, 50);
  assert.equal(out.list.pageSize, 20);
  assert.deepEqual(
    calls.map((c) => `${c.page}@${c.limit}`),
    ['1@100', '2@20', '3@20'],
  );
});

test('getSubStore: at most 20 pages', async () => {
  const { calls, fetchFn } = fakeRsi({ total: 100000, cap: 20 });
  const out = await OH.getSubStore({ account: SUB, fetchFn, pause: noPause, force: true });
  assert.equal(calls.length, 20);
  assert.equal(out.list.items.length, 400);
});

test('getSubStore: refused or busy → stops, keeps the last good list', async () => {
  const first = fakeRsi({ total: 150 });
  await OH.getSubStore({ account: SUB, fetchFn: first.fetchFn, pause: noPause });
  const refused = fakeRsi({ total: 150, status: { 1: 403 } });
  const r = await OH.getSubStore({
    account: SUB,
    fetchFn: refused.fetchFn,
    pause: noPause,
    force: true,
  });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'refused');
  assert.equal(r.list.items.length, 150);
  assert.equal(refused.calls.length, 1);
  // Page 2 busy: the short read doesn't replace the fuller list.
  delete store.netDown;
  const busy = fakeRsi({ total: 150, status: { 2: 429 } });
  const b = await OH.getSubStore({
    account: SUB,
    fetchFn: busy.fetchFn,
    pause: noPause,
    force: true,
  });
  assert.equal(b.ok, false);
  assert.equal(b.error, 'busy');
  assert.equal(busy.calls.length, 2);
  assert.equal(store.subStore.items.length, 150);
  // A 429 also marks RSI down for a while (OH.guarded): the next try waits.
  assert.ok(store.netDown && store.netDown['robertsspaceindustries.com']);
});
