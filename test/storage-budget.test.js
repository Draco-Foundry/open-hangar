'use strict';
// Storage budget (src/lib.js, Storage size guard). The extension keeps
// `unlimitedStorage`, so every key that grows with the data needs its own cap.
// This fills storage the way a very big account would (1,500 pledges, 1,000
// buy-backs, a 2,000-pledge archive, a full history, one saved alt, a recovery
// copy, a damaged copy set aside, every cache over its cap) and checks each key
// stays within its budget and the total under OH.STORAGE_WARN_BYTES.
// A new key written anywhere in src/ or ui/ fails the first test until it's
// added to BUDGET below with its cap. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { writtenKeys } = require('./storage-keys.js');

let mem = {};
global.window = globalThis;
global.chrome = {
  storage: {
    local: {
      get: async (keys) => {
        if (keys == null) return structuredClone(mem);
        const out = {};
        for (const k of [].concat(keys)) if (k in mem) out[k] = structuredClone(mem[k]);
        return out;
      },
      set: async (obj) => Object.assign(mem, structuredClone(obj)),
      remove: async (keys) => [].concat(keys).forEach((k) => delete mem[k]),
    },
  },
  runtime: { getManifest: () => ({ version: '0.0.0' }) },
};
global.fetch = async () => new Response('', { status: 404 }); // nothing leaves the test
require('../src/lib.js');
const OH = globalThis.OH;

const KB = 1e3;
const MB = 1e6;
// key → { cap: how it's bounded, max: worst-case bytes this test allows }.
// `small`: a setting, a timestamp or one fetched list that's replaced whole.
const small = (cap = 'one value, replaced whole') => ({ cap, max: 50 * KB });
const BUDGET = {
  db: { cap: 'MAX_PAGES 1000 per source (1,500 pledges + 1,000 buy-backs here)', max: 3 * MB },
  dbHistory: { cap: 'HISTORY_MAX 100 snapshots, HISTORY_MAX_BYTES 3e6', max: 3.2 * MB },
  pledgeArchive: { cap: 'ARCHIVE_MAX 2,000 newest', max: 2.6 * MB },
  'profile:*': {
    cap: 'one per saved account; its db + history + archive (caps above)',
    max: 9 * MB,
  },
  dbRecovery: { cap: 'one copy: db + history + archive (caps above)', max: 9 * MB },
  dbCorrupt: { cap: 'CORRUPT_MAX 3 damaged copies', max: 3 * 3.2 * MB },
  errorLog: { cap: 'LOG_MAX 100 entries, 600 chars each', max: 100 * KB },
  bbDetails: { cap: 'pruned to the current buy-back list after each buy-back scan', max: 1 * MB },
  bbHistoryRejects: { cap: 'BB_REJECTS_MAX 500 newest', max: 50 * KB },
  bbdSlowDownUntil: small('one timestamp'),
  bbdSlowDowns: small('one count'),
  shipImages: {
    cap: 'CACHE_MAX.shipImages 2,000 newest; 90 days (1 day for misses)',
    max: 400 * KB,
  },
  // openhangar.space's feeds (OH.siteFeed): each one copy, replaced whole.
  feedShips: { cap: 'one ships feed (~330 ships), replaced whole (a day)', max: 300 * KB },
  feedCatalog: {
    cap: 'one store catalog (RSI store size, ~700 items), replaced whole (30 minutes)',
    max: 2 * MB,
  },
  feedReferral: small('one referral-events feed (events + picture links)'),
  feedIssues: small('one known-issues feed, 100 issues at most'),
  feedGameStatus: small('one game-status feed (10 minutes)'),
  feedVersions: small('one versions.json'),
  shipMatrix: { cap: 'one RSI ship-matrix list, replaced whole', max: 300 * KB },
  storeShips: { cap: 'one store list, replaced whole (6 hours)', max: 1 * MB },
  subStore: {
    cap: 'SUB_STORE_MAX 2,000 items (20 pages), replaced whole once a day',
    max: 1.5 * MB,
  },
  netDown: small('hosts down in the last 10 minutes'),
  remoteStatus: small('one status.json, replaced whole'),
  account: small('the signed-in account, replaced whole'),
  patchNotes: small('newest 15 threads'),
  fxRates: small(),
  loanerMatrix: { cap: 'one help-center table, replaced whole', max: 100 * KB },
  includedVessels: { cap: 'one help-center table, replaced whole', max: 100 * KB },
  siteLink: small(),
  siteUrl: small(),
  siteSyncRequested: small(),
  justUpdated: small(),
  updateReady: small(),
  reopenAfterUpdate: small(),
  lastUpdateCheck: small(),
  lastBackupAt: small(),
  // Things the user types or picks: bounded by what they enter, never trimmed (that
  // would drop their input). The total check still catches a runaway one.
  marketAnnotations: { cap: 'user-entered prices, one per item', max: 200 * KB },
  savedViews: small('user-saved filter views'),
  wishlist: small('user-picked ships'),
  orgFleet: { cap: 'user-imported org members (their ship lists)', max: 2 * MB },
  homeIgnored: small('user-dismissed Home alerts'),
  homeReady: small('owned ships that turned flight ready'),
  homeShipStatus: small('owned ships and their status'),
  uiWishSort: small(),
  uiStatsTab: small(),
  uiLayout: small(),
  uiQuickLinksHidden: small('old Quick Links switch, moved into uiHomeLayout'),
  uiHomeLayout: small('show/hide per card and MAX_SAVED 10 named layouts (24 characters)'),
  wishWatch: small('the last wishlist check, replaced whole'),
  uiGroupByType: small(),
  hideSmallInv: small(),
  hideSmallBb: small(),
  bbStack: small(),
  bbLayout: small(),
  scanSources: small(),
  invFiltersFolded: small(),
  invClosedGroups: small(),
  bbFiltersFolded: small(),
  bbClosedGroups: small(),
  currency: small(),
  streamerMode: small(),
  remindRescan: small(),
};
// Keys built at run time, as the source writes them (test/storage-keys.js).
const DYNAMIC = {
  '[profileKey()]': ['profile:*'],
  '[key]': ['profile:*', 'loanerMatrix', 'includedVessels'], // migrateRecovery, getHelpTable
  '[feedKey]': [
    'feedShips',
    'feedCatalog',
    'feedReferral',
    'feedIssues',
    'feedGameStatus',
    'feedVersions',
  ], // OH.siteFeed
};
const budgetOf = (key) => BUDGET[/^profile:/.test(key) ? 'profile:*' : key];

