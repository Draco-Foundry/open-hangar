'use strict';
// Auto Scan Daily's run (ui/scan/runner.js autoScan, #666) on top of the real src/lib.js,
// with a stand-in RSI and openhangar.space: every request counted, every storage write
// seen. What the privacy policy's Auto Scan Daily section says, part by part, and the
// privacy notes' checks 4 (a quick check that finds nothing new saves and sends nothing)
// and 10 (the popup asks for a scan after any part not saved). Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');

const DAY = 24 * 3600e3;
const RSI = 'https://robertsspaceindustries.com';
const SITE = 'https://app.example';

// --- The browser ----------------------------------------------------------------------
let mem = {};
let sess = {};
// `log`: whether its writes are noted (local storage's, in `writes`).
function area(get, log = false) {
  return {
    get: async (k) => {
      const data = get();
      const keys =
        k == null
          ? Object.keys(data)
          : typeof k === 'string'
            ? [k]
            : Array.isArray(k)
              ? k
              : Object.keys(k);
      return Object.fromEntries(
        keys.filter((x) => x in data).map((x) => [x, structuredClone(data[x])]),
      );
    },
    set: async (o) => {
      if (log) writes.push(Object.keys(o));
      Object.assign(get(), structuredClone(o));
    },
    remove: async (k) => {
      if (log) writes.push([].concat(k).map((x) => `-${x}`));
      [].concat(k).forEach((x) => delete get()[x]);
    },
  };
}
let writes = [];
global.window = globalThis;
// The dossier's Citizen Record is read as HTML (src/lib.js citizenRecordOf).
global.DOMParser = new (require('jsdom').JSDOM)('').window.DOMParser;
global.chrome = {
  storage: { local: area(() => mem, true), session: area(() => sess) },
  runtime: { getManifest: () => ({ version: '0.4.0' }) },
};
// RSI's pages as the stand-in serves them: JSON, then anything after a '<' (a sign-in
// form) is the page's HTML.
const json = (html) => JSON.parse(String(html).split('<')[0] || 'null');
global.OpenHangar = {
  parsePledges: (html) => json(html) || [],
  parseBuybacks: (html) => json(html)?.items || [],
  parseBuybackTokens: (html) => json(html)?.tokens ?? null,
};
// Waits run at once (fetchPage's retries, the runner's progress timer).
const realTimeout = setTimeout;
global.setTimeout = (fn, ms, ...a) => realTimeout(fn, 0, ...a);
require('../src/lib.js');
const OH = globalThis.OH;
let pauses = 0;
OH.autoPause = async () => void pauses++;

// --- RSI and openhangar.space ---------------------------------------------------------
const pledges = (n, from = 0) =>
  Array.from({ length: n }, (_, i) => ({
    id: String(1000 + from + i),
    name: `Pledge ${from + i}`,
    value: 10,
  }));
const buybacks = (n, from = 0) =>
  Array.from({ length: n }, (_, i) => ({
    id: String(5000 + from + i),
    name: `Buy-Back ${from + i}`,
    kind: 'ship',
  }));
let rsi; // what RSI has: { who, hangar, buybacks, tokens, recruits, fail }
let asked; // every request to RSI, in order: 'who' | 'dossier' | 'hangar:N' | 'buybacks:N' | 'referrals:C/conv/N'
let site; // every request to openhangar.space: { path, at, autoScan }
let syncAnswer;
const dashboardHtml = (who) =>
  who
    ? `<div data-account="${JSON.stringify({ nickname: who, displayname: `${who} D` }).replace(/"/g, '&quot;')}"></div>` +
      `<div data-ref="${JSON.stringify({ referralCode: 'STAR-ABCD-1234' }).replace(/"/g, '&quot;')}"></div>`
    : '<html><a href="/connect">Sign in</a></html>';
const SIGN_IN = '<input name="password">';
global.fetch = async (url, init = {}) => {
  const u = new URL(String(url));
  if (u.origin === SITE) {
    const path = u.pathname + u.search;
    site.push({ path, method: init.method || 'GET', autoScan: structuredClone(mem.autoDaily) });
    if (path === '/api/v1/sync' && init.method === 'POST') return syncAnswer();
    return new Response('', { status: 404 });
  }
  if (u.origin !== RSI) return new Response('', { status: 404 });
  let kind;
  if (u.pathname === '/en/account/dashboard') kind = 'who';
  else if (u.pathname.startsWith('/en/citizens/')) kind = 'dossier';
  else if (u.pathname === '/en/account/pledges') kind = `hangar:${u.searchParams.get('page')}`;
  else if (u.pathname === '/en/account/buy-back-pledges')
    kind = `buybacks:${u.searchParams.get('page')}`;
  else if (u.pathname === '/graphql') {
    const v = JSON.parse(init.body).variables;
    kind = `referrals:${v.campaignId}/${v.converted}/${v.page}`;
  } else kind = u.pathname;
  asked.push(kind);
  const n = asked.filter((k) => k === kind).length;
  const bad = rsi.fail?.(kind, n, asked.length);
  if (bad === 'network') throw new TypeError('Failed to fetch');
  if (bad) return bad;
  if (kind === 'who') {
    const who = typeof rsi.who === 'function' ? rsi.who(n) : rsi.who;
    return new Response(dashboardHtml(who));
  }
  // A public dossier: its Citizen Record when `rsi.records` has one for the handle.
  if (kind === 'dossier') {
    const handle = decodeURIComponent(u.pathname.slice('/en/citizens/'.length));
    const rec = rsi.records?.[handle];
    return rec
      ? new Response(`<div class="citizen-record"><span class="value">${rec}</span></div>`)
      : new Response('', { status: 404 });
  }
  const page = (list, size, p) => {
    const last = Math.max(1, Math.ceil(list.length / size));
    const at = Math.min(p, last);
    return list.slice((at - 1) * size, at * size);
  };
  const p = Number(u.searchParams.get('page'));
  if (kind.startsWith('hangar:')) return new Response(JSON.stringify(page(rsi.hangar, 10, p)));
  if (kind.startsWith('buybacks:'))
    return new Response(
      JSON.stringify({ items: page(rsi.buybacks, 100, p), tokens: rsi.tokens }) +
        (rsi.buybacks.length ? '' : '<p>No pledges available</p>'),
    );
  if (kind.startsWith('referrals:')) {
    const v = JSON.parse(init.body).variables;
    const list = v.converted ? rsi.recruits : [];
    return Response.json({
      data: {
        referralRecruitsList: {
          recruitsCount: list.length,
          prospectsCount: 0,
          data: list.slice((v.page - 1) * 50, v.page * 50),
        },
      },
    });
  }
  return new Response('', { status: 404 });
};
const rsiAsked = () => asked.length;

