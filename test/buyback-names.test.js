'use strict';
// OH.shortBuybackName: buy-back titles without the type label in front and without
// Warbond / Standard Edition (#176). Names are real RSI buy-back titles.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = globalThis;
global.chrome = { storage: { local: { get: async () => ({}), set: async () => {} } } };
require('../src/lib.js');
const short = globalThis.OH.shortBuybackName;

const cases = [
  // type labels
  ['Standalone Ship - Drake Cutlass Black', 'Drake Cutlass Black'],
  ['Standalone Ships - Aegis Avenger Titan', 'Aegis Avenger Titan'],
  ['Package - Generalist Defense Con Starter Pack', 'Generalist Defense Con Starter Pack'],
  ['Packs - Origin Complete Pack', 'Origin Complete Pack'],
  ['Pack - Arena Commander Pack', 'Arena Commander Pack'],
  ['Subscriber Store - Hull C Ironclad Paint', 'Hull C Ironclad Paint'],
  // Warbond / Standard Edition
  ['Standalone Ship - Anvil Carrack - Warbond Edition', 'Anvil Carrack'],
  ['RSI Constellation Andromeda Warbond Edition', 'RSI Constellation Andromeda'],
  ['Crusader Hercules C2 - Standard Edition', 'Crusader Hercules C2'],
  ['Origin 400i Standard Edition', 'Origin 400i'],
  ['MISC Freelancer (Warbond)', 'MISC Freelancer'],
  ['Drake Corsair Warbond', 'Drake Corsair'],
  ['Aurora Mk I LX Standard Edition', 'Aurora Mk I LX'], // a CCU ship name
  // left alone
  ['Drake Cutlass Black', 'Drake Cutlass Black'],
  ['Squadron 42 Digital Download', 'Squadron 42 Digital Download'],
  ['Warbonder Mug', 'Warbonder Mug'],
  ['', ''],
];

for (const [name, want] of cases) {
  test(`"${name}" → "${want}"`, () => assert.equal(short(name), want));
}

test('never returns an empty title for a non-empty name', () => {
  assert.equal(short('Package - '), 'Package -');
  assert.equal(short(null), '');
});
