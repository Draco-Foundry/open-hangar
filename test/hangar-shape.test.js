'use strict';
// The hangar view (#441, src/hangar-shape.js): the "stored shape" the website keeps
// for a synced hangar, built by the same shaping the backup file and sync use, and
// read straight from storage by the background worker. It never holds the sync token,
// the site address, settings, other accounts, the referral code or the prospects.
// Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { account, gone, archiveOf, states } = require('./stored-data.js');

const NOW = Date.UTC(2026, 9, 10, 12, 0, 0);
let mem = {};
let reads = []; // keys of every storage read
global.window = globalThis;
global.chrome = {
  storage: {
    local: {
      get: async (keys) => {
        reads.push(keys == null ? null : [].concat(keys));
        if (keys == null) return structuredClone(mem);
        const out = {};
        for (const k of [].concat(keys)) if (k in mem) out[k] = structuredClone(mem[k]);
        return out;
      },
      set: async (obj) => Object.assign(mem, structuredClone(obj)),
      remove: async (keys) => [].concat(keys).forEach((k) => delete mem[k]),
    },
  },
  runtime: { getManifest: () => ({ version: '0.3.0' }) },
};
require('../src/lib.js');
const OH = globalThis.OH;
const SHAPE = globalThis.OHShape;
const get = (keys) => chrome.storage.local.get(keys);
const full = () => structuredClone(states().find((s) => s.name.startsWith('everything')).mem);
const viewOf = async () => await SHAPE.readHangarView(get, { appVersion: '0.3.0', now: NOW });

// The website's rules for what it keeps of a sync, written out from its side: no
// referral code in the referral source or on the account block, no prospects, no
// history, the pledge archive capped at its newest 2,000 by goneAt.
function storedShape(sync) {
  const omit = (o, keys) =>
    Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const { history, ...out } = sync;
  const ref = out.sources?.referral;
  if (isObj(ref?.items)) {
    const drop = ['code', 'url', 'referralCode', 'referralUrl', 'referralUrlCopy'];
    drop.push('referrerCode', 'referrerReferralCode', 'prospectsList');
    out.sources = { ...out.sources, referral: { ...ref, items: omit(ref.items, drop) } };
  }
  if (isObj(out.account)) {
    const drop = ['referral', 'referralCode', 'referralUrl', 'referralUrlCopy'];
    out.account = omit(out.account, [...drop, 'referrerCode', 'referrerReferralCode']);
  }
  if ('pledgeArchive' in out) {
    const a = out.pledgeArchive;
    if (!isObj(a)) delete out.pledgeArchive;
    else {
      const at = (v) => (typeof v.goneAt === 'number' && Number.isFinite(v.goneAt) ? v.goneAt : 0);
      const ids = Object.keys(a).filter((id) => isObj(a[id]));
      if (ids.length > 2000) ids.sort((x, y) => at(a[y]) - at(a[x]));
      out.pledgeArchive = Object.fromEntries(ids.slice(0, 2000).map((id) => [id, a[id]]));
    }
  }
  return out;
}

test('the hangar view: the sync payload as the website keeps it, keys in order', async () => {
  mem = full();
  const { ok, hangar } = await viewOf();
  assert.equal(ok, true);
  assert.deepEqual(Object.keys(hangar), [
    'app',
    'appVersion',
    'exportedAt',
    'schemaVersion',
    'account',
    'sources',
    'pledgeArchive',
  ]);
  assert.equal(hangar.exportedAt, new Date(NOW).toISOString());
  assert.deepEqual(Object.keys(hangar.sources.referral.items).sort(), [
    'current',
    'legacy',
    'prospects',
    'recruitsList',
  ]);
  assert.equal(hangar.sources.referral.items.prospects, 1, 'the prospects count stays');
  assert.equal(hangar.sources.hangar.items.length, 5);
  assert.equal(hangar.sources.buybacks.meta.tokens, 2);
});

