'use strict';

/*
 * Hangar Transfer Format export (OH.buildHTF / OH.htfShipName in src/lib.js).
 * Uses the real bundled ship-code table so name → code matching is exercised
 * against actual data. Run: `npm test`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const codes = require('../src/data/ship-codes.json');

global.window = globalThis;
global.chrome = global.chrome || {
  storage: { local: { get: async () => ({}), set: async () => {} } },
};
require('../src/lib.js');
const OH = globalThis.OH;

const pledge = (over) => ({
  id: 111,
  name: 'Standalone Ship - Anvil Carrack Warbond',
  value: 600,
  currency: 'USD',
  contents: [
    { kind: 'Ship', label: 'Carrack', image: null },
    { kind: 'Insurance', label: 'Lifetime Insurance', image: null },
  ],
  insurance: 'LTI',
  kind: 'ship',
  ...over,
});

test('one entry per ship with pledge fields and ship codes', () => {
  const [e, ...rest] = OH.buildHTF([pledge()], codes);
  assert.equal(rest.length, 0);
  assert.deepEqual(e, {
    name: 'Carrack',
    entity_type: 'ship',
    ship_code: 'ANVL_Carrack',
    ship_name: 'Carrack',
    manufacturer_code: 'ANVL',
    manufacturer_name: e.manufacturer_name, // from the table, e.g. "Anvil Aerospace"
    pledge_id: '111',
    pledge_name: 'Standalone Ship - Anvil Carrack Warbond',
    pledge_cost: '$600.00 USD',
    lti: true,
    warbond: true,
  });
  assert.match(e.manufacturer_name, /Anvil/);
});

test('a multi-ship package yields one entry per ship sharing the pledge fields', () => {
  const pkg = pledge({
    id: 222,
    name: 'Package - Starter Duo',
    value: 150,
    insurance: '120M',
    contents: [
      { kind: 'Ship', label: 'Cutlass Black' },
      { kind: 'Ship', label: 'Drake Buccaneer' },
      { kind: 'Hangar decoration', label: 'Poster' },
    ],
  });
  const out = OH.buildHTF([pkg], codes);
  assert.deepEqual(
    out.map((e) => [e.name, e.ship_code, e.pledge_id, e.lti, e.warbond]),
    [
      ['Cutlass Black', 'DRAK_Cutlass_Black', '222', false, false],
      ['Buccaneer', 'DRAK_Buccaneer', '222', false, false],
    ],
  );
});

test('CCUs, paints, add-ons and coupons are not exported (no HTF representation)', () => {
  const out = OH.buildHTF(
    [
      { id: 1, name: 'Upgrade - Aurora MR to Avenger Titan', value: 25, contents: [], kind: 'ccu' },
      {
        id: 2,
        name: 'Paints - Carrack Stormbringer',
        value: 15,
        contents: [{ kind: 'Paint', label: 'Stormbringer' }],
        kind: 'paint',
      },
      {
        id: 3,
        name: 'Add-On - Poster',
        value: 5,
        contents: [{ kind: 'Hangar decoration', label: 'Poster' }],
        kind: 'addon',
      },
    ],
    codes,
  );
  assert.equal(out.length, 0);
});

test('unknown ships are kept by name without a guessed code', () => {
  const [e] = OH.buildHTF(
    [pledge({ contents: [{ kind: 'Ship', label: 'Totally Fictional Hauler' }] })],
    codes,
  );
  assert.equal(e.name, 'Totally Fictional Hauler');
  assert.equal(e.ship_name, 'Totally Fictional Hauler');
  assert.equal(e.ship_code, undefined);
  assert.equal(e.manufacturer_code, undefined);
});

test('htfShipName strips manufacturer prefixes and edition noise', () => {
  assert.equal(OH.htfShipName('Anvil Carrack'), 'Carrack');
  assert.equal(OH.htfShipName("Xi'an Scout"), 'Scout');
  assert.equal(OH.htfShipName('Origin 400i'), '400i');
  assert.equal(OH.htfShipName('Cutlass Black Warbond'), 'Cutlass Black');
});

test('missing value/insurance fields degrade gracefully', () => {
  const [e] = OH.buildHTF([pledge({ value: null, insurance: null, name: 'Gift' })], codes);
  assert.equal(e.pledge_cost, undefined);
  assert.equal(e.lti, false);
  assert.equal(e.warbond, false);
});

test('pledge_date is exported when the pledge has one', () => {
  const [e] = OH.buildHTF([pledge({ date: '2016-12-08' })], codes);
  assert.equal(e.pledge_date, '2016-12-08');
  const [f] = OH.buildHTF([pledge()], codes);
  assert.equal(f.pledge_date, undefined);
});

test('special editions: name = base ship (for importers), ship_name = full edition name', () => {
  const out = OH.buildHTF(
    [
      pledge({ contents: [{ kind: 'Ship', label: 'Gladius Dunlevy' }] }),
      pledge({ contents: [{ kind: 'Ship', label: 'Mustang Omega : AMD' }] }),
    ],
    codes,
  );
  assert.deepEqual(
    out.map((e) => [e.name, e.ship_name, e.ship_code]),
    [
      ['Gladius', 'Gladius Dunlevy', 'AEGS_Gladius'],
      ['Mustang Omega', 'Mustang Omega : AMD', 'CNOU_Mustang_Omega'],
    ],
  );
});

test('ships newer than the bundled table fall back to the RSI ship-matrix', () => {
  const matrix = [
    { lname: 'pitbull', name: 'Pitbull', mfr: 'DRAK', mfrName: 'Drake Interplanetary' },
    {
      lname: 'starlite',
      name: 'Starlite',
      mfr: 'MISC',
      mfrName: 'Musashi Industrial & Starflight Concern',
    },
  ];
  const out = OH.buildHTF(
    [
      pledge({ contents: [{ kind: 'Ship', label: 'Pitbull' }] }),
      pledge({ contents: [{ kind: 'Ship', label: 'Starlite' }] }),
      pledge({ contents: [{ kind: 'Ship', label: 'Raptor' }] }), // in neither → by name only
    ],
    codes,
    matrix,
  );
  assert.deepEqual(
    out.map((e) => [e.name, e.ship_code, e.manufacturer_code]),
    [
      ['Pitbull', 'DRAK_Pitbull', 'DRAK'],
      ['Starlite', 'MISC_Starlite', 'MISC'],
      ['Raptor', undefined, undefined],
    ],
  );
});