test('every storage key the code writes has a budget (add new ones to BUDGET)', () => {
  const missing = [];
  for (const [key, files] of writtenKeys()) {
    const names = DYNAMIC[key] || [key];
    for (const k of names) if (!BUDGET[k]) missing.push(`${key} (${[...files].join(', ')})`);
  }
  assert.deepEqual(missing, [], 'uncapped storage keys: give each a cap and a BUDGET entry');
});

// --- The worst case --------------------------------------------------------------

const img = (i, j) =>
  `https://media.robertsspaceindustries.com/${(i * 7919 + j).toString(36).padStart(14, 'x')}/store_small.jpg`;
const KINDS = ['Ship', 'Ship', 'Insurance', 'Hangar decoration', 'Component', 'Skin'];
const pledge = (i, n = 4) => ({
  id: String(10000000 + i),
  name: `Package - Anvil Carrack Expedition Best In Show Edition ${i}`,
  value: 350,
  currency: 'USD',
  contents: Array.from({ length: n }, (_, j) => ({
    kind: KINDS[j % KINDS.length],
    label: `Item Label Number ${j} Of Pledge`,
    image: j % 3 === 2 ? null : img(i, j),
  })),
  image: img(i, 0),
  containsShip: true,
  isCCU: false,
  ccu: null,
  isAddOn: false,
  isCoupon: false,
  isPaint: false,
  kind: 'ship',
  giftable: true,
  meltable: true,
  insurance: 'LTI',
  date: '2023-11-24',
  raw: { rawValue: '$350.00 USD' },
});
const rows = (i) => (i % 50 === 0 ? 40 : 5); // every 50th a 40-item pack
const buyback = (i) => ({
  id: String(20000000 + i),
  name: `Drake Cutlass Black Best In Show ${i}`,
  image: img(i, 9),
  date: '2023-11-24',
  contains: 'Cutlass Black · Lifetime Insurance',
  href: `/account/buy-back-pledges/reclaim/${20000000 + i}`,
  price: '',
  isCCU: false,
  ccu: null,
  wasUpgraded: false,
  fromShipId: '',
  toShipId: '42',
  toSkuId: '99',
  kind: 'ship',
});
const timed = (n, make) =>
  Object.fromEntries(
    Array.from({ length: n }, (_, i) => [`k${i}`, { ...make(i), at: Date.now() }]),
  );

