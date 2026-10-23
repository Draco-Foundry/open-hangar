'use strict';
// The 0.4.0 toolbar popup (ui/popup/): what it works out from what's stored, its
// settings and its words. The background's side of it is test/connector.test.js and
// test/alerts-background.test.js. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const data = () => import('../ui/popup/data.js');
const NOW = Date.UTC(2026, 9, 14, 12);
const MIN = 60e3;
const HOUR = 3600e3;
const DAY = 86400e3;

test('header: the scan age, green, amber from a week, grey before any scan', async () => {
  const { scanAge, staleAge } = await data();
  assert.deepEqual(scanAge(null, NOW), { tone: 'never', n: null, unit: null });
  // A list an older parser read shows amber, whatever its age; never and stale stay.
  assert.equal(staleAge(scanAge(NOW - 20e3, NOW), true).tone, 'stale');
  assert.equal(staleAge(scanAge(NOW - 20e3, NOW), false).tone, 'fresh');
  assert.equal(staleAge(scanAge(null, NOW), true).tone, 'never');
  assert.deepEqual(scanAge(NOW - 20e3, NOW), { tone: 'fresh', n: 1, unit: 'm' });
  assert.deepEqual(scanAge(NOW - 42 * MIN, NOW), { tone: 'fresh', n: 42, unit: 'm' });
  assert.deepEqual(scanAge(NOW - 2 * HOUR, NOW), { tone: 'fresh', n: 2, unit: 'h' });
  assert.deepEqual(scanAge(new Date(NOW - 3 * DAY).toISOString(), NOW), {
    tone: 'fresh',
    n: 3,
    unit: 'd',
  });
  assert.deepEqual(scanAge(NOW - 7 * DAY, NOW), { tone: 'stale', n: 7, unit: 'd' });
});

test('scan: running from the shared marks, hidden without a tab, progress only its run', async () => {
  const { scanState } = await data();
  const run = { at: NOW - MIN, tabId: null, run: 'r1', by: 'offscreen' };
  const prog = { run: 'r1', at: NOW - 1e3, part: 'buybacks', page: 2, count: 20, retry: null };
  const s = scanState({ scanRunning: run, scanProgress: prog }, NOW);
  assert.equal(s.phase, 'running');
  assert.equal(s.hidden, true);
  assert.equal(s.progress, prog);
  // Another run's progress isn't this one's.
  assert.equal(
    scanState({ scanRunning: run, scanProgress: { ...prog, run: 'r0' } }, NOW).progress,
    null,
  );
  // Today's mark from the Open Hangar tab: running, in a tab.
  const tab = scanState({ scanRunning: { at: NOW - MIN, tabId: 42 } }, NOW);
  assert.equal(tab.phase, 'running');
  assert.equal(tab.hidden, false);
  assert.equal(scanState({ scanRunning: { ...run, by: 'tab', tabId: 7 } }, NOW).hidden, false);
  // Asked for a moment ago: running.
  assert.equal(scanState({ scanRequest: { at: NOW - 10e3 } }, NOW).phase, 'running');
  assert.equal(scanState({ scanRequest: { at: NOW - 2 * MIN } }, NOW).phase, 'idle');
  assert.equal(scanState({}, NOW).phase, 'idle');
});

test('scan: stopped when its page went away, never when it reported', async () => {
  const { scanState } = await data();
  // A mark left behind past the background's 10 minutes.
  const old = { at: NOW - 11 * MIN, tabId: null, run: 'r2', by: 'offscreen' };
  assert.equal(scanState({ scanRunning: old }, NOW).phase, 'stopped');
  assert.equal(scanState({ scanRunning: old, scanReport: { run: 'r2' } }, NOW).phase, 'idle');
  // Progress gone quiet with no mark and no report for its run.
  const quiet = { run: 'r3', at: NOW - 3 * MIN, part: 'hangar', page: 4 };
  assert.equal(scanState({ scanProgress: quiet }, NOW).phase, 'stopped');
  assert.equal(scanState({ scanProgress: { ...quiet, at: NOW - 30e3 } }, NOW).phase, 'idle');
  assert.equal(scanState({ scanProgress: quiet, scanReport: { run: 'r3' } }, NOW).phase, 'idle');
});

test('scan: stopped after a browser restart, from the start kept locally (#676)', async () => {
  const { scanState } = await data();
  // A scan began 5 minutes ago and the browser closed: no session marks are left.
  const started = { run: 'r4', by: 'offscreen', reason: 'popup', at: NOW - 5 * MIN };
  assert.equal(scanState({ scanStarted: started }, NOW).phase, 'stopped');
  // Ended: its report or Auto Scan Daily's record, for that run at that start.
  const ended = { run: 'r4', startedAt: started.at };
  assert.equal(scanState({ scanStarted: started, scanReport: ended }, NOW).phase, 'idle');
  assert.equal(scanState({ scanStarted: started, autoScan: ended }, NOW).phase, 'idle');
  // The run alone never pairs: a page keeps its run for every scan it runs.
  const earlier = { run: 'r4', startedAt: started.at - DAY };
  assert.equal(scanState({ scanStarted: started, scanReport: earlier }, NOW).phase, 'stopped');
  assert.equal(scanState({ scanStarted: started, autoScan: earlier }, NOW).phase, 'stopped');
  // One that began after it (a held scan, say) ends it too.
  const later = { run: 'r5', startedAt: started.at + MIN };
  assert.equal(scanState({ scanStarted: started, scanReport: later }, NOW).phase, 'idle');
  // A start under a minute old: not yet (its marks are on their way).
  assert.equal(scanState({ scanStarted: { ...started, at: NOW - 30e3 } }, NOW).phase, 'idle');
  // Fresh marks: running, whatever was kept.
  const mark = { at: NOW - MIN, tabId: null, run: 'r4', by: 'offscreen' };
  assert.equal(scanState({ scanStarted: started, scanRunning: mark }, NOW).phase, 'running');
  // Nothing usable kept: idle.
  assert.equal(scanState({ scanStarted: { at: NOW - DAY } }, NOW).phase, 'idle');
});

