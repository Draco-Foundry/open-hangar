'use strict';
// Auto Scan Daily (#666): its rules (ui/scan/auto.js), the worker that keeps its time
// (src/background.js, the `autoScan` flag's block, in the sandbox of test/bridge-env.js)
// and the privacy notes' check 6: only store alerts and Auto Scan Daily use alarms, and
// Auto Scan Daily never notifies. The run itself is test/auto-scan-runner.test.js.
// Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CHROME_ID, cutFlags, loadBackground } = require('./bridge-env.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const auto = () => import('../ui/scan/auto.js');
const H = 3600e3;
const MIN = 60e3;
const DAY = 24 * H;
// OH.retryAfterMs (src/lib.js): the other callers' parse, capped at a day. Auto Scan
// Daily's backoff has its own (ui/scan/auto.js retryAfterMs), capped at its 4 days.
global.window = globalThis;
global.chrome = { storage: { local: { get: async () => ({}), set: async () => {} } } };
require('../src/lib.js');
const ohRetryAfterMs = globalThis.OH.retryAfterMs;

// --- The rules (ui/scan/auto.js) ---------------------------------------------------------

test('fullDue: a part whose last complete read no longer stands, a week, a clock gone back', async () => {
  const { fullDue } = await auto();
  const NOW = 100 * DAY;
  const db = (at = NOW - DAY) => ({
    sources: {
      hangar: { scannedAt: at },
      buybacks: { scannedAt: at + 1 },
      referral: { scannedAt: at + 2 },
    },
  });
  const full = (at = NOW - DAY) => ({ hangar: at, buybacks: at + 1, referral: at + 2 });
  assert.equal(fullDue(full(), db(), new Set(), NOW), false, 'all stand, a day old');
  // A part missing its stamp, or one that isn't its saved scan time (a scan stopped
  // short, an import, another account's hangar since): due.
  assert.equal(fullDue({ hangar: NOW - DAY, buybacks: NOW - DAY + 1 }, db(), new Set(), NOW), true);
  assert.equal(fullDue({ ...full(), buybacks: 5 }, db(), new Set(), NOW), true);
  assert.equal(fullDue({ ...full(), hangar: String(NOW - DAY) }, db(), new Set(), NOW), true);
  assert.equal(fullDue(null, db(), new Set(), NOW), true);
  assert.equal(fullDue(full(), { sources: {} }, new Set(), NOW), true, 'Clear Data');
  // A week, to the millisecond.
  const week = NOW - 7 * DAY;
  assert.equal(fullDue(full(week + 1), db(week + 1), new Set(), NOW), false);
  assert.equal(fullDue(full(week), db(week), new Set(), NOW), true);
  // The clock went back: a stamp from the future.
  assert.equal(fullDue(full(NOW + H), db(NOW + H), new Set(), NOW), true);
  // A part the status file pauses doesn't count.
  const noRef = { hangar: NOW - DAY, buybacks: NOW - DAY + 1 };
  assert.equal(fullDue(noRef, db(), new Set(['referral']), NOW), false);
  // A sync owed makes it a full read (the quick check never sends).
  assert.equal(fullDue(full(), db(), new Set(), NOW, { owed: true }), true);
  // A part an older parser read is due (#728), unless the status file pauses it.
  assert.equal(fullDue(full(), db(), new Set(), NOW, { stale: new Set(['buybacks']) }), true);
  assert.equal(
    fullDue(full(), db(), new Set(['buybacks']), NOW, { stale: new Set(['buybacks']) }),
    false,
  );
});

