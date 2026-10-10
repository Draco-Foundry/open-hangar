'use strict';
// Bridge v2 (src/site-pages.js, src/background.js, src/site-bridge.js): which of our
// pages may ask what, the checks every message passes first, the hello with its
// capabilities, our hangar page's requests (Local Mode) and Firefox's bridge. The
// background runs in a sandbox with a fake chrome API (test/bridge-env.js), built the
// way scripts/pack.mjs builds it. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  FRONT,
  APP,
  HANGAR,
  STAGING,
  HANGAR_STAGING,
  builtBridge,
  loadBackground,
  pagesFor,
} = require('./bridge-env.js');
const { AT, states } = require('./stored-data.js');
const PAGES = require('../src/site-pages.js');

const UNKNOWN = { ok: false, error: 'unknown request' };
const BAD = { ok: false, error: 'bad request' };
const HANGAR_CAPS = ['hello', 'getHangar', 'getScanStatus', 'requestScan', 'addToCart'];
const DASHBOARD = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop/src/dashboard.html';
const full = () => structuredClone(states()[1].mem);

// Add to RSI Cart's lane, stood in for: these tests are about who may ask, not RSI.
const fakeCart = () => {
  const calls = [];
  const lane = {
    upgradeOptions: async (...a) => (calls.push(['options', ...a]), { ok: true, options: [] }),
    upgradePrice: async (...a) => (calls.push(['price', ...a]), { ok: true, price: 170 }),
    addUpgradeToCart: async (...a) => (calls.push(['add', ...a]), { ok: true }),
  };
  return { lane, calls };
};
function load(opts = {}) {
  const cart = fakeCart();
  const fetched = [];
  const x = loadBackground({
    globals: { OHCart: cart.lane },
    fetch: async (url, init) => {
      fetched.push(url);
      return { ok: false, json: async () => ({}) };
    },
    ...opts,
  });
  return { ...x, cart: cart.calls, fetched };
}

// One valid message of every type, as the website's pages send them.
const VALID = {
  'oh-hello': { type: 'oh-hello' },
  'oh-get-hangar': { type: 'oh-get-hangar' },
  'oh-scan-status': { type: 'oh-scan-status' },
  'oh-request-scan': { type: 'oh-request-scan' },
  'oh-upgrade-options': { type: 'oh-upgrade-options', toShipId: 900, toSkuId: 9001, skus: [9001] },
  'oh-upgrade-price': { type: 'oh-upgrade-price', fromShipId: 101, toShipId: 900, toSkuId: 9001 },
  'oh-add-upgrade': { type: 'oh-add-upgrade', fromShipId: 101, toShipId: 900, toSkuId: 9001 },
  'oh-connect-begin': { type: 'oh-connect-begin' },
  'oh-connect-finish': { type: 'oh-connect-finish', code: 'one-time-code', sync: true },
};

test('the capability lists: two per-origin lists, each type named once', () => {
  assert.deepEqual(PAGES.LISTS, {
    hangar: HANGAR_CAPS,
    site: ['hello', 'addToCart', 'connect'],
  });
  assert.deepEqual(PAGES.CAPS, {
    hello: ['oh-hello'],
    getHangar: ['oh-get-hangar'],
    getScanStatus: ['oh-scan-status'],
    requestScan: ['oh-request-scan'],
    addToCart: ['oh-upgrade-options', 'oh-upgrade-price', 'oh-add-upgrade'],
    connect: ['oh-connect-begin', 'oh-connect-finish'],
  });
  assert.deepEqual(Object.keys(VALID).sort(), [...PAGES.TYPES].sort());
  // The Firefox bridge's own list of types is the same.
  const bridge = fs.readFileSync(path.join(__dirname, '..', 'src', 'site-bridge.js'), 'utf8');
  const list = /const TYPES = \[([^\]]+)\]/.exec(bridge);
  assert.deepEqual(
    [...list[1].matchAll(/'([^']+)'/g)].map((m) => m[1]),
    PAGES.TYPES,
  );
});

test("the repo's copy lets no page in: only a build has pages", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(PAGES.pages)), { hangar: [], site: [], connect: [] });
  for (const o of [HANGAR, APP, FRONT, STAGING]) assert.equal(PAGES.known(o), false, o);
  assert.match(
    fs.readFileSync(path.join(__dirname, '..', 'src', 'site-bridge.js'), 'utf8'),
    /^\s*const PAGES = \[\];$/m,
  );
});

// --- Every message from every kind of page ------------------------------------------
// What each kind of page may ask, in a build with sync and Local Mode (the beta), plus
// staging's in a developer's staging build.
const ALLOWED = {
  hangar: [
    'oh-hello',
    'oh-get-hangar',
    'oh-scan-status',
    'oh-request-scan',
    ...PAGES.CAPS.addToCart,
  ],
  app: ['oh-hello', ...PAGES.CAPS.addToCart, ...PAGES.CAPS.connect],
  front: ['oh-hello', ...PAGES.CAPS.addToCart],
};
const ORIGINS = [
  ['hangar', HANGAR, ALLOWED.hangar, false],
  ['app', APP, ALLOWED.app, false],
  ['bare', FRONT, ALLOWED.front, false],
  ['staging', STAGING, ALLOWED.app, true],
  ['hangar-staging', HANGAR_STAGING, ALLOWED.hangar, true],
];

