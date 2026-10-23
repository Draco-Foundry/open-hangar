'use strict';
// Sync Now (src/lib.js, OH.siteSync): a browser that hasn't scanned never sends its
// empty hangar, which would replace the one already on the website (found in the
// 2026-10-04 sync test), and the server's refusals read as plain advice.
// Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');

let mem = {};
let sent = []; // bodies POSTed to /api/v1/sync
let calls = []; // every request: "METHOD url"
let answer = () => new Response(JSON.stringify({ ok: true, synced_at: 123 }), { status: 200 });
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
global.fetch = async (url, init) => {
  calls.push(`${init?.method || 'GET'} ${url}`);
  if (String(url).endsWith('/api/v1/sync') && init?.method === 'POST') {
    sent.push(JSON.parse(init.body));
    return answer();
  }
  return new Response('', { status: 404 });
};
require('../src/lib.js');
const OH = globalThis.OH;

const linked = (db) => {
  mem = {
    siteUrl: 'https://staging.example',
    siteLink: { token: 't', name: 'pilot' },
    ...(db ? { db } : {}),
  };
  sent = [];
};
const scanned = (at) => ({
  schemaVersion: 2,
  sources: { hangar: { scannedAt: at, items: [{ id: 'p1', name: 'Gladius', value: 90 }] } },
});

test('nothing scanned: Sync Now sends nothing and says to scan first', async () => {
  linked();
  await assert.rejects(OH.siteSync(), /Scan your hangar first/);
  assert.equal(sent.length, 0);
});

test('a scanned hangar syncs and remembers when', async () => {
  linked(scanned(Date.now() - 60_000));
  const j = await OH.siteSync();
  assert.equal(j.synced_at, 123);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].sources.hangar.items.length, 1);
  assert.equal(mem.siteLink.lastSync, 123);
});

test("the server's refusals read as advice, not a status code", async () => {
  linked(scanned(Date.now() - 60_000));
  answer = () => new Response(JSON.stringify({ reason: 'older-scan' }), { status: 409 });
  await assert.rejects(OH.siteSync(), /newer scan from another browser/);
  answer = () => new Response(JSON.stringify({ reason: 'no-scan' }), { status: 409 });
  await assert.rejects(OH.siteSync(), /Scan your hangar first/);
});

// The website's other refusals (JSON { error, reason }): each reads as short advice,
// and only "sync isn't open yet" is calm (a note in the scan report, not a problem).
const refusedWith = async (status, body) => {
  linked(scanned(Date.now() - 60_000));
  answer = () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  try {
    await OH.siteSync();
  } catch (err) {
    return err;
  }
  assert.fail('the sync went through');
};

test('sync not open yet: a calm note with the date, and the link stays', async () => {
  const err = await refusedWith(403, {
    error: 'Sync opens November 10. Your hangar stays safe in your browser until then.',
    reason: 'not-open',
  });
  assert.equal(
    err.message,
    'Sync opens November 10. Your hangar stays safe in your browser until then.',
  );
  assert.equal(err.calm, true);
  assert.ok(mem.siteLink, 'still connected');
  assert.equal(mem.siteLink.lastSync, undefined);
});

test("sync not open yet: the website's own words win, so a new date needs no store update", async () => {
  const moved = await refusedWith(403, {
    error: 'Sync opens November 17. Your hangar stays safe in your browser until then.',
    reason: 'not-open',
  });
  assert.equal(
    moved.message,
    'Sync opens November 17. Your hangar stays safe in your browser until then.',
  );
  assert.equal(moved.calm, true);
  // No words, markup or a wall of text: the built-in sentence instead.
  const fallback = 'Sync opens November 10. Your hangar stays safe in your browser until then.';
  for (const error of [undefined, '', '  ', '<b>closed</b>', 'x'.repeat(201), 42]) {
    const err = await refusedWith(403, { error, reason: 'not-open' });
    assert.equal(err.message, fallback);
    assert.equal(err.calm, true);
  }
});

test('an extension too old to sync is told to update', async () => {
  const err = await refusedWith(426, { error: 'too old', reason: 'old-format' });
  assert.equal(
    err.message,
    'This version of Open Hangar is too old to sync. Update it, then sync again.',
  );
  assert.ok(!err.calm);
  // 426 means the same even without a reason.
  assert.match((await refusedWith(426, '')).message, /too old to sync/);
});

test('a format newer than the website knows: try again soon', async () => {
  const err = await refusedWith(400, { error: 'newer', reason: 'newer-format' });
  assert.equal(
    err.message,
    "openhangar.space hasn't caught up with this version yet. Try again soon.",
  );
  assert.ok(!err.calm);
});

