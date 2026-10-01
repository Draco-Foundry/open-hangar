'use strict';
// The local database (src/lib.js, Storage section): every load is checked, damaged
// data is set aside instead of crashing the dashboard, older versions migrate, and
// scan history lives in its own key (#184). Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');

let mem = {};
let writes = []; // keys of every chrome.storage.local.set call
let onRead = null; // test hook: called on each read of the DB + history
global.window = globalThis;
global.chrome = {
  storage: {
    local: {
      get: async (keys) => {
        if (keys == null) return structuredClone(mem);
        if ([].concat(keys).includes('dbHistory')) onRead?.();
        const out = {};
        for (const k of [].concat(keys)) if (k in mem) out[k] = structuredClone(mem[k]);
        return out;
      },
      set: async (obj) => {
        writes.push(Object.keys(obj));
        Object.assign(mem, structuredClone(obj));
      },
      remove: async (keys) => [].concat(keys).forEach((k) => delete mem[k]),
    },
  },
  runtime: { getManifest: () => ({ version: '0.0.0' }) },
};
// Scans read JSON "pages": page N of a source answers with that source's rows.
let pages = {}; // source → rows on page 1 (page 2 repeats them, which ends the scan)
global.OpenHangar = {
  parsePledges: (html) => JSON.parse(html),
  parseBuybacks: (html) => JSON.parse(html),
  parseBuybackTokens: () => 2,
};
global.setTimeout = (fn) => (queueMicrotask(fn), 0); // no real pauses
global.fetch = async (url) => {
  const u = String(url);
  const src = /buy-back-pledges/.test(u)
    ? 'buybacks'
    : /account\/pledges/.test(u)
      ? 'hangar'
      : null;
  if (!src) return new Response('', { status: 404 }); // status file, account etc.
  return new Response(JSON.stringify(pages[src] || []), { status: 200 });
};
require('../src/lib.js');
const OH = globalThis.OH;

const acct = { loggedIn: true, nickname: 'Main', displayname: 'Main D' };
const rows = (n, tag = 'p') =>
  Array.from({ length: n }, (_, i) => ({ id: `${tag}${i}`, name: `Ship ${i}`, value: 10 }));
const snap = (at, n) => ({
  at,
  items: Array.from({ length: n }, (_, i) => [`p${i}`, `Ship ${i}`, 10]),
});
const reset = (state) => {
  mem = structuredClone(state);
  writes = [];
};
const settle = () => OH.storageSettled();

// --- Damaged data ---------------------------------------------------------------

test('a DB with no sources loads empty instead of crashing, and is set aside', async () => {
  reset({ db: { schemaVersion: 2 } });
  const db = await OH.loadDB();
  assert.deepEqual(db.sources, {});
  assert.deepEqual(db.history, []);
  const damaged = await OH.getDamaged();
  assert.equal(damaged.length, 1);
  assert.equal(damaged[0].what, 'db');
  assert.match(damaged[0].problems.join(), /no sources/);
  assert.equal(damaged[0].raw, undefined); // the list never carries the data itself
  assert.deepEqual((await OH.exportDamaged())[0].raw, { schemaVersion: 2 }); // the original, untouched
  await settle();
  assert.deepEqual(mem.db, { schemaVersion: 3, sources: {} }); // written back clean
  await OH.loadDB();
  await settle();
  assert.equal((await OH.getDamaged()).length, 1); // set aside once, not on every load
});

test('a DB that is not even an object is set aside too', async () => {
  for (const bad of ['oops', 42, null, []]) {
    reset({ db: bad });
    const db = await OH.loadDB();
    assert.deepEqual(db.sources, {}, String(bad));
    assert.equal((await OH.getDamaged()).length, 1, String(bad));
  }
});