test('owedSync: a saved scan whose sync never went out', async () => {
  const { owedSync } = await auto();
  const link = { lastSync: 1, syncedScan: '5|6|7' };
  assert.equal(owedSync({ stamp: '5|6|7', link }), false, 'the one synced');
  assert.equal(owedSync({ stamp: '8|6|7', link }), true, 'a newer scan');
  assert.equal(owedSync({ stamp: '8|6|7', link, rec: { syncTried: '8|6|7' } }), false, 'refused');
  // A link from before 0.4.0 (no syncedScan): owed only if it never synced.
  assert.equal(owedSync({ stamp: '8|6|7', link: { lastSync: 1 } }), false);
  assert.equal(owedSync({ stamp: '8|6|7', link: { lastSync: null } }), true);
  // Nothing scanned, or not connected: nothing owed.
  assert.equal(owedSync({ stamp: '|6|7', link: { lastSync: null } }), false);
  assert.equal(owedSync({ stamp: '8|6|7', link: null }), false);
});

test('syncTriedAfter: cleared once sent, the stamp after a refusal, else as it was', async () => {
  const { syncTriedAfter } = await auto();
  assert.equal(syncTriedAfter({ state: 'sent' }, 's', 'old'), null);
  assert.equal(syncTriedAfter({ state: 'error', status: 409 }, 's', 'old'), 's');
  assert.equal(syncTriedAfter({ state: 'calm', status: 403 }, 's', null), 's', 'not open yet');
  assert.equal(syncTriedAfter({ state: 'calm', status: 429 }, 's', 'old'), 'old', 'too soon');
  assert.equal(syncTriedAfter({ state: 'held' }, 's', 'old'), 'old');
  assert.equal(syncTriedAfter({ state: 'off' }, 's', null), null, "Firefox's no");
  assert.equal(syncTriedAfter({ state: 'error', msg: 'offline' }, 's', null), null);
});

test('bigDrop: an empty hangar over one, or 5 gone and 10% of it', async () => {
  const { bigDrop, DROP_MIN, DROP_SHARE } = await auto();
  assert.equal(DROP_MIN, 5);
  assert.equal(DROP_SHARE, 0.1);
  const at = (saved, gone) => bigDrop({ saved, gone, next: saved - gone });
  assert.equal(bigDrop({ saved: 0, gone: 0, next: 0 }), false, 'never anything');
  assert.equal(bigDrop({ saved: 0, gone: 0, next: 4 }), false);
  assert.equal(at(4, 3), false, '4 saved: under 5 gone');
  assert.equal(at(4, 4), true, 'empty over non-empty');
  assert.equal(at(5, 4), false);
  assert.equal(at(5, 5), true);
  assert.equal(at(20, 4), false);
  assert.equal(at(20, 5), true);
  assert.equal(at(500, 49), false);
  assert.equal(at(500, 50), true);
  assert.equal(at(1000, 99), false);
  assert.equal(at(1000, 100), true);
});

test('newBuybackIds and goneCount: by id; fallback ids and a first buy-back scan count none', async () => {
  const { newBuybackIds, goneCount } = await auto();
  const saved = [{ id: '1' }, { id: '2' }];
  const next = [{ id: '1' }, { id: '3' }, { id: 4 }, { id: 'buybacks-p1-7' }, { id: null }];
  assert.equal(newBuybackIds(saved, next), 2);
  assert.equal(newBuybackIds(null, next), 0, 'never scanned: nothing to compare with');
  assert.equal(goneCount([{ id: '1' }, { id: 2 }, { id: '3' }], [{ id: '2' }]), 2);
  assert.equal(goneCount([], [{ id: '1' }]), 0);
});

test('retryAtOf: doubles from a day, at most 4 days, never before Retry-After', async () => {
  const { retryAtOf } = await auto();
  const AT = Date.parse('2026-10-14T06:12:00Z');
  assert.equal(retryAtOf({ at: AT, fails: 0 }), null, 'the run finished');
  assert.equal(retryAtOf({ at: AT, fails: 1 }), AT + DAY);
  assert.equal(retryAtOf({ at: AT, fails: 2 }), AT + 2 * DAY);
  assert.equal(retryAtOf({ at: AT, fails: 3 }), AT + 4 * DAY);
  assert.equal(retryAtOf({ at: AT, fails: 9 }), AT + 4 * DAY, 'capped');
  // Retry-After longer than the backoff wins, as seconds or as a date.
  const later = new Date(AT + 30 * H).toUTCString();
  assert.equal(retryAtOf({ at: AT, fails: 1, retryAfter: later }), AT + 30 * H);
  const soon = new Date(AT + 2 * H).toUTCString();
  assert.equal(retryAtOf({ at: AT, fails: 1, retryAfter: soon }), AT + DAY);
  const custom = (v) => (v === 'big' ? 3 * DAY : 0);
  assert.equal(retryAtOf({ at: AT, fails: 1, retryAfter: 'big' }, custom), AT + 3 * DAY);
  assert.equal(retryAtOf({ at: AT, fails: 2, retryAfter: '60' }), AT + 2 * DAY);
  assert.equal(retryAtOf({ at: AT, fails: 1, retryAfter: 'soon' }), AT + DAY, 'unreadable');
});

