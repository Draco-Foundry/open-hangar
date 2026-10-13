'use strict';

/* Home live data: buy-back tokens. Run: `npm test`. */

const test = require('node:test');
const assert = require('node:assert/strict');

global.window = globalThis;
global.chrome = { storage: { local: { get: async () => ({}), set: async () => {} } } };
require('../src/lib.js');
const OH = globalThis.OH;

test('nextBuybackToken: the listed date, then the first Monday of the next quarter', () => {
  assert.equal(OH.nextBuybackToken(Date.UTC(2026, 8, 30)), Date.parse('2026-10-05T12:00:00Z'));
  // Past the list: Mon Jan 4 2027, then Mon Apr 5, Mon Jul 5, Mon Oct 4.
  assert.equal(OH.nextBuybackToken(Date.UTC(2026, 9, 5, 18)), Date.parse('2027-01-04T12:00:00Z'));
  assert.equal(OH.nextBuybackToken(Date.UTC(2026, 11, 1)), Date.parse('2027-01-04T12:00:00Z'));
  assert.equal(OH.nextBuybackToken(Date.UTC(2027, 0, 4, 13)), Date.parse('2027-04-05T12:00:00Z'));
  assert.equal(OH.nextBuybackToken(Date.UTC(2027, 5, 1)), Date.parse('2027-07-05T12:00:00Z'));
  assert.equal(OH.nextBuybackToken(Date.UTC(2027, 6, 6)), Date.parse('2027-10-04T12:00:00Z'));
});

// RSI Spectrum Patch Notes channel, first 8 threads as read on 2026-09-30.
const PATCH = require('./fixtures/patch-notes.json');

test('parsePatchNotes reads label, version, link and date, newest first', () => {
  const n = OH.parsePatchNotes(PATCH);
  assert.equal(n.length, 8);
  assert.equal(n[0].label, 'Wave 3 PTU');
  assert.equal(n[0].title, 'Star Citizen Alpha 4.10.2 PTU Patch Notes'); // build number dropped
  assert.equal(n[0].version, '4.10.2');
  assert.match(n[0].url, /\/forum\/190048\/thread\/star-citizen-alpha-4-10-2-ptu-patch-notes-2$/);
  assert.ok(n.every((x, i) => i === 0 || n[i - 1].at >= x.at));
  assert.deepEqual(OH.parsePatchNotes({}), []);
});

test('patchWave finds the newest wave for a test version', () => {
  const n = OH.parsePatchNotes(PATCH);
  assert.equal(OH.patchWave(n, '4.10.2'), 'Wave 3');
  assert.equal(OH.patchWave(n, '9.9.9'), '');
});

test('soonBuybackToken: only in the last 30 days before a token', () => {
  // 2027-01-04 is the next one after 2026-10-05.
  assert.equal(OH.soonBuybackToken(Date.UTC(2026, 9, 6)), null); // ~90 days away
  assert.equal(OH.soonBuybackToken(Date.UTC(2026, 11, 10)), Date.parse('2027-01-04T12:00:00Z'));
  assert.equal(OH.soonBuybackToken(Date.UTC(2026, 8, 30)), Date.parse('2026-10-05T12:00:00Z'));
});
