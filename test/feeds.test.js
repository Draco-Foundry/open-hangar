'use strict';
// openhangar.space's public feeds (src/lib.js, OH.siteFeed and its readers): the
// extension talks only to RSI and openhangar.space. Polite: ETag / 304, at most
// once per feed's time, Retry-After and back-off on 429/5xx, the cached copy kept,
// and nothing about the user in the request. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');

let mem = {};
global.window = globalThis;
global.chrome = {
  storage: {
    local: {
      get: async (k) => {
        const out = {};
        for (const x of [].concat(k)) if (x in mem) out[x] = structuredClone(mem[x]);
        return out;
      },
      set: async (o) => Object.assign(mem, structuredClone(o)),
      remove: async (k) => [].concat(k).forEach((x) => delete mem[x]),
    },
  },
};
require('../src/lib.js');
const OH = globalThis.OH;
test.beforeEach(() => (mem = {}));

const SHIPS = {
  v: 1,
  updatedAt: '2026-09-30T00:00:00.000Z',
  credit: 'Ship data: Star Citizen Wiki API',
  ships: [
    {
      name: 'Avenger Titan',
      cls: 'aegs_avenger_titan',
      msrp: 65,
      img: 'https://media.robertsspaceindustries.com/dogyaf0p2eup4/store_small.jpg',
    },
    {
      name: 'Brand New Ship',
      cls: 'new_ship',
      msrp: 99,
      img: 'https://media.openhangar.space/n.jpg',
    },
    { name: 'Elsewhere', cls: null, msrp: 10, img: 'https://example.com/x.jpg' },
  ],
};

test('siteFeed: our own site only, no cookies, ETag on the next ask, 304 keeps the copy', async () => {
  const seen = [];
  let answer = () => Response.json(SHIPS, { headers: { etag: 'W/"s1"' } });
  const fetchFn = async (url, init) => {
    seen.push({ url, init });
    return answer();
  };
  const a = await OH.getShipsFeed({ fetchFn });
  assert.equal(a.data.ships.length, 3);
  assert.equal(seen[0].url, 'https://openhangar.space/api/ships');
  assert.equal(seen[0].init.credentials, 'omit');
  assert.equal(seen[0].init.headers['If-None-Match'], undefined);
  // Within a day: no request.
  await OH.getShipsFeed({ fetchFn });
  assert.equal(seen.length, 1);
  // Forced (or a day later): asks with the ETag; 304 = same copy, fresh time.
  answer = () => new Response(null, { status: 304 });
  mem.feedShips.at = 1;
  const b = await OH.getShipsFeed({ fetchFn });
  assert.equal(seen.length, 2);
  assert.equal(seen[1].init.headers['If-None-Match'], 'W/"s1"');
  assert.equal(b.data.ships.length, 3);
  assert.ok(Date.now() - mem.feedShips.at < 5000);
});

test('siteFeed: 429 and 503 keep the cached copy and wait for Retry-After; network errors back off', async () => {
  let calls = 0;
  let answer = () => Response.json(SHIPS);
  const fetchFn = async () => {
    calls++;
    return answer();
  };
  await OH.getShipsFeed({ fetchFn });
  answer = () => new Response('', { status: 429, headers: { 'retry-after': '120' } });
  const kept = await OH.getShipsFeed({ fetchFn, force: true });
  assert.equal(kept.data.ships.length, 3, 'the cached copy, no error');
  const wait = mem.feedShips.retryAt - Date.now();
  assert.ok(wait > 110e3 && wait <= 120e3, `waits Retry-After (${wait} ms)`);
  await OH.getShipsFeed({ fetchFn, force: true });
  assert.equal(calls, 2, 'not asked again before Retry-After, even when forced');
  // No Retry-After: 10 minutes, then doubling (counting from this outage).
  mem.feedShips.retryAt = 0;
  delete mem.feedShips.fails;
  answer = () => {
    throw new TypeError('Failed to fetch');
  };
  await OH.getShipsFeed({ fetchFn, force: true });
  const first = mem.feedShips.retryAt - Date.now();
  mem.feedShips.retryAt = 0;
  await OH.getShipsFeed({ fetchFn, force: true });
  const second = mem.feedShips.retryAt - Date.now();
  assert.ok(first > 9 * 60e3 && first <= 10 * 60e3 + 50, `first wait ${first}`);
  assert.ok(second > 19 * 60e3, `second wait ${second}`);
  assert.equal(mem.feedShips.data.ships.length, 3, 'the copy survives every failure');
  // A good answer clears the back-off.
  mem.feedShips.retryAt = 0;
  answer = () => Response.json(SHIPS);
  await OH.getShipsFeed({ fetchFn, force: true });
  assert.equal(mem.feedShips.fails, undefined);
});