// --- The runner -----------------------------------------------------------------------
const load = () => import('../ui/scan/runner.js');
let cookie = 'in';
async function runner() {
  const { createRunner } = await load();
  return createRunner({
    OH,
    store: chrome.storage.local,
    session: chrome.storage.session,
    me: { by: 'offscreen', tabId: null, run: 'run-auto-1' },
    mayReadRsi: async () => true,
    mayShare: async () => true,
    rsiCookie: async () => cookie,
    fetchFn: async () => assert.fail('no portrait in these tests'),
    appVersion: '0.4.0',
  });
}
// A connected browser that scanned (a pressed Scan) and synced: RSI as it was then.
async function scannedAndSynced({ hangar = pledges(25), bbs = buybacks(3), recruits = [] } = {}) {
  mem = {
    siteUrl: SITE,
    siteLink: { token: 't', name: 'pilot', connectedAt: 1, lastSync: null },
    remoteStatus: { at: Date.now(), data: null }, // status.json, as cached
  };
  sess = {};
  rsi = { who: 'Test_Pilot', hangar, buybacks: bbs, tokens: 2, recruits, fail: null };
  asked = [];
  site = [];
  syncAnswer = () => Response.json({ ok: true, synced_at: Date.now() });
  cookie = 'in';
  OH.flags = { wishlistImport: false, autoScanRun: true };
  const r = await runner();
  const report = await r.scan({ reason: 'popup' });
  assert.equal(report.bad, false, 'the pressed Scan went fine');
  await r.packsDone();
  assert.ok(mem.siteLink.syncedScan, 'and its sync went through');
  // A fresh count for the run, and Auto Scan Daily switched on.
  mem.autoDailyOn = true;
  asked = [];
  site = [];
  writes = [];
  pauses = 0;
  return r;
}
const without = (o, keys) =>
  Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
const stamps = () => mem.autoDailyFull || {};

// --- Check 4: a quick check that finds nothing new ------------------------------------

test('check 4: nothing new: 3 requests to RSI, only its record written, nothing sent', async () => {
  const r = await scannedAndSynced();
  const before = structuredClone(mem);
  const rec = await r.autoScan();
  assert.deepEqual(asked, ['who', 'hangar:1', 'buybacks:1']);
  assert.equal(pauses, rsiAsked() - 1, 'a pause before every request but the first');
  assert.deepEqual(writes.flat(), ['autoDaily'], 'only its record');
  for (const k of [
    'db',
    'dbHistory',
    'pledgeArchive',
    'account',
    'avatarImg',
    'scanReport',
    'scanStarted',
    'autoDailyFull',
  ])
    assert.deepEqual(mem[k], before[k], `${k} byte for byte the same`);
  assert.deepEqual(without(mem, ['autoDaily']), before);
  assert.deepEqual(site, [], 'nothing sent to openhangar.space');
  assert.equal(rec.line, 'quick');
  assert.equal(rec.run, null, 'no full read began');
  assert.equal(rec.fails, 0);
  assert.equal(rec.retryAt, null);
  assert.equal(sess.scanRunning, undefined, 'its marks gone');
  assert.equal(sess.scanProgress, undefined);
});

test('check 4: a list an older parser read is due: a full read, not a quick check (#728)', async () => {
  const r = await scannedAndSynced();
  const { PARSER_VERSION } = require('../src/hangar-shape.js');
  mem.scanParser = { hangar: PARSER_VERSION, buybacks: PARSER_VERSION - 1 };
  await r.autoScan();
  assert.deepEqual(asked.slice(0, 3), ['who', 'who', 'dossier'], 'straight to the full read');
  assert.equal(mem.scanParser.buybacks, PARSER_VERSION, 'and read again: no longer stale');
});

test('check 4: a sync owed makes it a full read, and the sync goes only at its end', async () => {
  const r = await scannedAndSynced();
  mem.siteLink.syncedScan = 'an older scan';
  const rec = await r.autoScan();
  assert.equal(asked[1], 'who', 'no quick check: straight to the full read');
  assert.deepEqual(asked.slice(0, 4), ['who', 'who', 'dossier', 'hangar:1']);
  assert.equal(site.length, 1);
  assert.equal(site[0].path, '/api/v1/sync');
  assert.equal(rec.line, 'quick', 'it read everything and nothing was different');
  assert.equal(mem.siteLink.syncedScan, OH.syncStamp(mem.db), 'what it saved is synced');
});

