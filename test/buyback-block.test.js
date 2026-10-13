'use strict';

/*
 * Can't Be Bought Back and the melt facts (#403, OH.buybackBlock and OH.meltFacts in
 * src/lib.js). Every pledge here is invented. Run: `npm test`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

global.window = globalThis;
global.chrome = global.chrome || {
  storage: { local: { get: async () => ({}), set: async () => {} } },
};
require('../src/lib.js');
const OH = globalThis.OH;
const block = (p, d) => OH.buybackBlock(p, d);

test('Squadron 42 game access in a pledge, a buy-back or its loaded page', () => {
  assert.equal(
    block({
      name: 'Package - Starter Pack + Squadron 42',
      contents: [
        { kind: 'Ship', label: 'Mustang Alpha' },
        { kind: '', label: 'Squadron 42 Digital Download' },
      ],
    }),
    'sq42',
  );
  assert.equal(
    block({ name: 'Package - Starter', contains: 'Mustang Alpha, Squadron 42 Digital Game' }),
    'sq42',
  );
  assert.equal(block({ name: 'Star Citizen + Squadron 42 Bundle' }), 'sq42');
  assert.equal(
    block(
      { name: 'Package - Starter', contains: 'Mustang Alpha' },
      { also: ['Squadron 42 Digital Download'] },
    ),
    'sq42',
  );
});

test('Squadron 42 extras and plain Star Citizen packages are not blocked', () => {
  assert.equal(block({ name: 'Add-On Squadron 42 Soundtrack Digital' }), null);
  assert.equal(block({ name: 'Paints - Squadron 42 Livery' }), null);
  assert.equal(
    block({
      name: 'Package - Aurora MR Starter',
      contains: 'Aurora MR, Star Citizen Digital Download',
    }),
    null,
  );
  // The Aurora Mk I is not on RSI's list (owner, 2026-10-06).
  assert.equal(block({ name: 'Standalone Ships - Aurora Mk I ES' }), null);
});

test('physical items, Add-On store label, AMD and giveaways', () => {
  assert.equal(
    block({ name: 'Package - Collector', contents: [{ kind: '', label: 'Physical Game Box' }] }),
    'physical',
  );
  assert.equal(block({ name: 'Add-On - Name Reservation' }), 'addon');
  assert.equal(block({ name: 'Add-Ons - Torpedo Module' }), 'addon');
  assert.equal(block({ name: 'AMD Reward Package' }), 'amd');
  assert.equal(block({ name: 'Community Giveaway - Mustang Alpha' }), 'giveaway');
});

test('unsure means no label: combos, ships, paints, CCUs, lowercase "amd" words', () => {
  assert.equal(block({ name: 'Combo - Kraken and Expansion' }), null);
  assert.equal(block({ name: 'Standalone Ships - Cutlass Black' }), null);
  assert.equal(block({ name: 'Paints - Gladius Ghoulish Green' }), null);
  assert.equal(block({ name: 'Paints - Grammar Pack' }), null);
  assert.equal(
    block({ name: 'Upgrade - Add-On to Squadron 42', isCCU: true, ccu: { from: 'a', to: 'b' } }),
    null,
  );
  assert.equal(block(null), null);
  for (const k of ['sq42', 'physical', 'addon', 'amd', 'giveaway']) {
    assert.ok(OH.BUYBACK_BLOCK_REASONS[k], k);
    assert.doesNotMatch(OH.BUYBACK_BLOCK_REASONS[k], /—/);
  }
});

test('melt facts: an upgraded pledge comes back as the original pack', () => {
  const f = OH.meltFacts({
    name: 'Package - Aurora Mk I MR Starter Pack - upgraded',
    contents: [{ kind: 'Ship', label: 'C8X Pisces Expedition' }],
    giftable: false,
  });
  assert.equal(f.block, null);
  assert.equal(
    f.lines[0],
    'The buy-back is your original Aurora Mk I MR Starter Pack, not the C8X Pisces Expedition. The upgrades on it are lost.',
  );
  const same = OH.meltFacts({
    name: 'Package - Mustang Alpha Starter Pack - upgraded',
    contents: [{ kind: 'Ship', label: 'Mustang Alpha' }],
  });
  assert.match(same.lines[0], /not the upgraded ship\./);
  const g = OH.meltFacts({
    name: 'Standalone Ships - Cutlass Black - upgraded',
    contents: [
      { kind: 'Ship', label: 'A' },
      { kind: 'Ship', label: 'B' },
    ],
  });
  assert.match(
    g.lines[0],
    /^The buy-back is your original Cutlass Black pledge, not the upgraded ship\./,
  );
});

test('melt facts: no upgrade line without proof; insurance, gifting, full price', () => {
  const f = OH.meltFacts({
    name: 'Standalone Ships - Cutlass Black',
    contents: [{ kind: 'Ship', label: 'Cutlass Black' }],
    insurance: 'LTI',
    giftable: true,
  });
  assert.equal(f.lines.length, 3);
  assert.doesNotMatch(f.lines.join(' '), /original/);
  assert.equal(f.lines[0], 'It carries LTI. Melting it gives that up until you buy it back.');
  assert.match(f.lines[1], /giftable now.*store credit, it can't be gifted/);
  assert.match(f.lines[2], /full price.*Buy-Back Token.*one buy-back per cart/);
  const s = OH.meltFacts({ name: 'Standalone Ships - Arrow', insurance: '120M', giftable: false });
  assert.equal(
    s.lines[0],
    'It carries 120 months of insurance. Melting it gives that up until you buy it back.',
  );
  assert.equal(s.lines.length, 2);
  for (const l of [...f.lines, ...s.lines]) assert.doesNotMatch(l, /—/);
});

test('melt facts carry the block for the red warning', () => {
  const f = OH.meltFacts({
    name: 'Package - Starter',
    contents: [{ kind: '', label: 'Squadron 42 Digital Download' }],
  });
  assert.equal(f.block, 'sq42');
  assert.ok(f.lines.length >= 1);
});
