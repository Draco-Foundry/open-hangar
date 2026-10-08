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