test("a sync the website refuses with a status isn't sent again until the scan changes; a 429 is", async () => {
  const r = await scannedAndSynced();
  mem.siteLink.syncedScan = 'an older scan';
  syncAnswer = () => Response.json({ reason: 'older-scan' }, { status: 409 });
  const rec = await r.autoScan();
  assert.equal(rec.syncTried, OH.syncStamp(mem.db), 'refused: tried');
  assert.equal(mem.autoDaily.syncTried, rec.syncTried);
  asked = [];
  site = [];
  const again = await r.autoScan();
  assert.deepEqual(asked, ['who', 'hangar:1', 'buybacks:1'], 'not owed any more: a quick check');
  assert.deepEqual(site, []);
  assert.equal(again.syncTried, rec.syncTried);
  // Too soon (429): owed still, sent again next time.
  const s = await scannedAndSynced();
  mem.siteLink.syncedScan = 'an older scan';
  syncAnswer = () => Response.json({ reason: 'too-soon' }, { status: 429 });
  const soon = await s.autoScan();
  assert.equal(soon.syncTried, null);
});

// --- Its local checks, and who is signed in ---------------------------------------------

test('paused, or the live hangar another account this link does not sync: 0 requests', async () => {
  for (const sources of [{ autoScan: { enabled: false } }, { hangar: { minVersion: '9.0.0' } }]) {
    const r = await scannedAndSynced();
    mem.remoteStatus = { at: Date.now(), data: { sources } };
    const rec = await r.autoScan();
    assert.equal(rsiAsked(), 0, JSON.stringify(sources));
    assert.equal(rec.line, 'paused');
    assert.deepEqual(site, []);
  }
  const r = await scannedAndSynced();
  mem.siteLink.accounts = [{ handle: 'Someone_Else', record: null }];
  const rec = await r.autoScan();
  assert.equal(rsiAsked(), 0);
  assert.equal(rec.line, 'other');
  assert.deepEqual(site, []);
});

test("signed out: RSI's sign-in cookie gone means 0 requests; else one read says so", async () => {
  const r = await scannedAndSynced();
  cookie = 'out';
  const rec = await r.autoScan();
  assert.equal(rsiAsked(), 0, 'the cookie said so: RSI not asked');
  assert.equal(rec.line, 'signed-out');
  cookie = null; // can't tell: RSI is asked
  rsi.who = null;
  const one = await r.autoScan();
  assert.deepEqual(asked, ['who']);
  assert.equal(one.line, 'signed-out');
  assert.deepEqual(site, []);
});

test('another RSI account signed in: one request, never a switch, the live hangar as it was', async () => {
  const r = await scannedAndSynced();
  const was = { db: structuredClone(mem.db), account: structuredClone(mem.account) };
  const switches = [];
  const keep = OH.switchProfile;
  OH.switchProfile = async (...a) => (switches.push(a), keep(...a));
  try {
    rsi.who = 'Other_Pilot';
    const rec = await r.autoScan();
    assert.deepEqual(asked, ['who']);
    assert.equal(rec.line, 'other');
    assert.deepEqual(switches, [], 'never switches accounts');
    assert.deepEqual(mem.db, was.db);
    assert.deepEqual(mem.account, was.account);
    assert.deepEqual(site, []);
  } finally {
    OH.switchProfile = keep;
  }
});

// The account check (owner, 2026-11-01): by UEE Citizen Record when this browser kept one
// for its last-scanned account, else by handle; never an account the link merely knows.
test('the account check: the Citizen Record decides when both sides have one', async () => {
  // A changed handle, the same record: the same account, so it goes on.
  let r = await scannedAndSynced();
  mem.account = { ...mem.account, citizenRecord: '#1234' };
  rsi.who = 'New_Handle';
  rsi.records = { New_Handle: '#1234' };
  let rec = await r.autoScan();
  assert.deepEqual(asked.slice(0, 2), ['who', 'dossier'], 'who, then their record');
  assert.notEqual(rec.line, 'other');
  // The same handle, another record: not the same account; nothing more is read.
  r = await scannedAndSynced();
  mem.account = { ...mem.account, citizenRecord: '#1234' };
  rsi.records = { Test_Pilot: '#9999' };
  rec = await r.autoScan();
  assert.deepEqual(asked, ['who', 'dossier']);
  assert.equal(rec.line, 'other');
  assert.deepEqual(site, []);
  // The link's synced record counts too, when the cached account is another handle's.
  r = await scannedAndSynced();
  mem.account = { ...mem.account, nickname: 'Someone', citizenRecord: '#5' };
  mem.siteLink.accounts = [{ handle: 'Test_Pilot', record: '1234' }];
  rsi.records = { Test_Pilot: '#9999' };
  assert.equal((await r.autoScan()).line, 'other');
});

test("the account check: RSI didn't show the record, so the handle decides", async () => {
  let r = await scannedAndSynced();
  mem.account = { ...mem.account, citizenRecord: '#1234' };
  rsi.records = {}; // the dossier answers 404
  let rec = await r.autoScan();
  assert.notEqual(rec.line, 'other', 'the same handle');
  r = await scannedAndSynced();
  mem.account = { ...mem.account, citizenRecord: '#1234' };
  rsi.who = 'New_Handle';
  rsi.records = {};
  rec = await r.autoScan();
  assert.deepEqual(asked, ['who', 'dossier']);
  assert.equal(rec.line, 'other', 'a changed handle with no record: skipped');
});

test('never scanned in this browser: nothing to check against, so 0 requests', async () => {
  const r = await scannedAndSynced();
  mem.db = { ...mem.db, owner: null };
  const rec = await r.autoScan();
  assert.equal(rsiAsked(), 0);
  assert.equal(rec.line, 'other');
  assert.deepEqual(site, []);
});

