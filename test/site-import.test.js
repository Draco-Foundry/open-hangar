'use strict';
// Importing the website's "Download Your Data" file (OH.importDB, importSiteNow in
// src/lib.js): the extension's backup sits at rsi_accounts[i].latest_sync.data
// (as synced, without history). One account imports like a backup, owned by its
// handle; several go to their own saved-account slots. Run: `npm test`.
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

const pledge = (id, name = `Ship ${id}`) => ({ id: String(id), name, value: 50, contents: [] });
// What the extension syncs: its backup file (OH.exportDB), the website drops history.
const synced = (handle, ids, extra = {}) => ({
  app: 'open-hangar',
  appVersion: '0.3.0',
  exportedAt: '2026-10-01T00:00:00.000Z',
  schemaVersion: 2,
  account: { handle, displayName: `${handle} D`, ueeRecord: '#1' },
  sources: {
    hangar: { items: ids.map((i) => pledge(i)), scannedAt: 100 },
    buybacks: { items: [{ id: `b${ids[0]}`, name: 'Old Thing' }], scannedAt: 100 },
  },
  ...extra,
});
// The website's file (app/src/lib/export-data.ts), trimmed to what matters here.
const siteFile = (...accounts) => ({
  export: { format: 1, created_at: '2026-10-05T00:00:00.000Z', about: '…' },
  account: { id: 'u1', email: 'someone@example.test', name: 'Someone' },
  sign_in_methods: [],
  sessions: [],
  connected_extensions: [],
  wrong_link_codes: [],
  preferences: null,
  rsi_accounts: accounts.map(([handle, data, syncedAt]) => ({
    account: { handle, verified_at: null, created_at: 1, last_synced_at: syncedAt },
    latest_sync: data === null ? null : { synced_at: syncedAt, format_version: 2, data },
    sharing: [],
    consent_history: [],
    orgs: [],
    pledge_history: [],
    value_history: [],
    purchases: [],
  })),
});
const ids = (db) => db.sources.hangar.items.map((p) => p.id);

test('siteExportAccounts reads the wrapper, skips accounts never synced', () => {
  const file = siteFile(['Main', synced('Main', [1]), 50], ['Empty', null, 0]);
  const got = OH.siteExportAccounts(file);
  assert.equal(got.length, 1);
  assert.equal(got[0].handle, 'Main');
  assert.equal(got[0].displayName, 'Main D');
  assert.equal(got[0].syncedAt, 50);
  assert.equal(OH.siteExportAccounts({ sources: {} }), null); // a backup file
  assert.equal(OH.siteExportAccounts(null), null);
});

test('one account: imported like a backup, owned by its handle, history kept', async () => {
  const snap = { at: 1, items: [['9', 'Ship 9', 50]] };
  mem = {
    db: { schemaVersion: 3, sources: { hangar: { items: [pledge(9)], scannedAt: 1 } } },
    dbHistory: [snap],
  };
  const res = await OH.importDB(siteFile(['Main', synced('Main', [1, 2]), 50]));
  assert.equal(res.ok, true);
  await settle();
  assert.deepEqual(ids(mem.db), ['1', '2']);
  assert.equal(mem.db.sources.buybacks.items.length, 1);
  assert.deepEqual(mem.db.owner, { nickname: 'Main', displayname: 'Main D' });
  assert.deepEqual(mem.dbHistory, [snap]); // the file has none: local history stays
  assert.equal(res.site.live, 'Main D');
  assert.deepEqual(res.site.parked, []);
  assert.ok(!Object.keys(mem).some((k) => k.startsWith('profile:')));
});

test('the archive merges as usual', async () => {
  mem = { pledgeArchive: { 5: { id: '5', name: 'Here', goneAt: 10 } } };
  const data = synced('Main', [1], {
    pledgeArchive: { 6: { id: '6', name: 'From The Site', goneAt: 20 } },
  });
  await OH.importDB(siteFile(['Main', data, 50]));
  await settle();
  assert.deepEqual(Object.keys(mem.pledgeArchive).sort(), ['5', '6']);
});

test('several accounts: the signed-in one goes live, the others are parked', async () => {
  mem = { account: { loggedIn: true, nickname: 'alt' } };
  const res = await OH.importDB(
    siteFile(
      ['Main', synced('Main', [1]), 90],
      ['Alt', synced('Alt', [2], { pledgeArchive: { 7: { id: '7', goneAt: 1 } } }), 50],
    ),
  );
  assert.equal(res.ok, true);
  await settle();
  assert.equal(mem.db.owner.nickname, 'Alt');
  assert.deepEqual(ids(mem.db), ['2']);
  assert.ok(mem.pledgeArchive['7']);
  const main = mem['profile:main'];
  assert.equal(main.owner.nickname, 'Main');
  assert.deepEqual(ids(main), ['1']);
  assert.deepEqual(res.site.parked, ['Main D']);
  // They show up as saved accounts, and switching works as for any other.
  const list = await OH.listProfiles();
  assert.deepEqual(list.map((p) => [p.nickname, p.active]).sort(), [
    ['Alt', true],
    ['Main', false],
  ]);
  const sw = await OH.switchProfile('Main');
  assert.equal(sw.restored, true);
  assert.deepEqual(ids(mem.db), ['1']);
  assert.equal(mem.pledgeArchive, undefined); // Alt's archive went with Alt
  assert.ok(mem['profile:alt'].pledgeArchive['7']);
});