// One very big account, the way storage keeps it: { db, dbHistory, pledgeArchive }.
function account(nick) {
  const items = Array.from({ length: 1500 }, (_, i) => pledge(i, rows(i)));
  const history = [];
  for (let s = 0; s < 120; s++) {
    history.push(
      OH.snapshotOf(
        items.map((p) => ({ ...p, value: p.value + s })),
        1e12 + s * 1e6,
      ),
    );
  }
  const gone = Array.from({ length: 2500 }, (_, i) => {
    const { raw, ...p } = pledge(30000 + i, rows(i));
    return p;
  });
  // Through the real caps: 2,500 gone pledges, 120 snapshots.
  let archive = {};
  for (let i = 0; i < gone.length; i += 500) {
    archive = OH.archiveGone(archive, gone.slice(i, i + 500), 1e12 + i);
  }
  return {
    db: {
      schemaVersion: 3,
      owner: { nickname: nick },
      sources: {
        hangar: { items, scannedAt: 5 },
        buybacks: { items: Array.from({ length: 1000 }, (_, i) => buyback(i)), scannedAt: 5 },
      },
    },
    dbHistory: OH.trimHistory(history),
    pledgeArchive: archive,
  };
}

async function fillWorstCase() {
  const live = account('Main');
  const alt = account('Alt');
  mem = {
    ...live,
    'profile:alt': { ...alt.db, history: alt.dbHistory, pledgeArchive: alt.pledgeArchive },
    dbRecovery: {
      at: 1,
      db: { ...alt.db, history: alt.dbHistory },
      archive: alt.pledgeArchive,
    },
    dbCorrupt: [{ id: 'x', at: 1, what: 'history', problems: ['bad'], raw: live.dbHistory }],
    bbDetails: Object.fromEntries(
      Array.from({ length: 1000 }, (_, i) => [
        String(20000000 + i),
        {
          title: `Drake Cutlass Black Best In Show ${i}`,
          price: 110,
          melt: 110,
          currency: 'USD',
          ships: [
            {
              name: 'Cutlass Black',
              manufacturer: 'Drake',
              focus: 'Medium Freight',
              image: img(i, 1),
            },
          ],
          also: ['Lifetime Insurance', 'Hangar Poster'],
          insurance: 'LTI',
          at: 1,
          src: 'rsi',
        },
      ]),
    ),
    bbHistoryRejects: timed(500, () => ({ from: 'archive' })),
    // Customize Home at its cap: ten saved layouts with the longest names.
    uiHomeLayout: {
      v: 1,
      cards: { citizen: true, value: true, acquisitions: true, wishlist: true, quicklinks: true },
      saved: Array.from({ length: 10 }, (_, i) => ({
        name: `Layout ${i}`.padEnd(24, 'x'),
        v: 1,
        cards: {
          citizen: true,
          value: true,
          acquisitions: true,
          wishlist: true,
          quicklinks: true,
          spotlight: true,
          referrals: true,
        },
      })),
    },
    // A last wishlist check of 200 ships.
    wishWatch: {
      at: 1,
      items: Object.fromEntries(
        Array.from({ length: 200 }, (_, i) => [
          `Anvil Carrack Expedition Edition ${i}`,
          {
            status: 'in',
            price: 600,
            warbond: 550,
            url: `https://robertsspaceindustries.com/pledge/ships/anvil-carrack/Carrack-Expedition-${i}`,
          },
        ]),
      ),
    },
    feedGameStatus: {
      at: 1,
      etag: 'W/"' + 'f'.repeat(32) + '"',
      data: {
        v: 1,
        updatedAt: '2026-10-06T11:05:54.330Z',
        status: {
          level: 'degraded',
          label: 'PU Disrupted, Platform Disrupted',
          url: 'https://openhangar.space/',
        },
        live: { version: '4.10.1', released: 1 },
        ptu: { version: '4.10.2', wave: 'Wave 3', notesAt: 1 },
        patchNotes: {
          title: 'x'.repeat(160),
          url: 'https://robertsspaceindustries.com/' + 'x'.repeat(400),
          at: 1,
        },
        event: {
          name: 'x'.repeat(120),
          start: 1,
          end: 2,
          url: 'https://robertsspaceindustries.com/' + 'x'.repeat(400),
        },
        nextEvent: {
          name: 'x'.repeat(120),
          start: 1,
          end: 2,
          url: 'https://robertsspaceindustries.com/' + 'x'.repeat(400),
        },
      },
    },
    // Every cache seeded over its cap; one real call below trims it.
    shipImages: timed(2600, (i) => ({ url: img(i, 3) })),
    shipMatrix: {
      v: 2,
      at: Date.now(),
      list: Array.from({ length: 300 }, (_, i) => ({
        lname: `ship ${i}`,
        name: `Ship ${i}`,
        img: img(i, 4),
        mfr: 'DRAK',
        mfrName: 'Drake Interplanetary',
      })),
    },
    storeShips: {
      at: Date.now(),
      ships: Array.from({ length: 400 }, (_, i) => ({
        id: i,
        name: `Ship ${i}`,
        url: `https://robertsspaceindustries.com/pledge/ships/ship-${i}`,
        skus: [{ title: 'Standard Edition', price: 11000, available: true }],
      })),
    },
    marketAnnotations: Object.fromEntries(
      Array.from({ length: 1500 }, (_, i) => [`package - ship ${i}|350`, { price: '400' }]),
    ),
  };
  // The capped caches, each through one real write.
  await OH.getShipImage('Brand New Ship');
  // The feeds through real reads, each far bigger than today's.
  const etag = { headers: { etag: 'W/"' + 'e'.repeat(32) + '"' } };
  await OH.getShipsFeed({
    fetchFn: async () =>
      Response.json(
        {
          v: 1,
          updatedAt: '2026-09-30T00:00:00.000Z',
          credit: 'x'.repeat(200),
          ships: Array.from({ length: 1000 }, (_, i) => ({
            name: `Drake Some Long Ship Name ${i}`,
            cls: `drak_some_long_ship_name_${i}`,
            msrp: 110,
            img: `https://media.openhangar.space/${'a'.repeat(32)}${i}.jpg`,
          })),
        },
        etag,
      ),
  });
  await OH.getStoreCatalog({
    fetchFn: async () =>
      Response.json(
        {
          v: 1,
          updatedAt: '2026-10-06T11:03:32.858Z',
          items: Array.from({ length: 2500 }, (_, i) => ({
            id: `sku-${100000 + i}`,
            kind: 'paint',
            name: `Some Fairly Long Ship Name - Nebula Drift Paint ${i}`,
            img: `https://media.openhangar.space/${'b'.repeat(32)}.jpg`,
            url: `https://robertsspaceindustries.com/pledge/Paints/Some-Fairly-Long-Ship-Name-Nebula-Drift-Paint-${i}`,
            price: 15,
            wasPrice: 20,
            warbond: false,
            standardPrice: null,
            savings: null,
            inStore: true,
            insurance: '24 Mo',
            upgrade: null,
          })),
          ships: Array.from({ length: 300 }, (_, i) => ({
            id: i,
            name: `Ship ${i}`,
            msrp: 110,
            editions: [
              { sku: 10000 + i, price: 110, warbond: false },
              { sku: 20000 + i, price: 100, warbond: true },
            ],
          })),
        },
        etag,
      ),
  });
  await OH.getReferralFeed({
    fetchFn: async () =>
      Response.json({
        v: 1,
        updatedAt: '2026-10-06T08:22:37.010Z',
        credit: 'x'.repeat(100),
        events: Array.from({ length: 40 }, (_, i) => ({
          start: '2026-07-29',
          end: '2026-08-12',
          name: `Foundation Festival ${i}`,
          reward: 'x'.repeat(200),
          image: `Event picture ${i}.jpg`,
          img: `https://media.openhangar.space/${'c'.repeat(32)}.jpg`,
        })),
        images: Object.fromEntries(
          Array.from({ length: 80 }, (_, i) => [
            `Referral reward picture ${i}.jpg`,
            `https://media.openhangar.space/${'d'.repeat(32)}.jpg`,
          ]),
        ),
      }),
  });
  await OH.getKnownIssues({
    fetchFn: async () =>
      Response.json({
        v: 1,
        updatedAt: '2026-10-06T08:22:37.010Z',
        issues: Array.from({ length: 100 }, (_, i) => ({
          number: 1000 + i,
          title: 'x'.repeat(200),
          url: `https://github.com/Draco-Foundry/open-hangar/issues/${1000 + i}`,
          labels: ['bug', 'scan-broken'],
          createdAt: '2026-10-06T08:22:37.010Z',
        })),
      }),
  });
  // Your Subscriber Store through one real read: far more items than it keeps.
  await OH.getSubStore({
    account: { loggedIn: true, nickname: 'Main', subscriber: { type: 'Imperator' } },
    pause: async () => {},
    fetchFn: async (url, init) => {
      const { page, limit } = JSON.parse(init.body)[0].variables.query;
      const resources = Array.from({ length: limit }, (_, i) => {
        const n = (page - 1) * limit + i;
        return {
          id: 9000000 + n,
          name: `Subscriber Exclusive Nebula Drift Paint For The Example Hauler ${n}`,
          subtitle: 'Example Hauler Series And Variants',
          url: `/en/pledge/Subscribers-Store/Subscriber-Exclusive-Nebula-Drift-Paint-${n}`,
          media: { thumbnail: { storeSmall: img(n, 5) } },
          nativePrice: { amount: 1500, discounted: 1200 },
          stock: { available: true },
          tags: Array.from({ length: 12 }, (_, j) => ({ name: `Some Store Tag ${j}` })),
          label: 'Imperator',
          isWarbond: true,
        };
      });
      return Response.json([
        { data: { store: { listing: { resources, count: limit, totalCount: 5000 } } } },
      ]);
    },
  });
  // The log, well past its cap, with the longest messages it keeps.
  for (let i = 0; i < 150; i++) OH.log('warn', 'hangar', `retry ${i} `.padEnd(700, 'x'));
  await OH.log('info', 'hangar', 'done');
}

