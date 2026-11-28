'use strict';

/*
 * The ship-name prefix guard (OH.shipNameGuard in src/lib.js): a prefix match never ties
 * a base ship to a variant, or a variant to its base. Only edition words and kind endings
 * may fall away; a variant, a mark or a loadout never does.
 * Run: `npm test`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

global.window = globalThis;
global.chrome = {
  storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
  runtime: { getURL: (p) => 'ext://' + p, getManifest: () => ({ version: '0.0.0' }) },
};
require('../src/lib.js');
const OH = globalThis.OH;

// The best name for `raw` as every caller picks it: the guard sees every known name, the
// score runs over the candidates (the ones with a picture, say). Null below 70, the
// threshold the HTF codes use.
function best(known, raw, candidates = known) {
  const q = OH.normShipName(raw).toLowerCase();
  const guard = OH.shipNameGuard(known, q);
  let hit = null;
  let top = 0;
  for (const n of candidates) {
    const s = OH.shipNameScore(n, q, guard);
    if (s > top) {
      top = s;
      hit = n;
    }
  }
  return top >= 70 ? hit : null;
}

const FLEET = [
  'cutter',
  'cutter scout',
  'cutter rambler',
  'mustang alpha',
  'mustang beta',
  'hull a',
  'hull b',
  'hull c',
  'avenger titan',
  'avenger titan renegade',
  '600i explorer',
  '600i touring',
  'genesis starliner',
  'ptv',
];

const NEVER = [
  ['Cutter', 'cutter scout'],
  ['Cutter', 'cutter rambler'],
  ['Cutter Scout', 'cutter'],
  ['Cutter Rambler', 'cutter'],
  ['Mustang Alpha', 'mustang beta'],
  ['Mustang Beta', 'mustang alpha'],
  ['Hull B', 'hull c'],
  ['Hull C', 'hull b'],
  ['Avenger Titan', 'avenger titan renegade'],
  ['Avenger Titan Renegade', 'avenger titan'],
  ['600i Explorer', '600i touring'],
  ['600i Touring', '600i explorer'],
];

for (const [raw, wrong] of NEVER) {
  test(`"${raw}" never matches "${wrong}", even when "${wrong}" is the only candidate`, () => {
    assert.notEqual(best(FLEET, raw), wrong);
    // The case the guard is for: the right ship has no picture, the wrong one does.
    assert.equal(best(FLEET, raw, [wrong]), null);
  });
}

test('a name that is in the list matches itself', () => {
  for (const n of FLEET) assert.equal(best(FLEET, n), n);
});

test('Genesis finds the Genesis Starliner when Genesis alone is not a ship', () => {
  assert.equal(best(FLEET, 'Genesis'), 'genesis starliner');
  assert.equal(best(['genesis', 'genesis starliner'], 'Genesis', ['genesis starliner']), null);
});

test('one family counts once: a special edition of the only variant is not a second one', () => {
  const list = ['genesis starliner', 'genesis starliner best edition'];
  assert.equal(best(list, 'Genesis'), 'genesis starliner');
});

test('a base that two variants extend matches neither', () => {
  assert.equal(best(['mustang alpha', 'mustang beta'], 'Mustang'), null);
  assert.equal(best(['cutter scout', 'cutter rambler'], 'Cutter'), null);
});

test('PTV Buggy finds the PTV: a kind ending falls away', () => {
  assert.equal(best(FLEET, 'PTV Buggy'), 'ptv');
});

test('edition words fall away', () => {
  assert.equal(best(FLEET, 'Cutter - 10 Year'), 'cutter');
  assert.equal(best(FLEET, 'Genesis Starliner Best In Show'), 'genesis starliner');
  assert.equal(best(FLEET, 'Cutter Scout Best In Show Edition'), 'cutter scout');
  assert.equal(best(FLEET, 'Avenger Titan Renegade - 10 Year'), 'avenger titan renegade');
});

test('a query extends the longest known name it starts with, never a shorter one', () => {
  // "Avenger Titan Renegade - 10 Year" fits the Renegade; with no Renegade picture it
  // gets none, not the Titan's.
  const raw = 'Avenger Titan Renegade - 10 Year';
  assert.equal(best(FLEET, raw, ['avenger titan']), null);
});

test('Aurora MR still finds the Aurora Mk I MR, and Mk II stays its own ship', () => {
  const list = ['aurora mk i mr', 'aurora mk i lx', 'aurora mk ii'];
  assert.equal(best(list, 'Aurora MR'), 'aurora mk i mr');
  assert.equal(best(list, 'Aurora Mk II'), 'aurora mk ii');
  assert.equal(best(list, 'Aurora'), null);
});

test('an upgraded pledge and its paint never pick the base ship over the variant', () => {
  assert.equal(best(FLEET, 'Cutter Scout plus Nightfall Paint'), 'cutter scout');
  assert.notEqual(best(FLEET, 'Cutter - Nightfall Paint'), 'cutter scout');
});

test('makeShipIndex: a base ship with no price never borrows a variant', () => {
  const catalog = [
    { name: 'Cutter', lname: 'cutter', slug: 'cutter', msrp: null },
    { name: 'Cutter Scout', lname: 'cutter scout', slug: 'cutter-scout', msrp: 50 },
    { name: 'Genesis Starliner', lname: 'genesis starliner', slug: 'gs', msrp: 400 },
    { name: 'Avenger Titan', lname: 'avenger titan', slug: 'at', msrp: 60 },
  ];
  const { shipOf, priceOf } = OH.makeShipIndex(catalog);
  assert.equal(shipOf('Cutter').lname, 'cutter');
  assert.equal(priceOf('Cutter'), null);
  assert.equal(shipOf('Genesis').lname, 'genesis starliner');
  assert.equal(priceOf('Genesis').msrp, 400);
  assert.equal(shipOf('Avenger Titan - 10 Year').lname, 'avenger titan');
});
