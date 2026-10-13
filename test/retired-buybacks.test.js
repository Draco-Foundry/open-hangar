'use strict';

/*
 * Retired ships on the Buy-Backs page (#306, OH.retiredBuyback in src/lib.js):
 * the Aurora Mk I and Hornet Mk I can't be bought back; paints and Mk II ships can.
 * Run: `npm test`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

global.window = globalThis;
global.chrome = global.chrome || {
  storage: { local: { get: async () => ({}), set: async () => {} } },
};
require('../src/lib.js');
const OH = globalThis.OH;
const retired = (b) => !!OH.retiredBuyback(b);

test('Aurora Mk I ships, packs and upgrades are retired; old names count', () => {
  assert.equal(retired({ kind: 'ship', name: 'Standalone Ship - Aurora Mk I MR' }), true);
  assert.equal(retired({ kind: 'ship', name: 'Aurora LN - LTI' }), true);
  assert.equal(
    retired({
      kind: 'other',
      name: 'Package - Aurora MR Starter',
      contains: 'Aurora MR, Star Citizen Digital Download',
    }),
    true,
  );
  assert.equal(
    retired({
      kind: 'ccu',
      name: 'Upgrade - Aurora MR to Mustang Alpha',
      ccu: { from: 'Aurora MR', to: 'Mustang Alpha' },
    }),
    true,
  );
});

test('Hornet Mk I is retired, Mk II is not', () => {
  assert.equal(retired({ kind: 'ship', name: 'F7C Hornet' }), true);
  assert.equal(retired({ kind: 'ship', name: 'F7C-M Super Hornet Heartseeker Mk I' }), true);
  assert.equal(retired({ kind: 'ship', name: 'F7C Hornet Mk II' }), false);
  assert.equal(retired({ kind: 'ship', name: 'F7C-M Super Hornet Mk II' }), false);
});

test('paints and Mk II ships keep their buy-back link', () => {
  assert.equal(retired({ kind: 'paint', name: 'Aurora - Ghoulish Green Paint' }), false);
  assert.equal(retired({ kind: 'other', name: 'Aurora Mk I Paint Pack' }), false);
  assert.equal(retired({ kind: 'ship', name: 'Aurora Mk II' }), false);
  assert.equal(retired({ kind: 'ship', name: 'Cutlass Black' }), false);
});

test('retired is only a label: the note says RSI still sells the buy-back back', () => {
  const note = OH.retiredBuyback({ kind: 'ship', name: 'Standalone Ship - Aurora Mk I MR' });
  assert.match(note, /buy-back is still open on RSI/);
  assert.doesNotMatch(note, /can no longer be bought back/);
});
