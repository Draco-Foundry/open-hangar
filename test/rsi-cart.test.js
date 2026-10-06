'use strict';
// Add to RSI Cart (src/rsi-cart.js, #288): the requests RSI's upgrade window makes,
// their answers, the error kinds, and the rule that addToCart is never retried. Also
// the website bridge in src/background.js, in a store build (sync cut out).
// No real RSI anywhere: every id and name below is invented. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

require('../src/rsi-cart.js');
const C = globalThis.OHCart;

// A pretend RSI upgrade tool. Ships: 101 and 102 can upgrade to the target (SKU 9001
// of ship 900), 103 is owned but RSI won't take it, 104 isn't owned.
function fakeRsi({ anonymous = false, mode = 'browse', add = 'ok', status = {} } = {}) {
  const calls = []; // the upgrade tool's calls (context + GraphQL)
  const all = []; // every request, the RSI page and setAuthToken too
  const res = (body, code = 200, headers = {}) => ({
    ok: code >= 200 && code < 300,
    status: code,
    headers: { get: (k) => headers[k.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => body,
  });
  const fetch = async (url, init) => {
    all.push({ url, init });
    if (url === C.PLEDGE_STORE_URL)
      return res('<html><head><meta name="csrf-token" content="csrf-from-page"></head></html>');
    if (url === C.AUTH_URL) return res({ success: 1 });
    const body = JSON.parse(init.body);
    calls.push({ url, body, init });
    const op = url.endsWith('setContextToken') ? 'context' : body.operationName;
    if (status[op]) return res({}, status[op], { 'retry-after': '30' });
    if (op === 'context') {
      if (body.pledgeId) mode = 'buyback';
      return res({ success: 1 });
    }
    if (op === 'initShipUpgrade') {
      const data = { app: { mode, isAnonymous: anonymous } };
      if (/ships/.test(body.query))
        data.ships = [
          {
            id: 101,
            name: 'Pulse',
            owned: 1,
            msrp: 3000,
            medias: { productThumbMediumAndSmall: '/media/p.jpg' },
          },
          { id: 102, name: 'Avenger Titan', owned: 1, msrp: 5500, medias: null },
          { id: 103, name: 'Cutlass Black', owned: 1, msrp: 10000 },
          { id: 104, name: 'Arrow', owned: 0, msrp: 7500 },
          { id: 900, name: 'Constellation Taurus', owned: 0, msrp: 20000 },
        ];
      return res({ data });
    }
    if (op === 'filterShips')
      return res({
        data: { from: { ships: [{ id: 101 }, { id: 102 }, { id: 104 }] }, to: { ships: [] } },
      });
    if (op === 'getPrice') {
      const amount = { 101: 17000, 102: 14500 }[body.variables.from];
      return res({ data: { price: { amount, nativeAmount: amount } } });
    }
    if (op === 'addToCart') {
      if (add === 'ok') return res({ data: { addToCart: { jwt: 'header.payload.sig' } } });
      if (add === 'auth') return res({ errors: [{ message: 'User is not authenticated' }] });
      return res({ errors: [{ message: 'Upgrade not available' }], data: { addToCart: null } });
    }
    throw new Error(`unexpected ${op}`);
  };
  return {
    fetch,
    calls,
    all,
    ops: () =>
      calls.map((c) => (c.url.endsWith('setContextToken') ? 'context' : c.body.operationName)),
  };
}
const fast = (rsi, extra = {}) => C.make({ fetch: rsi.fetch, sleep: async () => {}, ...extra });

test('request bodies match RSI upgrade window (ids as numbers, buy-back adds pledgeId)', () => {
  assert.deepEqual(C.contextBody({ fromShipId: '101', toShipId: 900, toSkuId: '9001' }), {
    fromShipId: 101,
    toShipId: 900,
    toSkuId: 9001,
  });
  assert.deepEqual(C.contextBody({ fromShipId: 1, toShipId: 2, toSkuId: 3, pledgeId: '44' }), {
    fromShipId: 1,
    toShipId: 2,
    toSkuId: 3,
    pledgeId: 44,
  });
  assert.deepEqual(C.contextBody({ toShipId: 'x' }), {});
  const f = C.filterBody(9001);
  assert.equal(f.operationName, 'filterShips');
  assert.deepEqual(f.variables, { toId: 9001, fromFilters: [] });
  assert.doesNotMatch(
    f.query,
    /to\(from:/,
    'no "to" half: RSI says Ship not found without a From ship',
  );
  assert.match(f.query, /from\(to: \$toId, filters: \$fromFilters\)/);
  assert.deepEqual(C.priceBody(101, 9001).variables, { from: 101, to: 9001 });
  assert.match(C.priceBody(1, 2).query, /^query getPrice\(\$from: Int!, \$to: Int!\)/);
  const a = C.addBody('101', '9001');
  assert.equal(a.operationName, 'addToCart');
  assert.deepEqual(a.variables, { from: 101, to: 9001 });
  assert.match(a.query, /^mutation addToCart\(\$from: Int!, \$to: Int!\)[\s\S]*jwt/);
});

test('parsing: prices in dollars, the from list, errors, owned ships first and best first', () => {
  assert.deepEqual(C.parsePrice({ data: { price: { amount: 17000, nativeAmount: 15900 } } }), {
    price: 170,
    native: 159,
  });
  assert.equal(C.parsePrice({ data: { price: null } }), null);
  assert.deepEqual(C.parseFrom([{ data: { from: { ships: [{ id: 5 }, { id: 'x' }] } } }]), [5]);
  assert.equal(C.parseFrom({ data: {} }), null);
  assert.equal(C.gqlError({ errors: [{ message: 'Not logged in' }] }), 'signed-out');
  assert.equal(C.gqlError({ errors: [{ message: 'Sku is not available' }] }), 'refused');
  assert.equal(C.gqlError({ data: {} }), null);
  assert.equal(C.parseAdded({ data: { addToCart: { jwt: 'x' } } }), true);
  assert.equal(C.parseAdded({ data: { addToCart: null } }), false);
  const ships = C.parseShips({
    data: {
      ships: [
        {
          id: 1,
          name: 'A',
          owned: 1,
          msrp: 10,
          medias: { productThumbMediumAndSmall: '/m/a.jpg' },
        },
        { id: 2, name: 'B', owned: true, msrp: 50 },
        { id: 3, name: 'C', owned: 1, msrp: 90 },
        { id: 4, name: 'D', owned: 0, msrp: 20 },
      ],
    },
  });
  assert.equal(ships[0].image, 'https://robertsspaceindustries.com/m/a.jpg');
  const opts = C.buildOptions(ships, [1, 2, 4], 9);
  assert.deepEqual(
    opts.map((o) => [o.name, o.eligible]),
    [
      ['B', true],
      ['A', true],
      ['C', false],
    ],
  );
  // RSI marks nothing owned: its from list is "My ships".
  const none = ships.map((s) => ({ ...s, owned: false }));
  assert.deepEqual(
    C.buildOptions(none, [1, 4], 9).map((o) => o.name),
    ['D', 'A'],
  );
});

test('upgradeOptions: context, ship list, filterShips, then RSI prices one at a time', async () => {
  const rsi = fakeRsi();
  const r = await fast(rsi).upgradeOptions(900, 9001);
  assert.equal(r.ok, true);
  assert.deepEqual(
    r.options.map((o) => [o.id, o.name, o.eligible, o.price]),
    [
      [102, 'Avenger Titan', true, 145],
      [101, 'Pulse', true, 170],
      [103, 'Cutlass Black', false, null],
    ],
  );
  assert.deepEqual(rsi.ops(), [
    'context',
    'initShipUpgrade',
    'filterShips',
    'getPrice',
    'getPrice',
  ]);
  assert.deepEqual(rsi.calls[0].body, {}, 'a new upgrade opens a plain context');
  for (const c of rsi.calls) {
    assert.equal(c.init.method, 'POST');
    assert.equal(c.init.credentials, 'include', 'runs in your own RSI session');
  }
  assert.equal(rsi.calls[2].url, C.UPGRADE_URL);
});

test('upgradeOptions: signed out of RSI says so and asks nothing more', async () => {
  const rsi = fakeRsi({ anonymous: true });
  const r = await fast(rsi).upgradeOptions(900, 9001);
  assert.deepEqual(r, { ok: false, error: 'signed-out' });
  assert.deepEqual(rsi.ops(), ['context', 'initShipUpgrade']);
});

test('addUpgradeToCart: context with both ships, a sign-in check, one addToCart', async () => {
  const rsi = fakeRsi();
  const r = await fast(rsi).addUpgradeToCart(101, 900, 9001);
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(rsi.ops(), ['context', 'initShipUpgrade', 'addToCart']);
  assert.deepEqual(rsi.calls[0].body, { fromShipId: 101, toShipId: 900, toSkuId: 9001 });
  assert.deepEqual(rsi.calls[2].body.variables, { from: 101, to: 9001 });
});

test('buy-back upgrade: pledge id in the context, and only added in buy-back mode', async () => {
  const rsi = fakeRsi();
  assert.deepEqual(await fast(rsi).addUpgradeToCart(101, 900, 9001, { pledgeId: 5550001 }), {
    ok: true,
  });
  assert.deepEqual(rsi.calls[0].body, {
    fromShipId: 101,
    toShipId: 900,
    toSkuId: 9001,
    pledgeId: 5550001,
  });
  // RSI didn't switch to buy-back mode: nothing is added (it would be a new upgrade).
  const stuck = fakeRsi();
  const api = C.make({
    fetch: async (url, init) => {
      const r = await stuck.fetch(url, {
        ...init,
        body: init.body.replace(/,"pledgeId":\d+/, ''),
      });
      return r;
    },
    sleep: async () => {},
  });
  const r = await api.addUpgradeToCart(101, 900, 9001, { pledgeId: 5550001 });
  assert.deepEqual(r, { ok: false, error: 'refused' });
  assert.ok(!stuck.ops().includes('addToCart'));
});

test('buy-back price: context with the pledge, then getPrice', async () => {
  const rsi = fakeRsi();
  const r = await fast(rsi).upgradePrice(101, 9001, { pledgeId: 5550001, toShipId: 900 });
  assert.equal(r.ok, true);
  assert.equal(r.price, 170);
  assert.deepEqual(rsi.ops(), ['context', 'getPrice']);
  assert.equal(rsi.calls[0].body.pledgeId, 5550001);
});

test('a new upgrade is not added while RSI is still in buy-back mode', async () => {
  const rsi = fakeRsi({ mode: 'buyback' });
  assert.deepEqual(await fast(rsi).addUpgradeToCart(101, 900, 9001), {
    ok: false,
    error: 'refused',
  });
  assert.ok(!rsi.ops().includes('addToCart'));
});

test('picking a From ship opens a fresh context before asking its price', async () => {
  const rsi = fakeRsi();
  const r = await fast(rsi).upgradePrice(101, 9001, { toShipId: 900, setContext: true });
  assert.equal(r.price, 170);
  assert.deepEqual(rsi.ops(), ['context', 'getPrice']);
  assert.deepEqual(rsi.calls[0].body, { fromShipId: 101, toShipId: 900, toSkuId: 9001 });
});

test('errors map to signed-out / refused / busy / network', async () => {
  assert.deepEqual(await fast(fakeRsi({ add: 'auth' })).addUpgradeToCart(101, 900, 9001), {
    ok: false,
    error: 'signed-out',
  });
  assert.deepEqual(await fast(fakeRsi({ add: 'no' })).addUpgradeToCart(101, 900, 9001), {
    ok: false,
    error: 'refused',
  });
  assert.deepEqual(
    await fast(fakeRsi({ status: { context: 401 } })).addUpgradeToCart(101, 900, 9001),
    { ok: false, error: 'signed-out' },
  );
  assert.deepEqual(
    await fast(fakeRsi({ status: { addToCart: 503 } })).addUpgradeToCart(101, 900, 9001),
    { ok: false, error: 'network' },
  );
  const down = C.make({
    fetch: async () => {
      throw new TypeError('Failed to fetch');
    },
    sleep: async () => {},
  });
  assert.deepEqual(await down.addUpgradeToCart(101, 900, 9001), { ok: false, error: 'network' });
  assert.deepEqual(await fast(fakeRsi()).addUpgradeToCart(0, 900, 9001), {
    ok: false,
    error: 'refused',
  });
});

test('addToCart is never retried, even when RSI fails or asks to slow down', async () => {
  for (const status of [500, 502, 429]) {
    const rsi = fakeRsi({ status: { addToCart: status } });
    const r = await fast(rsi).addUpgradeToCart(101, 900, 9001);
    assert.equal(r.ok, false);
    assert.equal(rsi.ops().filter((o) => o === 'addToCart').length, 1, `status ${status}`);
  }
  const net = fakeRsi();
  let adds = 0;
  const api = C.make({
    fetch: async (url, init) => {
      if (JSON.parse(init.body).operationName === 'addToCart') {
        adds++;
        throw new TypeError('Failed to fetch');
      }
      return net.fetch(url, init);
    },
    sleep: async () => {},
  });
  assert.deepEqual(await api.addUpgradeToCart(101, 900, 9001), { ok: false, error: 'network' });
  assert.equal(adds, 1);
});

test('polite: one request at a time with a pause, and nothing during a Retry-After', async () => {
  let t = 1000;
  const waits = [];
  let inFlight = 0;
  let most = 0;
  const clock = {
    sleep: async (ms) => {
      waits.push(ms);
      t += ms;
    },
    now: () => t,
    random: () => 0,
  };
  const ok = fakeRsi();
  const api = C.make({
    fetch: async (url, init) => {
      inFlight++;
      most = Math.max(most, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return ok.fetch(url, init);
    },
    ...clock,
  });
  await Promise.all([api.upgradeOptions(900, 9001), api.upgradePrice(101, 9001)]);
  assert.equal(most, 1, 'never two at once');
  assert.equal(waits.length, ok.all.length - 1, 'a pause before every request but the first');
  assert.ok(waits.every((w) => w >= 300));

  const rsi = fakeRsi({ status: { getPrice: 429 } });
  const slow = C.make({ fetch: rsi.fetch, ...clock });
  const a = await slow.upgradeOptions(900, 9001);
  assert.equal(a.ok, true, 'the list still shows');
  assert.equal(a.options[0].price, null);
  assert.equal(rsi.ops().filter((o) => o === 'getPrice').length, 1, 'stopped at the first 429');
  const before = rsi.calls.length;
  const c = await slow.addUpgradeToCart(101, 900, 9001);
  assert.equal(c.error, 'busy');
  assert.ok(c.retryAt > t);
  assert.equal(rsi.calls.length, before, 'held off for Retry-After: nothing sent');
  t += 31e3;
  assert.equal((await slow.addUpgradeToCart(101, 900, 9001)).ok, true);
});

// The background worker as a store build ships it (scripts/pack.mjs cuts @sync blocks).
function loadBackground({ sync }) {
  let src = fs.readFileSync(path.join(__dirname, '..', 'src', 'background.js'), 'utf8');
  if (!sync) {
    const out = [];
    let inside = false;
    for (const line of src.split('\n')) {
      if (line.includes('@sync-start')) inside = true;
      else if (line.includes('@sync-end')) inside = false;
      else if (!inside) out.push(line);
    }
    src = out.join('\n');
  }
  const listen = () => ({ addListener() {} });
  let external;
  const rsi = fakeRsi();
  const area = { get: async () => ({}), set: async () => {}, remove: async () => {} };
  const chrome = {
    storage: { local: area, session: area, onChanged: listen() },
    runtime: {
      id: 'x',
      onInstalled: listen(),
      onStartup: listen(),
      onUpdateAvailable: listen(),
      onMessageExternal: { addListener: (f) => (external = f) },
      getManifest: () => ({
        version: '0.0.0',
        externally_connectable: {
          matches: [
            'https://openhangar.space/*',
            'https://app.openhangar.space/*',
            'https://staging.openhangar.space/*',
          ],
        },
      }),
      getURL: (p) => p,
    },
    action: { onClicked: listen(), setBadgeText() {}, setTitle() {}, setBadgeBackgroundColor() {} },
    tabs: { create() {} },
  };
  const ctx = {
    chrome,
    console,
    crypto,
    TextEncoder,
    btoa,
    Date,
    Math,
    JSON,
    Promise,
    setTimeout,
    fetch: rsi.fetch,
  };
  ctx.self = ctx;
  ctx.importScripts = (f) =>
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx);
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const send = (msg, origin) =>
    new Promise((res) => {
      const later = external(msg, { origin }, (r) => res(r && JSON.parse(JSON.stringify(r))));
      if (!later) res(undefined);
    });
  return { send, rsi };
}

test('website bridge works in a store build: options, price, add; only from our site', async () => {
  const x = loadBackground({ sync: false });
  const SITE = 'https://app.openhangar.space';
  assert.deepEqual(await x.send({ type: 'oh-hello' }, SITE), {
    ok: true,
    cart: true,
    connect: false,
  });
  const o = await x.send({ type: 'oh-upgrade-options', toShipId: 900, toSkuId: 9001 }, SITE);
  assert.equal(o.ok, true);
  assert.deepEqual(
    o.options.map((r) => r.id),
    [102, 101, 103],
  );
  const p = await x.send({ type: 'oh-upgrade-price', fromShipId: 101, toSkuId: 9001 }, SITE);
  assert.equal(p.price, 170);
  const a = await x.send(
    { type: 'oh-add-upgrade', fromShipId: 101, toShipId: 900, toSkuId: 9001 },
    SITE,
  );
  assert.deepEqual(a, { ok: true });
  const c = await x.send({ type: 'oh-connect-begin' }, SITE);
  assert.equal(c.ok, false, 'no connect in a store build');
  const main = await x.send({ type: 'oh-hello' }, 'https://openhangar.space');
  assert.equal(main.cart, true, 'the store on openhangar.space too');
  const before = x.rsi.calls.length;
  assert.equal(
    await x.send(
      { type: 'oh-add-upgrade', fromShipId: 101, toShipId: 900, toSkuId: 9001 },
      'https://evil.example',
    ),
    undefined,
  );
  assert.equal(x.rsi.calls.length, before, 'another site gets nothing and sends nothing');
});

test('website bridge in a sync build answers both the cart and Connect', async () => {
  const x = loadBackground({ sync: true });
  const hello = await x.send({ type: 'oh-hello' }, 'https://staging.openhangar.space');
  assert.deepEqual(hello, { ok: true, cart: true, connect: true });
  const main = await x.send({ type: 'oh-hello' }, 'https://openhangar.space');
  assert.deepEqual(main, { ok: true, cart: true, connect: false }, 'Connect stays on the app');
  const c = await x.send({ type: 'oh-connect-begin' }, 'https://openhangar.space');
  assert.equal(c.ok, false);
  const o = await x.send(
    { type: 'oh-upgrade-options', toShipId: 900, toSkuId: 9001 },
    'https://staging.openhangar.space',
  );
  assert.equal(o.ok, true);
});

test("signs in the way RSI's own window does: x-rsi-token on setup, X-CSRF-TOKEN on GraphQL", async () => {
  assert.equal(C.parseCsrf('<meta name="csrf-token" content="t0k">'), 't0k');
  assert.equal(C.parseCsrf('<meta content="t0k" name="csrf-token" />'), 't0k');
  assert.equal(C.parseCsrf('<html></html>'), null);
  const rsi = fakeRsi();
  const cart = fast(rsi, { rsiToken: async () => 'cookie-token' });
  const r = await cart.upgradeOptions(900, 9001);
  assert.equal(r.ok, true);
  const urls = rsi.all.map((c) => c.url);
  assert.equal(urls[0], C.AUTH_URL, 'setAuthToken first');
  assert.equal(urls[1], C.CONTEXT_URL, 'then setContextToken');
  for (const c of rsi.all.filter((x) => x.url === C.AUTH_URL || x.url === C.CONTEXT_URL))
    assert.equal(c.init.headers['x-rsi-token'], 'cookie-token');
  const gql = rsi.all.filter((x) => x.url === C.UPGRADE_URL);
  assert.ok(gql.length >= 2);
  for (const c of gql) assert.equal(c.init.headers['X-CSRF-TOKEN'], 'csrf-from-page');
  assert.equal(
    rsi.all.filter((x) => x.url === C.PLEDGE_STORE_URL).length,
    1,
    'the page is read once and its token reused',
  );
});
