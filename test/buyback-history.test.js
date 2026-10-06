'use strict';
// Buy-back details from your own history (src/lib.js): pledges that leave the
// hangar are kept in the pledge archive, a buy-back with the same id AND a name
// that agrees is filled from it (then from the scan history, value only), and
// RSI's pages are only read for the rest. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');

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
let pages = {}; // source → rows on page 1
let detailHits = []; // buy-back ids whose RSI page was read
global.OpenHangar = {
  parsePledges: (html) => JSON.parse(html),
  parseBuybacks: (html) => JSON.parse(html),
  parseBuybackTokens: () => 2,
  parseBuybackDetail: () => ({ title: 'From RSI', price: 99, ships: [{ name: 'RSI' }], also: [] }),
  insuranceTerm: (contents) =>
    (contents || []).some((c) => /insurance/i.test(c.kind || '')) ? 'LTI' : null,
};
global.setTimeout = (fn) => (queueMicrotask(fn), 0); // no real pauses
global.fetch = async (url) => {
  const u = String(url);
  const m = u.match(/\/pledge\/buyback\/(\d+)/);
  if (m) {
    detailHits.push(m[1]);
    return new Response('<html>buy-back</html>', { status: 200 });
  }
  const src = /buy-back-pledges/.test(u)
    ? 'buybacks'
    : /account\/pledges/.test(u)
      ? 'hangar'
      : null;
  if (!src) return new Response('', { status: 404 });
  return new Response(JSON.stringify(pages[src] || []), { status: 200 });
};
require('../src/lib.js');
const OH = globalThis.OH;

const acct = { loggedIn: true, nickname: 'Main', displayname: 'Main D' };
const pack = (id, name, value = 165) => ({
  id: String(id),
  name,
  value,
  currency: 'USD',
  contents: [
    { kind: 'Ship', label: 'Cutlass Black', image: 'https://x/cutlass.jpg' },
    { kind: 'Ship', label: 'Aurora MR', image: null },
    { kind: 'Insurance', label: 'Lifetime Insurance', image: null },
    { kind: '', label: 'Star Citizen Digital Download', image: null },
  ],
  insurance: 'LTI',
  kind: 'ship',
  raw: { rawValue: '$165.00 USD' },
});
const ccu = (id, from, to, value = 25) => ({
  id: String(id),
  name: `Upgrade - ${from} to ${to}`,
  value,
  contents: [],
  isCCU: true,
  ccu: { from, to },
  kind: 'ccu',
});
const bb = (id, name, extra = {}) => ({ id: String(id), name, kind: 'package', ...extra });
async function reset(state = {}) {
  mem = structuredClone(state);
  pages = {};
  detailHits = [];
  await OH.pruneBuybackDetails([]); // forget details from the last test
}

// --- The pledge archive -------------------------------------------------------------

test('a complete hangar scan keeps the pledges that left in the archive', async () => {
  await reset({ db: { schemaVersion: 3, sources: {} }, dbHistory: [] });
  pages.hangar = [pack(1, 'Package - Starter'), pack(2, 'Package - Other')];
  await OH.scanSource('hangar', null, { account: acct });
  assert.equal(mem.pledgeArchive, undefined); // nothing gone yet
  pages.hangar = [pack(2, 'Package - Other')];
  await OH.scanSource('hangar', null, { account: acct });
  const a = mem.pledgeArchive;
  assert.deepEqual(Object.keys(a), ['1']);
  assert.equal(a['1'].name, 'Package - Starter');
  assert.equal(a['1'].contents.length, 4); // everything the hangar showed
  assert.equal(a['1'].insurance, 'LTI');
  assert.ok(Number.isFinite(a['1'].goneAt));
  assert.equal(a['1'].raw, undefined); // RSI's raw strings aren't kept
});

test('a hangar that belonged to another account is never archived', async () => {
  await reset({
    db: {
      schemaVersion: 3,
      owner: { nickname: 'Alt' },
      sources: { hangar: { items: [pack(7, 'Package - Alt Pack')], scannedAt: 1 } },
    },
    dbHistory: [],
  });
  pages.hangar = [pack(2, 'Package - Other')];
  await OH.scanSource('hangar', null, { account: acct });
  assert.equal(mem.pledgeArchive, undefined);
});

test('the archive keeps the newest ARCHIVE_MAX', () => {
  const many = Array.from({ length: OH.ARCHIVE_MAX + 5 }, (_, i) => ({ id: `p${i}`, name: 'X' }));
  let a = OH.archiveGone({}, many.slice(0, 10), 1); // oldest
  a = OH.archiveGone(a, many.slice(10), 2);
  assert.equal(Object.keys(a).length, OH.ARCHIVE_MAX);
  assert.equal(a.p10.goneAt, 2);
  // The oldest went first: 5 of the 10 oldest make way for the newer ones.
  assert.equal(Object.values(a).filter((x) => x.goneAt === 1).length, 5);
});

