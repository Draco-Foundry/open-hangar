'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = globalThis;
global.chrome = { storage: { local: { get: async () => ({}), set: async () => {} } } };
require('../src/lib.js');
const OH = globalThis.OH;

const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'loaner-matrix.html'), 'utf8');
const matrix = OH.parseLoanerMatrix(html);
const loaners = (name) => (OH.loanersFor(name, matrix) || {}).loaners || null;

test('parseLoanerMatrix reads every row of RSI loaner table', () => {
  assert.equal(matrix.length, 54);
  const pioneer = matrix.find((r) => r.ship === 'Pioneer');
  assert.deepEqual(pioneer.loaners, ['Caterpillar', 'Nomad']);
  for (const r of matrix) {
    assert.ok(r.loaners.length, r.ship);
    for (const l of r.loaners) assert.doesNotMatch(l, /&| |<|^\s|\s$/, r.ship);
  }
});

test('loanersFor matches the shorthand RSI uses', () => {
  assert.deepEqual(loaners('Pioneer'), ['Caterpillar', 'Nomad']);
  assert.deepEqual(loaners('600i Executive'), ['Cyclone']); // "600i Explorer and Executive"
  assert.deepEqual(loaners('Hull E'), ['Hull C', 'Hercules C2']); // "Hull D, E"
  assert.deepEqual(loaners('Idris-P'), ['F7C-M Super Hornet', 'MPUV Passenger']); // "Idris-M & P"
  assert.deepEqual(loaners('Pulse LX'), ['Mustang Alpha']); // "Pulse (+ LX)"
  assert.deepEqual(loaners('X1 Force'), ['Mustang Alpha']); // "X1 (+ Velocity, Force)"
  assert.deepEqual(loaners('Cyclone TR'), ['Mustang Alpha']); // "Cyclone Variants"
  assert.deepEqual(loaners('Carrack Expedition'), ['C8 Pisces', 'URSA Rover']);
  assert.deepEqual(loaners('Crucible'), ['Constellation Andromeda']); // &nbsp; trimmed
});

test('loanersFor prefers the most specific row', () => {
  assert.deepEqual(loaners('Constellation Phoenix Emerald'), ['P-72 Archimedes', 'Lynx Rover']);
  assert.deepEqual(loaners('Kraken Privateer'), ['Polaris', 'Ironclad', 'Buccaneer']);
  assert.deepEqual(loaners('Kraken'), ['Polaris', 'Ironclad Assault', 'Buccaneer']);
});

test('loanersFor returns null for flyable ships', () => {
  assert.equal(OH.loanersFor('Cutlass Black', matrix), null);
  assert.equal(OH.loanersFor('Constellation Taurus', matrix), null);
});

test('included vessels: RSI list parses and matches parent ships', () => {
  const inc = OH.parseLoanerMatrix(
    fs.readFileSync(path.join(__dirname, 'fixtures', 'included-vessels.html'), 'utf8'),
  );
  const got = (n) => (OH.loanersFor(n, inc) || {}).loaners || null;
  assert.ok(inc.length >= 10);
  assert.deepEqual(got('Carrack'), ['C8 Pisces', 'URSA Rover']);
  assert.deepEqual(got('Constellation Andromeda'), ['P-52 Merlin']);
  assert.deepEqual(got('Idris-M'), ['MPUV-Personnel']); // "Idris-M Frigate"
  assert.deepEqual(got('Javelin'), ['MPUV-Cargo']); // "Javelin*"
  assert.deepEqual(got('600i Executive'), ['G12* (currently Cyclone)']); // "600i Executive Edition"
  assert.equal(got('Cutlass Black'), null);
});
