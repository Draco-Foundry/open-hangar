'use strict';
// Invented stored data in the shapes the extension really keeps (chrome.storage.local):
// the database as scans and imports write it, its history, the cached RSI account and
// the pledge archive, from a fresh browser to a big account with every source. No real
// player: the handles are made up (TestPilot, Wingmate…). Used by
// test/export-unchanged.test.js and test/hangar-shape.test.js.

const AT = Date.UTC(2026, 9, 1, 12, 0, 0); // a scan time, fixed so outputs are too
const img = (i, j = 0) =>
  `https://media.robertsspaceindustries.com/test${String(i * 31 + j).padStart(8, '0')}/store_small.jpg`;

// A hangar pledge as src/scraper/parser.js makes it.
function pledge(i, { ship = true, ccu = false } = {}) {
  const name = ccu
    ? `Upgrade - Test Arrow to Test Hornet ${i}`
    : `Package - Test Cutlass ${ship ? 'Black' : 'Paint'} ${i}`;
  const contents = ccu
    ? []
    : [
        { kind: ship ? 'Ship' : 'Skin', label: `Test Item ${i}`, image: img(i) },
        { kind: 'Insurance', label: 'Lifetime Insurance', image: null },
        { kind: 'Hangar decoration', label: 'Test Poster', image: img(i, 2), guessed: true },
      ];
  return {
    id: String(40000000 + i),
    name,
    value: ccu ? 15 : 110 + i,
    currency: 'USD',
    contents,
    image: ccu ? null : img(i),
    containsShip: ship && !ccu,
    isCCU: ccu,
    ccu: ccu ? { from: 'Test Arrow', to: `Test Hornet ${i}` } : null,
    isAddOn: !ship && !ccu,
    isCoupon: false,
    isPaint: !ship && !ccu,
    kind: ccu ? 'ccu' : ship ? 'ship' : 'paint',
    giftable: i % 2 === 0,
    meltable: true,
    insurance: ccu ? null : 'LTI',
    date: `2024-0${(i % 9) + 1}-1${i % 10}`,
    raw: { rawValue: `$${ccu ? 15 : 110 + i}.00 USD` },
  };
}

// A buy-back as the parser makes it.
function buyback(i) {
  return {
    id: String(70000000 + i),
    name: `Test Mustang ${i}`,
    image: img(i + 500),
    date: 'Jan 05, 2025',
    contains: 'Test Mustang and 2 items',
    href: `/pledge/buyback/${70000000 + i}`,
    price: '',
    isCCU: false,
    ccu: null,
    wasUpgraded: i === 1,
    fromShipId: '',
    toShipId: '',
    toSkuId: '',
    kind: 'ship',
  };
}

// The referral source as a scan saves it: the code and its link, counts, recruits and
// prospects (other players: invented here).
function referral() {
  const row = (n, campaign) => ({
    id: String(900 + n),
    handle: `Recruit${n}`,
    moniker: `Recruit ${n}`,
    avatar: null,
    enlistedOn: '2025-02-03',
    convertedOn: '2025-03-04',
    ...(campaign ? { campaign } : {}),
  });
  return {
    code: 'STAR-TEST-0000',
    url: 'https://robertsspaceindustries.com/enlist?referral=STAR-TEST-0000',
    current: { recruits: 1 },
    legacy: { recruits: 2 },
    prospects: 1,
    recruitsList: [row(1, 'current'), row(2, 'legacy')],
    prospectsList: [{ ...row(3), convertedOn: null }],
  };
}

// The cached RSI account (lib.js getAccount, cache v6), signed in.
function account(nickname = 'TestPilot') {
  return {
    v: 6,
    loggedIn: true,
    nickname,
    displayname: `${nickname} Prime`,
    avatar: 'https://robertsspaceindustries.com/media/testavatar/heap_infobox/avatar.png',
    enlistedSince: 'Nov 28, 2016',
    countryName: 'Testland',
    credits: {
      store: { value: 123456, symbol: '$', label: 'Store Credits', currency: 'USD' },
      uec: { value: 5000, symbol: 'UEC', label: 'UEC', currency: 'UEC' },
      rec: { value: 0, symbol: 'REC', label: 'REC', currency: 'REC' },
    },
    subscriber: { type: 'Centurion', frequency: 'monthly' },
    concierge: { level: 'High Admiral', next: 'Grand Admiral', percent: 40 },
    citizenRecord: '#1234567',
    org: {
      name: 'Test Org',
      sid: 'TESTORG',
      rank: 'Member',
      logo: 'https://robertsspaceindustries.com/media/testorg/heap_thumb/logo.png',
    },
    referral: { code: 'STAR-TEST-0000', url: 'https://example.invalid/r', referrerCode: null },
    fetchedAt: AT + 1000,
  };
}

