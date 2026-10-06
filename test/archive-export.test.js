'use strict';
// The pledge archive in the backup file and in sync (#388, src/lib.js): the export
// carries a lean copy (OH.leanArchive), an import merges it back (newest goneAt
// wins, ARCHIVE_MAX kept), older files without one still import, and a sync stays
// within its budget even for a very big account (OH.syncBody). Run: `npm test`.
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
require('../src/lib.js');
const OH = globalThis.OH;
const settle = () => OH.storageSettled();

// A pledge as the parser makes it (src/scraper/parser.js), with `n` content rows.
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
const gone = (i, goneAt, n) => {
  const { raw, ...p } = pledge(i, n);
  return { ...p, goneAt };
};
const archiveOf = (list) => Object.fromEntries(list.map((p) => [p.id, p]));
const liveDB = (items = [pledge(1)]) => ({
  schemaVersion: 3,
  owner: { nickname: 'Main' },
  sources: { hangar: { items, scannedAt: 5 } },
});

test('the export carries the pledge archive, lean: no raw strings, flags or images', async () => {
  mem = { db: liveDB(), dbHistory: [], pledgeArchive: archiveOf([gone(2, 10)]) };
  const file = await OH.exportDB();
  assert.equal(file.schemaVersion, 2); // additive: older versions ignore the new key
  const e = file.pledgeArchive[String(10000002)];
  assert.deepEqual(Object.keys(e).sort(), [
    'contents',
    'currency',
    'date',
    'goneAt',
    'id',
    'insurance',
    'kind',
    'name',
    'value',
  ]);
  assert.equal(e.goneAt, 10);
  assert.deepEqual(e.contents[0], { kind: 'Ship', label: 'Item Label Number 0 Of Pledge' });
  // No archive yet: an empty one, not a missing key.
  mem = { db: liveDB(), dbHistory: [] };
  assert.deepEqual((await OH.exportDB()).pledgeArchive, {});
});

test('a lean entry still fills buy-back details', () => {
  const lean = OH.leanArchive(archiveOf([gone(3, 10)]));
  const id = String(10000003);
  const r = OH.buybackFromHistory({ id, name: pledge(3).name }, lean, []);
  assert.equal(r.detail.src, 'history');
  assert.equal(r.detail.melt, 350);
  assert.equal(r.detail.insurance, 'LTI');
  assert.equal(r.detail.ships.length, 2);
});

test('after Clear Data, importing a backup brings the archive back', async () => {
  mem = { db: liveDB(), dbHistory: [], pledgeArchive: archiveOf([gone(2, 10), gone(3, 11)]) };
  const file = JSON.parse(JSON.stringify(await OH.exportDB()));
  await OH.clearData();
  await settle();
  assert.equal(mem.pledgeArchive, undefined);
  const res = await OH.importDB(file);
  assert.equal(res.ok, true);
  await settle();
  assert.deepEqual(Object.keys(mem.pledgeArchive).sort(), [String(10000002), String(10000003)]);
  assert.equal(mem.pledgeArchive[String(10000003)].goneAt, 11);
});

test('import merges the archive: per pledge the newest goneAt wins, the rest kept', async () => {
  const here = gone(2, 50); // this browser saw pledge 2 leave later
  here.name = 'Here';
  const older = gone(3, 10);
  older.name = 'Older Here';
  mem = { db: liveDB(), dbHistory: [], pledgeArchive: archiveOf([here, older, gone(4, 5)]) };
  const fromFile = { ...gone(2, 20), name: 'File' };
  const newer = { ...gone(3, 30), name: 'Newer In File' };
  const res = await OH.importDB({
    app: 'open-hangar',
    schemaVersion: 2,
    sources: { hangar: { items: [pledge(1)], scannedAt: 5 } },
    pledgeArchive: archiveOf([fromFile, newer, gone(9, 1)]),
  });
  assert.equal(res.ok, true);
  await settle();
  const a = mem.pledgeArchive;
  assert.equal(a[String(10000002)].name, 'Here'); // 50 beats 20
  assert.equal(a[String(10000003)].name, 'Newer In File'); // 30 beats 10
  assert.ok(a[String(10000004)]); // only here
  assert.ok(a[String(10000009)]); // only in the file
});

test('the merged archive keeps the newest ARCHIVE_MAX', () => {
  const max = OH.ARCHIVE_MAX;
  const here = archiveOf(Array.from({ length: max }, (_, i) => ({ id: `h${i}`, goneAt: 100 })));
  const file = archiveOf(Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, goneAt: 200 })));
  const m = OH.mergeArchive(here, file);
  assert.equal(Object.keys(m).length, max);
  assert.equal(Object.values(m).filter((x) => x.goneAt === 200).length, 10);
});

