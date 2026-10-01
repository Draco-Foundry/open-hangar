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

test('round trips through many big accounts lose nothing and mix nothing (#199)', async () => {
  const N = 5;
  const PLEDGES = 1500;
  const SNAPS = 60;
  const nick = (k) => `Pilot${k}`;
  const items = (k) =>
    Array.from({ length: PLEDGES }, (_, i) => ({
      id: `${k}-${i}`,
      name: `Ship ${k}/${i}`,
      value: i % 400,
      insurance: i % 3 ? '120 months' : 'LTI',
    }));
  const history = (k) =>
    Array.from({ length: SNAPS }, (_, t) => ({
      at: 1e12 + t * 86400e3 + k,
      items: items(k)
        .slice(0, PLEDGES - t)
        .map((p) => [p.id, p.name, p.value]),
    }));
  const scanned = (k) => ({
    schemaVersion: 3,
    owner: { nickname: nick(k), displayname: `${nick(k)} D` },
    sources: {
      hangar: { items: items(k), scannedAt: 1000 + k },
      buybacks: { items: items(k).slice(0, 200), scannedAt: 2000 + k, meta: { tokens: k } },
    },
  });

  // Each account signs in once and scans.
  mem = { db: scanned(0), dbHistory: history(0) };
  for (let k = 1; k < N; k++) {
    await OH.switchProfile(nick(k), `${nick(k)} D`);
    mem.db = scanned(k);
    mem.dbHistory = history(k);
  }
  // Then hop between them in a scrambled order, twice over.
  for (const k of [2, 0, 4, 1, 3, 0, 2, 4, 3, 1]) {
    await OH.switchProfile(nick(k).toUpperCase()); // handles match in any case
    const db = await OH.loadDB();
    assert.equal(db.owner.nickname, nick(k));
    assert.deepEqual(db.sources, scanned(k).sources, `${nick(k)} sources`);
    assert.deepEqual(db.history, history(k), `${nick(k)} history`);
  }
  const list = await OH.listProfiles();
  assert.equal(list.length, N);
  assert.ok(list.every((p) => p.pledges === PLEDGES));
});