test('the hangar view never holds the sync token, site address, settings, the code or prospects', async () => {
  mem = full();
  const text = JSON.stringify((await viewOf()).hangar);
  for (const never of [
    'test-sync-token', // siteLink's token
    'example.invalid', // siteUrl, and the referral link the account cache keeps
    'siteLink',
    'siteUrl',
    'STAR-TEST-0000', // the referral code
    'Recruit3', // a prospect (another player)
    'prospectsList',
    'Wingmate', // another account parked in this browser
    'uiLayout',
    'remindRescan',
    'wishlist',
    'bbDetails',
    '"history"',
  ])
    assert.ok(!text.includes(never), never);
});

test('the hangar view is the website stored shape, for every stored state', async () => {
  for (const { name, mem: stored } of states()) {
    mem = structuredClone(stored);
    const page = await OH.exportDB();
    await OH.storageSettled();
    const view = SHAPE.hangarView(page);
    assert.deepEqual(view, storedShape(OH.syncPayload(page)), name);
    assert.equal(JSON.stringify(view), JSON.stringify(storedShape(OH.syncPayload(page))), name);
  }
});

test('the worker reads the same view the dashboard would build', async () => {
  for (const { name, mem: stored } of states()) {
    mem = structuredClone(stored);
    const read = await viewOf();
    if (!read.ok) continue;
    mem = structuredClone(stored);
    const page = SHAPE.hangarView(await OH.exportDB());
    await OH.storageSettled();
    assert.deepEqual({ ...read.hangar, exportedAt: 0 }, { ...page, exportedAt: 0 }, name);
  }
});

test('the archive in the view: the newest 2,000 by goneAt, objects only, order kept below that', () => {
  const small = archiveOf([gone(1, 5), gone(2), gone(3, 9)]);
  small.junk = 'x';
  assert.deepEqual(Object.keys(SHAPE.capArchive(small)), Object.keys(small).slice(0, 3));
  const big = {};
  for (let i = 0; i < 2003; i++) big[`k${i}`] = { goneAt: i < 3 ? undefined : i };
  big.k5 = { goneAt: '99999' }; // not a number: counts as 0
  const capped = SHAPE.capArchive(big);
  assert.equal(Object.keys(capped).length, 2000);
  // Four at 0 (k0, k1, k2 without goneAt, k5 with text): the first one stays, as listed.
  assert.ok('k0' in capped);
  for (const k of ['k1', 'k2', 'k5']) assert.ok(!(k in capped), k);
  assert.equal(SHAPE.capArchive(null), undefined);
  const view = SHAPE.hangarView({ app: 'open-hangar', sources: {}, pledgeArchive: null });
  assert.ok(!('pledgeArchive' in view), 'no archive, no key');
});

test('the view is a copy: the export it came from is untouched', async () => {
  mem = full();
  const page = await OH.exportDB();
  const before = JSON.stringify(page);
  SHAPE.hangarView(OH.syncPayload(page));
  SHAPE.hangarView(page);
  assert.equal(JSON.stringify(page), before);
});

test('reading the view: nothing scanned, older storage, damage', async () => {
  mem = {};
  assert.deepEqual(await viewOf(), { ok: false, error: 'no-scan' });
  mem = { db: { schemaVersion: 3, sources: {} }, account: account() };
  assert.deepEqual(await viewOf(), { ok: false, error: 'no-scan' });
  mem = { db: { schemaVersion: 3, sources: { hangar: { items: [], scannedAt: null } } } };
  assert.deepEqual(await viewOf(), { ok: false, error: 'no-scan' });
  for (const { name, mem: stored } of states()) {
    if (!/before the versioned|v2 database|damaged/.test(name)) continue;
    mem = structuredClone(stored);
    assert.deepEqual(await viewOf(), { ok: false, error: 'needs-upgrade' }, name);
  }
  // A database from a newer version (a rollback) is left to an extension page too.
  mem = full();
  mem.db.schemaVersion = 4;
  assert.deepEqual(await viewOf(), { ok: false, error: 'needs-upgrade' });
  // The dashboard brings storage up to date, then the view reads.
  mem = structuredClone(states().find((s) => /v2 database/.test(s.name)).mem);
  await OH.loadDB();
  await OH.storageSettled();
  assert.equal((await viewOf()).ok, true);
});