test('Clear Data removes the archive; an account switch parks it and brings it back', async () => {
  const live = {
    schemaVersion: 3,
    owner: { nickname: 'Main' },
    sources: { hangar: { items: [pack(2, 'Package - Other')], scannedAt: 1 } },
  };
  await reset({ db: live, dbHistory: [], pledgeArchive: { 1: { id: '1', name: 'A', goneAt: 1 } } });
  await OH.switchProfile('Alt', 'Alt D');
  assert.equal(mem.pledgeArchive, undefined); // Alt has none
  assert.equal(mem['profile:main'].pledgeArchive['1'].name, 'A');
  await OH.switchProfile('Main');
  assert.equal(mem.pledgeArchive['1'].name, 'A'); // Main's is back
  // The account-switch clear keeps it restorable; a manual Clear Data removes it.
  await OH.clearData({ backup: true });
  assert.equal(mem.pledgeArchive, undefined);
  await OH.recoverData();
  assert.equal(mem.pledgeArchive['1'].name, 'A');
  mem.bbHistoryRejects = { 5: { at: 1, from: 'archive' } };
  await OH.clearData();
  assert.equal(mem.pledgeArchive, undefined);
  assert.equal(mem.bbHistoryRejects, undefined);
});

// --- Matching ------------------------------------------------------------------------

test('names agree across case, spacing, curly quotes and RSI suffixes', () => {
  const agree = (a, b) => OH.historyNamesAgree({ name: a }, b);
  assert.ok(agree('Package - Mustang Alpha Starter Pack', 'package -  mustang alpha starter pack'));
  assert.ok(agree('Standalone Ship - Drake’s Cutlass', "Standalone Ship - Drake's Cutlass"));
  assert.ok(agree('Standalone Ships - Gladius - Standard Edition', 'Standalone Ships - Gladius'));
  assert.ok(agree('Standalone Ships - Gladius Warbond', 'Standalone Ships - Gladius'));
  assert.ok(agree('Standalone Ships – Gladius', 'Standalone Ships - Gladius'));
  assert.ok(!agree('Standalone Ships - Gladius', 'Standalone Ships - Sabre'));
  assert.ok(!agree('', ''));
});

test('CCUs compare from and to', () => {
  const b = {
    name: 'Upgrade - Avenger Titan to Cutlass Black',
    ccu: { from: 'Avenger Titan', to: 'Cutlass Black' },
  };
  assert.ok(OH.historyNamesAgree(b, 'Upgrade - Avenger Titan to Cutlass Black'));
  assert.ok(OH.historyNamesAgree(b, 'upgrade - avenger titan to cutlass black warbond'));
  assert.ok(!OH.historyNamesAgree(b, 'Upgrade - Avenger Titan to Cutlass Red'));
  assert.ok(!OH.historyNamesAgree(b, 'Standalone Ships - Cutlass Black')); // not a CCU at all
  assert.ok(!OH.historyNamesAgree({ name: 'Standalone Ships - Cutlass Black' }, b.name));
});

test('an archived pack fills contents, price and insurance, marked as from history', () => {
  const archive = { 11: { ...pack(11, 'Package - Starter'), goneAt: 1 } };
  const r = OH.buybackFromHistory(bb(11, 'Package - Starter'), archive, [], 5);
  assert.equal(r.detail.src, 'history');
  assert.equal(r.detail.price, 165);
  assert.equal(r.detail.insurance, 'LTI');
  assert.deepEqual(
    r.detail.ships.map((s) => s.name),
    ['Cutlass Black', 'Aurora MR'],
  );
  assert.deepEqual(r.detail.also, ['Lifetime Insurance', 'Star Citizen Digital Download']);
  assert.equal(r.detail.partial, undefined);
});

test('a name that disagrees is rejected and falls through, never filled', () => {
  const archive = { 11: pack(11, 'Package - Starter') };
  const hist = [{ at: 1, items: [['11', 'Package - Starter', 165]] }];
  assert.deepEqual(OH.buybackFromHistory(bb(11, 'Package - Something Else'), archive, hist), {
    rejected: 'archive',
  });
  assert.deepEqual(OH.buybackFromHistory(bb(11, 'Package - Something Else'), {}, hist), {
    rejected: 'history',
  });
});