test("the website's format check refused it: its own words, and where in the flight log (#584)", async () => {
  const err = await refusedWith(400, {
    error: 'schema',
    reason: 'schema',
    path: '/sources/hangar/items/3/value',
  });
  assert.equal(
    err.message,
    "Held at the hangar doors: this version packs your hangar in a shape our site won't accept. Our bug, not yours. Nothing was sent and your hangar is safe here. Update Open Hangar, or report it if it keeps happening.",
  );
  assert.equal(err.reason, 'schema');
  assert.equal(err.path, '/sources/hangar/items/3/value');
  assert.ok(!err.calm, 'a problem, not a note');
  await OH.storageSettled();
  assert.match(
    (await OH.getLog()).at(-1).msg,
    /format check failed at \/sources\/hangar\/items\/3\/value$/,
  );
  // A path that isn't a plain pointer (a value smuggled in, markup) never reaches the log.
  for (const path of ['/a b', '<b>x</b>', 'sources/hangar', 42, '/x'.repeat(40)]) {
    const bad = await refusedWith(400, { reason: 'schema', path });
    assert.equal(bad.path, undefined, String(path));
    await OH.storageSettled();
    assert.match((await OH.getLog()).at(-1).msg, /failed at \?$/);
  }
});

test('no format version, or any other refusal, keeps the status', async () => {
  const noFormat = await refusedWith(400, { error: 'no format', reason: 'no-format' });
  assert.equal(noFormat.message, 'openhangar.space responded 400');
  assert.ok(!noFormat.calm);
  const accounts = await refusedWith(403, { error: 'too many RSI accounts on this login' });
  assert.equal(accounts.message, 'openhangar.space responded 403');
  assert.ok(!accounts.calm);
});

test("a body that isn't JSON still gives a message", async () => {
  const err = await refusedWith(502, '<html>Bad gateway</html>');
  assert.equal(err.message, 'openhangar.space responded 502');
  assert.match((await refusedWith(409, 'nope')).message, /Scan your hangar first/);
});

test('too big to sync: says so, and that the hangar is safe', async () => {
  for (const error of ['too large', 'storage limit reached for this login']) {
    const err = await refusedWith(413, { error });
    assert.match(err.message, /more cargo than openhangar\.space can hold/);
    assert.match(err.message, /stays safe in your browser/);
    assert.ok(!err.calm);
  }
});

test('disconnected on the website: forgets the link', async () => {
  const err = await refusedWith(401, { error: 'not connected' });
  assert.match(err.message, /disconnected on the website/);
  assert.equal(mem.siteLink, undefined);
});

test('an old link refused after connecting again leaves the new link alone', async () => {
  linked(scanned(Date.now() - 60_000));
  answer = () => {
    mem.siteLink = { token: 'new', name: 'pilot' }; // Disconnect, then Connect, meanwhile
    return new Response(JSON.stringify({ error: 'not connected' }), { status: 401 });
  };
  await assert.rejects(OH.siteSync(), /disconnected on the website/);
  assert.deepEqual(mem.siteLink, { token: 'new', name: 'pilot' });
});

test('sync and disconnect use the versioned /api/v1/sync', async () => {
  linked(scanned(Date.now() - 60_000));
  answer = () => new Response(JSON.stringify({ ok: true, synced_at: 456 }), { status: 200 });
  calls = [];
  await OH.siteSync();
  await OH.siteDisconnect();
  assert.deepEqual(calls, [
    'POST https://staging.example/api/v1/sync',
    'DELETE https://staging.example/api/v1/sync',
  ]);
  assert.equal(mem.siteLink, undefined, 'forgotten after disconnect');
});

// Connect with a code (OH.siteLinkWait) while already connected (#741): the old token is
// revoked as Disconnect does, never the new one, and a failed revoke keeps the new link.
async function codeConnect(token, deleteAnswer) {
  const real = global.fetch;
  const deletes = [];
  global.fetch = async (url, init) => {
    if (init?.method === 'DELETE') {
      deletes.push(`${url} ${init.headers.authorization}`);
      return deleteAnswer();
    }
    return new Response(JSON.stringify({ status: 'approved', token, name: 'pilot' }));
  };
  try {
    const link = await OH.siteLinkWait({ device_code: 'd', expires_in: 60, interval: 0.001 });
    return { link, deletes };
  } finally {
    global.fetch = real;
  }
}
const revoked = () => new Response('{}', { status: 200 });

