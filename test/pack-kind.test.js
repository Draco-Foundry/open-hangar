'use strict';

/*
 * Pack or Game Package (OH.packKind in src/lib.js), the website's rule: both repos read
 * test/fixtures/pack-kind-cases.json (the website keeps a pinned copy), so the dashboard
 * and the website type the same pledge the same way. Run: `npm test`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { cases } = require('./fixtures/pack-kind-cases.json');

global.window = globalThis;
global.chrome = global.chrome || {
  storage: { local: { get: async () => ({}), set: async () => {} } },
};
require('../src/lib.js');
const OH = globalThis.OH;

test('every shared case reads as the website reads it', () => {
  for (const c of cases) assert.equal(OH.packKind(c), c.want, c.why);
});

test("a buy-back's facets (items, no kinds) read the same way", () => {
  const items = (labels) => labels.map((label) => ({ kind: '', label }));
  assert.equal(
    OH.packKind({
      name: 'Package - Mustang Alpha Starter Pack',
      items: items(['Mustang Alpha', 'Star Citizen Digital Download']),
    }),
    'package',
  );
  assert.equal(OH.packKind({ name: 'Package - Arena Commander Pass', items: [] }), 'package');
  assert.equal(OH.packKind(null), null);
});