// --- Auto Scan Daily in Settings (#666) ----------------------------------------------
test("Auto Scan Daily's line: each run's approved words, none while it's off", async () => {
  const { autoLine, autoWhen } = await data();
  const { t } = await import('../ui/popup/copy.js');
  const at = new Date(2026, 9, 14, 6, 12).getTime(); // local time
  const now = new Date(2026, 9, 14, 18, 40).getTime();
  assert.equal(autoWhen(at, now, 'en-US'), 'today 6:12 AM');
  assert.equal(autoWhen(at, new Date(2026, 9, 15, 7).getTime(), 'en-US'), 'Oct 14, 6:12 AM');
  const say = (rec, on = true) => {
    const l = autoLine({ on, rec }, now, 'en-US');
    return l && { words: t(l.key, { when: l.when }), ask: l.ask };
  };
  assert.equal(say({ v: 1, at, line: 'quick' }, false), null, 'off: no line');
  assert.deepEqual(say(null), { words: 'Runs once a day while your browser is open.', ask: false });
  assert.deepEqual(say({ v: 1, at: null, line: null }), {
    words: 'Runs once a day while your browser is open.',
    ask: false,
  });
  const rows = {
    quick: ['Last: today 6:12 AM, no changes', false],
    full: ['Last: today 6:12 AM, hangar updated', false],
    'signed-out': ['Skipped today 6:12 AM: signed out of RSI', false],
    other: ['Skipped today 6:12 AM: a different RSI account is signed in', false],
    paused: ['Skipped today 6:12 AM: scans are paused', false],
    bad: ["Last: today 6:12 AM, something looked wrong and wasn't saved. Scan to check.", true],
    'out-partway': ['Last: today 6:12 AM, signed out of RSI partway. Scan to check.', true],
    partway: ['Last: today 6:12 AM, RSI stopped answering partway. Scan to check.', true],
  };
  for (const [line, [words, ask]] of Object.entries(rows))
    assert.deepEqual(say({ v: 1, at, line }), { words, ask }, line);
  // Another day: the date and time.
  assert.equal(
    t(autoLine({ on: true, rec: { at, line: 'full' } }, now + DAY, 'en-US').key, {
      when: autoWhen(at, now + DAY, 'en-US'),
    }),
    'Last: Oct 14, 6:12 AM, hangar updated',
  );
});

test("Auto Scan Daily's ask: the Settings dot for a part not kept, until a scan saves since", async () => {
  const { autoAsk } = await data();
  const rec = { v: 1, at: NOW - HOUR, ended: NOW - HOUR + MIN, line: 'partway' };
  assert.equal(autoAsk({ on: true, rec, scannedAt: NOW - DAY }), true);
  assert.equal(autoAsk({ on: true, rec: { ...rec, line: 'bad' }, scannedAt: NOW - DAY }), true);
  assert.equal(
    autoAsk({ on: true, rec: { ...rec, line: 'out-partway' }, scannedAt: NOW - DAY }),
    true,
  );
  assert.equal(autoAsk({ on: true, rec, scannedAt: NOW }), false, 'a scan saved since');
  assert.equal(autoAsk({ on: false, rec, scannedAt: NOW - DAY }), false, 'switched off');
  for (const line of ['quick', 'full', 'signed-out', 'other', 'paused', null])
    assert.equal(autoAsk({ on: true, rec: { ...rec, line }, scannedAt: NOW - DAY }), false, line);
});

test('scan: the bar only moves forward, and the steps follow the part', async () => {
  const { progressFraction, scanSteps } = await data();
  const order = [
    { part: 'start' },
    { part: 'account' },
    { part: 'hangar', page: 1 },
    { part: 'hangar', page: 30 },
    { part: 'buybacks', page: 1 },
    { part: 'referrals' },
    { part: 'packs' },
    { part: 'sync' },
  ].map(progressFraction);
  for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1], `step ${i}`);
  assert.ok(order.every((f) => f > 0 && f < 1));
  assert.equal(progressFraction(null), progressFraction({ part: 'start' }));
  const states = (part) =>
    scanSteps(part)
      .map((s) => s.state)
      .join();
  assert.equal(states('account'), 'now,todo,todo');
  assert.equal(states('hangar'), 'now,todo,todo');
  assert.equal(states('buybacks'), 'done,now,todo');
  assert.equal(states('referrals'), 'done,done,now');
  assert.equal(states('sync'), 'done,done,done');
  assert.deepEqual(
    scanSteps('hangar').map((s) => s.id),
    ['hangar', 'buybacks', 'referrals'],
  );
});