test('an old backup without an archive imports and leaves the archive as it is', async () => {
  mem = { db: liveDB(), dbHistory: [], pledgeArchive: archiveOf([gone(2, 10)]) };
  const res = await OH.importDB({
    app: 'open-hangar',
    schemaVersion: 1,
    sources: { hangar: { items: [pledge(7)], scannedAt: 2 } },
  });
  assert.equal(res.ok, true);
  await settle();
  assert.equal(mem.db.sources.hangar.items[0].id, String(10000007));
  assert.deepEqual(Object.keys(mem.pledgeArchive), [String(10000002)]);
});

test('junk in a hand-edited archive is dropped on import', async () => {
  mem = { db: liveDB(), dbHistory: [] };
  const res = await OH.importDB({
    app: 'open-hangar',
    schemaVersion: 2,
    sources: { hangar: { items: [], scannedAt: 2 } },
    pledgeArchive: { 1: null, 2: 'text', 3: { name: 'Fine', contents: [null, { label: 'X' }] } },
  });
  assert.equal(res.ok, true);
  await settle();
  assert.deepEqual(mem.pledgeArchive, {
    3: { id: '3', name: 'Fine', contents: [{ label: 'X' }] },
  });
  // A file with an empty or non-object archive leaves none behind.
  mem = { db: liveDB(), dbHistory: [] };
  await OH.importDB({ sources: { hangar: { items: [] } }, pledgeArchive: [] });
  await settle();
  assert.equal(mem.pledgeArchive, undefined);
});

// --- Size: the worst case a sync has to carry ------------------------------------------

// A very big account: 1,500 pledges (every 50th a 40-item pack), 1,000 buy-backs,
// a full 2,000-pledge archive and a history at its 3 MB cap.
function worstCase({ history }) {
  const rows = (i) => (i % 50 === 0 ? 40 : 5);
  const items = Array.from({ length: 1500 }, (_, i) => pledge(i, rows(i)));
  const buybacks = Array.from({ length: 1000 }, (_, i) => ({
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
  }));
  const archive = archiveOf(
    Array.from({ length: 2000 }, (_, i) => gone(30000 + i, 1e12 + i, rows(i))),
  );
  const hist = [];
  if (history) {
    for (let s = 0; s < 100; s++) {
      hist.push(
        OH.snapshotOf(
          items.map((p) => ({ ...p, value: p.value + s })),
          1e12 + s * 1e6,
        ),
      );
    }
  }
  return {
    db: {
      schemaVersion: 3,
      owner: { nickname: 'Main' },
      sources: { hangar: { items, scannedAt: 5 }, buybacks: { items: buybacks, scannedAt: 5 } },
    },
    dbHistory: OH.trimHistory(hist),
    pledgeArchive: archive,
  };
}
const bytes = (s) => Buffer.byteLength(s);

test('worst case without much history: the whole archive syncs within the budget', async () => {
  mem = worstCase({ history: false });
  const file = await OH.exportDB();
  const archiveBytes = bytes(JSON.stringify(file.pledgeArchive));
  const full = bytes(JSON.stringify(archiveOf(Object.values(mem.pledgeArchive))));
  assert.ok(archiveBytes < full * 0.55, `lean ${archiveBytes} vs stored ${full}`);
  const body = OH.syncBody(file);
  assert.ok(bytes(body) <= OH.SYNC_BUDGET_BYTES, `${bytes(body)} bytes`);
  assert.equal(Object.keys(JSON.parse(body).pledgeArchive).length, 2000); // nothing dropped
});

test('worst case with a full history: the sync is trimmed under the budget, oldest first', async () => {
  mem = worstCase({ history: true });
  const file = await OH.exportDB();
  assert.ok(bytes(JSON.stringify(file)) > 5 * 1024 * 1024); // too big as it is
  const body = OH.syncBody(file);
  assert.ok(bytes(body) <= OH.SYNC_BUDGET_BYTES, `${bytes(body)} bytes`);
  const sent = JSON.parse(body);
  assert.equal(sent.sources.hangar.items.length, 1500); // the hangar always goes whole
  assert.equal(sent.sources.buybacks.items.length, 1000);
  // The archive went first, then the oldest snapshots; the newest is kept.
  assert.ok(sent.history.length >= 1 && sent.history.length < file.history.length);
  assert.equal(sent.history.at(-1).at, file.history.at(-1).at);
});

test('a small payload goes exactly as exported', async () => {
  mem = { db: liveDB(), dbHistory: [], pledgeArchive: archiveOf([gone(2, 10)]) };
  const file = await OH.exportDB();
  assert.equal(OH.syncBody(file), JSON.stringify(file));
});

test('the archive is trimmed oldest first when that is enough', () => {
  const archive = archiveOf(
    Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, name: 'x'.repeat(100), goneAt: i })),
  );
  const payload = { sources: {}, history: [], pledgeArchive: archive };
  const budget = bytes(JSON.stringify(payload)) - 300; // about three entries too many
  const sent = JSON.parse(OH.syncBody(payload, budget));
  const ids = Object.keys(sent.pledgeArchive);
  assert.ok(ids.length >= 6 && ids.length <= 7, ids.join());
  assert.ok(ids.includes('p9') && !ids.includes('p0'));
  assert.ok(bytes(JSON.stringify(sent)) <= budget);
});