const snapshot = (at, n, credit) => ({
  at,
  items: Array.from({ length: n }, (_, i) => [String(40000000 + i), `Test Ship ${i}`, 110 + i]),
  ...(credit === undefined ? {} : { credit }),
});

// A pledge archive entry as archiveGone stores it (the raw strings dropped).
function gone(i, goneAt) {
  const { raw, ...p } = pledge(i + 1000);
  return goneAt === undefined ? p : { ...p, goneAt };
}
const archiveOf = (list) => Object.fromEntries(list.map((p) => [p.id, p]));

// Every state: { name, mem } (mem = chrome.storage.local).
function states() {
  const hangar = [
    pledge(1),
    pledge(2, { ccu: true }),
    pledge(3, { ship: false }),
    pledge(4),
    pledge(5),
  ];
  const settings = {
    siteLink: { token: 'test-sync-token', name: 'TestPilot', connectedAt: AT, lastSync: null },
    siteUrl: 'https://example.invalid',
    uiLayout: { view: 'grid' },
    remindRescan: true,
    currency: 'EUR',
    'profile:wingmate': {
      schemaVersion: 3,
      owner: { nickname: 'Wingmate', displayname: null },
      sources: { hangar: { items: [pledge(9)], scannedAt: AT - 5 } },
    },
    wishlist: { 123: { at: AT } },
    bbDetails: { 70000001: { at: AT, melt: 50 } },
  };
  const full = {
    db: {
      schemaVersion: 3,
      owner: { nickname: 'TestPilot', displayname: 'TestPilot Prime' },
      sources: {
        hangar: {
          items: hangar,
          scannedAt: AT,
          meta: {
            shape: { n: 5, date: 1, value: 1, contents: 0.8, image: 0.8, tiles: 9, untyped: 1 },
            probe: { at: AT, n: 5, v: '0.2.19' },
          },
        },
        buybacks: { items: [buyback(1), buyback(2)], scannedAt: AT + 10, meta: { tokens: 2 } },
        referral: { items: referral(), scannedAt: AT + 20 },
      },
    },
    dbHistory: [snapshot(AT - 86400e3, 3), snapshot(AT, 5, 1234.56)],
    account: account(),
    pledgeArchive: archiveOf([gone(1, AT - 100), gone(2, AT - 50), gone(3)]),
    ...settings,
  };
  const bigArchive = {};
  for (let i = 0; i < 2105; i++) {
    const p = gone(i, i % 7 === 0 ? undefined : AT - (i % 300) * 1000);
    bigArchive[p.id] = p;
  }
  return [
    { name: 'a fresh browser', mem: {} },
    { name: 'everything, signed in, with settings around it', mem: full },
    {
      name: 'signed out of RSI: the account block comes from the owner',
      mem: { ...full, account: { loggedIn: false, fetchedAt: AT } },
    },
    {
      name: 'no account known at all',
      mem: { db: { schemaVersion: 3, sources: { hangar: { items: hangar, scannedAt: AT } } } },
    },
    {
      name: 'a referral block without its code (an imported backup)',
      mem: {
        ...full,
        db: {
          ...full.db,
          sources: {
            ...full.db.sources,
            referral: {
              items: { current: { recruits: 0 }, legacy: { recruits: 0 }, prospects: 0 },
              scannedAt: AT,
            },
          },
        },
      },
    },
    {
      name: 'before the versioned database (hangar and scannedAt at the top)',
      mem: { hangar: hangar.slice(0, 2), scannedAt: AT },
    },
    {
      name: 'a v2 database with its history inside',
      mem: {
        db: { ...full.db, schemaVersion: 2, history: [snapshot(AT - 3600e3, 2)] },
        account: account(),
      },
    },
    {
      name: 'damaged rows and a bad scan time',
      mem: {
        db: {
          schemaVersion: 3,
          owner: { nickname: 'TestPilot' },
          sources: {
            hangar: { items: [pledge(1), null, 'x', pledge(2)], scannedAt: 'not a time' },
            buybacks: { items: [buyback(1)], scannedAt: AT, meta: 'bad' },
          },
        },
      },
    },
    {
      name: 'a big account: 2,105 archived pledges and 300 in the hangar',
      mem: {
        ...full,
        db: {
          ...full.db,
          sources: {
            ...full.db.sources,
            hangar: {
              items: Array.from({ length: 300 }, (_, i) => pledge(i, { ccu: i % 5 === 0 })),
              scannedAt: AT,
            },
          },
        },
        pledgeArchive: bigArchive,
      },
    },
  ];
}

module.exports = { AT, pledge, buyback, referral, account, snapshot, gone, archiveOf, states };