test('retryAtOf: a Retry-After over a day holds, up to the 4-day cap', async () => {
  const { retryAtOf, retryAfterMs } = await auto();
  const AT = Date.parse('2026-10-14T06:12:00Z');
  // Two days, as seconds or as a date: held two days, not cut to one.
  assert.equal(retryAfterMs(String(2 * 86400), AT), 2 * DAY);
  assert.equal(retryAtOf({ at: AT, fails: 1, retryAfter: String(2 * 86400) }), AT + 2 * DAY);
  const date = new Date(AT + 2 * DAY).toUTCString();
  assert.equal(retryAtOf({ at: AT, fails: 1, retryAfter: date }), AT + 2 * DAY);
  // Ten days: its own cap, 4 days.
  assert.equal(retryAtOf({ at: AT, fails: 1, retryAfter: String(10 * 86400) }), AT + 4 * DAY);
  // The other callers' parse still stops at a day.
  assert.equal(ohRetryAfterMs(String(2 * 86400), AT), DAY);
});

test('lineOf: another account or a drop first, then partway, then whether anything changed', async () => {
  const { lineOf, LINES } = await auto();
  assert.equal(lineOf({ bad: true, partway: true, changed: true }), 'bad');
  assert.equal(lineOf({ bad: true, out: true }), 'bad');
  assert.equal(lineOf({ out: true, partway: true, changed: true }), 'out-partway');
  assert.equal(lineOf({ partway: true, changed: true }), 'partway');
  assert.equal(lineOf({ changed: true }), 'full');
  assert.equal(lineOf({}), 'quick', 'a full read that found nothing different: no changes');
  assert.deepEqual(LINES, [
    'quick',
    'full',
    'signed-out',
    'other',
    'paused',
    'bad',
    'out-partway',
    'partway',
    'rsi-down',
  ]);
});

test('connectedPilot: synced through this link, or its first with no other account here', async () => {
  const { connectedPilot } = await auto();
  assert.equal(connectedPilot('A', 'yes'), true);
  assert.equal(connectedPilot('A', 'first', [{ nickname: 'a' }]), true);
  assert.equal(connectedPilot('A', 'first', [{ nickname: 'A' }, { nickname: 'B' }]), false);
  assert.equal(connectedPilot('A', 'new'), false);
  assert.equal(connectedPilot('A', 'no'), false);
  assert.equal(connectedPilot('', 'yes'), false);
});

test('record: replaced whole; a run with no line keeps the last line and its time', async () => {
  const { record } = await auto();
  const was = {
    v: 1,
    at: 5,
    ended: 6,
    line: 'quick',
    run: null,
    startedAt: null,
    fails: 0,
    retryAt: null,
    syncTried: 'x',
  };
  const quiet = record(was, {
    at: 9,
    ended: 10,
    line: null,
    run: 'r',
    startedAt: 9,
    fails: 1,
    retryAt: 99,
  });
  assert.deepEqual(quiet, {
    v: 1,
    at: 5,
    ended: 10,
    line: 'quick',
    run: 'r',
    startedAt: 9,
    fails: 1,
    retryAt: 99,
    syncTried: 'x',
    pageChanged: null,
  });
  assert.deepEqual(
    Object.keys(record(null, { at: 1, ended: 2, line: 'full', fails: 0, retryAt: null })),
    [
      'v',
      'at',
      'ended',
      'line',
      'run',
      'startedAt',
      'fails',
      'retryAt',
      'syncTried',
      'pageChanged',
    ],
  );
});

