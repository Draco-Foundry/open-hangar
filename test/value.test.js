'use strict';

/*
 * Hangar value (OH.makePriceIndex / OH.hangarValue in src/lib.js), against a
 * slim snapshot of the star-citizen.wiki vehicle list (test/fixtures) and the
 * bundled ship-code table. Run: `npm test`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const codes = require('../src/data/ship-codes.json');
const catalog = require('./fixtures/wiki-catalog.json');

global.window = globalThis;
global.chrome = global.chrome || {
  storage: { local: { get: async () => ({}), set: async () => {} } },
};
require('../src/lib.js');
const OH = globalThis.OH;
const priceOf = OH.makePriceIndex(catalog, codes);

test('prices ships by code, name, and reordered names', () => {
  assert.equal(priceOf('Carrack').msrp, 600);
  assert.equal(priceOf('Anvil Carrack').msrp, 600); // manufacturer prefix
  assert.equal(priceOf('Cutlass Black').msrp, 110);
  assert.equal(priceOf('Hercules Starlifter C2').msrp, 400); // reordered
  assert.equal(priceOf('Aurora MR').msrp, 30); // "Aurora Mk I MR"
  assert.equal(priceOf('890 Jump').msrp, 950);
});

test('never guesses a price from a loose match', () => {
  assert.equal(priceOf('Totally Unknown Ship'), null);
  assert.equal(priceOf(''), null);
});

test('hangarValue totals ships and flags pledges paid below store price', () => {
  const items = [
    {
      id: 1,
      name: 'Standalone Ship - Carrack Warbond',
      value: 500,
      contents: [
        { kind: 'Ship', label: 'Carrack' },
        { kind: 'Insurance', label: 'Lifetime Insurance' },
      ],
    },
    {
      id: 2,
      name: 'Standalone Ship - Cutlass Black',
      value: 110,
      contents: [{ kind: 'Ship', label: 'Cutlass Black' }],
    },
    {
      id: 3,
      name: 'Mystery pack',
      value: 50,
      contents: [
        { kind: 'Ship', label: 'Totally Unknown Ship' },
        { kind: 'Ship', label: 'Aurora MR' },
      ],
    },
    { id: 4, name: 'Paint', value: 10, contents: [{ kind: 'Skin', label: 'Some paint' }] },
  ];
  const v = OH.hangarValue(items, priceOf);
  assert.equal(v.ships, 4);
  assert.equal(v.priced, 3);
  assert.equal(v.store, 600 + 110 + 30);
  assert.equal(v.pledges[1].below, true); // paid 500 for a $600 ship
  assert.equal(v.pledges[2].below, false); // paid full price
  assert.equal(v.pledges[3].below, false); // partly unpriced → no verdict
  assert.equal(v.pledges[4], undefined); // no ships
  assert.equal(v.paidPriced, 610);
  assert.equal(v.storePriced, 710);
  assert.deepEqual(v.unpriced, [{ name: 'Totally Unknown Ship', n: 1 }]);
});

test('CCUs are priced as the gap between their ships', () => {
  const items = [
    {
      id: 10,
      name: 'Upgrade - Cutlass Black to Carrack Warbond Edition',
      value: 400,
      isCCU: true,
      ccu: { from: 'Cutlass Black', to: 'Carrack Warbond Edition' },
      contents: [],
    },
  ];
  const v = OH.hangarValue(items, priceOf);
  assert.equal(v.pledges[10].store, 490); // 600 - 110
  assert.equal(v.pledges[10].below, true);
  assert.deepEqual(v.ccu, { n: 1, priced: 1, store: 490, paid: 400 });
  assert.equal(v.store, 0); // CCUs aren't ships
});

test('fleetStats sums cargo and groups by size', () => {
  const { shipOf } = OH.makeShipIndex(catalog, codes);
  const f = OH.fleetStats(
    [
      { contents: [{ kind: 'Ship', label: 'Carrack' }] },
      {
        contents: [
          { kind: 'Ship', label: 'Cutlass Black' },
          { kind: 'Paint', label: 'x' },
        ],
      },
    ],
    shipOf,
  );
  assert.equal(f.ships, 2);
  assert.equal(f.known, 2);
  assert.equal(f.cargo, shipOf('Carrack').cargo + shipOf('Cutlass Black').cargo);
  assert.ok(f.cargo > 0);
  assert.equal(
    Object.values(f.bySize).reduce((a, b) => a + b, 0),
    2,
  );
});

test('diffSnapshots finds new, gone and upgraded pledges', () => {
  const a = OH.snapshotOf(
    [
      { id: 1, name: 'Cutlass Black', value: 110 },
      { id: 2, name: 'Aurora MR', value: 30 },
    ],
    1,
  );
  const b = OH.snapshotOf(
    [
      { id: 1, name: 'Cutlass Black - upgraded', value: 150 },
      { id: 3, name: 'Carrack', value: 600 },
    ],
    2,
  );
  const d = OH.diffSnapshots(a, b);
  assert.deepEqual(
    d.added.map((x) => x.id),
    ['3'],
  );
  assert.deepEqual(
    d.removed.map((x) => x.id),
    ['2'],
  );
  assert.equal(d.changed.length, 1);
  assert.equal(d.melt, 750 - 140);
});

test('mergeHistory unions by time, collapses repeats, drops junk', () => {
  const s = (at, items) => OH.snapshotOf(items, at);
  const one = [{ id: 1, name: 'A', value: 10 }];
  const two = [...one, { id: 2, name: 'B', value: 20 }];
  const mine = [s(100, one), s(300, two)];
  const backup = [s(100, one), s(200, one), { at: 'bad' }, null];
  const m = OH.mergeHistory(mine, backup);
  assert.deepEqual(
    m.map((x) => x.at),
    [100, 300],
  ); // 200 was identical to 100 → folded in
  assert.equal(m[0].checkedAt, 200);
  const many = Array.from({ length: 150 }, (_, i) => s(i, [{ id: i, name: 'x', value: i }]));
  assert.equal(OH.mergeHistory(many, []).length, 100);
});

test('mergeHistory: same moment in both keeps this browser’s copy; order never matters (#199)', () => {
  const s = (at, items) => OH.snapshotOf(items, at);
  const a = [{ id: 1, name: 'A', value: 10 }];
  const b = [{ id: 1, name: 'A', value: 99 }];
  const mine = [s(300, b), s(100, a)]; // out of order on purpose
  const backup = [s(200, b), s(100, b)]; // same moment as mine, different contents
  const m = OH.mergeHistory(mine, backup);
  assert.deepEqual(
    m.map((x) => [x.at, x.items[0][2]]),
    [
      [100, 10],
      [200, 99],
    ],
  ); // 100 is mine; 300 matched 200 and folded in
  assert.equal(m[1].checkedAt, 300);
  // Trimming keeps the newest, wherever they came from.
  const old = Array.from({ length: 120 }, (_, i) => s(i, [{ id: i, name: 'x', value: i }]));
  const kept = OH.mergeHistory([], old.slice().reverse());
  assert.equal(kept.length, 100);
  assert.equal(kept[0].at, 20);
  assert.equal(kept[99].at, 119);
});

// Our rates file (openhangar.space/rates.json, #243): USD based, every offered currency.
const ratesFile = (over = {}) => ({
  base: 'USD',
  date: '2026-09-30',
  source: 'ECB',
  rates: {
    USD: 1,
    EUR: 0.88,
    GBP: 0.75,
    CAD: 1.42,
    AUD: 1.44,
    NZD: 1.77,
    CHF: 0.83,
    SEK: 9.98,
    PLN: 3.85,
    CZK: 21.5,
    BRL: 5.2,
    CNY: 6.7,
    JPY: 157,
    KRW: 1355,
    HUF: 322,
    ...over,
  },
});
const fxStore = (store) => {
  global.chrome.storage.local.get = async (k) => ({ [k]: store[k] });
  global.chrome.storage.local.set = async (o) => Object.assign(store, o);
};

test('getFxRates reads our rates file once and caches the offered currencies', async () => {
  fxStore({});
  let calls = 0;
  const fetchFn = async (url) => {
    calls++;
    assert.equal(url, 'https://openhangar.space/rates.json');
    return { ok: true, json: async () => ratesFile() };
  };
  const r1 = await OH.getFxRates(fetchFn);
  const r2 = await OH.getFxRates(fetchFn);
  assert.equal(r1.rates.EUR, 0.88);
  assert.equal(r1.rates.USD, 1);
  assert.equal(r1.date, '2026-09-30');
  assert.equal(r2.rates.KRW, 1355);
  assert.equal(r1.rates.HUF, undefined); // not offered, not kept
  assert.equal(calls, 1);
});

test('getFxRates refetches a cache saved before a currency was added', async () => {
  fxStore({
    fxRates: { at: Date.now(), date: '2026-09-27', rates: { USD: 1, EUR: 0.9 } }, // no `want`
  });
  let calls = 0;
  const fetchFn = async () => {
    calls++;
    return { ok: true, json: async () => ratesFile({ KRW: 1357 }) };
  };
  const r = await OH.getFxRates(fetchFn);
  assert.equal(calls, 1);
  assert.equal(r.rates.KRW, 1357);
});

test('getFxRates keeps the saved rates when the file is incomplete or unreachable', async () => {
  const old = { at: 0, want: 'stale', date: '2026-09-01', rates: { USD: 1, EUR: 0.9 } };
  for (const answer of [
    { ok: true, json: async () => ratesFile({ JPY: undefined }) }, // a currency missing
    { ok: true, json: async () => ({ ...ratesFile(), base: 'EUR' }) }, // wrong base
    { ok: false, status: 503, json: async () => ({}) },
  ]) {
    fxStore({ fxRates: { ...old } });
    const r = await OH.getFxRates(async () => answer);
    assert.equal(r.date, '2026-09-01');
    assert.equal(r.rates.EUR, 0.9);
  }
});

// Account Value (#164, #165): everything owned, one rule set for today and history.
test('accountValue counts ships, CCUs, other pledges at melt and Store Credit', () => {
  const items = [
    {
      id: 'a',
      name: 'Standalone Ship - Carrack',
      value: 500,
      contents: [{ kind: 'Ship', label: 'Carrack' }],
    },
    {
      id: 'b',
      name: 'Upgrade - Cutlass Black to Carrack',
      value: 400,
      isCCU: true,
      kind: 'ccu',
      ccu: { from: 'Cutlass Black', to: 'Carrack' },
    },
    {
      id: 'c',
      name: 'Paint - Carrack Pathfinder',
      value: 12,
      contents: [{ kind: 'Skin', label: 'Pathfinder' }],
    },
    {
      id: 'd',
      name: 'Standalone Ship - Mystery One',
      value: 75,
      contents: [{ kind: 'Ship', label: 'Totally Unknown Ship' }],
    },
  ];
  const v = OH.accountValue(items, priceOf, 42.5);
  assert.equal(v.ships, 600 + 75); // Carrack at store, the unpriced ship at melt
  assert.equal(v.ccus, 600 - 110); // standard price, the gap between the ships
  assert.equal(v.other, 12); // paint at melt
  assert.equal(v.credit, 42.5);
  assert.equal(v.total, 675 + 490 + 12 + 42.5);
  assert.equal(v.byId.c, 12);
});

test('the latest snapshot of the same hangar values exactly like today', () => {
  const items = [
    {
      id: 'a',
      name: 'Standalone Ship - Carrack',
      value: 500,
      contents: [{ kind: 'Ship', label: 'Carrack' }],
    },
    {
      id: 'c',
      name: 'Paint - Carrack Pathfinder',
      value: 12,
      contents: [{ kind: 'Skin', label: 'Pathfinder' }],
    },
  ];
  const v = OH.accountValue(items, priceOf, 10);
  const snap = OH.snapshotOf(items, 1, 10);
  assert.equal(OH.snapshotValue(snap, v, priceOf), v.total);
});

test('gone pledges: ships from their name, anything else at melt; old snapshots skip credit', () => {
  const v = OH.accountValue([], priceOf, 0);
  const snap = {
    at: 1,
    items: [
      ['x', 'Standalone Ship - Cutlass Black - LTI', 90],
      ['y', 'Paint - Some Livery', 8],
      ['z', 'Upgrade - A to B', 20],
      ['w', 'Hangar Decoration - Plush', 5],
    ],
  };
  assert.equal(OH.snapshotValue(snap, v, priceOf), 110 + 8 + 20 + 5);
  assert.equal(OH.snapshotValue({ ...snap, credit: 30 }, v, priceOf), 110 + 8 + 20 + 5 + 30);
});

test('a scan that only changes Store Credit keeps a new snapshot', () => {
  const items = [{ id: 'a', name: 'Carrack', value: 500 }];
  const a = OH.snapshotOf(items, 1, 10);
  const b = OH.snapshotOf(items, 2, 25);
  const c = OH.snapshotOf(items, 3, 25);
  const merged = OH.mergeHistory([a, b], [c]);
  assert.equal(merged.length, 2);
  assert.equal(merged[1].credit, 25);
});