test('scan bar: fills by RSI page count, only forward, a part never waits on its end', async () => {
  const { barFraction } = await data();
  const order = [
    null,
    { part: 'start' },
    { part: 'account' },
    { part: 'hangar', page: 1, pages: 4 },
    { part: 'hangar', page: 2, pages: 4 },
    { part: 'hangar', page: 4, pages: 4 },
    { part: 'buybacks', page: 1, pages: 2 },
    { part: 'buybacks', page: 2, pages: 2 },
    { part: 'referrals', page: 0, pages: 3 },
    { part: 'referrals', page: 2, pages: 3 },
    { part: 'sync' },
  ].map(barFraction);
  for (let i = 1; i < order.length; i++) assert.ok(order[i] >= order[i - 1], `step ${i}`);
  assert.ok(order.every((f) => f >= 0 && f <= 1));
  // Half the hangar's pages read: half its share; all read: where buy-backs begin.
  const h = (page, pages, retry = null) => barFraction({ part: 'hangar', page, pages, retry });
  assert.equal(h(2, 4), 0.3);
  assert.equal(h(4, 4), barFraction({ part: 'buybacks', page: 0, pages: 2 }));
  // A page being retried isn't read yet.
  assert.equal(h(3, 4, { attempt: 1, of: 3 }), h(2, 4));
  // A rescan that found nothing changed (#294): page 1 of 1, the part done at once.
  assert.equal(h(1, 1), h(4, 4));
  // No pager: eased, still short of the part's end however many pages.
  assert.ok(h(1, null) > h(0, null) && h(40, null) < h(4, 4));
  // Packs read after the scan fill on their own.
  assert.equal(barFraction({ part: 'packs', page: 3, count: 6 }), 0.5);
  assert.equal(barFraction({ part: 'packs', page: 0, count: 0 }), 0);
});

test('scan bar: creeps towards where the next page puts it, never past', async () => {
  const { barFraction, barNext } = await data();
  const h = (page, pages, retry = null) => ({ part: 'hangar', page, pages, retry });
  // Page 2 of 4 read: the next point is page 3's.
  assert.equal(barNext(h(2, 4)), barFraction(h(3, 4)));
  // A page being retried: still towards that page.
  assert.equal(barNext(h(3, 4, { attempt: 1, of: 3 })), barFraction(h(3, 4)));
  // The last page read: towards the part's end, never into the next part.
  assert.equal(barNext(h(4, 4)), 0.55);
  assert.equal(barNext(h(1, 1)), 0.55);
  // No pager: the eased next page, still short of the end.
  assert.ok(barNext(h(5, null)) > barFraction(h(5, null)) && barNext(h(5, null)) < 0.55);
  // Parts without pages creep towards their end.
  assert.equal(barNext({ part: 'account' }), 0.05);
  assert.equal(barNext({ part: 'sync' }), 1);
  assert.equal(barNext(null), 0.02);
  assert.equal(
    barNext({ part: 'referrals', page: 1, pages: 3 }),
    barFraction({ part: 'referrals', page: 2, pages: 3 }),
  );
  // Always ahead of (or at) where it is.
  for (const p of [
    h(0, 4),
    h(2, 4),
    h(4, 4),
    { part: 'buybacks', page: 1, pages: 2 },
    { part: 'start' },
  ])
    assert.ok(barNext(p) >= barFraction(p));
});

test('scan bar: names the part and counts what it has read', async () => {
  const { barLabel } = await data();
  const { t } = await import('../ui/popup/copy.js');
  const say = (p) => {
    const l = barLabel(p);
    return [t(l.key), l.n];
  };
  assert.deepEqual(say(null), ['Scanning', '']);
  assert.deepEqual(say({ part: 'start' }), ['Scanning', '']);
  assert.deepEqual(say({ part: 'account' }), ['Account', '']);
  assert.deepEqual(say({ part: 'hangar', page: 2, count: 1214, pages: 3 }), ['Hangar', '1,214']);
  assert.deepEqual(say({ part: 'hangar', page: 1, count: null }), ['Hangar', '']);
  assert.deepEqual(say({ part: 'buybacks', page: 1, count: 37 }), ['Buy-Backs', '37']);
  assert.deepEqual(say({ part: 'referrals', page: 1, count: 12 }), ['Referrals', '12']);
  assert.deepEqual(say({ part: 'sync' }), ['Syncing', '']);
  assert.deepEqual(say({ part: 'packs', page: 3, count: 6 }), ['Buy-Back Packs', '3 / 6']);
  assert.deepEqual(say({ part: 'hangar', page: 2, count: 20, retry: { attempt: 1, of: 3 } }), [
    'Waiting on RSI',
    '',
  ]);
  assert.deepEqual(say({ part: 'what' }), ['Scanning', '']);
});

test("scan bar: Scan held back until RSI's wait is over", async () => {
  const { scanHold } = await data();
  assert.equal(scanHold({ wait: NOW + 5 * MIN }, NOW), NOW + 5 * MIN);
  assert.equal(scanHold({ wait: NOW - 1 }, NOW), null);
  assert.equal(scanHold({ wait: null }, NOW), null);
  assert.equal(scanHold({}, NOW), null);
  assert.equal(scanHold(null, NOW), null);
});

test('scan report: shown once, and how long it took', async () => {
  const { newReport, took } = await data();
  const r = { v: 1, at: NOW, ms: 38e3, rows: [] };
  assert.equal(newReport(r, 0), r);
  assert.equal(newReport(r, NOW), null, 'already shown');
  assert.equal(newReport({ ...r, v: 2 }, 0), null, 'a shape this version does not know');
  assert.equal(newReport(null, 0), null);
  assert.deepEqual(took(38e3), { m: 0, s: 38 });
  assert.deepEqual(took(125e3), { m: 2, s: 5 });
  assert.deepEqual(took(200), { m: 0, s: 1 });
  assert.equal(took(undefined), null);
});