test('a hangar never goes under another RSI login: the same rule as sync', async () => {
  // [the RSI login, the stored hangar's owner, refused]. Signed in to RSI as Wingmate
  // while TestPilot's hangar is still the live one (no extension page has switched
  // hangars yet): TestPilot's pledges never go under Wingmate's handle, record and
  // balances. Sync refuses exactly the same states.
  const cases = [
    ['Wingmate', 'TestPilot', true],
    [' testpilot ', 'TestPilot', false], // the same pilot, written another way
    [null, 'TestPilot', false], // signed out: the account block is the owner's
    ['Wingmate', null, false], // no owner known: nothing to mix up
  ];
  for (const [login, owner, refused] of cases) {
    const state = () => {
      const m = full();
      delete m.siteUrl; // sync stops before any request
      m.account = login
        ? { ...account(login), citizenRecord: '#999' }
        : { loggedIn: false, fetchedAt: 1 };
      if (owner) m.db.owner = { nickname: owner, displayname: null };
      else delete m.db.owner;
      return m;
    };
    const name = `${login} on ${owner}'s hangar`;
    mem = state();
    const read = await viewOf();
    if (refused) assert.deepEqual(read, { ok: false, error: 'needs-upgrade' }, name);
    else assert.equal(read.ok, true, name);
    mem = state();
    const sync = await OH.siteSync().then(
      () => null,
      (e) => e,
    );
    await OH.storageSettled();
    assert.equal(/another pilot than the one signed in/.test(sync?.message), refused, name);
  }
  // An extension page switches hangars (reconcileAccount → OH.switchProfile): then the
  // view is Wingmate's own parked hangar.
  mem = full();
  mem.account = account('Wingmate');
  await OH.switchProfile('Wingmate', 'Wingmate Prime');
  await OH.storageSettled();
  mem.account = account('Wingmate');
  const { ok, hangar } = await viewOf();
  assert.equal(ok, true);
  assert.equal(hangar.account.handle, 'Wingmate');
  assert.deepEqual(
    hangar.sources.hangar.items.map((p) => p.id),
    ['40000009'],
  );
});

test('reading the view touches only the database, the account and the archive', async () => {
  mem = full();
  reads = [];
  await viewOf();
  assert.deepEqual(reads, [['db', 'hangar', 'account', 'pledgeArchive']]);
});

test('a view that fails its checks is never handed out: { error: schema, path }', async () => {
  mem = full();
  mem.db.sources.hangar.items[0].value = '110'; // text where a number goes
  assert.deepEqual(await viewOf(), {
    ok: false,
    error: 'schema',
    path: '/sources/hangar/items/0/value',
  });
});

