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