test('scan report: RSI not answering wins over signed out, and shows no trouble rows', async () => {
  const { reportRsi, reportTrouble, reportDone, autoLine } = await data();
  const base = {
    v: 1,
    run: 'r',
    at: NOW,
    ms: 9e3,
    held: null,
    signedOut: false,
    bad: 1,
    wait: null,
  };
  const bb = { id: 'buybacks', ok: false, partial: null, n: null, error: 'RSI responded 503' };
  // A 5xx: the down line, not the raw error.
  const down = { ...base, rows: [bb], rsiDown: true };
  assert.deepEqual(reportRsi(down, NOW - HOUR, NOW), { kind: 'down' });
  assert.deepEqual(reportTrouble(down, NOW - HOUR), []);
  assert.equal(reportDone(down), null);
  // RSI that isn't answering can look signed out: RSI not answering still wins.
  const both = { ...down, signedOut: true };
  assert.deepEqual(reportRsi(both, null, NOW), { kind: 'down' });
  // A 429: RSI's ask to wait, until that time; after it, nothing.
  const slow = { ...down, wait: NOW + 5 * MIN };
  assert.deepEqual(reportRsi(slow, null, NOW), { kind: 'wait', at: NOW + 5 * MIN });
  assert.equal(reportRsi(slow, null, NOW + 6 * MIN), null);
  // A scan since went fine, a held report, or a scan RSI answered: nothing.
  assert.equal(reportRsi(down, NOW + 2 * MIN, NOW), null);
  assert.equal(reportRsi({ ...down, held: 'busy' }, null, NOW), null);
  assert.equal(reportRsi({ ...down, rsiDown: false }, null, NOW), null);
  assert.equal(reportRsi(null, null, NOW), null);
  // Auto Scan Daily's day skipped because RSI wasn't answering.
  const line = autoLine({ on: true, rec: { line: 'rsi-down', at: NOW } }, NOW, 'en-US');
  assert.equal(line.key, 'popup.auto-rsi-down');
  assert.equal(line.ask, false);
});

test('scan report: a held one, one read in part or signed out is never "Scanned in"', async () => {
  const { reportDone, reportTrouble, reportPaused } = await data();
  const base = { v: 1, run: 'r', at: NOW, ms: 38e3, held: null, signedOut: false, bad: 0 };
  const ok = { id: 'hangar', ok: true, partial: null, n: 20, error: null };
  assert.deepEqual(reportDone({ ...base, rows: [ok] }), { m: 0, s: 38 });
  // The runner's held reports (ui/scan/runner.js): ms 0, no rows, nothing read.
  for (const held of ['busy', 'no-rsi', 'paused']) {
    const r = { ...base, ms: 0, rows: [], held };
    assert.equal(reportDone(r), null, held);
    assert.deepEqual(reportTrouble(r, null), [], `${held}: no trouble rows either`);
  }
  // Read only in part: a problem, with its count, never a success line.
  const part = { ...ok, partial: 'stopped at page 3 (timeout); rescan to get the rest' };
  const bb = { id: 'buybacks', ok: false, partial: null, n: null, error: 'RSI answered 500' };
  const bad = { ...base, rows: [part, bb, { ...ok, id: 'referrals' }], bad: 2 };
  assert.equal(reportDone(bad), null);
  assert.deepEqual(reportTrouble(bad, NOW - HOUR), [part, bb]);
  // A scan since went fine: the old trouble says nothing.
  assert.deepEqual(reportTrouble(bad, NOW + 2 * MIN), []);
  assert.equal(reportDone({ ...base, rows: [], signedOut: true }), null);
  assert.deepEqual(reportTrouble({ ...bad, signedOut: true }, null), []);
  // Paused by status.json: its own line, the status file's words.
  const words = 'RSI changed their site, so this scan is paused while we patch it.';
  const paused = { ...base, held: 'paused', rows: [{ ...bb, error: words }], bad: 1 };
  assert.equal(reportPaused(paused, NOW - HOUR), words);
  assert.equal(reportPaused(paused, NOW + 2 * MIN), '');
  assert.equal(reportPaused(bad, null), '');
  assert.equal(reportPaused(null, null), '');
});

test('scan report: a page RSI changed is the scan bar line, until a scan since goes fine', async () => {
  const { reportPageChanged } = await data();
  const { t } = await import('../ui/popup/copy.js');
  assert.equal(t('popup.rsi-page-changed'), 'RSI changed a page. Holding your last scan.');
  const base = { v: 1, run: 'r', at: NOW, ms: 9e3, held: null, signedOut: false, bad: 1 };
  const row = { id: 'hangar', ok: false, partial: null, n: null, error: 'x', pageChanged: true };
  const changed = { ...base, rows: [row] };
  assert.equal(reportPageChanged(changed, NOW - HOUR), true);
  assert.equal(reportPageChanged(changed, NOW + 2 * MIN), false, 'a scan since went fine');
  assert.equal(reportPageChanged({ ...base, rows: [{ ...row, pageChanged: undefined }] }), false);
  assert.equal(reportPageChanged(null, null), false);
});

test("scan report: the sync's question names the account the scan read", async () => {
  const { reportPilot } = await data();
  const ask = { v: 1, at: NOW, sync: { state: 'ask', msg: null, at: NOW } };
  const account = { loggedIn: true, nickname: 'New_Pilot', citizenRecord: '123' };
  assert.deepEqual(reportPilot(ask, { account }), { handle: 'New_Pilot', record: '123' });
  assert.deepEqual(reportPilot(ask, { account: null, db: { owner: { nickname: 'Owner' } } }), {
    handle: 'Owner',
    record: null,
  });
  assert.equal(reportPilot({ ...ask, sync: { state: 'sent', at: NOW } }, { account }), null);
  assert.equal(reportPilot({ ...ask, sync: null }, { account }), null);
  assert.equal(reportPilot(ask, {}), null, 'no handle known');
});