test('worst case: every key within its budget, the total under the warning line', async (t) => {
  await fillWorstCase();
  assert.ok(Object.keys(mem.shipImages).length <= OH.CACHE_MAX.shipImages);
  assert.ok(Object.keys(mem.pledgeArchive).length <= OH.ARCHIVE_MAX);
  assert.equal(mem.errorLog.length, 100);
  assert.equal(mem.subStore.items.length, OH.SUB_STORE_MAX);

  const u = await OH.storageUsage();
  const over = [];
  for (const k of Object.keys(mem)) {
    const b = budgetOf(k);
    assert.ok(b, `no budget for ${k}`);
    const bytes = Buffer.byteLength(k + JSON.stringify(mem[k]));
    if (bytes > b.max) over.push(`${k}: ${bytes} > ${b.max}`);
  }
  assert.deepEqual(over, []);
  assert.ok(u.total < OH.STORAGE_WARN_BYTES, `${OH.formatBytes(u.total)} in total`);
  assert.equal(u.over, false);
  // The sizes, for the record: node --test --test-reporter=spec shows them.
  for (const { key, bytes } of u.keys) t.diagnostic(`${key} ${OH.formatBytes(bytes)}`);
  t.diagnostic(`total ${OH.formatBytes(u.total)}`);
});