test('siteFeed: a first run with the site down is null (callers degrade), a wrong shape is not cached', async () => {
  assert.equal(
    await OH.getShipsFeed({ fetchFn: async () => new Response('', { status: 503 }) }),
    null,
  );
  mem = {};
  assert.equal(
    await OH.getShipsFeed({ fetchFn: async () => Response.json({ v: 2, ships: [] }) }),
    null,
  );
  assert.equal(mem.feedShips.data, undefined);
});

test('retryAfterMs: seconds or a date, between a minute and a day', () => {
  assert.equal(OH.retryAfterMs('300'), 300e3);
  assert.equal(OH.retryAfterMs('1'), 60e3);
  assert.equal(OH.retryAfterMs('999999'), 24 * 3600e3);
  const now = Date.UTC(2026, 9, 6, 12);
  assert.equal(OH.retryAfterMs(new Date(now + 600e3).toUTCString(), now), 600e3);
  assert.equal(OH.retryAfterMs(''), 0);
  assert.equal(OH.retryAfterMs('soon'), 0);
});

test('mergeShipsFeed: prices, class names and pictures on top of the bundled fleet stats', () => {
  const bundled = [
    {
      name: 'Avenger Titan',
      lname: 'avenger titan',
      slug: 'aegs-avenger-titan',
      cls: 'aegs_avenger_titan',
      msrp: 60,
      career: 'Transporter',
      size: 'Small',
      crew: 1,
      cargo: 8,
      mfr: 'Aegis Dynamics',
    },
  ];
  const out = OH.mergeShipsFeed(bundled, SHIPS.ships);
  const titan = out.find((v) => v.lname === 'avenger titan');
  assert.equal(titan.msrp, 65, 'the feed has the current price');
  assert.equal(titan.career, 'Transporter', 'stats stay from the bundled list');
  assert.match(titan.img, /^https:\/\/media\.robertsspaceindustries\.com\//);
  const fresh = out.find((v) => v.lname === 'brand new ship');
  assert.equal(fresh.msrp, 99);
  assert.equal(fresh.cls, 'new_ship');
  assert.equal(out.find((v) => v.lname === 'elsewhere').img, null, 'no third-party pictures');
  assert.equal(bundled[0].msrp, 60, 'the bundled list is not changed');
  assert.deepEqual(OH.mergeShipsFeed(bundled, null), bundled);
  // The price index reads cls and msrp as before.
  const priceOf = OH.makePriceIndex(out);
  assert.equal(priceOf('Avenger Titan').msrp, 65);
});

test('getScVersion: the LIVE version from the game-status feed, shared with the pill', async () => {
  let calls = 0;
  const fetchFn = async (url) => {
    calls++;
    assert.equal(url, 'https://openhangar.space/api/game-status');
    return Response.json({
      v: 1,
      live: { version: '4.10.1', released: '2026-09-16T00:00:00.000Z' },
    });
  };
  const v = await OH.getScVersion({ fetchFn });
  assert.deepEqual(v, { code: '4.10.1-LIVE', released: Date.UTC(2026, 8, 16) });
  assert.equal(OH.formatScVersion(v.code), '4.10.1-LIVE');
  const pill = await OH.getGameStatus({ fetchFn });
  assert.equal(pill.data.live.version, '4.10.1');
  assert.equal(calls, 1, 'one request for both');
  mem = {};
  assert.deepEqual(
    await OH.getScVersion({ fetchFn: async () => new Response('', { status: 404 }) }),
    {
      code: null,
      released: null,
    },
  );
});

const CATALOG = {
  v: 1,
  updatedAt: '2026-10-06T11:03:32.858Z',
  items: [
    {
      id: 'sku-89',
      kind: 'ship',
      name: 'Cutlass Black',
      img: null,
      url: 'https://robertsspaceindustries.com/pledge/Standalone-Ships/Cutlass-Black',
      price: 110,
      wasPrice: null,
      warbond: false,
      standardPrice: null,
      savings: null,
      inStore: true,
      insurance: '6 Mo',
      upgrade: null,
    },
    {
      id: 'sku-90',
      kind: 'ship',
      name: 'Sabre Raven EX',
      img: null,
      url: 'https://robertsspaceindustries.com/pledge/a',
      price: 185,
      wasPrice: null,
      warbond: false,
      standardPrice: null,
      savings: null,
      inStore: true,
      insurance: null,
      upgrade: null,
    },
    {
      id: 'sku-91',
      kind: 'ship',
      name: 'Sabre Raven EX',
      img: null,
      url: 'https://robertsspaceindustries.com/pledge/b',
      price: 165,
      wasPrice: null,
      warbond: true,
      standardPrice: 185,
      savings: 20,
      inStore: true,
      insurance: null,
      upgrade: null,
    },
    {
      id: 'sku-92',
      kind: 'ship',
      name: 'Hull A',
      img: null,
      url: 'https://robertsspaceindustries.com/pledge/c',
      price: 100,
      wasPrice: null,
      warbond: false,
      standardPrice: null,
      savings: null,
      inStore: false,
      insurance: null,
      upgrade: null,
    },
    {
      id: 'sku-19453',
      kind: 'pack',
      name: 'ATLS Duo Pack',
      img: 'https://media.openhangar.space/e7.jpg',
      url: 'https://robertsspaceindustries.com/pledge/Packs/ATLS-Duo-Pack-Warbond',
      price: 75,
      wasPrice: null,
      warbond: true,
      standardPrice: 90,
      savings: 15,
      inStore: true,
      insurance: '24 Mo',
      upgrade: null,
    },
    {
      id: 'upgrade-16',
      kind: 'upgrade',
      name: 'Upgrade to Freelancer',
      img: null,
      url: 'https://robertsspaceindustries.com/en/pledge',
      price: 110,
      wasPrice: null,
      warbond: false,
      standardPrice: null,
      savings: null,
      inStore: true,
      insurance: null,
      upgrade: { toShipId: 16, to: 'Freelancer', skus: [13002] },
    },
    {
      id: 'sku-1',
      kind: 'paint',
      name: 'Bad Link Paint',
      img: 'https://evil.example/x.jpg',
      url: 'javascript:alert(1)',
      price: 5,
      inStore: true,
      upgrade: null,
    },
    { id: 'nope', kind: 'ship', name: 'No id', price: 1 },
  ],
  ships: [
    {
      id: 16,
      name: 'Freelancer',
      msrp: 110,
      editions: [
        { sku: 1, price: 110, warbond: false },
        { sku: 2, price: 100, warbond: true },
      ],
    },
  ],
};

test('shapeCatalog: checked items, RSI links only, our pictures only', () => {
  const c = OH.shapeCatalog(CATALOG);
  assert.equal(c.items.length, 7);
  const bad = c.byId.get('sku-1');
  assert.equal(bad.url, null);
  assert.equal(bad.img, null);
  assert.equal(c.byId.get('upgrade-16').wishKind, 'ccu');
  assert.equal(c.byId.get('sku-19453').wishKind, 'pack');
  assert.deepEqual(
    c.ships[0].editions.map((e) => e.price),
    [100, 110],
  );
});

test('catalogWishStatus: ships by name, any item by id, CCUs priced from your ship', () => {
  const c = OH.shapeCatalog(CATALOG);
  const opts = { msrpOf: (n) => ({ 'Aurora MR': 25, Carrack: 600, 'Hull A': 100 })[n] || null };
  assert.deepEqual(OH.catalogWishStatus(c, 'cutlass black', opts), {
    status: 'in',
    price: 110,
    warbond: null,
    url: 'https://robertsspaceindustries.com/pledge/Standalone-Ships/Cutlass-Black',
    img: null,
  });
  const raven = OH.catalogWishStatus(c, 'Sabre Raven EX', opts);
  assert.equal(raven.price, 185);
  assert.equal(raven.warbond, 165);
  assert.equal(OH.catalogWishStatus(c, 'Hull A', opts).status, 'soldout');
  const off = OH.catalogWishStatus(c, 'Carrack', opts);
  assert.equal(off.status, 'out');
  assert.equal(off.price, 600, 'its usual price');
  const pack = OH.catalogWishStatus(
    c,
    { id: 'sku-19453', kind: 'pack', name: 'ATLS Duo Pack' },
    opts,
  );
  assert.deepEqual([pack.status, pack.price, pack.warbond], ['in', 90, 75]);
  const ccu = { id: 'upgrade-16', kind: 'ccu', name: 'Aurora MR to Freelancer', from: 'Aurora MR' };
  const up = OH.catalogWishStatus(c, ccu, opts);
  assert.deepEqual([up.status, up.price, up.warbond], ['in', 85, 75]);
  const gone = OH.catalogWishStatus(
    c,
    { id: 'sku-404', kind: 'paint', name: 'Old Paint', price: 5 },
    opts,
  );
  assert.deepEqual([gone.status, gone.price], ['out', 5]);
  assert.equal(OH.catalogWishStatus(null, 'Cutlass Black', opts).status, 'unknown');
});

test('upgradeCost: edition price minus the ship you start from; none when not cheaper', () => {
  const c = OH.shapeCatalog(CATALOG);
  const item = c.byId.get('upgrade-16');
  assert.deepEqual(OH.upgradeCost(c, item, 25), { price: 85, warbond: 75 });
  assert.deepEqual(OH.upgradeCost(c, item, 105), { price: 5, warbond: null });
  assert.equal(OH.upgradeCost(c, item, 110), null);
  assert.equal(OH.upgradeCost(c, item, 0), null);
});

test('the store catalog is one request for everything; the wishlist never leaves', async () => {
  const urls = [];
  const fetchFn = async (url, init) => {
    urls.push(url);
    assert.equal(init.body, undefined);
    return Response.json(CATALOG, { headers: { etag: 'W/"c1"' } });
  };
  const feed = await OH.getStoreCatalog({ fetchFn, force: true });
  assert.equal(feed.data.items.length, CATALOG.items.length);
  assert.deepEqual(urls, ['https://openhangar.space/api/catalog']);
});

test('versions.json and the retired third-party caches', async () => {
  const feed = await OH.getStoreVersions({
    fetchFn: async (url) => {
      assert.equal(url, 'https://openhangar.space/versions.json');
      return Response.json({ version: '0.2.19', stores: { firefox: { live: '0.2.19' } } });
    },
  });
  assert.equal(feed.data.stores.firefox.live, '0.2.19');
  mem.wikiFiles = { a: 1 };
  mem.shipCatalog = { list: [] };
  mem.wishlist = ['Carrack'];
  await OH.dropRetiredCaches();
  assert.deepEqual(
    Object.keys(mem).sort(),
    ['errorLog', 'feedVersions', 'wishlist'].filter((k) => k in mem).sort(),
  );
  assert.equal(mem.wikiFiles, undefined);
  assert.deepEqual(mem.wishlist, ['Carrack']);
});