test('no retries: a 5xx or no answer on a page ends the run at once', async () => {
  const r = await scannedAndSynced();
  delete mem.autoDailyFull; // a full read
  rsi.fail = (kind) => (kind === 'hangar:2' ? new Response('', { status: 503 }) : null);
  const rec = await r.autoScan();
  assert.equal(asked.filter((k) => k === 'hangar:2').length, 1, 'asked once');
  assert.equal(rec.line, 'partway');
});

test('who is signed in gets no answer: a quiet end, and the next run backs off', async () => {
  const r = await scannedAndSynced();
  rsi.fail = (kind) =>
    kind === 'who' ? new Response('', { status: 429, headers: { 'retry-after': '120' } }) : null;
  const rec = await r.autoScan();
  assert.deepEqual(asked, ['who'], 'a 429 is never retried');
  assert.equal(rec.line, 'rsi-down', 'RSI not answering before anything was read: its own line');
  assert.equal(rec.fails, 1);
  assert.equal(rec.retryAt, rec.ended + DAY);
  // In a row: twice the wait. Then an answer resets it.
  const two = await r.autoScan();
  assert.equal(two.fails, 2);
  assert.equal(two.retryAt, two.ended + 2 * DAY);
  rsi.fail = null;
  const ok = await r.autoScan();
  assert.equal(ok.fails, 0);
  assert.equal(ok.retryAt, null);
  assert.equal(ok.line, 'quick');
});

test('the quick check: page 1 of the hangar different reads in full, without peeking at buy-backs', async () => {
  const r = await scannedAndSynced();
  rsi.hangar = [...pledges(1, 900), ...rsi.hangar];
  const rec = await r.autoScan();
  assert.deepEqual(asked.slice(0, 5), ['who', 'hangar:1', 'who', 'dossier', 'hangar:1']);
  assert.equal(rec.line, 'full');
  assert.equal(mem.db.sources.hangar.items.length, 26);
  assert.deepEqual(mem.scanStarted, {
    run: 'run-auto-1',
    by: 'offscreen',
    reason: 'auto',
    at: rec.startedAt,
  });
  assert.equal(rec.run, 'run-auto-1');
  assert.equal(site.length, 1, 'what it saved is synced');
  // A part due (its last complete read gone): the full read, with no peek at all.
  delete mem.autoDailyFull;
  asked = [];
  await r.autoScan();
  assert.deepEqual(asked.slice(0, 4), ['who', 'who', 'dossier', 'hangar:1']);
});

test('who is signed in answers a 5xx: the same line, and the next run backs off', async () => {
  const r = await scannedAndSynced();
  rsi.fail = (kind) => (kind === 'who' ? new Response('', { status: 503 }) : null);
  const rec = await r.autoScan();
  assert.equal(rec.line, 'rsi-down', 'RSI not answering before anything was read: its own line');
  assert.equal(rec.fails, 1);
  assert.equal(rec.retryAt, rec.ended + DAY);
});

test('the quick check sees a sign-in page: signed out; no answer: a quiet end with backoff', async () => {
  const r = await scannedAndSynced();
  rsi.fail = (kind) => (kind === 'hangar:1' ? new Response(`[]${SIGN_IN}`) : null);
  assert.equal((await r.autoScan()).line, 'signed-out');
  rsi.fail = (kind) =>
    kind === 'buybacks:1'
      ? new Response('', { status: 503, headers: { 'retry-after': '60' } })
      : null;
  const quiet = await r.autoScan();
  assert.equal(quiet.line, 'rsi-down', 'RSI not answering: its own line');
  assert.equal(quiet.fails, 1);
  assert.deepEqual(site, []);
});

// --- Part by part -----------------------------------------------------------------------

// The full read, each part's last complete read gone (so no quick check).
async function fullRun(setup) {
  const r = await scannedAndSynced(setup);
  delete mem.autoDailyFull;
  const before = structuredClone(mem);
  return { r, before };
}

test('RSI stops answering on hangar page 3: nothing saved, nothing more read, partway', async () => {
  const { r, before } = await fullRun({ hangar: pledges(25) });
  rsi.hangar = [...pledges(1, 900), ...rsi.hangar];
  const date = new Date(Date.now() + 2 * 3600e3).toUTCString();
  rsi.fail = (kind) =>
    kind === 'hangar:3'
      ? new Response('', { status: 429, headers: { 'retry-after': date } })
      : null;
  const rec = await r.autoScan();
  assert.equal(asked.filter((k) => k === 'hangar:3').length, 1, 'never retried');
  assert.ok(!asked.some((k) => k.startsWith('buybacks:')), 'no buy-backs asked for');
  assert.deepEqual(mem.db, before.db, 'the hangar it had stays');
  assert.equal(stamps().hangar, undefined, 'due next time');
  assert.equal(rec.line, 'partway');
  assert.equal(rec.fails, 1);
  assert.equal(rec.retryAt, rec.ended + DAY, 'a day (a Retry-After 2 hours out is sooner)');
  assert.deepEqual(site, [], 'nothing saved: nothing to sync');
});

test('buy-backs cut short after the hangar was kept: the hangar stays and syncs', async () => {
  const { r } = await fullRun();
  rsi.hangar = [...pledges(1, 900), ...rsi.hangar];
  rsi.fail = (kind) => (kind === 'buybacks:1' ? new Response('', { status: 429 }) : null);
  const rec = await r.autoScan();
  assert.equal(mem.db.sources.hangar.items.length, 26, 'the new hangar kept');
  assert.equal(stamps().hangar, mem.db.sources.hangar.scannedAt);
  assert.equal(stamps().buybacks, undefined);
  assert.equal(stamps().referral, undefined);
  assert.ok(!asked.some((k) => k.startsWith('referrals:')));
  assert.equal(rec.line, 'partway');
  assert.equal(site.length, 1, 'the hangar it kept is synced');
});