for (const [label, origin, allowed, staging] of ORIGINS)
  test(`every message from the ${label} page: its own list runs, the rest is "unknown request"`, async () => {
    for (const [type, msg] of Object.entries(VALID)) {
      const x = load({ staging }); // each in a fresh worker (requestScan has a cooldown)
      const got = await x.send(msg, origin);
      if (allowed.includes(type)) {
        assert.notDeepEqual(got, UNKNOWN, `${label} may ask ${type}`);
        assert.notDeepEqual(got, BAD, `${label}: ${type} is well formed`);
      } else {
        assert.deepEqual(got, UNKNOWN, `${label} may not ask ${type}`);
        assert.deepEqual(x.cart, [], 'no cart call');
        assert.deepEqual(x.opened, [], 'no tab');
        assert.deepEqual(x.fetched, [], 'no request');
        assert.deepEqual(x.stores.session, {}, 'nothing kept');
      }
    }
  });

test('pages that are not ours (or not in this build) get no answer at all', async () => {
  const x = load();
  const others = [
    'https://evil.example',
    'http://hangar.openhangar.space',
    'https://hangar.openhangar.space:8443',
    'https://sub.hangar.openhangar.space',
    'https://openhangar.space.evil.example',
    STAGING, // a store build leaves staging out
    HANGAR_STAGING,
    'null',
    undefined,
  ];
  for (const origin of others)
    for (const msg of Object.values(VALID))
      assert.equal(await x.send(msg, origin), undefined, `${origin} ${msg.type}`);
  // Without Local Mode (the public build) the hangar page isn't one of ours either.
  const pub = load({ flags: { sync: true, orgFleet: false, localMode: false } });
  for (const msg of Object.values(VALID))
    assert.equal(await pub.send(msg, HANGAR), undefined, msg.type);
  assert.deepEqual(x.opened, []);
  assert.deepEqual(x.fetched, []);
});

test('a request for another page is answered exactly like one that does not exist', async () => {
  const x = load();
  const pairs = [
    // [the other page's request, a made-up one shaped the same]
    [{ type: 'oh-get-hangar' }, { type: 'oh-nope' }],
    [{ type: 'oh-scan-status' }, { type: 'constructor' }],
    [
      { type: 'oh-request-scan', extra: 1 },
      { type: 'oh-nope', extra: 1 },
    ],
    [
      { type: 'oh-get-hangar', v: 'x' },
      { type: '__proto__', v: 'x' },
    ],
  ];
  for (const [real, fake] of pairs) {
    const a = await x.send(real, APP);
    assert.deepEqual(a, UNKNOWN, real.type);
    assert.deepEqual(await x.send(fake, APP), a, fake.type);
    assert.deepEqual(await x.send(real, FRONT), a);
  }
  // Connect from the hangar page or the public front page: the same.
  for (const origin of [HANGAR, FRONT])
    for (const msg of [VALID['oh-connect-begin'], VALID['oh-connect-finish']])
      assert.deepEqual(await x.send(msg, origin), UNKNOWN, `${origin} ${msg.type}`);
  // A message too big or not an object says the same whatever its type.
  const big = 'x'.repeat(20000);
  assert.deepEqual(await x.send({ type: 'oh-get-hangar', pad: big }, APP), BAD);
  assert.deepEqual(await x.send({ type: 'oh-nope', pad: big }, APP), BAD);
  assert.deepEqual(x.opened, []);
  assert.deepEqual(x.stores.session, {});
});

// --- Hello ---------------------------------------------------------------------------
test('hello v2: the version, and what this page may ask in this build', async () => {
  const x = load();
  const v2 = (caps) => ({
    ok: true,
    v: 2,
    version: '0.3.0',
    caps,
    cart: caps.includes('addToCart'),
    connect: caps.includes('connect'),
  });
  assert.deepEqual(await x.send({ type: 'oh-hello' }, HANGAR), v2(HANGAR_CAPS));
  assert.deepEqual(await x.send({ type: 'oh-hello' }, APP), v2(['hello', 'addToCart', 'connect']));
  assert.deepEqual(await x.send({ type: 'oh-hello' }, FRONT), v2(['hello', 'addToCart']));
  // A page may say which version it speaks; it's allowed and changes nothing.
  assert.deepEqual(await x.send({ type: 'oh-hello', v: 2 }, HANGAR), v2(HANGAR_CAPS));
  assert.deepEqual(await x.send({ type: 'oh-hello', v: '2' }, HANGAR), BAD);
  // Older website pages read cart and connect: the same as before on the site.
  const app = await x.send({ type: 'oh-hello' }, APP);
  assert.equal(app.ok && app.cart, true);
  assert.equal(app.connect, true);
  assert.equal((await x.send({ type: 'oh-hello' }, FRONT)).connect, false);

  // A build without sync (a developer's): no Connect anywhere, and it says so.
  const nosync = load({ flags: { sync: false, orgFleet: false, localMode: false } });
  assert.deepEqual(await nosync.send({ type: 'oh-hello' }, APP), v2(['hello', 'addToCart']));
  assert.deepEqual(await nosync.send(VALID['oh-connect-begin'], APP), UNKNOWN);
  // A build without Local Mode: the site's pages can't ask for the hangar either.
  const pub = load({ flags: { sync: true, orgFleet: false, localMode: false } });
  assert.deepEqual(await pub.send({ type: 'oh-get-hangar' }, APP), UNKNOWN);
});

