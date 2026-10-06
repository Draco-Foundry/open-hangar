'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const store = {};
global.window = globalThis;
global.chrome = {
  storage: {
    local: {
      get: async (k) => {
        const keys = Array.isArray(k) ? k : [k];
        return Object.fromEntries(keys.filter((x) => x in store).map((x) => [x, store[x]]));
      },
      set: async (o) => Object.assign(store, o),
    },
  },
};
require('../src/lib.js');
const OH = globalThis.OH;
// Each test simulates its own outages: forget the last test's 'site is down'.
test.beforeEach(() => delete store.netDown);

const raw = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'store-ships.json'), 'utf8'),
);

test('parseStoreShips: sale state, editions and prices in dollars', () => {
  const ships = OH.parseStoreShips(raw);
  assert.equal(ships.length, 242);
  const es = ships.find((s) => s.name === 'Aurora Mk I ES');
  assert.equal(es.forSale, true);
  assert.equal(es.price, 20);
  assert.equal(
    es.link,
    'https://robertsspaceindustries.com/pledge/ships/rsi-aurora/Aurora-Mk-I-ES',
  );
  const off = ships.find((s) => s.name === 'Idris-P');
  assert.equal(off.forSale, false);
  assert.equal(off.price, null);
  assert.ok(ships.some((s) => s.warbond));
  assert.equal(ships.filter((s) => s.forSale).length, 90);
});

test('getStoreShips caches for 6 hours and keeps the last copy when RSI is down', async () => {
  let calls = 0;
  const ok = async () => {
    calls++;
    return { ok: true, json: async () => raw };
  };
  const first = await OH.getStoreShips(ok);
  assert.equal(first.ships.length, 242);
  await OH.getStoreShips(ok);
  assert.equal(calls, 1);
  const down = async () => ({ ok: false, status: 503 });
  const again = await OH.getStoreShips(down, { force: true });
  assert.equal(again.ships.length, 242); // cached copy
});

test('upgradeSku: the SKU an Add to RSI Cart goes to (cheapest edition on offer)', () => {
  const ships = OH.parseStoreShips({
    data: {
      ships: [
        {
          id: 900,
          name: 'Example Hauler',
          skus: [
            { id: 9001, title: 'Standard Edition', available: true, price: 20000 },
            { id: 9002, title: 'Warbond Edition', available: true, price: 18000 },
            { id: 9003, title: 'Old Edition', available: false, price: 10000 },
          ],
        },
        { id: 901, name: 'Example Concept', skus: [] },
      ],
    },
  });
  assert.equal(ships[0].editions[0].id, 9001);
  assert.deepEqual(OH.upgradeSku(ships[0]), {
    toShipId: 900,
    toSkuId: 9002,
    skus: [9002, 9001],
    price: 180,
    title: 'Warbond Edition',
  });
  assert.equal(OH.upgradeSku(ships[1]), null);
  assert.equal(OH.upgradeSku({ id: 5, editions: [{ title: 'Old cache', price: 1 }] }), null);
});