test('connecting again with a code revokes the old token', async () => {
  linked();
  const { link, deletes } = await codeConnect('new', revoked);
  assert.deepEqual(deletes, ['https://staging.example/api/v1/sync Bearer t']);
  assert.equal(link.token, 'new');
  assert.equal(mem.siteLink.token, 'new');
});

test('connecting again with a code to the same token revokes nothing', async () => {
  linked();
  const { deletes } = await codeConnect('t', revoked);
  assert.deepEqual(deletes, []);
  assert.equal(mem.siteLink.token, 't');
});

test('a code connect whose revoke fails still keeps the new link', async () => {
  linked();
  const { link, deletes } = await codeConnect('new', () => {
    throw new Error('offline');
  });
  assert.equal(deletes.length, 1);
  assert.equal(link.token, 'new');
  assert.equal(mem.siteLink.token, 'new');
});

// Connect hardening (#669): a link is never replaced by one for another account without
// the basic page's question naming both (ui/basic/hub.svelte.js connect).
test('an account switch is asked first; reconnecting the same account is not', () => {
  const was = { token: 't', name: 'pilot' };
  assert.equal(OH.siteSwitches(null, { token: 'n', name: 'pilot' }), false, 'no link yet');
  assert.equal(OH.siteSwitches(was, { token: 't', name: 'other' }), false, 'the same token');
  assert.equal(OH.siteSwitches(was, { token: 'n', name: 'pilot' }), false, 'the same account');
  assert.equal(OH.siteSwitches(was, { token: 'n', name: 'Someone Else' }), true);
  // No name to tell by, on either side: asked.
  assert.equal(OH.siteSwitches(was, { token: 'n', name: '' }), true);
  assert.equal(OH.siteSwitches({ token: 't', name: '' }, { token: 'n', name: 'pilot' }), true);
});

test('a switch said no to: the new token is revoked, the link kept', async () => {
  linked();
  const real = global.fetch;
  const deletes = [];
  global.fetch = async (url, init) => {
    deletes.push(`${init.method} ${url} ${init.headers.authorization}`);
    return new Response('{}');
  };
  try {
    await OH.siteTokenDrop('n');
  } finally {
    global.fetch = real;
  }
  assert.deepEqual(deletes, ['DELETE https://staging.example/api/v1/sync Bearer n']);
  assert.deepEqual(mem.siteLink, { token: 't', name: 'pilot' });
});

test('a switch said yes to: the new link kept, the old one revoked', async () => {
  linked();
  const real = global.fetch;
  const deletes = [];
  global.fetch = async (url, init) => {
    deletes.push(`${init.method} ${init.headers.authorization}`);
    return new Response('{}');
  };
  try {
    await OH.siteLinkSave({ token: 'n', name: 'Someone Else' });
  } finally {
    global.fetch = real;
  }
  assert.deepEqual(deletes, ['DELETE Bearer t']);
  assert.equal(mem.siteLink.token, 'n');
});

// The privacy policy's "Your Wishlist": Disconnect deletes the popup's copy of it (the
// Wishlist stays on the account), and so does a sync the website says isn't connected.
test("Disconnect deletes the popup's Wishlist copy", async () => {
  const { COPY_KEY } = await import('../ui/popup/wish-client.js');
  const copy = { v: 1, connectedAt: 1, at: 1, items: [{ key: 'ship:a', name: 'A' }] };
  linked(scanned(Date.now() - 60_000));
  mem[COPY_KEY] = copy;
  await OH.siteDisconnect();
  assert.equal(mem[COPY_KEY], undefined);
  linked(scanned(Date.now() - 60_000));
  mem[COPY_KEY] = copy;
  answer = () => new Response(JSON.stringify({ error: 'not connected' }), { status: 401 });
  await assert.rejects(OH.siteSync(), /disconnected on the website/);
  assert.equal(mem[COPY_KEY], undefined);
  answer = () => new Response(JSON.stringify({ ok: true, synced_at: 123 }), { status: 200 });
});

// The store alerts' copy of the Wishlist keys is part of "Your Wishlist" too. Its own
// check deletes it for a link that's gone, but a check waits while status.json pauses
// alerts, so Disconnect (and a sync the website refuses as not connected) deletes it.
test("Disconnect deletes the store alerts' Wishlist keys, alerts paused or not", async () => {
  const { WISH_KEY } = require('../src/alerts.js');
  assert.equal(WISH_KEY, 'alertsWish');
  const paused = { at: 1, data: { sources: { alerts: { enabled: false } } } };
  const keys = { connectedAt: 1, at: 1, keys: ['ship:a'] };
  linked(scanned(Date.now() - 60_000));
  Object.assign(mem, { alertsOn: true, remoteStatus: paused, [WISH_KEY]: keys });
  await OH.siteDisconnect();
  assert.equal(mem[WISH_KEY], undefined);
  linked(scanned(Date.now() - 60_000));
  Object.assign(mem, { alertsOn: true, remoteStatus: paused, [WISH_KEY]: keys });
  answer = () => new Response(JSON.stringify({ error: 'not connected' }), { status: 401 });
  await assert.rejects(OH.siteSync(), /disconnected on the website/);
  assert.equal(mem[WISH_KEY], undefined);
  answer = () => new Response(JSON.stringify({ ok: true, synced_at: 123 }), { status: 200 });
});