test('record: a day skipped after a run that asks keeps the ask, until a scan saves', async () => {
  const { record } = await auto();
  const asked = { v: 1, at: 5, ended: 6, line: 'partway', fails: 1, retryAt: 99 };
  const run = (was, line, savedAt) =>
    record(was, { at: 20, ended: 21, line, fails: 0, retryAt: null, savedAt });
  for (const line of ['signed-out', 'other', 'paused']) {
    // No scan since (the hangar's saved scan time from before the run that asked).
    const kept = run(asked, line, 4);
    assert.equal(kept.line, 'partway', line);
    assert.equal(kept.at, 5, `${line}: the time of the run that asked`);
    assert.equal(kept.ended, 21, `${line}: this run's end`);
    assert.equal(run({ ...asked, line: 'bad' }, line, null).line, 'bad', line);
    // A scan saved since: the skip's own line.
    const saved = run(asked, line, 7);
    assert.equal(saved.line, line);
    assert.equal(saved.at, 20);
  }
  // Kept through days in a row, then a scan saves: the next skip says so.
  const twice = run(run(asked, 'signed-out', 4), 'signed-out', 4);
  assert.equal(twice.line, 'partway');
  assert.equal(run(twice, 'signed-out', 22).line, 'signed-out');
  // A run with a line of its own that isn't a skip replaces it.
  for (const line of ['quick', 'full', 'bad', 'partway']) {
    const next = run(asked, line, 4);
    assert.equal(next.line, line);
    assert.equal(next.at, 20);
  }
  // A skip after a line that doesn't ask: its own line, as before.
  assert.equal(run({ ...asked, line: 'quick' }, 'signed-out', 4).line, 'signed-out');
});

// --- The worker (src/background.js) ------------------------------------------------------
const LINK = { siteLink: { token: 't', name: 'pilot', connectedAt: 1, lastSync: null } };
// The store build's worker, connected, with Auto Scan Daily's switch where `local` puts it.
function worker(o = {}) {
  const x = loadBackground({
    changes: true,
    offscreen: true,
    ...o,
    local: { ...LINK, ...(o.local || {}) },
  });
  const badges = [];
  x.chrome.action.setBadgeText = async (b) => void badges.push(b.text);
  return { ...x, badges };
}
async function until(ok, ms = 1500) {
  const end = Date.now() + ms;
  while (!ok()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 2));
  }
}
const settle = () => new Promise((r) => setTimeout(r, 30));
const alarm = (x) => x.alarms.get('oh-auto-scan');
const within = (t, from, to) => assert.ok(t >= from && t <= to, `${t - from} ms from ${from}`);

test('turning it on: an alarm 10 to 30 minutes out, its time kept', async () => {
  const x = worker();
  await settle();
  assert.equal(alarm(x), undefined, 'off: none');
  const t0 = Date.now();
  await x.chrome.storage.local.set({ autoScanOn: true });
  await until(() => alarm(x));
  within(alarm(x).when, t0 + 10 * MIN, Date.now() + 30 * MIN);
  assert.equal(x.stores.local.autoScanNext, alarm(x).when);
  // Off: no alarm, no next run.
  await x.chrome.storage.local.set({ autoScanOn: false });
  await until(() => !alarm(x));
  assert.equal(x.stores.local.autoScanNext, undefined);
});