// --- Inbound checks ------------------------------------------------------------------
test('malformed messages are refused before any handler runs', async () => {
  const x = load();
  class Ask {}
  const odd = [
    null,
    'oh-hello',
    42,
    true,
    ['oh-hello'],
    {},
    { type: 5 },
    { type: null },
    Object.assign(new Ask(), { type: 'oh-hello' }),
    { type: 'oh-hello', extra: 1 },
    { type: 'oh-get-hangar', all: true },
    { type: 'oh-scan-status', since: 0 },
    { type: 'oh-request-scan', sources: ['hangar'] },
    { type: 'oh-upgrade-options', toShipId: '900', toSkuId: 9001 },
    { type: 'oh-upgrade-options', toShipId: 900 },
    { type: 'oh-upgrade-options', toShipId: 900, toSkuId: 0 },
    { type: 'oh-upgrade-options', toShipId: 900, toSkuId: 9001, skus: '9001' },
    { type: 'oh-upgrade-options', toShipId: -1, toSkuId: 9001 },
    { type: 'oh-upgrade-price', fromShipId: 1.5, toSkuId: 9001 },
    { type: 'oh-upgrade-price', fromShipId: 101, toSkuId: 9001, toShipId: '900' },
    { type: 'oh-add-upgrade', fromShipId: 101, toShipId: 900 },
    { type: 'oh-add-upgrade', fromShipId: 101, toShipId: 900, toSkuId: 9001, qty: 2 },
    { type: 'oh-connect-begin', redirect: 'https://evil.example/' },
    { type: 'oh-connect-finish' },
    { type: 'oh-connect-finish', code: '' },
    { type: 'oh-connect-finish', code: 7 },
    { type: 'oh-connect-finish', code: 'x'.repeat(513) },
    { type: 'oh-connect-finish', code: 'c', sync: 'yes' },
  ];
  for (const msg of odd) {
    const origin = /hangar|scan/.test(msg?.type) ? HANGAR : APP;
    assert.deepEqual(await x.send(msg, origin), BAD, JSON.stringify(msg));
  }
  // Over 16 KB, even of a well-formed request.
  const skus = Array.from({ length: 3000 }, (_, i) => 100000 + i);
  assert.ok(JSON.stringify(skus).length > 16 * 1024);
  assert.deepEqual(
    await x.send({ type: 'oh-upgrade-options', toShipId: 900, toSkuId: 9001, skus }, APP),
    BAD,
  );
  assert.deepEqual(x.cart, [], 'Add to RSI Cart never ran');
  assert.deepEqual(x.opened, [], 'no tab opened');
  assert.deepEqual(x.fetched, [], 'nothing sent');
  assert.deepEqual(x.stores.session, {}, 'nothing kept');
});

test('the 16 KB limit is on the message as sent, in bytes', () => {
  const at = (n, ch = 'x') => ({ type: 'oh-hello', v: 2, pad: ch.repeat(n) });
  const size = (m) => Buffer.byteLength(JSON.stringify(m));
  const room = 16 * 1024 - size(at(0));
  const has = () => true;
  const pages = pagesFor({ localMode: true, sync: true });
  // pad isn't an oh-hello key, so a message that fits is refused for that, not its size;
  // the size check comes first and answers the same for every type.
  assert.equal(size(at(room)), 16 * 1024);
  assert.deepEqual(PAGES.vet(at(room), APP, has, pages), { error: 'bad request' });
  const fits = { type: 'oh-upgrade-options', toShipId: 900, toSkuId: 9001, skus: [] };
  const n = Math.floor((16 * 1024 - size(fits)) / 2); // ",1" per extra entry
  fits.skus = Array(n).fill(1);
  assert.ok(size(fits) <= 16 * 1024);
  assert.deepEqual(PAGES.vet(fits, APP, has, pages), { type: 'oh-upgrade-options' });
  fits.skus.push(1, 1);
  assert.ok(size(fits) > 16 * 1024);
  assert.deepEqual(PAGES.vet(fits, APP, has, pages), { error: 'bad request' });
  // Counted in bytes: three-byte characters fill it three times as fast.
  const wide = { type: 'oh-connect-finish', code: '€'.repeat(500) };
  assert.ok(JSON.stringify(wide).length < 16 * 1024);
  assert.deepEqual(PAGES.vet(wide, APP, has, pages), { type: 'oh-connect-finish' });
  assert.deepEqual(PAGES.vet({ ...wide, pad: '€'.repeat(6000) }, APP, has, pages), {
    error: 'bad request',
  });
  // A message JSON can't write (a BigInt) is refused, never thrown.
  assert.deepEqual(PAGES.vet({ type: 'oh-hello', v: 10n }, APP, has, pages), {
    error: 'bad request',
  });
});