// --- Auto Scan Daily (#666) ----------------------------------------------------------
// Check 5 of the privacy notes: Disconnect turns Auto Scan Daily off (its switch and its
// next run go with the link and the popup's Wishlist copy), and so does a sync the
// website says isn't connected. The worker then clears its alarm (src/background.js).
test('Disconnect turns off Auto Scan Daily, as a sync refused as not connected does', async () => {
  const on = { autoScanOn: true, autoScanNext: Date.now() + 3600e3, popupWish: { v: 1 } };
  const kept = { autoScan: { v: 1, line: 'quick', at: 1 }, scanFull: { hangar: 1 } };
  linked(scanned(Date.now() - 60_000));
  Object.assign(mem, on, kept);
  await OH.siteDisconnect();
  for (const k of ['siteLink', 'popupWish', 'autoScanOn', 'autoScanNext'])
    assert.equal(mem[k], undefined, k);
  assert.deepEqual(mem.autoScan, kept.autoScan, 'its last run stays (the row is hidden)');
  linked(scanned(Date.now() - 60_000));
  Object.assign(mem, on);
  answer = () => new Response(JSON.stringify({ error: 'not connected' }), { status: 401 });
  await assert.rejects(OH.siteSync(), /disconnected on the website/);
  for (const k of ['siteLink', 'popupWish', 'autoScanOn', 'autoScanNext'])
    assert.equal(mem[k], undefined, k);
  answer = () => new Response(JSON.stringify({ ok: true, synced_at: 123 }), { status: 200 });
});

test('a background seeing the link go clears Auto Scan Daily and turns store alerts off', async () => {
  const { loadBackground } = require('./bridge-env.js');
  const x = loadBackground({
    changes: true,
    offscreen: true,
    local: { siteLink: { token: 't' }, autoScanOn: true, alertsOn: true },
  });
  const until = async (ok) => {
    for (let i = 0; i < 200 && !ok(); i++) await new Promise((r) => setTimeout(r, 2));
    assert.ok(ok());
  };
  await until(() => x.alarms.has('oh-auto-scan') && x.alarms.has('oh-alerts'));
  // Disconnect's removal, as OH.siteDisconnect writes it.
  await x.chrome.storage.local.remove([
    'siteLink',
    'popupWish',
    'alertsWish',
    'autoScanOn',
    'autoScanNext',
  ]);
  await until(() => !x.alarms.has('oh-auto-scan'));
  // Store alerts are on only while connected: off too, their alarm gone.
  await until(() => x.stores.local.alertsOn === false && !x.alarms.has('oh-alerts'));
  assert.equal(x.stores.local.autoScanNext, undefined);
});

// Which scan a sync sent, for a sync that never went out (ui/scan/auto.js owedSync), and
// a refusal's status, for one not to send again until the scan changes.
test('a sync that goes through keeps the scan it sent; a refusal carries its status', async () => {
  const db = scanned(Date.now() - 60_000);
  db.sources.buybacks = { scannedAt: 77, items: [] };
  linked(db);
  await OH.siteSync();
  assert.equal(mem.siteLink.syncedScan, `${db.sources.hangar.scannedAt}|77|`);
  answer = () => new Response(JSON.stringify({ reason: 'older-scan' }), { status: 409 });
  const err = await OH.siteSync().catch((e) => e);
  assert.equal(err.status, 409);
  answer = () => new Response(JSON.stringify({ reason: 'too-soon' }), { status: 429 });
  linked(db);
  assert.equal((await OH.siteSync().catch((e) => e)).status, 429);
  answer = () => new Response(JSON.stringify({ ok: true, synced_at: 123 }), { status: 200 });
});

// --- What sync leaves out ------------------------------------------------------------
// The referral prospects list is other players (handles, monikers, enlist dates) who
// aren't recruits yet: the backup file keeps it, sync never sends it.

