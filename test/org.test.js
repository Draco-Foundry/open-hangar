'use strict';

/*
 * Org fleet (OH.shipsFromFile / OH.orgFleet in src/lib.js) against the real
 * ship-code table and a wiki catalog snapshot. Run: `npm test`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const codes = require('../src/data/ship-codes.json');
const catalog = require('./fixtures/wiki-catalog.json');

global.window = globalThis;
global.chrome = { storage: { local: { get: async () => ({}), set: async () => {} } } };
require('../src/lib.js');
const OH = globalThis.OH;
const { shipOf, priceOf } = OH.makeShipIndex(catalog, codes);

test('reads an HTF export and takes the member name from the file name', () => {
  const r = OH.shipsFromFile(
    [
      { name: 'Carrack', ship_name: 'Carrack', entity_type: 'ship', lti: true },
      { name: 'Cutlass Black', entity_type: 'ship', lti: false },
    ],
    'open-hangar-htf-Draco_Nebulae-2026-09-28.json',
  );
  assert.equal(r.name, 'Draco_Nebulae');
  assert.deepEqual(r.ships, [
    { name: 'Carrack', lti: true },
    { name: 'Cutlass Black', lti: false },
  ]);
});

test('reads only the ships from a full backup', () => {
  const r = OH.shipsFromFile({
    account: { handle: 'Alt', balances: { storeCredit: { value: 999 } } },
    sources: {
      hangar: {
        items: [
          {
            insurance: 'LTI',
            contents: [
              { kind: 'Ship', label: 'Anvil Carrack' },
              { kind: 'Paint', label: 'x' },
            ],
          },
        ],
      },
      referral: { items: { code: 'STAR-XXXX-YYYY' } },
    },
  });
  assert.deepEqual(r, { name: 'Alt', ships: [{ name: 'Carrack', lti: true }] });
});

test('rejects files that are neither', () => {
  assert.ok(OH.shipsFromFile({ hello: 1 }).error);
  assert.ok(OH.shipsFromFile([]).error);
});

test('combines members into one fleet with owners and totals', () => {
  const f = OH.orgFleet(
    [
      { name: 'A', ships: [{ name: 'Carrack', lti: true }, { name: 'Cutlass Black' }] },
      { name: 'B', ships: [{ name: 'Anvil Carrack' }] },
    ],
    shipOf,
    priceOf,
  );
  assert.equal(f.members, 2);
  assert.equal(f.shipCount, 3);
  assert.equal(f.store, 600 + 110 + 600);
  const carrack = f.ships.find((s) => /carrack/i.test(s.name));
  assert.equal(carrack.count, 2);
  assert.equal(carrack.lti, 1);
  assert.deepEqual(carrack.owners.map((o) => o.name).sort(), ['A', 'B']);
  assert.ok(f.cargo > 0);
});