test('Account Value since an earlier scan: the newest one that differs, never this one', async () => {
  const { valueSince } = await data();
  const snap = (at, v) => ({ at, items: [['1', 'x', v]] });
  const valueOf = (s) => s.items[0][2];
  const history = [snap(NOW - 30 * DAY, 4000), snap(NOW - 2 * DAY, 4160), snap(NOW, 4280)];
  assert.deepEqual(valueSince(history, 4280, valueOf, NOW), { delta: 120, at: NOW - 2 * DAY });
  // The same value as before: the one before that.
  const same = [snap(NOW - 30 * DAY, 4000), snap(NOW - 2 * DAY, 4280), snap(NOW, 4280)];
  assert.deepEqual(valueSince(same, 4280, valueOf, NOW), { delta: 280, at: NOW - 30 * DAY });
  // Down is a change too.
  assert.equal(valueSince([snap(NOW - DAY, 4300)], 4280, valueOf, NOW).delta, -20);
  assert.equal(valueSince([snap(NOW, 4000)], 4280, valueOf, NOW), null, 'only this scan');
  assert.equal(valueSince([], 4280, valueOf, NOW), null);
  assert.equal(valueSince(null, 4280, valueOf, NOW), null);
});

test('Fleet News: the Wishlist first, then ships you own on sale, three at most', async () => {
  const { fleetNews } = await data();
  const m = (id, ...why) => ({ id, name: id, why: why.map((w) => ({ why: w, ships: [] })) });
  const items = [
    m('paint', 'paint'),
    m('ltd', 'limited'),
    m('wb', 'warbond'),
    m('wish', 'wishlist'),
    m('back', 'buyback'),
    m('wish2', 'wishlist', 'limited'),
  ];
  assert.deepEqual(
    fleetNews(items).map((x) => x.id),
    ['wish', 'wish2', 'ltd'],
  );
  // Unseen first within the same kind.
  assert.deepEqual(
    fleetNews(items, new Set(['wish2'])).map((x) => x.id),
    ['wish2', 'wish', 'ltd'],
  );
  assert.deepEqual(fleetNews([m('paint', 'paint'), m('back', 'buyback')]), []);
  assert.deepEqual(fleetNews(null), []);
});