test('the readable parts are kept; the original (junk included) is set aside', async () => {
  const raw = {
    schemaVersion: 3,
    owner: { nickname: 'Main', displayname: 'Main D' },
    sources: {
      hangar: { items: [{ id: 'a' }, null, 'junk', { id: 'b' }], scannedAt: 5 },
      buybacks: { items: 'nope', scannedAt: 5 },
      referral: { items: { recruits: 3 }, scannedAt: 5 },
    },
  };
  reset({ db: raw });
  const db = await OH.loadDB();
  assert.deepEqual(
    db.sources.hangar.items.map((x) => x.id),
    ['a', 'b'],
  );
  assert.equal(db.sources.buybacks, undefined);
  assert.deepEqual(db.sources.referral.items, { recruits: 3 });
  assert.equal(db.owner.nickname, 'Main');
  const [d] = await OH.getDamaged();
  assert.match(d.problems.join(' | '), /hangar: 2 unreadable rows.*buybacks: no items/);
  assert.deepEqual((await OH.exportDamaged())[0].raw, raw);
});

test('a DB from a newer version is read as far as possible, and kept aside', async () => {
  reset({ db: { schemaVersion: 9, sources: { hangar: { items: rows(2), scannedAt: 1 } } } });
  const db = await OH.loadDB();
  assert.equal(db.sources.hangar.items.length, 2);
  assert.match((await OH.getDamaged())[0].problems[0], /newer version/);
});

test('a damaged history key never breaks the DB beside it', async () => {
  reset({
    db: { schemaVersion: 3, sources: { hangar: { items: rows(1), scannedAt: 1 } } },
    dbHistory: 'x',
  });
  const db = await OH.loadDB();
  assert.deepEqual(db.history, []);
  assert.equal(db.sources.hangar.items.length, 1);
  assert.equal((await OH.getDamaged())[0].what, 'history');
});

test('at most three damaged copies are kept; dismissing hides them but keeps them', async () => {
  reset({});
  for (let i = 0; i < 5; i++) {
    mem.db = { schemaVersion: 3, junk: i }; // a different damage each time
    await OH.loadDB();
    await settle();
  }
  assert.equal((await OH.getDamaged()).length, 3);
  await OH.dismissDamaged();
  assert.ok((await OH.getDamaged()).every((d) => d.seen));
  assert.equal((await OH.exportDamaged()).length, 3);
});

// --- Versions -------------------------------------------------------------------

test('every older version migrates to the current one', () => {
  for (let v = 1; v < 3; v++) {
    const out = OH.migrateDB({
      schemaVersion: v,
      sources: { hangar: { items: [], scannedAt: 1 } },
    });
    assert.equal(out.schemaVersion, 3, `from v${v}`);
    assert.deepEqual(out.sources, { hangar: { items: [], scannedAt: 1 } });
  }
  const cur = { schemaVersion: 3, sources: {} };
  assert.deepEqual(OH.migrateDB(cur), cur);
});

test('the pre-database layout ({ hangar, scannedAt }) still loads', async () => {
  reset({ hangar: rows(3), scannedAt: 7 });
  const db = await OH.loadDB();
  assert.equal(db.sources.hangar.items.length, 3);
  assert.equal(db.sources.hangar.scannedAt, 7);
  assert.deepEqual(await OH.getDamaged(), []);
});

test('v2 → v3: history moves out of the DB into its own key, nothing lost', async () => {
  reset({
    db: {
      schemaVersion: 2,
      owner: { nickname: 'Main' },
      sources: { hangar: { items: rows(2), scannedAt: 2 } },
      history: [snap(1, 1), snap(2, 2)],
    },
  });
  const db = await OH.loadDB();
  assert.equal(db.history.length, 2); // callers still get it as before
  await settle();
  assert.equal(mem.db.schemaVersion, 3);
  assert.equal(mem.db.history, undefined);
  assert.equal(mem.dbHistory.length, 2);
  assert.deepEqual(await OH.getDamaged(), []); // an upgrade isn't damage
});

