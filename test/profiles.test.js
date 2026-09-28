'use strict';

/*
 * Saved accounts (OH.switchProfile / listProfiles / deleteProfile /
 * migrateRecovery in src/lib.js) against an in-memory chrome.storage.
 * Run: `npm test`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

let mem = {};
global.window = globalThis;
global.chrome = {
  storage: {
    local: {
      get: async (keys) => {
        if (keys == null) return { ...mem };
        const out = {};
        for (const k of [].concat(keys)) if (k in mem) out[k] = mem[k];
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

const dbFor = (nick, n) => ({
  schemaVersion: 2,
  owner: { nickname: nick, displayname: nick + ' D' },
  sources: {
    hangar: { items: Array.from({ length: n }, (_, i) => ({ id: i })), scannedAt: 1 },
  },
});

test('switching accounts parks the old data and restores it later', async () => {
  mem = { db: dbFor('Main', 3) };
  let r = await OH.switchProfile('Alt', 'Alt D');
  assert.deepEqual(r, { restored: false, parked: 'Main D' });
  assert.equal(mem.db.owner.nickname, 'Alt');
  assert.equal(mem['profile:main'].sources.hangar.items.length, 3);

  mem.db = dbFor('Alt', 5); // Alt scans
  r = await OH.switchProfile('main');
  assert.equal(r.restored, true);
  assert.equal(mem.db.sources.hangar.items.length, 3); // Main is back
  assert.equal(mem['profile:alt'].sources.hangar.items.length, 5); // Alt parked
  assert.equal(mem['profile:main'], undefined); // live copy isn't duplicated

  const list = await OH.listProfiles();
  assert.deepEqual(
    list.map((p) => [p.nickname, p.pledges, p.active]),
    [
      ['Main', 3, true],
      ['Alt', 5, false],
    ],
  );
  await OH.deleteProfile('ALT');
  assert.equal((await OH.listProfiles()).length, 1);
});

test('switching to the account that is already live does nothing', async () => {
  mem = { db: dbFor('Main', 2) };
  assert.deepEqual(await OH.switchProfile('MAIN'), { restored: false, parked: null });
  assert.equal(mem.db.sources.hangar.items.length, 2);
});

test('an old restore snapshot becomes a saved account', async () => {
  mem = { db: dbFor('Alt', 1), dbRecovery: { at: 1, db: dbFor('Main', 4) } };
  assert.equal(await OH.migrateRecovery(), true);
  assert.equal(mem.dbRecovery, undefined);
  assert.equal(mem['profile:main'].sources.hangar.items.length, 4);
});