const withReferral = () => {
  const db = scanned(Date.now() - 60_000);
  db.sources.referral = {
    scannedAt: Date.now() - 60_000,
    items: {
      current: { recruits: 1 },
      legacy: { recruits: 1 },
      prospects: 2,
      recruitsList: [{ id: 'r1', handle: 'Recruit_One', campaign: 'current' }],
      prospectsList: [
        { id: 'x1', handle: 'Someone_Else', moniker: 'Someone', date: '2026-09-01' },
        { id: 'x2', handle: 'Another_Pilot', moniker: 'Another', date: '2026-09-02' },
      ],
    },
  };
  return db;
};

test('sync leaves the prospects list out; the backup file keeps it', async () => {
  linked(withReferral());
  answer = () => new Response(JSON.stringify({ ok: true, synced_at: 1 }), { status: 200 });
  await OH.siteSync();
  const ref = sent[0].sources.referral.items;
  assert.equal('prospectsList' in ref, false, 'no prospects list in the sync');
  assert.equal(ref.prospects, 2, 'the count still goes');
  assert.equal(ref.recruitsList.length, 1, 'the recruits list still goes');
  assert.ok(!JSON.stringify(sent[0]).includes('Someone_Else'));
  // The backup file (OH.exportDB) and the stored data are untouched.
  const backup = await OH.exportDB();
  assert.equal(backup.sources.referral.items.prospectsList.length, 2);
  assert.equal(mem.db.sources.referral.items.prospectsList.length, 2);
});

test('OH.syncPayload is pure and passes payloads without prospects through', () => {
  const payload = { sources: { referral: { items: { prospects: 1, prospectsList: [{}] } } } };
  const out = OH.syncPayload(payload);
  assert.deepEqual(out.sources.referral.items, { prospects: 1 });
  assert.equal(payload.sources.referral.items.prospectsList.length, 1, 'not changed');
  const plain = { sources: { hangar: {} } };
  assert.equal(OH.syncPayload(plain), plain);
  assert.equal(OH.syncPayload(null), null);
});

// --- A browser shared by more than one RSI account ------------------------------------
// The link is one per browser, so it remembers which RSI accounts it has synced, and
// any other account asks first ("Sync <handle> to your openhangar.space account?").

const signedInAs = (handle, record) => {
  mem.account = { loggedIn: true, nickname: handle, displayname: handle, citizenRecord: record };
  mem.db = { ...mem.db, owner: { nickname: handle, displayname: handle } };
};
const ok = () => new Response(JSON.stringify({ ok: true, synced_at: 7 }), { status: 200 });
const tryAuto = async () => {
  try {
    await OH.siteSync({ auto: true });
    return null;
  } catch (err) {
    return err;
  }
};

test("a link's first sync goes without asking and remembers the account", async () => {
  linked(scanned(Date.now() - 60_000));
  signedInAs('Pilot_A', '1001');
  answer = ok;
  await OH.siteSync({ auto: true });
  assert.equal(sent.length, 1);
  assert.deepEqual(mem.siteLink.accounts, [{ handle: 'Pilot_A', record: '1001' }]);
  // And again, without asking.
  await OH.siteSync({ auto: true });
  assert.equal(sent.length, 2);
});

test('another RSI account in the same browser asks first and sends nothing', async () => {
  linked(scanned(Date.now() - 60_000));
  signedInAs('Pilot_A', '1001');
  answer = ok;
  await OH.siteSync({ auto: true });
  signedInAs('Pilot_B', '2002'); // reconcileAccount switched the hangar
  let sends = 0;
  const err = await tryAuto();
  assert.equal(err.message, 'Sync Pilot_B to your openhangar.space account?');
  assert.equal(err.calm, true);
  assert.deepEqual(err.ask, { handle: 'Pilot_B', record: '2002' });
  assert.equal(sent.length, 1, 'only the first account was sent');
  // Sync Now asks too.
  await assert.rejects(OH.siteSync({ onSend: () => sends++ }), (e) => e.ask?.handle === 'Pilot_B');
  assert.equal(sends, 0);
  assert.equal(sent.length, 1);
});

test('yes syncs that account from now on; the answer is kept per handle', async () => {
  linked(scanned(Date.now() - 60_000));
  signedInAs('Pilot_A', '1001');
  answer = ok;
  await OH.siteSync({ auto: true });
  signedInAs('Pilot_B', '2002');
  await OH.siteSyncAnswer({ handle: 'Pilot_B', record: '2002' }, true);
  await OH.siteSync({ auto: true });
  assert.equal(sent.length, 2);
  assert.equal(sent[1].account.handle, 'Pilot_B');
  assert.deepEqual(
    mem.siteLink.accounts.map((a) => a.handle),
    ['Pilot_A', 'Pilot_B'],
  );
  // Back to the first one: still no question.
  signedInAs('Pilot_A', '1001');
  await OH.siteSync({ auto: true });
  assert.equal(sent.length, 3);
});