test('a sign-in page partway through the hangar: not saved, signed out partway', async () => {
  const { r, before } = await fullRun();
  rsi.fail = (kind) => (kind === 'hangar:2' ? new Response(`[]${SIGN_IN}`) : null);
  const rec = await r.autoScan();
  assert.deepEqual(mem.db.sources.hangar, before.db.sources.hangar);
  assert.equal(rec.line, 'out-partway', 'its own line: the pilot signed out, RSI did answer');
  assert.equal(stamps().hangar, undefined);
});

test('another account by the end of buy-backs: not saved, referrals not read, bad', async () => {
  const { r, before } = await fullRun({ recruits: [{ id: 'r1', nickname: 'Recruit' }] });
  rsi.buybacks = [...buybacks(1, 50), ...rsi.buybacks];
  // The dashboard: the run's start, its account read, after the hangar, after buy-backs.
  rsi.who = (n) => (n >= 4 ? 'Other_Pilot' : 'Test_Pilot');
  const rec = await r.autoScan();
  assert.equal(rec.line, 'bad');
  assert.deepEqual(mem.db.sources.buybacks, before.db.sources.buybacks, 'buy-backs not kept');
  assert.equal(
    mem.db.sources.hangar.scannedAt > before.db.sources.hangar.scannedAt,
    true,
    'the hangar was',
  );
  assert.ok(!asked.some((k) => k.startsWith('referrals:')), 'nothing more read');
  assert.equal(mem.account.nickname, 'Test_Pilot', "the account cache never the other one's");
  assert.equal(stamps().buybacks, undefined);
  assert.equal(stamps().referral, undefined);
});

test('the account check after a part gets no answer: that part not saved, partway', async () => {
  const { r, before } = await fullRun();
  rsi.fail = (kind, n) =>
    kind === 'who' && n === 3
      ? new Response('', { status: 503, headers: { 'retry-after': '30' } })
      : null;
  const rec = await r.autoScan();
  assert.equal(rec.line, 'partway');
  assert.equal(rec.fails, 1);
  assert.deepEqual(mem.db.sources.hangar, before.db.sources.hangar);
  assert.equal(stamps().hangar, undefined);
});

test('a sudden drop with nothing to explain it: buy-backs kept, the hangar not, referrals read, bad', async () => {
  const { r, before } = await fullRun({ hangar: pledges(30) });
  rsi.hangar = pledges(10); // 20 gone
  const rec = await r.autoScan();
  assert.equal(rec.line, 'bad');
  assert.deepEqual(
    mem.db.sources.hangar.items,
    before.db.sources.hangar.items,
    'the hangar kept as it was',
  );
  assert.ok(
    mem.db.sources.buybacks.scannedAt > before.db.sources.buybacks.scannedAt,
    'buy-backs read first, kept',
  );
  assert.ok(
    asked.some((k) => k.startsWith('referrals:')),
    'referrals still read',
  );
  assert.equal(stamps().hangar, undefined);
  assert.equal(stamps().buybacks, mem.db.sources.buybacks.scannedAt);
  assert.ok(
    asked.indexOf('buybacks:1') < asked.lastIndexOf('who'),
    'buy-backs before the hangar was judged',
  );
});

test('a drop that new buy-backs explain: both kept, the pledges gone archived', async () => {
  const { r } = await fullRun({ hangar: pledges(30), bbs: buybacks(2) });
  rsi.hangar = pledges(10);
  rsi.buybacks = [...buybacks(20, 100), ...rsi.buybacks]; // melted: 20 new buy-backs
  const rec = await r.autoScan();
  assert.equal(rec.line, 'full');
  assert.equal(mem.db.sources.hangar.items.length, 10);
  assert.equal(mem.db.sources.buybacks.items.length, 22);
  assert.equal(Object.keys(mem.pledgeArchive).length, 20, 'gone pledges archived');
  assert.equal(stamps().hangar, mem.db.sources.hangar.scannedAt);
});

test('a drop, and buy-backs cut short: neither kept, partway', async () => {
  const { r, before } = await fullRun({ hangar: pledges(30) });
  rsi.hangar = pledges(10);
  rsi.fail = (kind) => (kind === 'buybacks:1' ? 'network' : null);
  const rec = await r.autoScan();
  assert.equal(rec.line, 'partway');
  assert.deepEqual(mem.db.sources.hangar, before.db.sources.hangar);
  assert.deepEqual(mem.db.sources.buybacks, before.db.sources.buybacks);
  assert.equal(stamps().hangar, undefined);
  assert.equal(stamps().buybacks, undefined);
});

test('referrals cut short: not merged, not saved, partway', async () => {
  const recruits = Array.from({ length: 60 }, (_, i) => ({ id: `r${i}`, nickname: `R${i}` }));
  const { r, before } = await fullRun({ recruits });
  rsi.fail = (kind) => (kind === 'referrals:1/true/2' ? new Response('', { status: 429 }) : null);
  const rec = await r.autoScan();
  assert.equal(rec.line, 'partway');
  assert.deepEqual(mem.db.sources.referral, before.db.sources.referral);
  assert.equal(stamps().referral, undefined);
  assert.equal(stamps().hangar, mem.db.sources.hangar.scannedAt, 'the parts before it stand');
});

test('something breaks midway: its marks go, and its record says partway', async () => {
  const { r } = await fullRun();
  const keep = OH.scanSource;
  OH.scanSource = async () => {
    throw new Error('the page broke');
  };
  try {
    const rec = await r.autoScan();
    assert.equal(rec.line, 'partway');
    assert.equal(sess.scanRunning, undefined);
    assert.equal(sess.scanProgress, undefined);
    assert.equal(mem.autoDaily.run, mem.scanStarted.run);
    assert.equal(mem.autoDaily.startedAt, mem.scanStarted.at, 'it pairs with its start');
  } finally {
    OH.scanSource = keep;
  }
});