test('a worker starting with the alarm gone: at the time it kept, soon, or 20 to 28 hours', async () => {
  const kept = Date.now() + 5 * H;
  const a = worker({ local: { autoScanOn: true, autoScanNext: kept } });
  await until(() => alarm(a));
  assert.equal(alarm(a).when, kept, 'the same personal time');
  // Its time already past (the browser was closed): once, soon.
  const t0 = Date.now();
  const b = worker({ local: { autoScanOn: true, autoScanNext: t0 - 3 * H } });
  await until(() => alarm(b));
  within(alarm(b).when, t0 + 10 * MIN, Date.now() + 30 * MIN);
  // More than 28 hours ahead (the clock went back): 20 to 28 hours from now.
  const c = worker({ local: { autoScanOn: true, autoScanNext: t0 + 40 * H } });
  await until(() => alarm(c));
  within(alarm(c).when, t0 + 20 * H, Date.now() + 28 * H);
  // Not connected: off for good.
  const e = worker({ local: { siteLink: undefined, autoScanOn: true, autoScanNext: kept } });
  await settle();
  assert.equal(alarm(e), undefined);
  assert.equal(e.stores.local.autoScanOn, undefined);
  assert.equal(e.stores.local.autoScanNext, undefined);
});

test('a late alarm (the browser was closed, the machine asleep): once, soon, and no page', async () => {
  const x = worker({ local: { autoScanOn: true } });
  await until(() => alarm(x));
  const t0 = Date.now();
  await x.fireAlarm('oh-auto-scan', { scheduledTime: t0 - 2 * H });
  await until(() => alarm(x));
  await settle();
  within(alarm(x).when, t0 + 10 * MIN, Date.now() + 30 * MIN);
  assert.equal(x.docs.length, 0, 'no hidden page');
  assert.deepEqual(x.opened, [], 'no tab');
});

test('on time: the next run 20 to 28 hours out first, then the hidden page with reason auto', async () => {
  const x = worker({ local: { autoScanOn: true } });
  await until(() => alarm(x));
  const t0 = Date.now();
  await x.fireAlarm('oh-auto-scan', { scheduledTime: t0 });
  await until(() => x.docs.length === 1);
  within(alarm(x).when, t0 + 20 * H, Date.now() + 28 * H);
  assert.equal(x.stores.local.autoScanNext, alarm(x).when);
  assert.match(x.docs[0].url, /^src\/scan\.html\?run=[\w-]+&by=offscreen&v=/);
  assert.equal(x.stores.session.scanRequest.reason, 'auto');
  assert.deepEqual(x.opened, [], 'no tab');
  // Firefox: its frame.
  const f = worker({
    browser: 'firefox',
    offscreen: false,
    frames: true,
    local: { autoScanOn: true },
  });
  await until(() => alarm(f));
  await f.fireAlarm('oh-auto-scan', { scheduledTime: Date.now() });
  await until(() => f.frames.length === 1);
  assert.equal(f.stores.session.scanRequest.reason, 'auto');
  assert.deepEqual(f.opened, []);
});

test('a scan began under 20 hours ago: the next run 20 to 28 hours after it, nothing asked', async () => {
  const started = Date.now() - 5 * H;
  const x = worker({
    local: {
      autoScanOn: true,
      scanStarted: { run: 'r1', by: 'tab', reason: 'popup', at: started },
    },
  });
  await until(() => alarm(x));
  await x.fireAlarm('oh-auto-scan', { scheduledTime: Date.now() });
  await settle();
  within(alarm(x).when, started + 20 * H, started + 28 * H);
  assert.equal(x.docs.length, 0);
  assert.equal(x.stores.session.scanRequest, undefined);
});

