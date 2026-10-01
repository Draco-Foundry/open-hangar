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

test('parseShipStock: standalone vs only-in-a-pack vs not in store (real RSI pages)', () => {
  const page = (n) =>
    fs.readFileSync(path.join(__dirname, 'fixtures', `ship-page-${n}.html`), 'utf8');
  const cutlass = OH.parseShipStock(page('in')); // standalone offer in stock
  assert.equal(cutlass.state, 'in');
  assert.equal(cutlass.price, 110);
  const carrack = OH.parseShipStock(page('pack')); // only offer: Ultimate Explorer Pack
  assert.equal(carrack.state, 'pack');
  assert.deepEqual(
    carrack.packs.map((p) => p.name),
    ['Ultimate Explorer Pack'],
  );
  assert.equal(OH.parseShipStock(page('out')).state, 'out'); // E1 Spirit
  assert.equal(OH.parseShipStock('<html>no data</html>'), null);
});

test('getShipStock: a missing page means not in the store; cached', async () => {
  let calls = 0;
  const gone = async () => {
    calls++;
    return { ok: false, status: 404 };
  };
  const url = 'https://robertsspaceindustries.com/pledge/ships/merchantman/Merchantman';
  assert.equal((await OH.getShipStock(url, gone)).state, 'out');
  assert.equal((await OH.getShipStock(url, gone)).state, 'out');
  assert.equal(calls, 1);
  assert.equal(await OH.getShipStock('https://evil.example/x', gone), null);
});

test('parseCommLinks reads RSI Comm-Link cards (real list)', () => {
  const items = OH.parseCommLinks(
    fs.readFileSync(path.join(__dirname, 'fixtures', 'commlinks.html'), 'utf8'),
  );
  assert.equal(items.length, 10);
  assert.equal(items[0].title, 'This Week in Star Citizen - September 28, 2026');
  assert.match(items[0].url, /^https:\/\/robertsspaceindustries\.com\/comm-link\//);
  assert.equal(items[0].when, '1 day ago');
  assert.ok(items[0].excerpt.includes('\u2018verse')); // &#8216; decoded
  for (const it of items) assert.doesNotMatch(it.title, /&#?\w+;|</);
});

test('getRsiNews caches an hour and keeps the last list when RSI is down', async () => {
  const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'commlinks.html'), 'utf8');
  let calls = 0;
  const ok = async () => {
    calls++;
    return { ok: true, json: async () => ({ success: 1, data: html }) };
  };
  assert.equal((await OH.getRsiNews(ok)).length, 10);
  assert.equal((await OH.getRsiNews(ok)).length, 10);
  assert.equal(calls, 1);
});

test('This Week in Star Citizen: short summary from the real post', () => {
  const read = (n) => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');
  assert.match(
    OH.twiscBodyUrl(read('twisc-page.html')),
    /^https:\/\/robertsspaceindustries\.com\/alexandria\/html\//,
  );
  assert.equal(OH.twiscBodyUrl("<script>const s3Url = 'https://evil.example/x';</script>"), null);
  const sum = OH.parseTwisc(read('twisc-body.html'));
  assert.ok(sum.points.length >= 4 && sum.points.length <= 6);
  assert.match(sum.points[0], /^Last week was a busy one on the testing front/);
  assert.ok(sum.points.every((p) => !/\s[.,!?]/.test(p) && !/see you soon/i.test(p)));
  assert.deepEqual(sum.schedule, [
    { day: 'Thursday, October 1', items: ['New Game Library System'] },
    { day: 'Friday, October 2', items: ['RSI Weekly Newsletter'] },
  ]);
});