test('the popup always opens on Hangar: no tab is kept between popups', async () => {
  const { TABS } = await data();
  assert.deepEqual(TABS, ['hangar', 'wishlist', 'settings']);
  const { cleanPrefs } = await import('../ui/popup/prefs.js');
  // A tab saved by 0.5.0 or before is dropped on the next save.
  assert.equal('tab' in cleanPrefs({ tab: 'wishlist' }), false);
  const popup = fs.readFileSync(path.join(ROOT, 'ui/popup/Popup.svelte'), 'utf8');
  assert.match(popup, /let tab = \$state\('hangar'\);/);
  assert.doesNotMatch(popup, /savePref\(\{ tab/);
  assert.doesNotMatch(popup, /prefs\.tab/);
});

test('Wishlist rows: named from the sale feed, on sale with the cheapest price, never guessed', async () => {
  const { wishRows } = await data();
  const feed = {
    ships: [
      { slug: 'avenger-titan', name: 'Avenger Titan' },
      { slug: 'zeus-mk-ii-cl', name: 'Zeus Mk II CL' },
    ],
    items: [
      {
        id: 'sku-10',
        kind: 'ship',
        name: 'Avenger Titan Warbond',
        price: 55,
        ships: ['avenger-titan'],
      },
      { id: 'sku-11', kind: 'ship', name: 'Avenger Titan', price: 70, ships: ['avenger-titan'] },
      { id: 'sku-20', kind: 'paint', name: 'Titan - Ghost Paint', price: 10, ships: [] },
      { id: 'upgrade-5', kind: 'upgrade', name: 'Titan to Cutlass Black', price: 55, ships: [] },
    ],
  };
  const keys = [
    'ship:avenger-titan',
    'ship:zeus-mk-ii-cl',
    'sku:20',
    'ccu:5',
    'sku:99',
    'ship:nope',
  ];
  assert.deepEqual(wishRows(keys, feed), {
    rows: [
      { key: 'ship:avenger-titan', name: 'Avenger Titan', onSale: true, price: 55 },
      { key: 'ship:zeus-mk-ii-cl', name: 'Zeus Mk II CL', onSale: false, price: null },
      { key: 'sku:20', name: 'Titan - Ghost Paint', onSale: true, price: 10 },
      { key: 'ccu:5', name: 'Titan to Cutlass Black', onSale: true, price: 55 },
    ],
    unnamed: 2,
  });
  assert.deepEqual(wishRows(['ship:avenger-titan'], null), { rows: [], unnamed: 1 });
  assert.deepEqual(wishRows(null, feed), { rows: [], unnamed: 0 });
  // No sale feed (alerts on, the feed not read yet): the ship list names the ships.
  const names = new Map([
    ['avenger-titan', 'Avenger Titan'],
    ['nope-not', 'Other'],
  ]);
  assert.deepEqual(wishRows(['ship:avenger-titan', 'ship:nope', 'sku:20'], null, names), {
    rows: [{ key: 'ship:avenger-titan', name: 'Avenger Titan', onSale: false, price: null }],
    unnamed: 2,
  });
  // The feed's own name wins.
  assert.equal(
    wishRows(['ship:avenger-titan'], feed, new Map([['avenger-titan', 'Old']])).rows[0].name,
    'Avenger Titan',
  );
});

test("Wishlist keys by the website's ship slug", async () => {
  const { shipSlug } = await data();
  assert.equal(shipSlug('Zeus Mk II CL'), 'zeus-mk-ii-cl');
  assert.equal(shipSlug('Avenger Titan'), 'avenger-titan');
  assert.equal(shipSlug("Hull C: 'Le Café'"), 'hull-c-le-cafe');
  assert.equal(shipSlug('  -- '), '');
  assert.equal(shipSlug(null), '');
});

// The read-only list when the website's Wishlist read doesn't answer for the tab (its 404):
// the store alerts' copy, as before, which asks nothing itself. The tab's own read is
// test/popup-wishlist.test.js.
test('the read-only Wishlist: the store alerts’ copy, and nothing with alerts off', async () => {
  const { readWishlist } = await import('../ui/popup/wishlist.js');
  const was = { chrome: globalThis.chrome, AL: globalThis.OHAlerts, fetch: globalThis.fetch };
  let store = {};
  const asked = [];
  globalThis.fetch = async (url) => {
    asked.push(String(url));
    throw new Error('the popup asks the website nothing');
  };
  globalThis.chrome = {
    storage: {
      local: {
        get: async (keys) =>
          Object.fromEntries(keys.filter((k) => k in store).map((k) => [k, store[k]])),
      },
    },
  };
  globalThis.OHAlerts = {
    ON_KEY: 'alertsOn',
    WISH_KEY: 'alertsWish',
    readWish: (j) => (Array.isArray(j?.keys) ? j.keys : null),
  };
  try {
    const link = { token: 't', connectedAt: 5 };
    const keys = ['ship:avenger-titan'];
    // Alerts off (the default): nothing read, even with the alerts' copy left over.
    store = { siteLink: link, alertsWish: { keys, connectedAt: 5, at: NOW } };
    assert.deepEqual(await readWishlist(), { off: true });
    store = { alertsOn: true, alertsWish: { keys, connectedAt: 5, at: NOW } };
    assert.deepEqual(await readWishlist(), { off: true }, 'not connected');
    // Alerts on: the copy for this connection, whatever its age.
    store = { siteLink: link, alertsOn: true, alertsWish: { keys, connectedAt: 5, at: 0 } };
    assert.deepEqual(await readWishlist(), { keys });
    // Another connection's copy, or none yet: not read yet.
    store = { siteLink: link, alertsOn: true, alertsWish: { keys, connectedAt: 4, at: NOW } };
    assert.deepEqual(await readWishlist(), { pending: true });
    store = { siteLink: link, alertsOn: true };
    assert.deepEqual(await readWishlist(), { pending: true });
    // The alerts' last read failed with nothing kept (a 401, a 404, a first failure).
    store = {
      siteLink: link,
      alertsOn: true,
      alertsWish: { keys: null, connectedAt: 5, at: null, retryAt: NOW + HOUR, fails: 1 },
    };
    assert.deepEqual(await readWishlist(), { failed: true });
    assert.deepEqual(asked, []);
  } finally {
    globalThis.chrome = was.chrome;
    globalThis.OHAlerts = was.AL;
    globalThis.fetch = was.fetch;
  }
});

test("Settings: a sync that didn't go through, never a retry promised", async () => {
  const { syncTrouble, reportSyncFailed } = await data();
  const connected = { name: 'p', lastSync: NOW - HOUR, waitUntil: NOW + 4 * MIN };
  assert.deepEqual(syncTrouble({ connected }, NOW), { until: NOW + 4 * MIN, msg: '' });
  const ok = { ...connected, waitUntil: null };
  assert.equal(syncTrouble({ connected: ok }, NOW), null);
  assert.deepEqual(syncTrouble({ connected: ok, failed: { msg: 'responded 500' } }, NOW), {
    until: null,
    msg: 'responded 500',
  });
  // The popup's words for a wait say when it can go, never that it retries.
  const { KEYS } = await import('../ui/popup/copy.js');
  assert.ok(!KEYS.includes('popup.retrying'));
  assert.equal(syncTrouble({ connected: null, failed: { msg: 'x' } }, NOW), null);
  // The last scan's sync failed after the last one that went through, not before.
  const report = { sync: { state: 'error', msg: 'responded 500', at: NOW } };
  assert.deepEqual(reportSyncFailed(report, { lastSync: NOW - HOUR }), { msg: 'responded 500' });
  assert.equal(reportSyncFailed(report, { lastSync: NOW + MIN }), null);
  assert.equal(reportSyncFailed({ sync: { state: 'sent', at: NOW } }, null), null);
  assert.equal(reportSyncFailed(null, null), null);
});

test('the portrait: only the copy the scan saved, only for this account', async () => {
  const { portrait } = await data();
  const src = 'data:image/jpeg;base64,/9j/4AAQ';
  assert.equal(portrait({ nickname: 'Demo_Citizen', src, at: NOW }, 'demo_citizen'), src);
  assert.equal(portrait({ nickname: 'Someone', src }, 'Demo_Citizen'), null, 'another account');
  // Never an address the popup would fetch (the privacy policy: it never asks RSI).
  const rsi = 'https://cdn.robertsspaceindustries.com/static/images/account/avatar_default_big.jpg';
  assert.equal(portrait({ nickname: 'Demo_Citizen', src: rsi }, 'Demo_Citizen'), null);
  assert.equal(portrait({ nickname: 'x', src: 'data:text/html;base64,PGI+' }, 'x'), null);
  assert.equal(portrait(null, 'x'), null);
});

test('the shortcut: the browser’s for opening the popup, or none', async () => {
  const { popupShortcut } = await data();
  assert.equal(
    popupShortcut([{ name: '_execute_action', shortcut: 'Alt+Shift+O' }], false),
    'Alt+Shift+O',
  );
  assert.equal(popupShortcut([{ name: '_execute_action', shortcut: '' }]), '');
  // Mac: its symbols, in its order (the owner's pick, 2026-10-22).
  const mac = (s) => popupShortcut([{ name: '_execute_action', shortcut: s }], true);
  assert.equal(mac('Alt+Shift+O'), '⌥⇧O', 'Firefox on a Mac');
  assert.equal(mac('Option+Shift+O'), '⌥⇧O');
  assert.equal(mac('⌥⇧O'), '⌥⇧O', 'Chrome and Edge on a Mac already hold symbols');
  assert.equal(mac('Ctrl+Shift+Y'), '⇧⌘Y', 'Ctrl is ⌘ there, and ⇧ comes first');
  assert.equal(mac('Command+Alt+MacCtrl+Shift+K'), '⌃⌥⇧⌘K');
  assert.equal(mac('MacCtrl+Comma'), '⌃Comma');
  assert.equal(mac(''), '');
  assert.equal(popupShortcut([{ name: 'other' }], true), null);
  assert.equal(popupShortcut(null, true), null);
  const other = (s) => popupShortcut([{ name: '_execute_action', shortcut: s }], false);
  assert.equal(other('Alt+Shift+O'), 'Alt+Shift+O', 'Windows and Linux keep their words');
  assert.equal(other(''), '');
  const { isMac } = await data();
  assert.equal(isMac({ userAgentData: { platform: 'macOS' }, platform: 'x' }), true);
  assert.equal(isMac({ platform: 'MacIntel' }), true);
  assert.equal(isMac({ platform: 'Win32' }), false);
  assert.equal(isMac({ userAgentData: { platform: 'Windows' }, platform: 'MacIntel' }), false);
  assert.equal(isMac({}), false);
  assert.equal(popupShortcut([{ name: 'other' }]), null);
  assert.equal(popupShortcut(null), null, 'no shortcuts in this browser');
  // manifest.json suggests it for every build; the store check keeps it there
  // (scripts/connector.mjs, test/connector-build.test.js).
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  assert.deepEqual(m.commands._execute_action.suggested_key, {
    default: 'Alt+Shift+O',
    mac: 'Alt+Shift+O',
  });
});

test('the popup settings: anything odd stored reads as the defaults', async () => {
  const { cleanPrefs, LOOKS, CURRENCIES } = await import('../ui/popup/prefs.js');
  assert.deepEqual(LOOKS, ['auto', 'dark', 'light']);
  assert.equal(CURRENCIES[0], 'USD');
  // No currency picked yet: '' (US dollars then, ui/popup/currency.js).
  const def = { look: 'auto', currency: '', seenVersion: '', reportSeenAt: 0 };
  assert.deepEqual(cleanPrefs(undefined), def);
  assert.deepEqual(cleanPrefs([]), def);
  assert.deepEqual(cleanPrefs({ look: 'neon', currency: 'XYZ', reportSeenAt: 'x' }), def);
  assert.deepEqual(cleanPrefs({ look: 'light', seenVersion: '0.4.0', reportSeenAt: NOW }), {
    ...def,
    look: 'light',
    seenVersion: '0.4.0',
    reportSeenAt: NOW,
  });
  assert.equal(cleanPrefs({ currency: 'EUR' }).currency, 'EUR');
  assert.equal(cleanPrefs({ currency: 'USD' }).currency, 'USD', 'USD picked stays picked');
});

test("popup copy: Title Case labels, no em dashes, and the basic page's words word for word", async () => {
  const { t, KEYS } = await import('../ui/popup/copy.js');
  const basic = await import('../ui/basic/copy.js');
  for (const k of KEYS) assert.doesNotMatch(t(k), /—/, `${k}: no em dash`);
  // One and many.
  assert.equal(t('popup.csv-saved', { n: 1 }), 'Saved 1 row to a CSV file.');
  assert.equal(t('popup.csv-saved', { n: 3 }), 'Saved 3 rows to a CSV file.');
  for (const k of KEYS.filter((k) => k.endsWith('.one')))
    assert.ok(KEYS.includes(k.slice(0, -4)), `${k} has its many`);
  // Copied from the basic page: the same words.
  const SAME = {
    'popup.scanning-short': 'basic.scanning',
    'popup.tabs': 'basic.tabs',
    'popup.tab-settings': 'basic.tab-settings',
    'popup.scan-problem': 'basic.scan-problem',
    'popup.syncing': 'basic.syncing',
    'popup.firefox-no': 'basic.firefox-no',
    'popup.update-ready': 'basic.update-ready',
    'popup.update-reload': 'basic.update-reload',
    'popup.pilot-yes': 'basic.pilot-yes',
    'popup.pilot-no': 'basic.pilot-no',
    'popup.pilot-body': 'basic.pilot-body',
    'popup.store-alerts': 'basic.alerts-title',
    'popup.json-saved': 'basic.json-saved',
    'popup.clear-ask': 'basic.clear-ask',
    'popup.keep-data': 'basic.keep-data',
    'popup.cleared': 'basic.cleared',
    'popup.account-live': 'basic.account-live',
    'popup.account-remove': 'basic.account-remove',
    'popup.account-remove-ask': 'basic.account-remove-ask',
    'popup.logged-out': 'basic.logged-out',
    'popup.logout-failed': 'basic.logout-failed',
    'popup.row-referrals': 'basic.row-referrals-box',
  };
  for (const [mine, theirs] of Object.entries(SAME)) assert.equal(t(mine), basic.t(theirs), mine);
  for (const n of [1, 42]) {
    assert.equal(t('popup.row-pledges', { n }), basic.t('basic.row-pledges', { n }));
    assert.equal(t('popup.row-buybacks', { n }), basic.t('basic.row-buybacks', { n }));
  }
  assert.equal(
    t('popup.pilot-title', { handle: 'X' }),
    basic.t('basic.pilot-title', { handle: 'X' }),
  );
  assert.equal(
    t('popup.account-line', { n: 1, when: 'x' }),
    basic.t('basic.account-line', { n: 1, when: 'x' }),
  );
  assert.equal(
    t('popup.switched-back', { who: 'X' }),
    basic.t('basic.switched-back', { who: 'X' }),
  );
  assert.equal(t('popup.switched-new', { who: 'X' }), basic.t('basic.switched-new', { who: 'X' }));
  // The dashboard's Disconnect question, word for word.
  const dc = fs.readFileSync(path.join(ROOT, 'ui/site/YouDisconnect.svelte'), 'utf8');
  for (const k of ['popup.disconnect-ask', 'popup.stay'])
    assert.ok(dc.includes(t(k)), `${k} is the dashboard's`);
  // Headings, buttons and links in Title Case (small words and openhangar.space aside).
  const LABELS = [
    'popup.new-in',
    'popup.what-changed',
    'popup.got-it',
    'popup.fleet-news',
    'popup.all-alerts',
    'popup.scan-again',
    'popup.first',
    'popup.log-in',
    'popup.open-store',
    'popup.wish-empty',
    'popup.wish-full',
    'popup.wish-trouble',
    'popup.wish-connect',
    'popup.sync-trouble',
    'popup.auto-scan',
    'popup.look-auto',
    'popup.shortcut-none',
    'popup.shortcut-change',
    'popup.disconnect-ask',
    'popup.stay',
  ];
  const SMALL = new Set(['a', 'an', 'and', 'at', 'for', 'in', 'of', 'on', 'the', 'to', 'from']);
  for (const k of LABELS)
    for (const w of t(k, { version: '0.4.0' }).split(/\s+/).slice(1))
      if (/^[a-z]/.test(w) && !SMALL.has(w) && !/^openhangar\.space/.test(w))
        assert.fail(`${k}: "${w}" in Title Case`);
  // The owner's approved words (2026-10-14), word for word.
  const APPROVED = {
    'popup.token-next': 'Next refill {date}',
    'popup.fleet-news-none': 'No news for your ships right now.',
    'popup.wish-search': 'Add a ship, paint or upgrade',
    'popup.wish-search-ships': 'Add a ship',
    'popup.wish-no-match': 'No matches.',
    'popup.wish-not-added': "Couldn't add {name}.",
    'popup.wish-remove': 'Remove {name}',
    'popup.export-json': 'JSON Backup',
    'popup.export-pledges': 'Pledges CSV',
    'popup.export-buybacks': 'Buy-Backs CSV',
    'popup.auto-first': 'Runs once a day while your browser is open.',
    'popup.auto-quick': 'Last: {when}, no changes',
    'popup.auto-full': 'Last: {when}, hangar updated',
    'popup.auto-signed-out': 'Skipped {when}: signed out of RSI',
    'popup.auto-other': 'Skipped {when}: a different RSI account is signed in',
    'popup.auto-paused': 'Skipped {when}: scans are paused',
    'popup.auto-bad': "Last: {when}, something looked wrong and wasn't saved. Scan to check.",
    'popup.auto-stopped': 'Last: {when}, RSI stopped answering partway. Scan to check.',
    'popup.auto-out-partway': 'Last: {when}, signed out of RSI partway. Scan to check.',
    // {when}'s form on the day it ran ("today 6:12 AM", the approved status lines').
    'popup.auto-today': 'today {time}',
  };
  // The retired line (replaced 2026-10-14) is gone for good.
  for (const k of KEYS) assert.ok(!/kept your last good scan/.test(t(k)), `${k}: retired words`);
  for (const [k, words] of Object.entries(APPROVED)) assert.equal(t(k), words, k);
  for (const k of ['popup.export-json', 'popup.export-pledges'])
    for (const w of t(k).split(/\s+/)) assert.match(w, /^[A-Z]/, `${k}: Title Case`);
  // Only the words still waiting for the owner's OK carry the mark, each one said
  // beside it (NEW_WORDS lists them for the PR).
  const { NEW_WORDS } = await import('../ui/popup/copy.js');
  const src = fs.readFileSync(path.join(ROOT, 'ui/popup/copy.js'), 'utf8');
  const marked = src
    .split('\n')
    .filter((l) => /^\s+'popup\.[^']+':.*NEW: needs the owner's OK/.test(l))
    .map((l) => /'(popup\.[^']+)'/.exec(l)[1]);
  assert.deepEqual(marked, NEW_WORDS);
  for (const k of NEW_WORDS) assert.ok(KEYS.includes(k), k);
});