// --- Its start, its record and its sync ---------------------------------------------------

test('the record is written before the sync; no wishlist import, packs or scan report', async () => {
  const { r, before } = await fullRun({ bbs: [{ id: '7001', name: 'Pack', kind: 'pack' }] });
  OH.flags = { wishlistImport: true, autoScanRun: true };
  mem.wishlist = ['Gladius'];
  rsi.hangar = [...pledges(1, 900), ...rsi.hangar];
  const rec = await r.autoScan();
  await r.packsDone();
  assert.deepEqual(
    site.map((s) => s.path),
    ['/api/v1/sync'],
    'no wishlist import after it',
  );
  assert.equal(site[0].autoScan.ended, rec.ended, 'its record was there when the sync went');
  assert.equal(site[0].autoScan.line, 'full');
  assert.ok(
    !asked.some((k) => /^\/en\/account\/buy-back-pledge\b|pledge\/\d/.test(k)),
    'no pack reads',
  );
  assert.deepEqual(mem.scanReport, before.scanReport, 'no scan report');
  assert.equal(mem.wishImport, undefined);
});

test('a sync kept for the end of the run goes then, even after a quick check', async () => {
  const r = await scannedAndSynced();
  sess.syncAfterScan = { at: Date.now(), auto: false }; // Sync Now pressed meanwhile
  await r.autoScan();
  assert.deepEqual(
    site.map((s) => s.path),
    ['/api/v1/sync'],
  );
  assert.equal(sess.syncAfterScan, undefined);
});

test('switched off midway: it stops at the next part, and what it kept syncs', async () => {
  const { r } = await fullRun();
  rsi.hangar = [...pledges(1, 900), ...rsi.hangar];
  rsi.fail = (kind) => {
    if (kind === 'hangar:2') mem.autoDailyOn = false;
    return null;
  };
  await r.autoScan();
  assert.equal(mem.db.sources.hangar.items.length, 26, 'the part it was reading finished');
  assert.ok(!asked.some((k) => k.startsWith('buybacks:')), 'nothing after it');
  assert.equal(site.length, 1);
});

test('disconnected midway: it stops at the next part, and nothing is sent', async () => {
  const { r } = await fullRun();
  rsi.hangar = [...pledges(1, 900), ...rsi.hangar];
  rsi.fail = (kind) => {
    if (kind === 'hangar:2') delete mem.siteLink;
    return null;
  };
  await r.autoScan();
  assert.ok(!asked.some((k) => k.startsWith('buybacks:')));
  assert.deepEqual(site, [], 'no sync after a disconnect');
  assert.ok(mem.autoDaily, 'its record is kept');
});

test('switched off or not connected when it starts: nothing at all, no record', async () => {
  const r = await scannedAndSynced();
  mem.autoDailyOn = false;
  assert.equal(await r.autoScan(), null);
  assert.equal(rsiAsked(), 0);
  assert.equal(mem.autoDaily, undefined);
});

test("a pressed Scan notes the parts it read whole; one cut short isn't", async () => {
  const r = await scannedAndSynced();
  for (const p of ['hangar', 'buybacks', 'referral'])
    assert.equal(stamps()[p], mem.db.sources[p].scannedAt, p);
  // A hangar RSI stopped answering for partway (nothing saved) and buy-backs that failed.
  delete mem.autoDailyFull;
  const was = mem.db.sources.hangar;
  rsi.hangar = pledges(35);
  rsi.fail = (kind) =>
    kind === 'hangar:4'
      ? 'network'
      : kind === 'buybacks:1'
        ? new Response('', { status: 401 })
        : null;
  const report = await r.scan({ reason: 'popup' });
  assert.equal(report.rows[0].ok, false);
  assert.deepEqual(mem.db.sources.hangar.items, was.items, 'the last full scan stays');
  assert.equal(report.rsiDown, true, 'RSI did not answer: the report says so');
  assert.equal(report.rows[1].ok, false);
  assert.deepEqual(Object.keys(stamps()), ['referral']);
});

test('a part the status file pauses is skipped; the others are read and kept', async () => {
  const r = await scannedAndSynced();
  mem.remoteStatus = { at: Date.now(), data: { sources: { referrals: { enabled: false } } } };
  rsi.hangar = [...pledges(1, 900), ...rsi.hangar];
  const rec = await r.autoScan();
  assert.equal(rec.line, 'full');
  assert.ok(!asked.some((k) => k.startsWith('referrals:')), 'referrals paused');
  assert.ok(asked.includes('buybacks:1'));
  // Buy-backs paused: the quick check counts them as the same, and doesn't ask.
  const q = await scannedAndSynced();
  mem.remoteStatus = { at: Date.now(), data: { sources: { buybacks: { enabled: false } } } };
  assert.equal((await q.autoScan()).line, 'quick');
  assert.deepEqual(asked, ['who', 'hangar:1']);
});

test('signed out at the start: nothing read, and a sync owed still goes', async () => {
  const r = await scannedAndSynced();
  mem.siteLink.syncedScan = 'an older scan';
  cookie = 'out';
  const rec = await r.autoScan();
  assert.equal(rec.line, 'signed-out');
  assert.equal(rsiAsked(), 0);
  assert.deepEqual(
    site.map((s) => s.path),
    ['/api/v1/sync'],
    'the saved scan whose sync never went out',
  );
});