test('several accounts: the one this data belongs to wins over the signed-in one', async () => {
  const snap = { at: 1, items: [['1', 'Ship 1', 50]] };
  mem = {
    db: {
      schemaVersion: 3,
      owner: { nickname: 'Main' },
      sources: { hangar: { items: [pledge(1)], scannedAt: 1 } },
    },
    dbHistory: [snap],
    account: { loggedIn: true, nickname: 'Alt' },
  };
  await OH.importDB(
    siteFile(['Main', synced('Main', [1, 3]), 10], ['Alt', synced('Alt', [2]), 90]),
  );
  await settle();
  assert.equal(mem.db.owner.nickname, 'Main');
  assert.deepEqual(ids(mem.db), ['1', '3']);
  assert.deepEqual(mem.dbHistory, [snap]);
  assert.deepEqual(ids(mem['profile:alt']), ['2']);
});

test('several accounts, none known here: the newest sync goes live', async () => {
  mem = {};
  const res = await OH.importDB(
    siteFile(['Old', synced('Old', [1]), 10], ['New', synced('New', [2]), 90]),
  );
  await settle();
  assert.equal(mem.db.owner.nickname, 'New');
  assert.ok(mem['profile:old']);
  assert.equal(res.site.live, 'New D');
});

test("data here for an account the file doesn't have is parked, not overwritten", async () => {
  const snap = { at: 1, items: [['8', 'Ship 8', 50]] };
  mem = {
    db: {
      schemaVersion: 3,
      owner: { nickname: 'Other' },
      sources: { hangar: { items: [pledge(8)], scannedAt: 1 } },
    },
    dbHistory: [snap],
    pledgeArchive: { 4: { id: '4', goneAt: 1 } },
  };
  await OH.importDB(siteFile(['Main', synced('Main', [1]), 10], ['Alt', synced('Alt', [2]), 90]));
  await settle();
  const other = mem['profile:other'];
  assert.deepEqual(ids(other), ['8']);
  assert.deepEqual(other.history, [snap]);
  assert.ok(other.pledgeArchive['4']);
  // The new live account doesn't inherit Other's history or archive.
  assert.equal(mem.db.owner.nickname, 'Alt');
  assert.deepEqual(mem.dbHistory, []);
  assert.equal(mem.pledgeArchive, undefined);
});

test('an account already parked here keeps its history; the file refreshes its hangar', async () => {
  const snap = { at: 1, items: [['2', 'Ship 2', 50]] };
  mem = {
    db: { schemaVersion: 3, owner: { nickname: 'Main' }, sources: {} },
    'profile:alt': {
      schemaVersion: 3,
      owner: { nickname: 'Alt' },
      sources: { hangar: { items: [pledge(2)], scannedAt: 1 } },
      history: [snap],
      pledgeArchive: { 3: { id: '3', goneAt: 5 } },
    },
  };
  await OH.importDB(
    siteFile(
      ['Main', synced('Main', [1]), 10],
      ['Alt', synced('Alt', [2, 4], { pledgeArchive: { 6: { id: '6', goneAt: 9 } } }), 90],
    ),
  );
  await settle();
  const alt = mem['profile:alt'];
  assert.deepEqual(ids(alt), ['2', '4']);
  assert.deepEqual(alt.history, [snap]);
  assert.deepEqual(Object.keys(alt.pledgeArchive).sort(), ['3', '6']);
  // And going live from a parked slot brings that history along.
  mem.account = { loggedIn: true, nickname: 'Alt' };
  delete mem.db.owner; // nobody's data here: the signed-in account decides
  await OH.importDB(siteFile(['Main', synced('Main', [1]), 10], ['Alt', synced('Alt', [2]), 90]));
  await settle();
  assert.equal(mem.db.owner.nickname, 'Alt');
  assert.deepEqual(mem.dbHistory, [snap]);
  assert.ok(mem.pledgeArchive['3'] && mem.pledgeArchive['6']);
  assert.equal(mem['profile:alt'], undefined); // one place per account
  assert.equal((await OH.listProfiles()).filter((p) => p.nickname === 'Alt').length, 1);
});

test('a website file with nothing synced, or too new, is refused and changes nothing', async () => {
  mem = { db: { schemaVersion: 3, sources: { hangar: { items: [pledge(1)], scannedAt: 1 } } } };
  const before = structuredClone(mem);
  let res = await OH.importDB(siteFile(['Main', null, 0]));
  assert.equal(res.ok, false);
  assert.match(res.error, /no synced hangar/);
  res = await OH.importDB(siteFile(['Main', synced('Main', [1], { schemaVersion: 99 }), 1]));
  assert.equal(res.ok, false);
  assert.match(res.error, /format v99/);
  await settle();
  assert.deepEqual(mem, before);
});

test('a plain backup file still imports as before (no owner)', async () => {
  mem = {};
  const res = await OH.importDB(synced('Main', [1]));
  assert.equal(res.ok, true);
  assert.equal(res.site, undefined);
  await settle();
  assert.equal(mem.db.owner, undefined);
  assert.deepEqual(ids(mem.db), ['1']);
});