test("the website's own messages (v1 and today's) all still pass", async () => {
  const x = load();
  // Exactly as the website's Store panel, ship pages and Connect page build them.
  const site = [
    { type: 'oh-hello' },
    { type: 'oh-upgrade-options', toShipId: 900, toSkuId: 9001, skus: [9001, 9002] },
    { type: 'oh-upgrade-price', fromShipId: 101, toShipId: 900, toSkuId: 9001 },
    { type: 'oh-add-upgrade', fromShipId: 101, toShipId: 900, toSkuId: 9001 },
    { type: 'oh-connect-begin' },
    {
      type: 'oh-connect-finish',
      code: 'Zm9yLXRlc3RzLW9ubHktYS1yYW5kb20tb25lLXRpbWUtY29kZQ',
      sync: true,
    },
    // Older pages: no skus, no toShipId on the price.
    { type: 'oh-upgrade-options', toShipId: 900, toSkuId: 9001 },
    { type: 'oh-upgrade-price', fromShipId: 101, toSkuId: 9001 },
    // A key the page left undefined (Firefox's window messages keep those).
    { type: 'oh-upgrade-price', fromShipId: 101, toSkuId: 9001, toShipId: undefined },
  ];
  for (const msg of site) {
    const r = await x.send(msg, APP);
    assert.notDeepEqual(r, BAD, JSON.stringify(msg));
    assert.notDeepEqual(r, UNKNOWN, JSON.stringify(msg));
  }
  assert.deepEqual(
    x.cart.map((c) => c[0]),
    ['options', 'price', 'add', 'options', 'price', 'price'],
  );
  // And the store's own panel on the public front page (Add to RSI Cart only).
  for (const msg of site.slice(0, 4))
    assert.notDeepEqual(await x.send(msg, FRONT), UNKNOWN, msg.type);
});

// --- getHangar -----------------------------------------------------------------------
// Keys that must never reach a page, wherever they'd be.
const FORBIDDEN = [
  'siteLink',
  'siteUrl',
  'siteConnect',
  'prospectsList',
  'referralCode',
  'referralUrl',
  'wishlist',
  'bbDetails',
  'settings',
  'cookies',
  'history',
];
function keysIn(v, out = new Set()) {
  if (Array.isArray(v)) v.forEach((x) => keysIn(x, out));
  else if (v && typeof v === 'object')
    for (const [k, x] of Object.entries(v)) {
      out.add(k);
      keysIn(x, out);
    }
  return out;
}

test('getHangar: the stored shape, never the sync token, site address, settings or referral code', async () => {
  const mem = full();
  const x = load({ local: mem });
  const r = await x.send({ type: 'oh-get-hangar' }, HANGAR);
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r), ['ok', 'hangar']);
  assert.deepEqual(Object.keys(r.hangar), [
    'app',
    'appVersion',
    'exportedAt',
    'schemaVersion',
    'account',
    'sources',
    'pledgeArchive',
  ]);
  assert.equal(r.hangar.appVersion, '0.3.0');
  assert.equal(r.hangar.account.handle, 'TestPilot');
  assert.equal(r.hangar.sources.hangar.items.length, 5);
  const keys = keysIn(r.hangar);
  for (const k of FORBIDDEN) assert.ok(!keys.has(k), `no "${k}" anywhere`);
  assert.ok(![...keys].some((k) => k.startsWith('profile:')), 'no parked account');
  const text = JSON.stringify(r);
  for (const s of ['test-sync-token', 'example.invalid', 'STAR-TEST-0000', 'Recruit3', 'Wingmate'])
    assert.ok(!text.includes(s), `"${s}" never handed out`);
  assert.equal('code' in r.hangar.sources.referral.items, false);
  assert.equal('url' in r.hangar.sources.referral.items, false);
  // Read only, and the store's copy is untouched.
  assert.deepEqual(x.stores.local, full());
  assert.deepEqual(x.opened, []);
  assert.deepEqual(x.fetched, []);
});