test('the scan history gives the value only, and leaves the contents to RSI', () => {
  const hist = [{ at: 1, items: [['12', 'Standalone Ships - Gladius', 90]] }];
  const r = OH.buybackFromHistory(bb(12, 'Standalone Ships - Gladius', { kind: 'ship' }), {}, hist);
  assert.equal(r.detail.src, 'scan-history');
  assert.equal(r.detail.price, 90);
  assert.equal(r.detail.partial, true);
  assert.deepEqual(r.detail.ships, []);
});

test('never from history: an upgraded pledge, a warbond price, an unknown value', () => {
  const archive = { 13: pack(13, 'Package - Starter') };
  // RSI's "- upgraded" buy-back is the original ship, not what the hangar showed.
  assert.equal(
    OH.buybackFromHistory(bb(13, 'Package - Starter', { wasUpgraded: true }), archive, []),
    null,
  );
  // Its value changed while in the hangar: an upgrade was applied to it.
  const changed = [
    { at: 1, items: [['13', 'Package - Starter', 165]] },
    { at: 2, items: [['13', 'Package - Starter', 200]] },
  ];
  assert.equal(OH.buybackFromHistory(bb(13, 'Package - Starter'), archive, changed), null);
  // A Warbond's buy-back costs the standard price: contents yes, price no.
  const wb = { 14: pack(14, 'Standalone Ships - Gladius Warbond', 80) };
  const r = OH.buybackFromHistory(bb(14, 'Standalone Ships - Gladius Warbond'), wb, []);
  assert.equal(r.detail.price, null);
  assert.equal(r.detail.melt, 80);
  // 0 in a snapshot can mean RSI showed no value: say nothing.
  const zero = [{ at: 1, items: [['15', 'Standalone Ships - Gladius', 0]] }];
  assert.equal(OH.buybackFromHistory(bb(15, 'Standalone Ships - Gladius'), {}, zero), null);
});

// --- Priority: history first, RSI for the rest -------------------------------------

test('history beats RSI: filled buy-backs are never read, the rest are, and rejections count', async () => {
  await reset({
    pledgeArchive: {
      21: pack(21, 'Package - Starter'),
      22: pack(22, 'Package - Renamed Since'),
    },
    db: { schemaVersion: 3, sources: {} },
    dbHistory: [{ at: 1, items: [['23', 'Package - Value Only', 60]] }],
  });
  const list = [
    bb(21, 'Package - Starter'),
    bb(22, 'Package - Not The Same'),
    bb(23, 'Package - Value Only'),
    bb(24, 'Package - Never Seen'),
  ];
  const got = await OH.fillBuybackDetailsFromHistory(list);
  assert.deepEqual(got, { history: 1, scan: 1, rejected: 1 });
  const all = await OH.getBuybackDetails();
  assert.equal(all['21'].src, 'history');
  assert.equal(all['23'].src, 'scan-history');
  assert.equal(all['22'], undefined);
  await OH.fetchBuybackDetails(list.map((b) => b.id));
  // 21 came from history; 23 only has its value, so its contents are still read.
  assert.deepEqual(detailHits, ['22', '23', '24']);
  assert.equal((await OH.getBuybackDetails())['23'].price, 99); // RSI's page replaced it
  assert.equal((await OH.getBuybackDetails())['21'].src, 'history');
  // Opening a filled buy-back's window doesn't read RSI either.
  detailHits = [];
  assert.equal((await OH.fetchBuybackDetail('21')).src, 'history');
  assert.deepEqual(detailHits, []);
  const stats = await OH.buybackDetailStats();
  assert.deepEqual(stats, { history: 1, scan: 0, rsi: 3, rejected: 1 });
  assert.match(await OH.errorReport(), /Bb detail: 1 from hangar history .* 1 names didn't agree/);
});

test('a pledge melted between two scans shows its contents without an RSI request', async () => {
  await reset({ db: { schemaVersion: 3, sources: {} }, dbHistory: [] });
  pages.hangar = [pack(31, 'Package - Starter'), pack(32, 'Package - Other')];
  await OH.scanSource('hangar', null, { account: acct });
  pages.hangar = [pack(32, 'Package - Other')];
  pages.buybacks = [bb(31, 'Package - Starter')];
  await OH.scanSource('hangar', null, { account: acct });
  const b = await OH.scanSource('buybacks', null, { account: acct });
  await OH.fillBuybackDetailsFromHistory(b.items);
  const d = (await OH.getBuybackDetails())['31'];
  assert.equal(d.src, 'history');
  assert.equal(d.ships.length, 2);
  assert.deepEqual(detailHits, []);
});
