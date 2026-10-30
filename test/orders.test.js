'use strict';
// The order history reader (src/scraper/parser.js parseOrders and ordersPath, the
// orderHistory flag) on test/fixtures/orders.sample.html: RSI's billing page shape with
// invented values. It reads each order's cells, lines and sums in whole cents, never
// the bill-to address or the payments table, and what it reads fits the sync's schema.
// Run: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('');
global.DOMParser = dom.window.DOMParser;
require('../src/scraper/parser.js');
const OH = globalThis.OpenHangar;
const { validate } = require('../src/schema-check.js');
const SCHEMA = require('../src/sync-schema.js');

const PAGE = fs.readFileSync(path.join(__dirname, 'fixtures', 'orders.sample.html'), 'utf8');

test('each order: its cells, lines and sums, amounts in whole cents', () => {
  assert.deepEqual(OH.parseOrders(PAGE), [
    {
      id: 'TESTORDER0001',
      date: '2024-02-11',
      status: 'CLOSED',
      payment: 'PAID',
      fulfillment: 'DONE',
      currency: 'USD',
      items: 11100,
      discount: 0,
      credit: 4000,
      beforeTax: 7100,
      total: 7100,
      lines: [
        { name: 'Package - Test Cutlass Black 1', qty: 1, price: 11100, discount: 0, total: 11100 },
      ],
    },
    {
      id: 'TESTORDER0002',
      date: '2024-03-12',
      status: 'CLOSED',
      payment: 'PAID',
      fulfillment: 'DONE',
      currency: 'USD',
      items: 122600,
      discount: 500,
      credit: 10000,
      beforeTax: 112100,
      total: 123450,
      lines: [
        {
          name: 'Standalone Ship - Test Carrack',
          qty: 1,
          price: 120000,
          discount: 0,
          total: 120000,
        },
        {
          name: 'Upgrade - Test Arrow to Test Hornet 2',
          qty: 1,
          price: 1500,
          discount: 0,
          total: 1500,
        },
        { name: 'Test Poster', qty: 4, price: 300, discount: 100, total: 1100 },
      ],
    },
  ]);
});

test('never the bill-to address or the payments table', () => {
  const text = JSON.stringify(OH.parseOrders(PAGE));
  for (const never of ['Billing', 'Testville', 'Testland', '00000', 'Processor', '18:30', '09:05'])
    assert.ok(!text.includes(never), never);
  // Every key is one the sync allows (the schema is strict there too).
  const keys = new Set();
  for (const o of OH.parseOrders(PAGE)) {
    Object.keys(o).forEach((k) => keys.add(k));
    for (const l of o.lines) Object.keys(l).forEach((k) => keys.add(`line.${k}`));
  }
  assert.deepEqual([...keys].sort(), [
    'beforeTax',
    'credit',
    'currency',
    'date',
    'discount',
    'fulfillment',
    'id',
    'items',
    'line.discount',
    'line.name',
    'line.price',
    'line.qty',
    'line.total',
    'lines',
    'payment',
    'status',
    'total',
  ]);
});

test('what it reads fits the sync schema', () => {
  const vector = path.join(__dirname, 'fixtures', 'sync-schema', '52-valid-orders.json');
  const { payload } = JSON.parse(fs.readFileSync(vector, 'utf8'));
  payload.sources.orders.items = OH.parseOrders(PAGE);
  assert.equal(validate(SCHEMA, payload), null);
});

test('the pager and the address of each page', () => {
  assert.deepEqual(OH.parsePager(PAGE), { current: 1, max: 2 });
  assert.equal(OH.ordersPath(1), '/en/account/billing?storefront=2&page=1&pagesize=100');
  assert.equal(OH.ordersPath(3), '/en/account/billing?storefront=2&page=3&pagesize=100');
  assert.equal(OH.ordersPath(0), '/en/account/billing?storefront=2&page=1&pagesize=100');
});

test('odd pages: no orders, a card without an id, an amount that does not read', () => {
  assert.deepEqual(OH.parseOrders('<html><body>No orders</body></html>'), []);
  assert.deepEqual(OH.parseOrders(null), []);
  const noId = PAGE.replace('TESTORDER0001', 'TEST ORDER/1');
  assert.deepEqual(
    OH.parseOrders(noId).map((o) => o.id),
    ['TESTORDER0002'],
  );
  const odd = OH.parseOrders(
    PAGE.replace(
      '<strong>Credits used:</strong><span class="">$40.00 USD</span>',
      '<strong>Credits used:</strong><span class="">n/a</span>',
    ),
  );
  assert.equal(odd[0].credit, null);
});
