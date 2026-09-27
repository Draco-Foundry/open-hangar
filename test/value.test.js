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