test('after a rollback (old version wrote history back into the DB) nothing is lost', async () => {
  reset({
    db: {
      schemaVersion: 3,
      sources: { hangar: { items: rows(3), scannedAt: 3 } },
      history: [snap(3, 3)],
    },
    dbHistory: [snap(1, 1), snap(2, 2)],
  });
  assert.deepEqual(
    (await OH.loadDB()).history.map((s) => s.at),
    [1, 2, 3],
  );
  await settle();
  assert.deepEqual(
    mem.dbHistory.map((s) => s.at),
    [1, 2, 3],
  );
  assert.equal(mem.db.history, undefined);
});

// --- Saving ---------------------------------------------------------------------

test('a hangar scan writes history; a buy-back scan leaves it alone', async () => {
  reset({ db: { schemaVersion: 3, sources: {} }, dbHistory: [] });
  pages = { hangar: rows(2), buybacks: rows(2, 'b') };
  assert.equal((await OH.scanSource('hangar', null, { account: acct })).ok, true);
  assert.ok(writes.some((k) => k.includes('dbHistory')));
  assert.equal(mem.dbHistory.length, 1);
  writes = [];
  assert.equal((await OH.scanSource('buybacks', null, { account: acct })).ok, true);
  assert.ok(writes.some((k) => k.includes('db')));
  assert.ok(!writes.some((k) => k.includes('dbHistory')), 'buy-backs rewrote history');
  assert.equal(mem.db.sources.buybacks.items.length, 2);
});

test('a buy-back save on a not-yet-upgraded DB keeps the history it moves out', async () => {
  reset({ db: { schemaVersion: 2, sources: {}, history: [snap(1, 1)] } });
  pages = { buybacks: rows(1, 'b') };
  await OH.scanSource('buybacks', null, { account: acct });
  await settle();
  assert.equal(mem.dbHistory.length, 1);
  assert.equal(mem.db.history, undefined);
});

test('an upgrade write never overwrites a scan saved at the same moment', async () => {
  reset({
    db: {
      schemaVersion: 2,
      sources: { hangar: { items: rows(1), scannedAt: 1 } },
      history: [snap(1, 1)],
    },
  });
  pages = { hangar: rows(4) };
  // The worst order: the upgrade reads storage while the scan's save is running
  // (so it sees the old data) and queues its write right after that save.
  let load;
  onRead = () => {
    onRead = null;
    load = OH.loadDB();
  };
  await OH.scanSource('hangar', null, { account: acct });
  await load;
  await settle();
  onRead = null;
  assert.equal(mem.db.sources.hangar.items.length, 4); // the scan won
  assert.deepEqual(
    mem.dbHistory.map((s) => s.items.length),
    [1, 4], // old snapshot kept, new one added
  );
});

// --- Accounts, backups, clearing ---------------------------------------------------

test('switching accounts carries each account’s history with it', async () => {
  reset({
    db: {
      schemaVersion: 3,
      owner: { nickname: 'Main', displayname: 'Main D' },
      sources: { hangar: { items: rows(3), scannedAt: 1 } },
    },
    dbHistory: [snap(1, 3)],
  });
  await OH.switchProfile('Alt', 'Alt D');
  assert.deepEqual(mem.dbHistory, []); // Alt starts with none
  assert.equal(mem['profile:main'].history.length, 1); // Main's is parked with it
  mem.db.sources.hangar = { items: rows(1, 'alt'), scannedAt: 2 };
  mem.dbHistory = [snap(2, 1)];
  await OH.switchProfile('Main');
  assert.equal(mem.db.owner.nickname, 'Main');
  assert.equal(mem.dbHistory.length, 1);
  assert.equal(mem.dbHistory[0].items.length, 3); // Main's history is back
  assert.equal(mem['profile:alt'].history[0].items.length, 1); // Alt's parked
  assert.equal(mem['profile:main'], undefined);
});

