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

test('parseShipStock reads the store page stock (real RSI pages)', () => {
  const page = (n) =>
    fs.readFileSync(path.join(__dirname, 'fixtures', `ship-page-${n}.html`), 'utf8');
  assert.equal(OH.parseShipStock(page('in')), 'in'); // Cutlass Black
  assert.equal(OH.parseShipStock(page('out')), 'out'); // E1 Spirit
  assert.equal(OH.parseShipStock('<html>no data</html>'), null);
});

test('getShipStock: a missing page means not in the store; cached', async () => {
  let calls = 0;
  const gone = async () => {
    calls++;
    return { ok: false, status: 404 };
  };
  const url = 'https://robertsspaceindustries.com/pledge/ships/merchantman/Merchantman';
  assert.equal(await OH.getShipStock(url, gone), 'out');
  assert.equal(await OH.getShipStock(url, gone), 'out');
  assert.equal(calls, 1);
  assert.equal(await OH.getShipStock('https://evil.example/x', gone), null);
});