test('getHangar: a forbidden key inside the stored hangar means nothing is handed out', async () => {
  const cases = [
    [
      '/sources/hangar/items/0/siteLink',
      (m) => (m.db.sources.hangar.items[0].siteLink = { token: 't' }),
    ],
    [
      '/sources/hangar/items/1/cookies',
      (m) => (m.db.sources.hangar.items[1].cookies = 'Rsi-Token=x'),
    ],
    ['/sources/buybacks/items/0/settings', (m) => (m.db.sources.buybacks.items[0].settings = {})],
    [
      '/sources/referral/items/recruitsList/0/referralCode',
      (m) => (m.db.sources.referral.items.recruitsList[0].referralCode = 'STAR-TEST-0000'),
    ],
    [
      '/sources/hangar/items/2/profile:wingmate',
      (m) => (m.db.sources.hangar.items[2]['profile:wingmate'] = {}),
    ],
  ];
  for (const [where, plant] of cases) {
    const mem = full();
    plant(mem);
    const x = load({ local: mem });
    const r = await x.send({ type: 'oh-get-hangar' }, HANGAR);
    assert.deepEqual(r, { ok: false, error: 'schema', path: where }, where);
  }
  // Something the schema doesn't know at the top of what a scan keeps: refused too.
  const mem = full();
  mem.db.sources.hangar.meta.siteUrl = 'https://example.invalid';
  const r = await load({ local: mem }).send({ type: 'oh-get-hangar' }, HANGAR);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'schema');
  assert.equal(r.hangar, undefined);
});

test('getHangar: nothing scanned, an older database, or another RSI login', async () => {
  const no = await load().send({ type: 'oh-get-hangar' }, HANGAR);
  assert.deepEqual(no, { ok: false, error: 'no-scan' });
  const old = states().find((s) => /before the versioned/.test(s.name)).mem;
  assert.deepEqual(
    await load({ local: structuredClone(old) }).send({ type: 'oh-get-hangar' }, HANGAR),
    {
      ok: false,
      error: 'needs-upgrade',
    },
  );
  const other = full();
  other.account.nickname = 'Wingmate';
  assert.deepEqual(await load({ local: other }).send({ type: 'oh-get-hangar' }, HANGAR), {
    ok: false,
    error: 'needs-upgrade',
  });
});

test('getHangar on Firefox: Firefox says yes first, then the hangar comes through the bridge', async () => {
  const url = `${HANGAR}/`;
  const ask = load({ browser: 'firefox', local: full(), granted: false });
  assert.deepEqual(await ask.fromPage({ type: 'oh-get-hangar' }, url), {
    ok: false,
    error: 'firefox-ask',
  });
  assert.deepEqual(ask.opened, ['moz-extension://uuid/src/dashboard.html#home']);
  // Home opens with Firefox's card up, in the tab it opened and no other dashboard.
  const card = ask.stores.session.localAskFirefox;
  assert.equal(card.tabId, 100, 'names the tab it opened');
  assert.ok(Date.now() - card.at < 5000);
  assert.equal(ask.stores.session.siteAskFirefox, undefined, "it isn't Connect's card");
  // Asked again (the page reloaded): the same answer, no second tab.
  assert.deepEqual(await ask.fromPage({ type: 'oh-get-hangar' }, url), {
    ok: false,
    error: 'firefox-ask',
  });
  assert.equal(ask.opened.length, 1);
  // The scan status and a scan don't hand the hangar over: no ask for those.
  assert.equal((await ask.fromPage({ type: 'oh-scan-status' }, url)).ok, true);

  const yes = load({ browser: 'firefox', local: full(), granted: true });
  const r = await yes.fromPage({ type: 'oh-get-hangar' }, url);
  assert.equal(r.ok, true);
  assert.equal(r.hangar.account.handle, 'TestPilot');
  assert.deepEqual(yes.opened, []);
  // An open dashboard is brought forward instead of a new tab.
  const open = load({
    browser: 'firefox',
    local: full(),
    granted: false,
    contexts: [
      {
        contextType: 'TAB',
        tabId: 7,
        windowId: 3,
        documentUrl: 'moz-extension://uuid/src/dashboard.html#stats',
      },
    ],
  });
  await open.fromPage({ type: 'oh-get-hangar' }, url);
  assert.deepEqual(open.opened, []);
  assert.deepEqual(open.focused, [
    { tab: 7, active: true },
    { window: 3, focused: true },
  ]);
  assert.equal(open.stores.session.localAskFirefox.tabId, 7, 'the card is for that tab');
});

test("getHangar on Firefox: two asks at once open one tab, and a restarted worker doesn't stack one", async () => {
  const url = `${HANGAR}/`;
  const ASK = { ok: false, error: 'firefox-ask' };
  // Two hangar pages loading together (a restored session): one Home tab.
  const both = load({ browser: 'firefox', local: full(), granted: false });
  assert.deepEqual(
    await Promise.all([
      both.fromPage({ type: 'oh-get-hangar' }, url),
      both.fromPage({ type: 'oh-get-hangar' }, url),
    ]),
    [ASK, ASK],
  );
  assert.equal(both.opened.length, 1);
  // A worker that stopped and started again still knows the last ask; once it's a
  // minute old, the next ask brings Home up again.
  const restarted = load({
    browser: 'firefox',
    local: full(),
    granted: false,
    session: { localAskedAt: Date.now() - 30e3 },
  });
  assert.deepEqual(await restarted.fromPage({ type: 'oh-get-hangar' }, url), ASK);
  assert.deepEqual(restarted.opened, []);
  restarted.stores.session.localAskedAt = Date.now() - 61e3;
  assert.deepEqual(await restarted.fromPage({ type: 'oh-get-hangar' }, url), ASK);
  assert.equal(restarted.opened.length, 1);
});