test('switched off and on (or disconnected, connected, on) after a quick check: not again within 20 hours', async () => {
  // A quick check that found nothing new: it writes no scanStarted, only its record.
  const ended = Date.now() - 2 * H;
  const rec = { v: 1, at: ended - MIN, ended, line: 'quick', fails: 0, retryAt: null };
  const x = worker({ local: { autoScanOn: true, autoScan: rec } });
  await until(() => alarm(x));
  await x.chrome.storage.local.set({ autoScanOn: false });
  await until(() => !alarm(x));
  const t0 = Date.now();
  await x.chrome.storage.local.set({ autoScanOn: true });
  await until(() => alarm(x));
  within(alarm(x).when, t0 + 10 * MIN, Date.now() + 30 * MIN);
  // Its alarm goes off: nothing asked, the next run 20 to 28 hours after the last one.
  await x.fireAlarm('oh-auto-scan', { scheduledTime: Date.now() });
  await settle();
  assert.equal(x.docs.length, 0, 'no hidden page');
  assert.equal(x.stores.session.scanRequest, undefined);
  within(alarm(x).when, ended + 20 * H, ended + 28 * H);
  assert.equal(x.stores.local.autoScanNext, alarm(x).when);
  // Disconnected, connected again, switched on: the same.
  const y = worker({ local: { autoScanOn: true, autoScan: rec } });
  await until(() => alarm(y));
  await y.chrome.storage.local.remove('siteLink');
  await until(() => !alarm(y));
  await y.chrome.storage.local.set({ ...LINK, autoScanOn: true });
  await until(() => alarm(y));
  await y.fireAlarm('oh-auto-scan', { scheduledTime: Date.now() });
  await settle();
  assert.equal(y.docs.length, 0);
  within(alarm(y).when, ended + 20 * H, ended + 28 * H);
  // Over 20 hours after it: it runs.
  const old = { ...rec, at: Date.now() - 21 * H, ended: Date.now() - 21 * H + MIN };
  const z = worker({ local: { autoScanOn: true, autoScan: old } });
  await until(() => alarm(z));
  await z.fireAlarm('oh-auto-scan', { scheduledTime: Date.now() });
  await until(() => z.docs.length === 1);
  assert.equal(z.stores.session.scanRequest.reason, 'auto');
});

test('backoff, offline, a scan running or a hidden page open: skipped, no page', async () => {
  const fire = async (x) => {
    await until(() => alarm(x));
    await x.fireAlarm('oh-auto-scan', { scheduledTime: Date.now() });
    await settle();
    assert.ok(alarm(x), 'always a next run');
    return x;
  };
  const retryAt = Date.now() + 2 * DAY;
  const back = await fire(
    worker({ local: { autoScanOn: true, autoScan: { v: 1, line: null, retryAt } } }),
  );
  assert.equal(back.docs.length, 0, 'RSI asked to wait');
  within(alarm(back).when, retryAt, retryAt + 2 * H);
  const off = await fire(
    worker({ local: { autoScanOn: true }, globals: { navigator: { onLine: false } } }),
  );
  assert.equal(off.docs.length, 0, 'offline');
  const asked = await fire(
    worker({ local: { autoScanOn: true }, session: { scanRequest: { at: Date.now(), run: 'x' } } }),
  );
  assert.equal(asked.docs.length, 0, 'a scan was just asked for');
  const busy = worker({ local: { autoScanOn: true } });
  busy.docs.push({ url: 'src/scan.html?run=open-page-1&by=offscreen&v=0.3.0' });
  await fire(busy);
  assert.equal(busy.docs.length, 1, 'the hidden page already open (packs, say)');
  assert.equal(busy.stores.session.scanRequest, undefined);
  for (const x of [back, off, asked, busy]) assert.deepEqual(x.opened, []);
});

test('no hidden page here: never a tab (the kill switch, no RSI access, offscreen failing)', async () => {
  const kill = { at: Date.now(), data: { sources: { scanHidden: { enabled: false } } } };
  for (const o of [
    { local: { autoScanOn: true, remoteStatus: kill } },
    { local: { autoScanOn: true }, rsi: false },
    { local: { autoScanOn: true }, failOffscreen: true },
    { local: { autoScanOn: true }, offscreen: false },
  ]) {
    const x = worker(o);
    await until(() => alarm(x));
    await x.fireAlarm('oh-auto-scan', { scheduledTime: Date.now() });
    await settle();
    assert.deepEqual(x.opened, [], JSON.stringify(o));
    assert.equal(x.docs.length, 0);
    assert.ok(alarm(x), 'tried again tomorrow');
    // A pressed Scan a moment later isn't held by it.
    assert.equal(x.stores.session.scanAskedAt, undefined);
  }
});