test("a page it can't read, or a save that fails: partway, and the part is due", async () => {
  const { r, before } = await fullRun();
  rsi.fail = (kind) => (kind === 'hangar:1' ? new Response('', { status: 403 }) : null);
  const rec = await r.autoScan();
  assert.equal(rec.line, 'partway');
  assert.equal(rec.fails, 1, 'RSI answered, but it stopped partway: it backs off too');
  assert.equal(rec.retryAt, rec.ended + DAY);
  assert.deepEqual(mem.db, before.db);
  // The storage write for the hangar fails.
  const f = await fullRun();
  rsi.hangar = [...pledges(1, 900), ...rsi.hangar];
  const set = chrome.storage.local.set;
  chrome.storage.local.set = async (o) => {
    if ('db' in o) throw new Error('QUOTA_BYTES quota exceeded');
    return set(o);
  };
  try {
    const failed = await f.r.autoScan();
    assert.equal(failed.line, 'partway');
    assert.equal(stamps().hangar, undefined);
    assert.ok(!asked.some((k) => k.startsWith('buybacks:')));
  } finally {
    chrome.storage.local.set = set;
  }
});

test('signed out by the end of a part: not kept, signed out partway, and it backs off like any partway', async () => {
  const { r, before } = await fullRun();
  rsi.who = (n) => (n >= 3 ? null : 'Test_Pilot');
  const rec = await r.autoScan();
  assert.equal(rec.line, 'out-partway');
  assert.equal(rec.fails, 1);
  assert.equal(rec.retryAt, rec.ended + DAY, 'a day: about when the next run is due anyway');
  assert.deepEqual(mem.db.sources.hangar, before.db.sources.hangar);
});

test('a referrals 4xx two runs in a row backs off two days, not a full read every day', async () => {
  const { r } = await fullRun();
  rsi.fail = (kind) => (kind.startsWith('referrals:') ? new Response('', { status: 400 }) : null);
  const one = await r.autoScan();
  assert.equal(one.line, 'partway');
  assert.equal(one.fails, 1);
  assert.equal(one.retryAt, one.ended + DAY);
  assert.equal(stamps().referral, undefined, 'due: the next run reads in full');
  const two = await r.autoScan();
  assert.equal(two.line, 'partway');
  assert.equal(two.fails, 2, 'it counts like RSI not answering');
  assert.equal(two.retryAt, two.ended + 2 * DAY);
  // RSI's page mended: a run that finishes ends the backoff.
  rsi.fail = null;
  const ok = await r.autoScan();
  assert.equal(ok.fails, 0);
  assert.equal(ok.retryAt, null);
  assert.ok(['quick', 'full'].includes(ok.line), ok.line);
});

test('a signed-out day after a partway run still asks; a scan that saves ends the ask', async () => {
  const { autoAsk, autoLine } = await import('../ui/popup/data.js');
  const ask = () =>
    autoAsk({ on: true, rec: mem.autoDaily, scannedAt: mem.db.sources.hangar.scannedAt });
  const { r } = await fullRun();
  rsi.hangar = [...pledges(1, 900), ...rsi.hangar];
  rsi.fail = (kind) => (kind === 'hangar:3' ? new Response('', { status: 429 }) : null);
  const partway = await r.autoScan();
  assert.equal(partway.line, 'partway');
  assert.equal(ask(), true);
  rsi.fail = null;
  // Signed out the next day (the cookie, or RSI says so): the ask stays.
  for (const how of ['cookie', 'rsi']) {
    if (how === 'cookie') cookie = 'out';
    else [cookie, rsi.who] = [null, null];
    const skipped = await r.autoScan();
    assert.equal(skipped.line, 'partway', how);
    assert.equal(skipped.at, partway.at, `${how}: the time of the run that asked`);
    assert.equal(ask(), true, `${how}: the Settings dot stays`);
    assert.equal(autoLine({ on: true, rec: skipped }, Date.now()).ask, true, `${how}: amber`);
  }
  // A pressed Scan saves: the ask ends, and the next skipped day says so itself.
  [cookie, rsi.who] = ['in', 'Test_Pilot'];
  await new Promise((done) => realTimeout(done, 2)); // its save a moment after that run
  await r.scan({ reason: 'popup' });
  await r.packsDone();
  assert.equal(ask(), false, 'a scan saved since');
  cookie = 'out';
  const after = await r.autoScan();
  assert.equal(after.line, 'signed-out');
  assert.equal(ask(), false);
  // And a later run that saves ends it too.
  cookie = 'in';
  rsi.hangar = [...pledges(1, 901), ...rsi.hangar]; // something new: a full read
  rsi.fail = (kind) => (kind === 'hangar:3' ? new Response('', { status: 429 }) : null);
  assert.equal((await r.autoScan()).line, 'partway');
  rsi.fail = null;
  const full = await r.autoScan();
  assert.ok(['quick', 'full'].includes(full.line), full.line);
  assert.equal(ask(), false);
});

test('a Retry-After over a day holds: 2 days for 2, 4 days for 10', async () => {
  const r = await scannedAndSynced();
  const wait = (s) => (kind) =>
    kind === 'who' ? new Response('', { status: 429, headers: { 'retry-after': s } }) : null;
  rsi.fail = wait(String(2 * 86400));
  const two = await r.autoScan();
  assert.equal(two.fails, 1);
  assert.equal(two.retryAt, two.ended + 2 * DAY, 'not cut to a day');
  rsi.fail = wait(String(10 * 86400));
  const ten = await r.autoScan();
  assert.equal(ten.retryAt, ten.ended + 4 * DAY, 'its own 4-day cap');
});

