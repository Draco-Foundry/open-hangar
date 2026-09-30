'use strict';

/*
 * Bundled ship list (src/data/ship-catalog.json): with the wiki unreachable,
 * prices still resolve from the snapshot shipped in the extension.
 * Run: `npm test`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SNAPSHOT = path.join(__dirname, '../src/data/ship-catalog.json');

global.window = globalThis;
global.chrome = {
  storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
  runtime: { getURL: (p) => 'ext://' + p, getManifest: () => ({ version: '0.0.0' }) },
};
global.fetch = async (url) => {
  if (String(url).endsWith('src/data/ship-catalog.json')) {
    const body = fs.readFileSync(SNAPSHOT, 'utf8');
    return { ok: true, json: async () => JSON.parse(body) };
  }
  throw new Error('offline'); // the wiki (and everything else) is unreachable
};
require('../src/lib.js');
const OH = globalThis.OH;

test('the bundled snapshot is well-formed', () => {
  const snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  assert.ok(snap.list.length >= 200);
  assert.ok(snap.list.every((v) => v.lname && v.slug));
  assert.ok(snap.list.filter((v) => v.msrp).length >= 150);
});

test('prices resolve offline from the bundled snapshot', async () => {
  const priceOf = await OH.getPriceIndex();
  assert.equal(priceOf('Carrack').msrp, 600);
  assert.ok(priceOf('Cutlass Black').msrp > 0);
});

test('mergeCatalogs adds concept ships and fills gaps, but no flight-ready dupes', () => {
  const list = [{ lname: 'cutlass black', slug: 'cutlass-black', msrp: null, status: null }];
  const matrix = [
    { lname: 'cutlass black', slug: 'cutlass-black', msrp: 110, status: 'flight-ready' },
    { lname: 'pioneer', slug: 'pioneer', msrp: 925, status: 'in-concept' },
    { lname: 'hornet tracker mk i', slug: 'x', msrp: 90, status: 'flight-ready' },
  ];
  const out = OH.mergeCatalogs(list, matrix);
  assert.equal(out.length, 2);
  assert.equal(out[0].msrp, 110);
  assert.equal(out[0].status, 'flight-ready');
  assert.equal(out[1].slug, 'pioneer');
  assert.equal(list[0].msrp, null); // input untouched
});

test('collectionStats: insurance mix, gift/melt split, makers owned of total', () => {
  const cat = [
    { lname: 'carrack', name: 'Carrack', mfr: 'Anvil Aerospace', msrp: 600 },
    { lname: 'arrow', name: 'Arrow', mfr: 'Anvil Aerospace', msrp: 75 },
    { lname: 'cutlass black', name: 'Cutlass Black', mfr: 'Drake Interplanetary', msrp: 110 },
  ];
  const shipOf = (n) => cat.find((v) => v.lname === String(n).toLowerCase()) || null;
  const items = [
    {
      insurance: 'LTI',
      giftable: true,
      meltable: true,
      contents: [{ kind: 'Ship', label: 'Carrack' }],
    },
    {
      insurance: '120M',
      giftable: false,
      meltable: true,
      contents: [{ kind: 'Ship', label: 'Cutlass Black' }],
    },
  ];
  const c = OH.collectionStats(items, shipOf, cat);
  assert.deepEqual(c.insurance, { LTI: 1, '120M': 1 });
  assert.equal(c.giftable, 1);
  assert.equal(c.notGiftable, 1);
  const anvil = c.makers.find((m) => m.name === 'Anvil Aerospace');
  assert.equal(anvil.own, 1);
  assert.equal(anvil.total, 2);
});

test('slimVehicle: the wiki\'s "undefined" size becomes Vehicle for ground vehicles, null otherwise', () => {
  const base = { name: 'Storm', slug: 'tmbl-storm', size: { en_EN: 'undefined' } };
  assert.equal(OH.slimVehicle({ ...base, is_vehicle: true }).size, 'Vehicle');
  assert.equal(OH.slimVehicle({ ...base, is_vehicle: false }).size, null);
  assert.equal(OH.slimVehicle({ ...base, size: { en_EN: 'Large' } }).size, 'Large');
});

test("fillCatalogSizes: special editions take their base ship's size", () => {
  const list = [
    { lname: 'f8c lightning', size: 'Small' },
    { lname: 'f8c lightning wikelo war special', size: 'undefined' },
    { lname: 'corsair', size: 'Large' },
    { lname: 'corsair pyam exec', size: null },
    { lname: 'geotack planetary beacon', size: null },
  ];
  OH.fillCatalogSizes(list);
  assert.deepEqual(
    list.map((v) => v.size),
    ['Small', 'Small', 'Large', 'Large', null],
  );
});