test("store alerts' alarm and Auto Scan Daily's never clear each other", async () => {
  const x = worker({ local: { autoScanOn: true, alertsOn: true } });
  await until(() => alarm(x) && x.alarms.has('oh-alerts'));
  await x.chrome.storage.local.set({ alertsOn: false });
  await until(() => !x.alarms.has('oh-alerts'));
  assert.ok(alarm(x), 'alerts off: Auto Scan stays');
  await x.chrome.storage.local.set({ alertsOn: true });
  await until(() => x.alarms.has('oh-alerts'));
  await x.chrome.storage.local.set({ autoScanOn: false });
  await until(() => !alarm(x));
  assert.ok(x.alarms.has('oh-alerts'), 'Auto Scan off: alerts stay');
  // The link gone (Disconnect, by any route): Auto Scan off; alerts as they are.
  await x.chrome.storage.local.set({ autoScanOn: true });
  await until(() => alarm(x));
  await x.chrome.storage.local.remove('siteLink');
  await until(() => !alarm(x));
  assert.ok(x.alarms.has('oh-alerts'));
  assert.equal(x.stores.local.autoScanOn, undefined);
});

test('a run that RSI asked to wait moves the next run after it', async () => {
  const x = worker({ local: { autoScanOn: true } });
  await until(() => alarm(x));
  const retryAt = Date.now() + 3 * DAY;
  await x.chrome.storage.local.set({ autoScan: { v: 1, at: 1, line: null, fails: 2, retryAt } });
  await until(() => alarm(x).when >= retryAt);
  within(alarm(x).when, retryAt, retryAt + 2 * H);
  assert.equal(x.stores.local.autoScanNext, alarm(x).when);
  // And it holds across a restart (the alarm gone, its time kept).
  const y = worker({ local: { ...x.stores.local } });
  await until(() => alarm(y));
  assert.equal(alarm(y).when, x.stores.local.autoScanNext);
});

test('the badge: a run that found nothing new keeps an old scan fresh, while it is on', async () => {
  const old = {
    schemaVersion: 3,
    sources: { hangar: { scannedAt: Date.now() - 9 * DAY, items: [] } },
  };
  const rec = { v: 1, at: Date.now() - H, line: 'quick' };
  const fresh = worker({ local: { db: old, autoScanOn: true, autoScan: rec } });
  await fresh.chrome.storage.local.set({ remindRescan: true });
  await until(() => fresh.badges.length);
  assert.equal(fresh.badges.at(-1), '');
  const stale = worker({ local: { db: old, autoScanOn: false, autoScan: rec } });
  await stale.chrome.storage.local.set({ remindRescan: true });
  await until(() => stale.badges.length);
  assert.equal(stale.badges.at(-1), '!');
  const bad = worker({ local: { db: old, autoScanOn: true, autoScan: { ...rec, line: 'bad' } } });
  await bad.chrome.storage.local.set({ remindRescan: true });
  await until(() => bad.badges.length);
  assert.equal(bad.badges.at(-1), '!');
});

test('the popup Scan during a hidden auto run is busy, and no tab comes up for it', async () => {
  const x = worker({ local: { autoScanOn: true } });
  await until(() => alarm(x));
  await x.fireAlarm('oh-auto-scan', { scheduledTime: Date.now() });
  await until(() => x.docs.length === 1);
  const r = await x.sendInternal(
    { ohPopup: 'scan' },
    { id: CHROME_ID, url: `chrome-extension://${CHROME_ID}/src/popup.html` },
  );
  assert.deepEqual(r, { ok: false, error: 'busy' });
  assert.deepEqual(x.opened, []);
});