// --- getScanStatus -------------------------------------------------------------------
test('getScanStatus: when each source was scanned, whether a scan runs, and stale after 7 days', async () => {
  const x = load({ local: full() });
  assert.deepEqual(await x.send({ type: 'oh-scan-status' }, HANGAR), {
    ok: true,
    scannedAt: { hangar: AT, buybacks: AT + 10 },
    running: false,
    stale: Date.now() - AT >= 7 * 86400000,
  });
  const fresh = full();
  fresh.db.sources.hangar.scannedAt = Date.now() - 6 * 86400000;
  fresh.db.sources.buybacks.scannedAt = new Date(AT).toISOString(); // older copies kept text
  const y = load({ local: fresh, session: { scanRunning: { at: Date.now() - 1000, tabId: 9 } } });
  const s = await y.send({ type: 'oh-scan-status' }, HANGAR);
  assert.equal(s.stale, false);
  assert.equal(s.running, true);
  assert.equal(s.scannedAt.buybacks, AT);
  const old = full();
  old.db.sources.hangar.scannedAt = Date.now() - 7 * 86400000 - 1;
  assert.equal((await load({ local: old }).send({ type: 'oh-scan-status' }, HANGAR)).stale, true);
  // A marker left by a page that closed mid-scan runs out after 10 minutes.
  const stuck = load({
    local: full(),
    session: { scanRunning: { at: Date.now() - 10 * 60e3 - 1, tabId: 9 } },
  });
  assert.equal((await stuck.send({ type: 'oh-scan-status' }, HANGAR)).running, false);
  // Nothing scanned yet.
  assert.deepEqual(await load().send({ type: 'oh-scan-status' }, HANGAR), {
    ok: true,
    scannedAt: { hangar: null, buybacks: null },
    running: false,
    stale: false,
  });
  // Junk in storage reads as nothing, never an error.
  const junk = load({ local: { db: { sources: { hangar: { scannedAt: 'soon' } } } } });
  assert.deepEqual((await junk.send({ type: 'oh-scan-status' }, HANGAR)).scannedAt, {
    hangar: null,
    buybacks: null,
  });
});

test('getScanStatus: a mark whose tab has closed is no scan; a request not started yet is one', async () => {
  const tab = (tabId, url = `${DASHBOARD}#home`) => ({
    contextType: 'TAB',
    tabId,
    windowId: 1,
    documentUrl: url,
  });
  const status = async (session, contexts = null) => {
    const x = load({ local: full(), session, contexts });
    const s = await x.send({ type: 'oh-scan-status' }, HANGAR);
    // Asking for the status never asks for a scan or opens anything.
    assert.deepEqual(x.opened, []);
    assert.deepEqual(x.focused, []);
    return s.running;
  };
  const mark = { scanRunning: { at: Date.now() - 9 * 60e3, tabId: 9 } };
  // The scanning tab is still open: running.
  assert.equal(await status(mark, [tab(4), tab(9)]), true);
  // It was closed mid-scan (or reloaded into something else): not running, well
  // before the 10 minutes run out, so the hangar page can ask for a scan again.
  assert.equal(await status(mark, [tab(4)]), false);
  assert.equal(await status(mark, [tab(9, 'chrome-extension://other/x.html')]), false);
  assert.equal(await status(mark, []), false);
  // A browser that can't list its tabs: the mark's time alone.
  assert.equal(await status(mark, null), true);
  // A request the dashboard hasn't started yet (it's still loading): running, for a
  // minute at most; one it dropped is gone, and one left over runs out.
  const asked = (ago) => ({ scanRequest: { at: Date.now() - ago, tabId: 100 } });
  assert.equal(await status(asked(1000), []), true);
  assert.equal(await status(asked(61e3), []), false);
  assert.equal(await status({}, [tab(100)]), false);
  // Right after the request, before the tab has loaded.
  const x = load({ local: full(), contexts: [] });
  assert.deepEqual(await x.send({ type: 'oh-request-scan' }, HANGAR), { ok: true, opened: true });
  assert.equal((await x.send({ type: 'oh-scan-status' }, HANGAR)).running, true);
});

// --- requestScan ---------------------------------------------------------------------
test('requestScan: opens the dashboard with a request naming its tab, then busy for 60 s', async () => {
  const x = load();
  assert.deepEqual(await x.send({ type: 'oh-request-scan' }, HANGAR), { ok: true, opened: true });
  assert.deepEqual(x.opened, [DASHBOARD]);
  const req = x.stores.session.scanRequest;
  assert.equal(req.tabId, 100, 'the tab it opened');
  assert.ok(Date.now() - req.at < 5000);
  assert.ok(x.stores.session.scanAskedAt);
  // Again within a minute: busy, and nothing opens.
  assert.deepEqual(await x.send({ type: 'oh-request-scan' }, HANGAR), { ok: false, error: 'busy' });
  assert.equal(x.opened.length, 1);
  // The worker never scans or asks RSI itself.
  assert.deepEqual(x.fetched, []);
  assert.deepEqual(x.cart, []);
});