test('a part being read is due until it is kept: a browser closing then reads it in full next', async () => {
  const run = await scannedAndSynced(); // every part's last complete read noted
  rsi.hangar = [...pledges(1, 900), ...rsi.hangar];
  let during = null;
  rsi.fail = (kind) => {
    if (kind === 'hangar:2') during = structuredClone(mem.autoDailyFull);
    return null;
  };
  await run.autoScan();
  assert.equal(during.hangar, undefined, 'the hangar due while it was read');
  assert.ok(during.buybacks, 'the parts not begun stand');
  assert.equal(stamps().hangar, mem.db.sources.hangar.scannedAt, 'kept: it stands again');
});

test('Clear Data turns Auto Scan Daily off and forgets its runs and starts', async () => {
  const r = await scannedAndSynced();
  await r.autoScan();
  mem.autoDailyNext = Date.now() + 3600e3;
  for (const k of ['autoDaily', 'autoDailyOn', 'autoDailyFull', 'scanStarted'])
    assert.ok(k in mem, k);
  await OH.clearData();
  for (const k of ['autoDaily', 'autoDailyOn', 'autoDailyNext', 'autoDailyFull', 'scanStarted'])
    assert.equal(mem[k], undefined, k);
});

// --- Check 10 -----------------------------------------------------------------------------

test('check 10: every part not saved ends with bad or partway and no last complete read', async () => {
  const cases = [
    (kind) => (kind === 'hangar:2' ? new Response('', { status: 429 }) : null),
    (kind) => (kind === 'buybacks:1' ? 'network' : null),
    (kind) => (kind === 'referrals:1/true/1' ? new Response('', { status: 429 }) : null),
  ];
  for (const fail of cases) {
    const { r, before } = await fullRun();
    rsi.hangar = [...pledges(1, 900), ...rsi.hangar];
    rsi.fail = fail;
    const rec = await r.autoScan();
    assert.ok(['bad', 'partway'].includes(rec.line), rec.line);
    for (const p of ['hangar', 'buybacks', 'referral']) {
      const saved = mem.db.sources[p]?.scannedAt !== before.db.sources[p]?.scannedAt;
      if (!saved) assert.equal(stamps()[p], undefined, `${p} not saved: due`);
    }
  }
  // And the popup asks (ui/popup/data.js autoAsk) until a scan saves since.
  const { autoAsk, autoLine } = await import('../ui/popup/data.js');
  const rec = mem.autoDaily;
  assert.equal(autoAsk({ on: true, rec, scannedAt: mem.db.sources.hangar.scannedAt }), true);
  assert.equal(autoLine({ on: true, rec }, rec.at).ask, true);
  assert.equal(autoAsk({ on: true, rec, scannedAt: rec.ended + 1 }), false);
});

// #672: a page the parser rules no longer fit (OpenHangar.pageChanged, #759) keeps the last
// good scan, for the hangar and buy-backs, in the quick check's follow-up read and in the
// full read, and syncs nothing.
test('a page RSI changed: the last good hangar and buy-backs stay, nothing is synced', async () => {
  OpenHangar.pageChanged = (html) => (html.includes('CHANGED') ? ['no pledge date reads'] : []);
  try {
    const changedHangar = (page) => (kind) =>
      kind === `hangar:${page}` ? new Response('[]<p>CHANGED</p>') : null;
    const cases = [
      ['hangar page 1', { hangar: pledges(25) }, changedHangar(1), true],
      ['hangar page 2', { hangar: pledges(25) }, changedHangar(2), true],
      [
        'buy-backs page 1',
        { hangar: pledges(25), bbs: buybacks(3) },
        (kind) =>
          kind === 'buybacks:1' ? new Response('{"items":[],"tokens":2}<p>CHANGED</p>') : null,
        false,
      ],
    ];
    for (const [name, setup, fail, hangarChanges] of cases) {
      const { r, before } = await fullRun(setup);
      // Something differs from the saved scan, so the quick check goes on to read in full.
      if (hangarChanges) rsi.hangar = [...pledges(1, 900), ...rsi.hangar];
      else rsi.buybacks = [...buybacks(1, 900), ...rsi.buybacks];
      rsi.fail = fail;
      const rec = await r.autoScan();
      assert.equal(rec.line, 'partway', name);
      const part = hangarChanges ? 'hangar' : 'buybacks';
      assert.deepEqual(
        mem.db.sources[part],
        before.db.sources[part],
        `${name}: the last good scan, as it was`,
      );
      assert.equal(stamps()[part], undefined, `${name}: not counted as read`);
      // The hangar read whole before buy-backs may sync; a changed page itself never does.
      if (hangarChanges) assert.deepEqual(site, [], `${name}: nothing synced`);
    }
    // The quick check alone only reads: a changed page 1 writes nothing but its record.
    const { r, before } = await fullRun({ hangar: pledges(25) });
    mem.autoDailyFull = before.scanFull ?? {};
    rsi.fail = (kind) => (kind === 'hangar:1' ? new Response('[]<p>CHANGED</p>') : null);
    await r.autoScan();
    assert.deepEqual(mem.db, before.db);
    assert.deepEqual(site, []);
  } finally {
    delete OpenHangar.pageChanged;
  }
});

test('Account History on: a full read reads only the newest log lines; a quick check none', async () => {
  const r = await scannedAndSynced();
  const asks = [];
  const keep = OH.readAccountLogs;
  OH.readAccountLogs = async (o) => (asks.push(o), { ok: true, parts: {} });
  OH.flags = { ...OH.flags, accountLogs: true };
  try {
    // Nothing new: the quick check stops there, no log read.
    await r.autoScan();
    assert.equal(asks.length, 0);
    // A full read: one daily-only read, paced like every request of the run.
    delete mem.autoDailyFull;
    await r.autoScan();
    assert.equal(asks.length, 1);
    assert.equal(asks[0].dailyOnly, true);
    assert.equal(asks[0].pause, OH.autoPause);
  } finally {
    OH.readAccountLogs = keep;
  }
});
