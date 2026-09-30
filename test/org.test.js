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

test('reports roles covered/missing, biggest ships and value per member', () => {
  const f = OH.orgFleet(
    [
      { name: 'A', ships: [{ name: 'Carrack', lti: true }, { name: 'Cutlass Black' }] },
      { name: 'B', ships: [{ name: 'Prospector' }] },
    ],
    shipOf,
    priceOf,
  );
  const role = (k) => f.roles.find((r) => r.key === k);
  assert.ok(role('mining').count >= 1, 'Prospector covers mining');
  assert.equal(role('medical').count, 0);
  assert.equal(f.byMember[0].name, 'A');
  assert.equal(f.byMember[0].ships, 2);
  assert.ok(f.byMember[0].store > f.byMember[1].store);
  assert.ok(f.biggest.some((s) => /carrack/i.test(s.name)));
});

test('a role held only by concept ships is covered but not ready', () => {
  const ships = {
    pioneer: {
      lname: 'pioneer',
      name: 'Pioneer',
      role: 'Heavy Construction',
      status: 'in-concept',
    },
    prospector: {
      lname: 'prospector',
      name: 'Prospector',
      role: 'Light Mining',
      status: 'flight-ready',
    },
  };
  const f = OH.orgFleet(
    [{ name: 'me', ships: [{ name: 'Pioneer' }, { name: 'Prospector' }] }],
    (n) => ships[n.toLowerCase()],
    () => null,
  );
  const construction = f.roles.find((r) => r.key === 'construction');
  const mining = f.roles.find((r) => r.key === 'mining');
  assert.equal(construction.count, 1);
  assert.equal(construction.ready, 0);
  assert.equal(mining.ready, 1);
  assert.equal(f.ships.find((s) => s.name === 'Pioneer').status, 'in-concept');
});

test('every ship role in the bundled ship list belongs to an org role', () => {
  const list = require('../src/data/ship-catalog.json');
  const ships = Array.isArray(list) ? list : list.list || list.ships || list.data;
  // Land-claim beacons aren't ships and have no role.
  const unplaced = ships
    .filter((v) => !/geotack/i.test(v.name))
    .filter(
      (v) =>
        !v.role || !v.role.split(' / ').every((one) => OH.ORG_ROLES.some((r) => r.re.test(one))),
    )
    .map((v) => `${v.name}: ${v.role || '(no role)'}`);
  assert.deepEqual(unplaced, []);
});

test('the Kraken counts as a carrier (its second role)', () => {
  const f = OH.orgFleet(
    [{ name: 'me', ships: [{ name: 'Kraken' }] }],
    () => ({
      lname: 'kraken',
      name: 'Kraken',
      role: 'Multi-Role / Light Carrier',
      status: 'in-concept',
    }),
    () => null,
  );
  assert.equal(f.roles.find((r) => r.key === 'carrier').count, 1);
  assert.equal(f.roles.find((r) => r.key === 'multirole').count, 1);
});