test('forbidden keys are refused wherever they sit, rows RSI fills included', () => {
  const view = (change) => {
    const v = JSON.parse(JSON.stringify(SHAPE.hangarView(SHAPE.withoutProspects(base))));
    change(v);
    return SHAPE.checkHangarView(v);
  };
  const base = SHAPE.exportPayload({
    db: SHAPE.checkDB(full().db).db,
    account: account(),
    archive: full().pledgeArchive,
    appVersion: '0.3.0',
  });
  assert.equal(
    view(() => {}),
    null,
  );
  assert.deepEqual(
    view((v) => (v.history = [])),
    { path: '/history', reason: 'never sent' },
  );
  assert.deepEqual(
    view((v) => (v.sources.hangar.items[0].siteLink = { token: 't' })),
    { path: '/sources/hangar/items/0/siteLink', reason: 'never sent' },
  );
  assert.deepEqual(
    view((v) => (v.sources.hangar.items[2].contents[0].referralCode = 'STAR-TEST-0000')),
    { path: '/sources/hangar/items/2/contents/0/referralCode', reason: 'never sent' },
  );
  assert.deepEqual(
    view((v) => (v.sources.referral.items.recruitsList[0].prospectsList = [])),
    { path: '/sources/referral/items/recruitsList/0/prospectsList', reason: 'never sent' },
  );
  assert.equal(
    view((v) => (v.sources.buybacks.meta.siteUrl = 'x')).path,
    '/sources/buybacks/meta/siteUrl',
  );
  // What this browser keeps for itself: the wishlist, the buy-back details cache,
  // settings, cookies, other accounts parked here.
  for (const [change, at] of [
    [
      (v) => (v.sources.referral.items.recruitsList[0].wishlist = {}),
      'referral/items/recruitsList/0/wishlist',
    ],
    [(v) => (v.sources.buybacks.items[1].bbDetails = {}), 'buybacks/items/1/bbDetails'],
    [
      (v) => (v.sources.hangar.items[0].raw['profile:wingmate'] = {}),
      'hangar/items/0/raw/profile:wingmate',
    ],
    [
      (v) => (v.sources.hangar.items[0].contents[1].cookies = 'x'),
      'hangar/items/0/contents/1/cookies',
    ],
    [(v) => (v.sources.referral.items.current.settings = {}), 'referral/items/current/settings'],
  ])
    assert.deepEqual(view(change), { path: `/sources/${at}`, reason: 'never sent' }, at);
  // Where the schema is strict it answers first, with the same path: the account
  // block, and what a scan keeps next to its rows.
  assert.equal(view((v) => (v.account.referral = { code: 'x' })).path, '/account/referral');
  assert.deepEqual(
    view((v) => (v.sources.hangar.meta.wishlist = { 123: {} })),
    { path: '/sources/hangar/meta/wishlist', reason: 'not allowed here' },
  );
  assert.equal(
    view((v) => (v.sources.hangar.meta.shape.bbDetails = {})).path,
    '/sources/hangar/meta/shape/bbDetails',
  );
  // An ordinary pledge key named like a setting elsewhere is fine.
  assert.equal(
    view((v) => (v.sources.hangar.items[0].url = 'https://robertsspaceindustries.com/x')),
    null,
  );
});

test('what a scan keeps next to its rows, as the extension writes it, fits', () => {
  const db = SHAPE.checkDB(full().db).db;
  db.sources.hangar.meta = {
    shape: OH.scanShape(db.sources.hangar.items), // every key a scan's read-out has
    probe: { at: NOW, n: db.sources.hangar.items.length, v: null },
  };
  db.sources.buybacks.meta = { tokens: null }; // RSI's page didn't say
  const sync = SHAPE.withoutProspects(SHAPE.exportPayload({ db, appVersion: '0.3.0', now: NOW }));
  assert.equal(SHAPE.checkPayload(JSON.parse(JSON.stringify(sync))), null);
  assert.equal(SHAPE.checkHangarView(SHAPE.hangarView(sync)), null);
});

test('the shared scripts load in a worker: no window, document, chrome or require', async () => {
  const ctx = vm.createContext({ self: {} });
  ctx.self = ctx;
  for (const f of ['schema-check.js', 'sync-schema.js', 'hangar-shape.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx, {
      filename: f,
    });
  assert.equal(typeof ctx.OHShape.readHangarView, 'function');
  assert.equal(typeof ctx.OHSchema.validate, 'function');
  const code = fs
    .readFileSync(path.join(__dirname, '..', 'src', 'hangar-shape.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, ''); // the code, not its comments
  assert.doesNotMatch(code, /\b(window|document|chrome|fetch|localStorage)\b/);
  const read = await ctx.OHShape.readHangarView(async () => structuredClone(full()), {
    appVersion: '0.3.0',
  });
  assert.equal(read.ok, true);
});

test('the shared scripts load on the dashboard before lib.js', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'dashboard.html'), 'utf8');
  const order = [...html.matchAll(/\bsrc="([^"]+\.js)"/g)].map((m) => m[1]);
  const at = (f) => order.indexOf(f);
  for (const f of ['schema-check.js', 'sync-schema.js', 'hangar-shape.js'])
    assert.ok(at(f) >= 0 && at(f) < at('lib.js'), `${f} before lib.js`);
  assert.ok(at('schema-check.js') < at('hangar-shape.js'));
  assert.ok(at('sync-schema.js') < at('hangar-shape.js'));
});