test('an account parked by an older version (history inside, v2) switches back fine', async () => {
  reset({
    db: {
      schemaVersion: 3,
      owner: { nickname: 'Alt' },
      sources: { hangar: { items: rows(1), scannedAt: 1 } },
    },
    'profile:main': {
      schemaVersion: 2,
      owner: { nickname: 'Main' },
      sources: { hangar: { items: rows(2), scannedAt: 1 } },
      history: [snap(1, 2)],
    },
  });
  assert.equal((await OH.switchProfile('Main')).restored, true);
  assert.equal(mem.db.schemaVersion, 3);
  assert.equal(mem.db.history, undefined);
  assert.equal(mem.dbHistory.length, 1);
});

test('a backup file keeps export format v2 and round-trips the history', async () => {
  reset({
    db: { schemaVersion: 3, sources: { hangar: { items: rows(2), scannedAt: 1 } } },
    dbHistory: [snap(1, 2)],
  });
  const file = await OH.exportDB();
  assert.equal(file.schemaVersion, 2);
  assert.equal(file.history.length, 1);
  reset({});
  const res = await OH.importDB(JSON.parse(JSON.stringify(file)));
  assert.equal(res.ok, true);
  assert.equal(mem.db.sources.hangar.items.length, 2);
  assert.equal(mem.dbHistory.length, 1);
  assert.equal(mem.db.history, undefined);
});

test('import refuses a backup format it does not know, but takes a stored DB', async () => {
  reset({});
  const future = await OH.importDB({ app: 'open-hangar', schemaVersion: 3, sources: {} });
  assert.equal(future.ok, false);
  assert.match(future.error, /Update the extension/);
  assert.equal(
    (await OH.importDB({ schemaVersion: 3, sources: { hangar: { items: [] } } })).ok,
    true,
  );
});

test('Clear Data removes history and set-aside copies; the account-switch clear keeps them restorable', async () => {
  reset({
    db: {
      schemaVersion: 3,
      owner: { nickname: 'Main' },
      sources: { hangar: { items: rows(2), scannedAt: 1 } },
    },
    dbHistory: [snap(1, 2)],
    dbCorrupt: [{ id: 'x', at: 1, what: 'db', problems: [], raw: 1 }],
  });
  await OH.clearData({ backup: true });
  assert.equal(mem.db, undefined);
  assert.equal(mem.dbHistory, undefined);
  const back = await OH.recoverData();
  assert.equal(back.history.length, 1);
  assert.equal(mem.dbHistory.length, 1);
  await OH.clearData();
  assert.equal(mem.db, undefined);
  assert.equal(mem.dbHistory, undefined);
  assert.equal(mem.dbCorrupt, undefined);
});

test('saved accounts with a damaged copy are listed, not a crash', async () => {
  reset({
    db: { schemaVersion: 3, owner: { nickname: 'Main' } },
    'profile:alt': { schemaVersion: 3, owner: { nickname: 'Alt' }, sources: 'x' },
  });
  const list = await OH.listProfiles();
  assert.deepEqual(
    list.map((p) => [p.nickname, p.pledges]),
    [
      ['Main', 0],
      ['Alt', 0],
    ],
  );
});

test('an account switch on a not-yet-upgraded DB never brings the old account back', async () => {
  reset({
    db: {
      schemaVersion: 2,
      owner: { nickname: 'Main' },
      sources: { hangar: { items: rows(3), scannedAt: 1 } },
      history: [snap(1, 3)],
    },
  });
  await OH.switchProfile('Alt', 'Alt D');
  await settle();
  assert.equal(mem.db.owner.nickname, 'Alt');
  assert.deepEqual(mem.db.sources, {});
  assert.deepEqual(mem.dbHistory, []);
  assert.equal(mem['profile:main'].sources.hangar.items.length, 3);
  assert.equal(mem['profile:main'].history.length, 1);
});

test('Clear Data right after loading a not-yet-upgraded DB stays cleared', async () => {
  reset({
    db: {
      schemaVersion: 2,
      sources: { hangar: { items: rows(2), scannedAt: 1 } },
      history: [snap(1, 2)],
    },
  });
  await OH.loadDB(); // queues the upgrade write
  await OH.clearData();
  await settle();
  assert.equal(mem.db, undefined);
  assert.equal(mem.dbHistory, undefined);
});