test('no keeps the sync after a scan quiet; Sync Now asks again', async () => {
  linked(scanned(Date.now() - 60_000));
  signedInAs('Pilot_A', '1001');
  answer = ok;
  await OH.siteSync({ auto: true });
  signedInAs('pilot_b', '2002');
  await OH.siteSyncAnswer({ handle: 'pilot_b', record: '2002' }, false);
  assert.deepEqual(mem.siteLink.declined, [{ handle: 'pilot_b', record: '2002' }]);
  const err = await tryAuto();
  assert.equal(err.quiet, true);
  assert.ok(!err.calm && !err.ask);
  assert.ok(!/pilot_b/i.test(err.message), 'nothing to show, and no handle to log');
  await assert.rejects(OH.siteSync(), (e) => e.ask?.handle === 'pilot_b');
  assert.equal(sent.length, 1);
  // Changing your mind later: yes moves it over.
  await OH.siteSyncAnswer({ handle: 'Pilot_B', record: '2002' }, true);
  assert.deepEqual(mem.siteLink.declined, []);
  await OH.siteSync({ auto: true });
  assert.equal(sent.length, 2);
});

test('the same Citizen Record under a new handle is the same pilot', async () => {
  linked(scanned(Date.now() - 60_000));
  signedInAs('Old_Handle', '3003');
  answer = ok;
  await OH.siteSync({ auto: true });
  signedInAs('New_Handle', '3003');
  await OH.siteSync({ auto: true });
  assert.equal(sent.length, 2);
  assert.deepEqual(mem.siteLink.accounts, [{ handle: 'New_Handle', record: '3003' }]);
});

test('only a real Citizen Record number makes two handles one pilot', async () => {
  linked(scanned(Date.now() - 60_000));
  signedInAs('Pilot_A', 'n/a'); // a placeholder, not a record
  answer = ok;
  await OH.siteSync({ auto: true });
  assert.deepEqual(mem.siteLink.accounts, [{ handle: 'Pilot_A', record: null }]);
  signedInAs('Pilot_B', 'n/a');
  const err = await tryAuto();
  assert.equal(err?.ask?.handle, 'Pilot_B', 'asks: the same placeholder is no match');
  assert.equal(sent.length, 1);
  assert.deepEqual(
    mem.siteLink.accounts.map((a) => a.handle),
    ['Pilot_A'],
  );
  // "#123" on the dossier and "123" are the same number.
  linked(scanned(Date.now() - 60_000));
  signedInAs('Old_Handle', '#123');
  await OH.siteSync({ auto: true });
  assert.deepEqual(mem.siteLink.accounts, [{ handle: 'Old_Handle', record: '123' }]);
  signedInAs('New_Handle', '123');
  await OH.siteSync({ auto: true });
  assert.equal(sent.length, 2);
});

test("the hangar's own account counts, not just the cached RSI login", async () => {
  linked(scanned(Date.now() - 60_000));
  signedInAs('Pilot_A', '1001');
  answer = ok;
  await OH.siteSync({ auto: true });
  assert.equal(sent.length, 1);
  // Pilot_B's hangar is the live one, but the RSI login cached is still Pilot_A's
  // (signed in again elsewhere before this page switched hangars).
  mem.db = { ...mem.db, owner: { nickname: 'Pilot_B', displayname: 'Pilot_B' } };
  let sends = 0;
  for (const opts of [{ auto: true }, {}]) {
    await assert.rejects(OH.siteSync({ ...opts, onSend: () => sends++ }), (e) => {
      assert.match(e.message, /belongs to another pilot than the one signed in to RSI/);
      assert.equal(e.calm, true);
      assert.ok(!e.ask && !/Pilot_/.test(e.message), 'no handle, so it can be logged');
      return true;
    });
  }
  assert.equal(sends, 0);
  assert.equal(sent.length, 1, "Pilot_B's hangar never went as Pilot_A's");
  // Signed out of RSI (no login cached): the hangar's own account is the one asked about.
  delete mem.account;
  const err = await tryAuto();
  assert.equal(err?.ask?.handle, 'Pilot_B');
  assert.equal(sent.length, 1);
});

