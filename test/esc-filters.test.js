'use strict';

/* Escape clears the newest filter (ui/lib/esc-filters.js): the order the pills went on. Run: `npm test`. */

const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../ui/lib/esc-filters.js');

test('filterId keys a pill by group and key', async () => {
  const { filterId } = await load();
  assert.equal(filterId({ group: 'ins', key: 'LTI', label: 'LTI' }), 'ins|LTI');
  assert.equal(filterId({ group: 'cap', key: '' }), 'cap|');
});

test('stackOrder: filters on at the start count in pill order', async () => {
  const { stackOrder } = await load();
  assert.deepEqual(stackOrder([], ['type|ship', 'ins|LTI', 'cap|']), [
    'type|ship',
    'ins|LTI',
    'cap|',
  ]);
});

test('stackOrder: a new filter goes on the end, even when its pill sits first', async () => {
  const { stackOrder } = await load();
  let o = stackOrder([], ['ins|LTI']);
  o = stackOrder(o, ['type|ship', 'ins|LTI']);
  assert.deepEqual(o, ['ins|LTI', 'type|ship']);
  assert.equal(o[o.length - 1], 'type|ship');
});

test('stackOrder: a removed filter drops out, the rest keep their place', async () => {
  const { stackOrder } = await load();
  const o = stackOrder(
    ['ins|LTI', 'type|ship', 'mfr|Drake'],
    ['type|ship', 'mfr|Drake', 'ins|LTI'],
  );
  assert.deepEqual(o, ['ins|LTI', 'type|ship', 'mfr|Drake']);
  assert.deepEqual(stackOrder(o, ['ins|LTI', 'mfr|Drake']), ['ins|LTI', 'mfr|Drake']);
  assert.deepEqual(stackOrder(o, []), []);
});

test('stackOrder: removed and put back moves it to the end', async () => {
  const { stackOrder } = await load();
  let o = ['ins|LTI', 'type|ship'];
  o = stackOrder(o, ['type|ship']);
  o = stackOrder(o, ['type|ship', 'ins|LTI']);
  assert.deepEqual(o, ['type|ship', 'ins|LTI']);
});
