'use strict';
// Rotating lines (src/quips.js, #256). Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = globalThis;
require('../src/quips.js');
const OH = globalThis.OH;

test('every pool has lines, follows the house rules, and matches the signed-off review copy', () => {
  const review = fs
    .readFileSync(path.join(__dirname, '..', 'docs', 'JOKE-POOLS.md'), 'utf8')
    .replace(/[’']/g, "'");
  for (const [name, list] of Object.entries(OH.QUIPS)) {
    assert.ok(list.length >= 10, name);
    assert.equal(new Set(list).size, list.length, `${name}: duplicates`);
    for (const line of list) {
      assert.ok(!line.includes('—'), `${name}: em dash in ${line}`);
      assert.ok(
        review.includes(line.replace(/[’']/g, "'")),
        `${name}: not in JOKE-POOLS.md: ${line}`,
      );
    }
  }
});

test('never the same line twice in a row', () => {
  let n = 0;
  const stuck = () => 0.5; // a "random" source that always picks the same index
  let prev = OH.quip('scan', stuck);
  for (let i = 0; i < 50; i++) {
    const next = OH.quip('scan', stuck);
    assert.notEqual(next, prev);
    prev = next;
    n++;
  }
  assert.equal(n, 50);
});

test('an unknown pool gives an empty string, not a crash', () => {
  assert.equal(OH.quip('nope'), '');
});