test('a sync without a Citizen Record keeps the one already known', async () => {
  linked(scanned(Date.now() - 60_000));
  signedInAs('Pilot_A', '1001');
  answer = ok;
  await OH.siteSync({ auto: true });
  delete mem.account; // signed out of RSI: the export has no record
  await OH.siteSync({ auto: true });
  assert.equal(sent.length, 2);
  assert.deepEqual(mem.siteLink.accounts, [{ handle: 'Pilot_A', record: '1001' }]);
  // So a new handle with that record is still the same pilot.
  signedInAs('Pilot_A2', '1001');
  await OH.siteSync({ auto: true });
  assert.equal(sent.length, 3);
});

test("a link's first sync asks when this browser keeps another account too", async () => {
  linked(scanned(Date.now() - 60_000));
  signedInAs('Pilot_B', '2002');
  mem['profile:pilot_a'] = {
    schemaVersion: 3,
    sources: { hangar: { scannedAt: 1, items: [] } },
    owner: { nickname: 'Pilot_A', displayname: 'Pilot_A' },
  };
  answer = ok;
  const err = await tryAuto();
  assert.equal(err?.ask?.handle, 'Pilot_B');
  assert.equal(sent.length, 0);
  await OH.siteSyncAnswer(err.ask, true);
  await OH.siteSync({ auto: true });
  assert.equal(sent.length, 1);
});

test('a sync that ends after Disconnect does not bring the link back', async () => {
  linked(scanned(Date.now() - 60_000));
  signedInAs('Pilot_A', '1001');
  answer = () => {
    delete mem.siteLink; // Disconnect pressed while the sync was in flight
    return ok();
  };
  await OH.siteSync();
  assert.equal(mem.siteLink, undefined);
});

// --- Holding off while the website says wait ------------------------------------------
// After "not open yet" the sync after a scan waits 6 hours (Sync Now still tries); a
// 429's Retry-After holds every sync. Nothing is uploaded while it holds.

const notOpen = () =>
  new Response(
    JSON.stringify({
      error: 'Sync opens November 10. Your hangar stays safe in your browser until then.',
      reason: 'not-open',
    }),
    { status: 403 },
  );

test('not open yet: the sync after a scan holds off for 6 hours, Sync Now still tries', async () => {
  linked(scanned(Date.now() - 60_000));
  answer = notOpen;
  const before = Date.now();
  await assert.rejects(OH.siteSync({ auto: true }), (e) => e.calm === true);
  assert.equal(sent.length, 1);
  const wait = mem.siteLink.wait;
  assert.equal(wait.reason, 'not-open');
  assert.ok(wait.until >= before + 6 * 3600e3 && wait.until <= Date.now() + 6 * 3600e3);
  // The next scan: the same calm note, nothing uploaded, nothing sent before it.
  let sends = 0;
  await assert.rejects(OH.siteSync({ auto: true, onSend: () => sends++ }), (e) => {
    assert.equal(
      e.message,
      'Sync opens November 10. Your hangar stays safe in your browser until then.',
    );
    assert.equal(e.calm, true);
    assert.equal(e.held, 'not-open');
    return true;
  });
  assert.equal(sends, 0);
  assert.equal(sent.length, 1);
  // Sync Now asks the website again.
  await assert.rejects(OH.siteSync(), (e) => e.calm === true && !e.held);
  assert.equal(sent.length, 2);
  // Six hours on, the sync after a scan tries again; a sync that goes clears the wait.
  mem.siteLink.wait.until = Date.now() - 1;
  answer = ok;
  await OH.siteSync({ auto: true });
  assert.equal(sent.length, 3);
  assert.equal(mem.siteLink.wait, undefined);
  assert.equal(mem.siteLink.lastSync, 7);
});

test('too soon (429): a calm note, and Retry-After holds every sync', async () => {
  linked(scanned(Date.now() - 60_000));
  answer = () =>
    new Response(
      JSON.stringify({ error: 'One sync every 5 minutes. Try again soon.', reason: 'too-soon' }),
      { status: 429, headers: { 'retry-after': '120' } },
    );
  const before = Date.now();
  await assert.rejects(OH.siteSync(), (e) => {
    assert.equal(e.message, 'One sync every 5 minutes. Try again soon.');
    assert.equal(e.calm, true);
    return true;
  });
  assert.equal(sent.length, 1);
  const wait = mem.siteLink.wait;
  assert.equal(wait.reason, 'too-soon');
  assert.ok(wait.until >= before + 120e3 && wait.until <= Date.now() + 120e3);
  // Both the sync after a scan and Sync Now wait, with the website's words.
  for (const opts of [{ auto: true }, {}]) {
    await assert.rejects(OH.siteSync(opts), (e) => {
      assert.equal(e.held, 'too-soon');
      assert.equal(e.calm, true);
      assert.equal(e.message, 'One sync every 5 minutes. Try again soon.');
      return true;
    });
  }
  assert.equal(sent.length, 1);
  // Once it's passed, Sync Now goes.
  mem.siteLink.wait.until = Date.now() - 1;
  answer = ok;
  await OH.siteSync();
  assert.equal(sent.length, 2);
});

