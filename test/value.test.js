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

test('melt candidates: meltable, no LTI, ships only, paid full price', () => {
  const ship = (over) => ({
    id: 20,
    name: 'Standalone Ship - Cutlass Black',
    value: 110,
    meltable: true,
    insurance: '6 Months',
    contents: [
      { kind: 'Ship', label: 'Cutlass Black' },
      { kind: 'Insurance', label: '6 Months Insurance' },
    ],
    ...over,
  });
  const check = (p) => OH.isMeltCandidate(p, OH.hangarValue([p], priceOf).pledges[p.id]);
  assert.equal(check(ship()), true);
  assert.equal(check(ship({ insurance: 'LTI' })), false);
  assert.equal(check(ship({ meltable: false })), false);
  assert.equal(check(ship({ value: 90 })), false); // bought cheaper — you'd lose that
  assert.equal(
    check(ship({ contents: [...ship().contents, { kind: 'Paint', label: 'Some paint' }] })),
    false,
  );
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

test('getFxRates fetches USD-based rates once and caches them', async () => {
  const store = {};
  global.chrome.storage.local.get = async (k) => ({ [k]: store[k] });
  global.chrome.storage.local.set = async (o) => Object.assign(store, o);
  let calls = 0;
  const fetchFn = async (url) => {
    calls++;
    assert.match(url, /base=USD/);
    return {
      ok: true,
      json: async () => ({ date: '2026-09-28', rates: { EUR: 0.88, GBP: 0.75 } }),
    };
  };
  const r1 = await OH.getFxRates(fetchFn);
  const r2 = await OH.getFxRates(fetchFn);
  assert.equal(r1.rates.EUR, 0.88);
  assert.equal(r1.rates.USD, 1);
  assert.equal(r2.rates.GBP, 0.75);
  assert.equal(calls, 1);
});

test('getFxRates refetches a cache saved before a currency was added', async () => {
  const store = {
    fxRates: { at: Date.now(), date: '2026-09-27', rates: { USD: 1, EUR: 0.9 } }, // no `want`
  };
  global.chrome.storage.local.get = async (k) => ({ [k]: store[k] });
  global.chrome.storage.local.set = async (o) => Object.assign(store, o);
  let calls = 0;
  const fetchFn = async () => {
    calls++;
    return {
      ok: true,
      json: async () => ({ date: '2026-09-28', rates: { EUR: 0.88, KRW: 1357 } }),
    };
  };
  const r = await OH.getFxRates(fetchFn);
  assert.equal(calls, 1);
  assert.equal(r.rates.KRW, 1357);
});