test('requestScan: busy while a scan runs, after a restart, and for two at once', async () => {
  const running = load({ session: { scanRunning: { at: Date.now() - 5000, tabId: 9 } } });
  assert.deepEqual(await running.send({ type: 'oh-request-scan' }, HANGAR), {
    ok: false,
    error: 'busy',
  });
  assert.deepEqual(running.opened, []);
  assert.equal(running.stores.session.scanRequest, undefined);
  // The scan ended (marker gone): the refused ask didn't start the cooldown.
  delete running.stores.session.scanRunning;
  assert.deepEqual(await running.send({ type: 'oh-request-scan' }, HANGAR), {
    ok: true,
    opened: true,
  });
  // Its tab was closed mid-scan, so the mark it left behind doesn't hold a request up.
  const closed = load({
    session: { scanRunning: { at: Date.now() - 5 * 60e3, tabId: 9 } },
    contexts: [],
  });
  assert.deepEqual(await closed.send({ type: 'oh-request-scan' }, HANGAR), {
    ok: true,
    opened: true,
  });
  assert.equal(closed.opened.length, 1);
  // A worker that stopped and started again still knows the last request.
  const restarted = load({ session: { scanAskedAt: Date.now() - 30e3 } });
  assert.deepEqual(await restarted.send({ type: 'oh-request-scan' }, HANGAR), {
    ok: false,
    error: 'busy',
  });
  // After a minute it's fine again.
  const later = load({ session: { scanAskedAt: Date.now() - 61e3 } });
  assert.equal((await later.send({ type: 'oh-request-scan' }, HANGAR)).ok, true);
  // Two at once: one tab.
  const both = load();
  const r = await Promise.all([
    both.send({ type: 'oh-request-scan' }, HANGAR),
    both.send({ type: 'oh-request-scan' }, HANGAR),
  ]);
  assert.deepEqual(r.map((a) => a.ok).sort(), [false, true]);
  assert.equal(both.opened.length, 1);
});

test('requestScan: an open dashboard is brought to the front and named in the request', async () => {
  const x = load({
    contexts: [
      { contextType: 'TAB', tabId: 4, windowId: 1, documentUrl: 'chrome-extension://other/x.html' },
      { contextType: 'TAB', tabId: 9, windowId: 2, documentUrl: `${DASHBOARD}#buybacks` },
    ],
  });
  assert.deepEqual(await x.send({ type: 'oh-request-scan' }, HANGAR), { ok: true, opened: true });
  assert.deepEqual(x.opened, []);
  assert.deepEqual(x.focused, [
    { tab: 9, active: true },
    { window: 2, focused: true },
  ]);
  assert.equal(x.stores.session.scanRequest.tabId, 9);
});

// --- Firefox: the background's own checks --------------------------------------------
test("firefox: only our content script, in a tab's top frame, on one of our pages", async () => {
  const x = load({ browser: 'firefox' });
  const hello = { type: 'oh-hello' };
  assert.equal((await x.fromPage(hello, `${HANGAR}/`)).ok, true);
  assert.deepEqual((await x.fromPage(hello, `${APP}/link?x=1`)).caps, [
    'hello',
    'addToCart',
    'connect',
  ]);
  const no = [
    ['a frame', { frameId: 1 }],
    ['no frame id', { frameId: undefined }],
    ['not in a tab', { tab: undefined }],
    ['another extension', { id: 'other@example' }],
    ['no page address', { url: undefined }],
    ['an unreadable address', { url: 'not a url' }],
    ['a page not ours', { url: 'https://evil.example/' }],
    ['staging, left out of this build', { url: `${STAGING}/` }],
    ['http, not https', { url: 'http://hangar.openhangar.space/' }],
  ];
  for (const [what, sender] of no)
    assert.equal(await x.fromPage(hello, `${HANGAR}/`, sender), undefined, what);
  // The dashboard's own messages aren't the website's.
  assert.equal(
    await x.sendInternal(hello, { id: x.chrome.runtime.id, tab: {}, frameId: 0, url: `${APP}/` }),
    undefined,
  );
  // The hangar page's requests from the site's pages: the same "unknown request".
  assert.deepEqual(await x.fromPage({ type: 'oh-get-hangar' }, `${APP}/`), UNKNOWN);
  assert.deepEqual(await x.fromPage({ type: 'oh-get-hangar', x: 1 }, `${FRONT}/`), UNKNOWN);
});