test('a 429 without a reason or Retry-After waits 5 minutes, with built-in words', async () => {
  const err = await refusedWith(429, '<html>Too many</html>');
  assert.equal(err.calm, true);
  assert.equal(
    err.message,
    'openhangar.space just took a sync for this account. The next one can launch in a few minutes.',
  );
  const left = mem.siteLink.wait.until - Date.now();
  assert.ok(left > 4.9 * 60e3 && left <= 5 * 60e3);
});

// An extension page only sees the Retry-After header when the website exposes it (CORS);
// the test's fetch has no CORS, so the JSON's `retry_after` is checked on its own here.
test('a 429 with retry_after in its JSON waits that long', async () => {
  const err = await refusedWith(429, { error: 'Too soon.', reason: 'too-soon', retry_after: 600 });
  assert.equal(err.calm, true);
  const left = mem.siteLink.wait.until - Date.now();
  assert.ok(left > 9.9 * 60e3 && left <= 10 * 60e3);
});

test('OH.siteSyncWait: which wait holds which sync', () => {
  const now = 1_000_000;
  const link = (reason, until) => ({ token: 't', wait: { reason, until, said: '' } });
  assert.equal(OH.siteSyncWait(null, { now }), null);
  assert.equal(OH.siteSyncWait({ token: 't' }, { now }), null);
  assert.ok(OH.siteSyncWait(link('not-open', now + 1), { auto: true, now }));
  assert.equal(OH.siteSyncWait(link('not-open', now + 1), { auto: false, now }), null);
  assert.ok(OH.siteSyncWait(link('too-soon', now + 1), { auto: false, now }));
  assert.equal(OH.siteSyncWait(link('too-soon', now), { now }), null, 'over');
  // A clock set back can't hold sync for days.
  assert.equal(OH.siteSyncWait(link('too-soon', now + 2 * 24 * 3600e3), { now }), null);
});

// The sync payload's schema (#441, src/hangar-shape.js checkPayload): a body that
// doesn't fit it never leaves, and the sync error says why and where.
test('a body that fails the sync schema is not sent: reason schema, and where', async () => {
  answer = () => new Response(JSON.stringify({ ok: true, synced_at: 123 }), { status: 200 });
  linked(scanned(Date.now() - 60_000));
  mem.db.sources.hangar.items[0].value = '90'; // text where a number goes
  calls = [];
  let sending = false;
  const err = await OH.siteSync({ onSend: () => (sending = true) }).then(
    () => assert.fail('it was sent'),
    (e) => e,
  );
  assert.equal(err.reason, 'schema');
  assert.equal(err.path, '/sources/hangar/items/0/value');
  assert.equal(
    err.message,
    "Held at the hangar doors: this version packs your hangar in a shape our site won't accept. Our bug, not yours. Nothing was sent and your hangar is safe here. Update Open Hangar, or report it if it keeps happening.",
  );
  assert.ok(!err.calm, 'a problem, not a note');
  assert.equal(sent.length, 0);
  assert.ok(!calls.some((c) => c.startsWith('POST')), 'no request at all');
  assert.equal(sending, false, "onSend doesn't run");
  assert.equal(mem.siteLink.lastSync, undefined);
  await OH.storageSettled();
  const log = (await OH.getLog()).at(-1);
  assert.equal(log.where, 'site');
  assert.match(log.msg, /schema at \/sources\/hangar\/items\/0\/value \(expected number or null\)/);
  assert.doesNotMatch(log.msg, /90/, 'never the value itself');
  // The same hangar with a number there goes.
  mem.db.sources.hangar.items[0].value = 90;
  await OH.siteSync();
  assert.equal(sent.length, 1);
});

test('a code connect with save: false keeps nothing and revokes nothing', async () => {
  linked();
  const real = global.fetch;
  const deletes = [];
  global.fetch = async (url, init) => {
    if (init?.method === 'DELETE') deletes.push(url);
    return new Response(JSON.stringify({ status: 'approved', token: 'new', name: 'other' }));
  };
  try {
    const start = { device_code: 'd', expires_in: 60, interval: 0.001 };
    const link = await OH.siteLinkWait(start, () => true, { save: false });
    assert.equal(link.token, 'new');
    assert.equal(mem.siteLink.token, 't', 'the old link stays until the page says so');
    assert.deepEqual(deletes, []);
  } finally {
    global.fetch = real;
  }
});