test('the hidden page asks whether the sign-in cookie is there: yes or no, never the cookie', async () => {
  const jar = new Map([['Rsi-Token', { name: 'Rsi-Token', value: 'secret-token' }]]);
  const x = worker({ local: { autoScanOn: true } });
  const asks = [];
  x.chrome.cookies = {
    get: async (q) => (asks.push(q), jar.get(q.name) || null),
  };
  const ask = (arg) =>
    x.fromScanPage({ ohScan: { op: 'cookies.get', run: 'run-abc123', arg } }, '?run=run-abc123');
  const RSI = 'https://robertsspaceindustries.com';
  assert.deepEqual(await ask({ url: RSI, name: 'Rsi-Token' }), { ok: true, value: {} });
  assert.ok(!JSON.stringify(await ask({ url: RSI, name: 'Rsi-Token' })).includes('secret'));
  jar.clear();
  assert.deepEqual(await ask({ url: RSI, name: 'Rsi-Token' }), { ok: true, value: null });
  // Only RSI's sign-in cookie, only from the hidden page.
  for (const arg of [
    { url: RSI, name: 'other' },
    { url: 'https://example.com', name: 'Rsi-Token' },
    { url: RSI, name: 'Rsi-Token', extra: 1 },
    null,
  ])
    assert.equal((await ask(arg)).ok, false, JSON.stringify(arg));
  assert.equal(asks.length, 3, 'only the three asks it takes');
  const tab = await x.sendInternal(
    { ohScan: { op: 'cookies.get', run: 'run-abc123', arg: { url: RSI, name: 'Rsi-Token' } } },
    { id: CHROME_ID, tab: { id: 3 }, url: `chrome-extension://${CHROME_ID}/src/scan.html` },
  );
  assert.equal(tab, undefined, 'not from a tab');
});

// --- Check 6: only store alerts and Auto Scan Daily use alarms; it never notifies -----

test('check 6: every alarm is the alerts or Auto Scan Daily; Auto Scan never notifies', () => {
  const files = fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /\.js$/.test(f));
  const made = [];
  for (const f of files)
    for (const m of read(`src/${f}`).matchAll(/chrome\.alarms\.create\(\s*([^,]+),/g))
      made.push(`${f}: ${m[1].trim()}`);
  for (const m of made) assert.match(m, /: (self\.OHAlerts\.ALARM|AL\.ALARM|AUTO_ALARM)$/, m);
  assert.ok(made.includes('background.js: AUTO_ALARM'), made.join(', '));
  assert.ok(made.includes('background.js: AL.ALARM'), made.join(', '));
  // Auto Scan Daily's code: the worker's block, its rules and the run.
  const bg = read('src/background.js');
  const blocks = [...bg.matchAll(/@flag-start autoScan[^\n]*\n([\s\S]*?)@flag-end autoScan/g)].map(
    (m) => m[1],
  );
  assert.equal(blocks.length, 2, 'the block and its badge rule');
  const runner = read('ui/scan/runner.js');
  // Its code, without the comments that say what it never does.
  const run = runner
    .slice(runner.indexOf('// --- Auto Scan Daily (#666)'), runner.indexOf('  return {\n    scan,'))
    .replace(/^\s*\/\/.*$/gm, '');
  assert.ok(run.length > 3000, 'found autoScan()');
  assert.doesNotMatch(run, /reconcile\(|switchProfile/, 'never switches accounts');
  for (const [name, text] of [
    ...blocks.map((b, i) => [`background block ${i}`, b]),
    ['ui/scan/auto.js', read('ui/scan/auto.js')],
    ['autoScan()', run],
  ]) {
    assert.doesNotMatch(
      text,
      /chrome\.notifications|notify\(|\.notify\b/,
      `${name}: never notifies`,
    );
    assert.doesNotMatch(text, /chrome\.cookies/, `${name}: no cookies API of its own`);
  }
  // No pack reads, no scan report, no tab.
  assert.doesNotMatch(run, /readPacks\(|writeReport\(|scanReport/);
  assert.match(blocks.join('\n'), /requestScan\('auto', \{ hiddenOnly: true \}\)/);
  // A build without the flag has none of it.
  const off = cutFlags(bg, {
    sync: true,
    localMode: true,
    connector: true,
    alerts: true,
    autoScan: false,
  });
  assert.doesNotMatch(off, /oh-auto-scan|autoScanOn|AUTO_ALARM/);
});