test("firefox: other add-ons' messages get no answer, even from a script on our page", async () => {
  // Firefox has no externally_connectable, so any add-on may message this one; Firefox
  // fills in the page's origin when another add-on's content script on our page sends.
  // None of it is a page's own message, so the Firefox build doesn't listen.
  const x = load({ browser: 'firefox', local: full() });
  const other = { id: 'some-other-addon@example', frameId: 2, tab: { id: 1 } };
  for (const msg of Object.values(VALID))
    for (const [origin, sender] of [
      [HANGAR, other],
      [APP, { ...other, frameId: 0 }],
      [FRONT, { id: 'some-other-addon@example' }],
    ])
      assert.equal(await x.send(msg, origin, sender), undefined, `${origin} ${msg.type}`);
  assert.deepEqual(x.opened, []);
  assert.deepEqual(x.cart, []);
  assert.deepEqual(x.stores.session, {});
  // Chrome and Edge: the pages' own messages still come straight in.
  assert.equal((await load().send({ type: 'oh-hello' }, HANGAR)).ok, true);
});

// --- Firefox: the bridge on the page -------------------------------------------------
// src/site-bridge.js as a build writes it, on a page at `origin`, with a stand-in
// window and runtime.
function loadBridge(origin, { pages = pagesFor({ localMode: true, sync: true }), reply } = {}) {
  const listeners = [];
  const posted = [];
  const sent = [];
  const win = {
    addEventListener: (type, f) => type === 'message' && listeners.push(f),
    postMessage: (data, target) => posted.push({ data: JSON.parse(JSON.stringify(data)), target }),
  };
  const chrome = {
    runtime: {
      sendMessage: (m) => {
        sent.push(JSON.parse(JSON.stringify(m)));
        return reply ? reply(m) : Promise.resolve({ ok: true, echo: m.ohSite.type });
      },
    },
  };
  vm.runInNewContext(builtBridge(pages), { window: win, location: { origin }, chrome });
  const post = (data, { source = win, from = origin } = {}) =>
    listeners.forEach((f) => f({ source, origin: from, data }));
  const settle = () => new Promise((r) => setTimeout(r, 0));
  return { listeners, posted, sent, post, settle, win };
}

test('bridge: does nothing on a page that is not in its own list', () => {
  for (const origin of ['https://evil.example', STAGING, 'http://openhangar.space', 'null'])
    assert.equal(loadBridge(origin).listeners.length, 0, origin);
  // A build without Local Mode doesn't run it on the hangar page either.
  const pub = loadBridge(HANGAR, { pages: pagesFor({ localMode: false, sync: true }) });
  assert.equal(pub.listeners.length, 0);
  assert.equal(loadBridge(HANGAR).listeners.length, 1);
});

test('bridge: only this window, this exact origin, and a well-formed ask', async () => {
  const b = loadBridge(HANGAR);
  const ask = { oh: 'ask', id: 'a'.repeat(36), msg: { type: 'oh-get-hangar' } };
  const ignored = [
    [ask, { source: {} }], // another window (a frame, an opener)
    [ask, { source: null }],
    [ask, { from: 'https://evil.example' }],
    [ask, { from: APP }], // another of our pages
    [ask, { from: 'http://hangar.openhangar.space' }],
    [null],
    ['ask'],
    [{ ...ask, oh: 'answer' }],
    [{ ...ask, id: 7 }],
    [{ ...ask, id: '' }],
    [{ ...ask, id: 'x'.repeat(65) }],
    [{ ...ask, msg: null }],
    [{ ...ask, msg: 'oh-hello' }],
    [{ ...ask, msg: { type: 'oh-nope' } }],
    [{ ...ask, msg: { type: 'constructor' } }],
    [{ ...ask, msg: {} }],
  ];
  for (const [data, from] of ignored) b.post(data, from);
  await b.settle();
  assert.deepEqual(b.sent, []);
  assert.deepEqual(b.posted, []);

  b.post({ ...ask, id: 'x'.repeat(64) });
  await b.settle();
  assert.deepEqual(b.sent, [{ ohSite: { type: 'oh-get-hangar' } }]);
  assert.deepEqual(b.posted, [
    {
      data: { oh: 'answer', id: 'x'.repeat(64), answer: { ok: true, echo: 'oh-get-hangar' } },
      target: HANGAR,
    },
  ]);
});

test("bridge: answers go to this page's origin only, never '*'; a dead extension answers null", async () => {
  const fail = loadBridge(APP, { reply: () => Promise.reject(new Error('gone')) });
  fail.post({ oh: 'ask', id: 'q1', msg: { type: 'oh-hello' } });
  await fail.settle();
  assert.deepEqual(fail.posted, [{ data: { oh: 'answer', id: 'q1', answer: null }, target: APP }]);
  const thrown = loadBridge(FRONT, {
    reply: () => {
      throw new Error('Extension context invalidated.');
    },
  });
  thrown.post({ oh: 'ask', id: 'q2', msg: { type: 'oh-hello' } });
  await thrown.settle();
  assert.deepEqual(thrown.posted, [
    { data: { oh: 'answer', id: 'q2', answer: null }, target: FRONT },
  ]);
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'site-bridge.js'), 'utf8');
  assert.doesNotMatch(src, /postMessage\([^)]*'\*'/);
});