test('storage usage: biggest first, saved accounts without their handle', async () => {
  mem = { a: 'x', 'profile:secrethandle': { big: 'y'.repeat(500) }, b: [1, 2, 3] };
  const u = await OH.storageUsage();
  assert.equal(u.keys[0].key, 'profile:(saved account)');
  assert.ok(!JSON.stringify(u).includes('secrethandle'));
  assert.equal(
    u.total,
    u.keys.reduce((s, k) => s + k.bytes, 0),
  );
  assert.equal(u.over, false);
});

test('storage usage uses the browser count when there is one (Chrome)', async () => {
  const local = chrome.storage.local;
  mem = { a: 1, b: 2 };
  local.getKeys = async () => Object.keys(mem);
  local.getBytesInUse = async (k) => (k === 'a' ? 10 : 30e6);
  try {
    const u = await OH.storageUsage();
    assert.deepEqual(u.keys, [
      { key: 'b', bytes: 30e6 },
      { key: 'a', bytes: 10 },
    ]);
    assert.equal(u.over, false);
  } finally {
    delete local.getKeys;
    delete local.getBytesInUse;
  }
});

test('past the warning line: a log warning, nothing deleted', async () => {
  mem = { db: { big: 'x'.repeat(100) }, cache: 'y' };
  const local = chrome.storage.local;
  local.getBytesInUse = async (k) => (k === 'db' ? 61e6 : 1e6);
  try {
    const u = await OH.checkStorage();
    assert.equal(u.over, true);
    assert.equal(u.total, 62e6);
    const log = await OH.getLog();
    assert.match(
      log.at(-1).msg,
      /storage is 62\.0 MB, larger than expected\. Biggest: db 61\.0 MB/,
    );
    assert.ok(mem.db && mem.cache); // nothing removed
  } finally {
    delete local.getBytesInUse;
  }
});

test('the error report (and so a scan problem report) carries the total, a number only', async () => {
  mem = { db: { schemaVersion: 3, sources: {} }, 'profile:secrethandle': { x: 1 } };
  const report = await OH.errorReport();
  assert.match(report, /^Storage: +\d+ B$/m);
  assert.ok(!report.includes('secrethandle'));
  const url = OH.scanProblemUrl({ summary: 'x', report, version: '0.0.0' });
  assert.ok(url.length <= OH.SCAN_REPORT_MAX_URL);
  assert.match(new URL(url).searchParams.get('report'), /Storage:/);
});

test('formatBytes', () => {
  assert.equal(OH.formatBytes(4.2e6), '4.2 MB');
  assert.equal(OH.formatBytes(820e3), '820 KB');
  assert.equal(OH.formatBytes(12), '12 B');
});
