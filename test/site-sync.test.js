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
