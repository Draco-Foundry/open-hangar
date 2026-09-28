'use strict';

/* CCU planner (OH.planCCU in src/lib.js). Run: `npm test`. */

const test = require('node:test');
const assert = require('node:assert/strict');

global.window = globalThis;
global.chrome = { storage: { local: { get: async () => ({}), set: async () => {} } } };
require('../src/lib.js');
const OH = globalThis.OH;

const ship = (name, msrp) => ({ name, msrp });
const ccu = (from, fromMsrp, to, toMsrp) => ({ from, to, fromMsrp, toMsrp });

test('no owned CCUs: pay the whole gap in one upgrade', () => {
  const r = OH.planCCU(ship('Cutlass Black', 110), ship('Carrack', 600));
  assert.equal(r.cash, 490);
  assert.deepEqual(r.steps, [{ type: 'buy', from: 'Cutlass Black', to: 'Carrack', cost: 490 }]);
});

test('uses owned CCUs and buys only the gaps between them', () => {
  const owned = [
    ccu('Freelancer MAX', 150, 'Constellation Andromeda', 240),
    ccu('Constellation Andromeda', 240, '400i', 250),
    ccu('Carrack', 600, 'Polaris', 975), // past the target: ignored
  ];
  const r = OH.planCCU(ship('Cutlass Black', 110), ship('Carrack', 600), owned);
  assert.equal(r.gap, 490);
  assert.equal(r.covered, 100);
  assert.equal(r.cash, 390);
  assert.deepEqual(
    r.steps.map((s) => `${s.type} ${s.from}>${s.to} ${s.cost}`),
    [
      'buy Cutlass Black>Freelancer MAX 40',
      'apply Freelancer MAX>Constellation Andromeda 0',
      'apply Constellation Andromeda>400i 0',
      'buy 400i>Carrack 350',
    ],
  );
});

test('picks the overlapping CCUs that cover the most', () => {
  const owned = [ccu('A', 100, 'C', 300), ccu('B', 150, 'D', 450), ccu('D', 450, 'E', 500)];
  const r = OH.planCCU(ship('Start', 100), ship('E', 500), owned);
  assert.equal(r.covered, 350); // B→D + D→E (300+50) beats A→C (200) + D→E (50)
});

test('refuses a target that costs less', () => {
  assert.ok(OH.planCCU(ship('Carrack', 600), ship('Cutlass Black', 110)).error);
});
