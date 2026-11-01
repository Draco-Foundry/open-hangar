'use strict';
// The Daily Scan Reminder (it replaced Auto Scan Daily, #666): the worker's block
// (src/background.js, the `autoScan` flag, in the sandbox of test/bridge-env.js) and
// check 6 of the privacy notes as it stands now: only store alerts and the reminder use
// alarms, and the reminder never reads RSI on its own. Its popup line is in
// test/popup.test.js. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CHROME_ID, STORE_FLAGS, cutFlags, loadBackground } = require('./bridge-env.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const H = 3600e3;
const MIN = 60e3;
const DAY = 24 * H;
const ALARM = 'oh-scan-reminder';

const LINK = { siteLink: { token: 't', name: 'pilot', connectedAt: 1, lastSync: null } };
const scanned = (at) => ({
  db: { schemaVersion: 5, sources: { hangar: { scannedAt: at, items: [] } } },
});
// The store build's worker, connected, notifications allowed unless `notify` says no.
function worker(o = {}) {
  const x = loadBackground({
    changes: true,
    offscreen: true,
    notify: true,
    ...o,
    local: { ...LINK, ...(o.local || {}) },
  });
  const fetched = [];
  x.ctx.fetch = async (url) => {
    fetched.push(String(url));
    throw new Error('no network here');
  };
  return { ...x, fetched };
}
async function until(ok, ms = 1500) {
  const end = Date.now() + ms;
  while (!ok()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 2));
  }
}
const settle = () => new Promise((r) => setTimeout(r, 30));
const alarm = (x) => x.alarms.get(ALARM);
const within = (t, from, to) => assert.ok(t >= from && t <= to, `${t - from} ms from ${from}`);
// The alarm going off now, and the worker done with it.
async function fire(x) {
  await until(() => alarm(x));
  await x.fireAlarm(ALARM, { scheduledTime: Date.now() });
  await settle();
}

test('turning it on: a check in a minute; off, none; not connected, off for good', async () => {
  const x = worker();
  await settle();
  assert.equal(alarm(x), undefined, 'off: none');
  const t0 = Date.now();
  await x.chrome.storage.local.set({ scanReminderOn: true });
  await until(() => alarm(x));
  within(alarm(x).when, t0 + MIN, Date.now() + MIN);
  await x.chrome.storage.local.set({ scanReminderOn: false });
  await until(() => !alarm(x));
  // Disconnected (by any route): the switch goes too.
  await x.chrome.storage.local.set({ scanReminderOn: true });
  await until(() => alarm(x));
  await x.chrome.storage.local.remove('siteLink');
  await until(() => !alarm(x));
  assert.equal(x.stores.local.scanReminderOn, undefined);
  // A worker starting not connected: off.
  const y = worker({ local: { siteLink: undefined, scanReminderOn: true } });
  await settle();
  assert.equal(alarm(y), undefined);
  assert.equal(y.stores.local.scanReminderOn, undefined);
});

test('the last scan over a day old: one notification in the approved words, nothing read', async () => {
  const t0 = Date.now();
  // Midday two calendar days back, so "2 days ago" holds at any hour (2 days and an hour
  // back is three calendar days just after midnight; the 0.5.5 release run hit it at 00:58).
  const last = new Date(t0);
  last.setHours(12, 0, 0, 0);
  last.setDate(last.getDate() - 2);
  const x = worker({ local: { scanReminderOn: true, ...scanned(last.getTime()) } });
  await fire(x);
  assert.equal(x.notes.length, 1);
  const [n] = x.notes;
  assert.equal(n.id, ALARM);
  assert.equal(n.title, 'Time to Scan');
  assert.equal(n.message, 'Your last scan was 2 days ago. Click here to scan your hangar.');
  assert.equal(x.stores.local.scanReminder.line, 'shown');
  within(x.stores.local.scanReminder.at, t0, Date.now());
  // The next check a day on; nothing asked of RSI or anyone, no page, no tab.
  within(alarm(x).when, t0 + DAY, Date.now() + DAY);
  assert.deepEqual(x.fetched, []);
  assert.equal(x.docs.length, 0, 'no hidden page');
  assert.deepEqual(x.opened, []);
  assert.equal(x.stores.session.scanRequest, undefined);
  assert.equal(x.stores.session.scanAskedAt, undefined);
});

test('{when}: yesterday, 2 to 6 days ago, then the date', async () => {
  const at = (days, hour = 12) => {
    const d = new Date();
    d.setHours(hour, 0, 0, 0);
    d.setDate(d.getDate() - days);
    return Math.min(d.getTime(), Date.now() - DAY - MIN);
  };
  const said = async (when) => {
    const x = worker({ local: { scanReminderOn: true, ...scanned(when) } });
    await fire(x);
    return x.notes[0]?.message.replace(/^Your last scan was (.*)\. Click here.*$/, '$1');
  };
  assert.equal(await said(at(1, 0)), 'yesterday');
  for (const n of [2, 6]) assert.equal(await said(at(n)), `${n} days ago`);
  const old = at(9);
  assert.equal(
    await said(old),
    new Date(old).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  );
});

test('not due: a scan in the last day, a reminder in the last day, or no scan at all', async () => {
  const t0 = Date.now();
  // Scanned 3 hours ago: the next check a day after that scan.
  const a = worker({ local: { scanReminderOn: true, ...scanned(t0 - 3 * H) } });
  await fire(a);
  assert.equal(a.notes.length, 0);
  assert.equal(alarm(a).when, t0 - 3 * H + DAY);
  assert.equal(a.stores.local.scanReminder, undefined);
  // Scanned days ago, reminded 2 hours ago: a day after the reminder.
  const shown = { at: t0 - 2 * H, line: 'shown' };
  const b = worker({
    local: { scanReminderOn: true, scanReminder: shown, ...scanned(t0 - 3 * DAY) },
  });
  await fire(b);
  assert.equal(b.notes.length, 0);
  assert.equal(alarm(b).when, shown.at + DAY);
  // Nothing scanned in this browser: nothing to remind of, checked again in a day.
  const c = worker({ local: { scanReminderOn: true } });
  await fire(c);
  assert.equal(c.notes.length, 0);
  within(alarm(c).when, t0 + DAY, Date.now() + DAY);
  // A scan asked for or running now: none.
  const d = worker({
    local: { scanReminderOn: true, ...scanned(t0 - 3 * DAY) },
    session: { scanRequest: { at: Date.now(), tabId: 7, reason: 'popup', by: 'tab' } },
  });
  await fire(d);
  assert.equal(d.notes.length, 0);
});

test('scans paused by the status file: the day skipped, its line kept, no notification', async () => {
  for (const id of ['autoScan', 'hangar']) {
    const remoteStatus = { at: Date.now(), data: { sources: { [id]: { enabled: false } } } };
    const x = worker({
      local: { scanReminderOn: true, remoteStatus, ...scanned(Date.now() - 3 * DAY) },
    });
    await fire(x);
    assert.equal(x.notes.length, 0, id);
    assert.equal(x.stores.local.scanReminder.line, 'paused', id);
    assert.deepEqual(x.fetched, [], 'the cached copy, nothing fetched');
  }
  // Another part paused: the reminder still goes.
  const remoteStatus = { at: Date.now(), data: { sources: { referrals: { enabled: false } } } };
  const y = worker({
    local: { scanReminderOn: true, remoteStatus, ...scanned(Date.now() - 3 * DAY) },
  });
  await fire(y);
  assert.equal(y.notes.length, 1);
});

test('without notifications it turns itself off: at the check, or when they are taken back', async () => {
  const x = worker({ notify: false, local: { scanReminderOn: true, ...scanned(0) } });
  await fire(x);
  assert.equal(x.stores.local.scanReminderOn, false);
  assert.equal(x.notes.length, 0);
  await until(() => !alarm(x));
  const y = worker({ local: { scanReminderOn: true } });
  await until(() => alarm(y));
  await y.revoke();
  await until(() => y.stores.local.scanReminderOn === false && !alarm(y));
});

test('its notification clicked: the popup Scan, in the hidden page; other ids untouched', async () => {
  const x = worker({ local: { scanReminderOn: true, ...scanned(Date.now() - 3 * DAY) } });
  await fire(x);
  await x.clickNote('oh-alerts:sku-1');
  await settle();
  assert.equal(x.docs.length, 0, "an alert's click is the alerts' own");
  const alertTabs = [...x.opened];
  await x.clickNote(ALARM);
  await until(() => x.docs.length === 1);
  assert.match(x.docs[0].url, /^src\/scan\.html\?run=[\w-]+&by=offscreen&v=/);
  assert.equal(x.stores.session.scanRequest.reason, 'popup');
  assert.deepEqual(x.opened, alertTabs, 'no tab');
  // Clicked again while it runs: busy, and still no tab (the hidden page has none).
  await x.clickNote(ALARM);
  await settle();
  assert.equal(x.docs.length, 1);
  assert.deepEqual(x.opened, alertTabs);
});

test('a scan saved: a reminder still up goes', async () => {
  const x = worker({ local: { scanReminderOn: true, ...scanned(Date.now() - 3 * DAY) } });
  const cleared = [];
  x.chrome.notifications.clear = async (id) => void cleared.push(id);
  await fire(x);
  await x.chrome.storage.local.set(scanned(Date.now()));
  await until(() => cleared.includes(ALARM));
});

test('from Auto Scan Daily: on with notifications allowed stays on as the reminder, else off', async () => {
  const old = {
    autoScan: { v: 1, at: 1, line: 'quick' },
    autoScanNext: Date.now() + H,
    autoScanRetry: 1,
    scanFull: { hangar: 1 },
  };
  const gone = ['autoScanOn', 'autoScan', 'autoScanNext', 'autoScanRetry', 'scanFull'];
  const x = worker({ local: { autoScanOn: true, ...old } });
  x.alarms.set('oh-auto-scan', { name: 'oh-auto-scan', scheduledTime: Date.now() + H });
  await until(() => alarm(x));
  assert.equal(x.stores.local.scanReminderOn, true);
  for (const k of gone) assert.equal(k in x.stores.local, false, k);
  assert.equal(x.alarms.has('oh-auto-scan'), false, 'its alarm goes');
  // Notifications not allowed: off.
  const y = worker({ notify: false, local: { autoScanOn: true, ...old } });
  await until(() => !('autoScanOn' in y.stores.local));
  assert.equal(y.stores.local.scanReminderOn, undefined);
  // It was off: still off. Not connected any more: off.
  const z = worker({ local: { autoScanOn: false, ...old } });
  await until(() => !('autoScan' in z.stores.local));
  assert.equal(z.stores.local.scanReminderOn, undefined);
  const w = worker({ local: { siteLink: undefined, autoScanOn: true } });
  await until(() => !('autoScanOn' in w.stores.local));
  assert.equal(w.stores.local.scanReminderOn, undefined);
  // A switch already set is left as it is.
  const v = worker({ local: { autoScanOn: true, scanReminderOn: false } });
  await until(() => !('autoScanOn' in v.stores.local));
  assert.equal(v.stores.local.scanReminderOn, false);
});

test("a scan request with reason 'auto' goes to the runner, which holds it without the flag", () => {
  const page = read('ui/scan/main.js');
  assert.match(page, /\['site', 'auto'\]\.includes\(r\.reason\)/);
  assert.doesNotMatch(page, /autoScan\(/);
  // The runner's check (test/scan-runner.test.js has each case).
  assert.match(read('ui/scan/runner.js'), /if \(!flag\('autoScanRun'\)\) return 'off';/);
});

test("store alerts' alarm and the reminder's never clear each other", async () => {
  const x = worker({ local: { scanReminderOn: true, alertsOn: true } });
  await until(() => alarm(x) && x.alarms.has('oh-alerts'));
  await x.chrome.storage.local.set({ alertsOn: false });
  await until(() => !x.alarms.has('oh-alerts'));
  assert.ok(alarm(x), 'alerts off: the reminder stays');
  await x.chrome.storage.local.set({ alertsOn: true });
  await until(() => x.alarms.has('oh-alerts'));
  await x.chrome.storage.local.set({ scanReminderOn: false });
  await until(() => !alarm(x));
  assert.ok(x.alarms.has('oh-alerts'), 'the reminder off: alerts stay');
});

test('the worker starting, or the popup opening, clears what a stopped scan left', async () => {
  // A fresh copy each time: a worker's storage is the object it's handed.
  const quiet = () => ({
    scanRunning: { at: Date.now() - 3 * MIN, tabId: null, run: 'r9', by: 'offscreen' },
    scanProgress: { run: 'r9', at: Date.now() - 3 * MIN, part: 'hangar', page: 2 },
  });
  const x = worker({ session: quiet() });
  await until(() => !x.stores.session.scanRunning && !x.stores.session.scanProgress);
  // A scan with a fresh heartbeat is left alone.
  const fresh = {
    scanRunning: { ...quiet().scanRunning, at: Date.now() - 20e3 },
    scanProgress: { ...quiet().scanProgress, at: Date.now() - 5e3 },
  };
  const y = worker({ session: structuredClone(fresh) });
  await settle();
  assert.deepEqual(y.stores.session.scanRunning, fresh.scanRunning);
  assert.deepEqual(y.stores.session.scanProgress, fresh.scanProgress);
  // It goes quiet while the worker runs: the popup opening clears it.
  await y.chrome.storage.session.set(quiet());
  await y.sendInternal(
    { ohPopup: 'opened' },
    { id: CHROME_ID, url: `chrome-extension://${CHROME_ID}/src/popup.html` },
  );
  await until(() => !y.stores.session.scanRunning && !y.stores.session.scanProgress);
});

// --- Check 6: only store alerts and the reminder use alarms; it never reads RSI ----------

test('check 6: every alarm is the alerts or the reminder; the reminder reads nothing', () => {
  const files = fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /\.js$/.test(f));
  const made = [];
  for (const f of files)
    for (const m of read(`src/${f}`).matchAll(/chrome\.alarms\.create\(\s*([^,]+),/g))
      made.push(`${f}: ${m[1].trim()}`);
  for (const m of made) assert.match(m, /: (self\.OHAlerts\.ALARM|AL\.ALARM|REMIND_ALARM)$/, m);
  assert.ok(made.includes('background.js: REMIND_ALARM'), made.join(', '));
  assert.ok(made.includes('background.js: AL.ALARM'), made.join(', '));
  const bg = read('src/background.js');
  const blocks = [
    ...bg.matchAll(/@flag-start autoScan:[^\n]*\n([\s\S]*?)@flag-end autoScan\n/g),
  ].map((m) => m[1].replace(/^\s*\/\/.*$/gm, ''));
  assert.equal(blocks.length, 1, 'one block');
  const [block] = blocks;
  // No network, no cookies, no RSI; a scan only from its notification's click.
  assert.doesNotMatch(block, /fetch\(|chrome\.cookies|robertsspaceindustries/);
  assert.equal([...block.matchAll(/requestScan\(/g)].length, 1);
  assert.match(block, /async function remindClicked\(id\) \{[\s\S]*?requestScan\('popup'\)/);
  // Auto Scan Daily's run is gone from every page.
  assert.equal(fs.existsSync(path.join(ROOT, 'ui/scan/auto.js')), false);
  assert.doesNotMatch(read('ui/scan/runner.js'), /autoScan\(|scanFull/);
  // Auto Scan (the autoScanRun flag, beta only) asks the hidden page for one scan and
  // reads nothing itself; a build without it has none of it.
  const runs = [
    ...bg.matchAll(/@flag-start autoScanRun:[^\n]*\n([\s\S]*?)@flag-end autoScanRun\n/g),
  ].map((m) => m[1].replace(/^\s*\/\/.*$/gm, ''));
  assert.equal(runs.length, 1, 'one Auto Scan block');
  assert.doesNotMatch(runs[0], /fetch\(|chrome\.cookies|robertsspaceindustries/);
  assert.deepEqual(
    [...runs[0].matchAll(/requestScan\([^)]*\)/g)].map((m) => m[0]),
    ["requestScan('auto', { hiddenOnly: true })"],
  );
  assert.equal([...bg.matchAll(/requestScan\('auto'/g)].length, 1);
  assert.doesNotMatch(
    cutFlags(bg, { sync: true, localMode: true, connector: true, alerts: true, autoScan: true }),
    /requestScan\('auto'|autoScanRunOn/,
  );
  // A build without the flag has none of it.
  const off = cutFlags(bg, {
    sync: true,
    localMode: true,
    connector: true,
    alerts: true,
    autoScan: false,
  });
  assert.doesNotMatch(off, /oh-scan-reminder|scanReminderOn|REMIND_ALARM/);
});

// --- Auto Scan (the autoScanRun flag, the beta's set) ----------------------------------
// With Auto Scan on too, the reminder's alarm asks the hidden scan page for a scan
// (reason 'auto') instead of the notification; the page checks the account
// (test/scan-runner.test.js). Its report decides: read it all, the line says so; held
// (signed out, another account) or short, the reminder's notification after all.
const BETA = { ...STORE_FLAGS, autoScanRun: true };
const OLD = Date.now() - 2 * DAY;
const autoWorker = (o = {}) =>
  worker({
    flags: BETA,
    ...o,
    local: { scanReminderOn: true, autoScanRunOn: true, ...scanned(OLD), ...(o.local || {}) },
  });
// The scan page's report for the scan asked of it.
const report = (x, more) =>
  x.chrome.storage.local.set({
    scanReport: {
      v: 1,
      run: x.stores.session.scanRequest.run,
      reason: 'auto',
      startedAt: Date.now(),
      at: Date.now(),
      held: null,
      signedOut: false,
      rows: [],
      bad: false,
      ...more,
    },
  });

test('auto: the reminder due, the hidden page scans instead; nothing read here, no tab', async () => {
  const t0 = Date.now();
  const x = autoWorker();
  await fire(x);
  assert.equal(x.notes.length, 0, 'no notification');
  assert.equal(x.docs.length, 1, 'the hidden page');
  assert.equal(x.stores.session.scanRequest.reason, 'auto');
  assert.deepEqual(x.opened, [], 'no tab');
  assert.deepEqual(x.fetched, [], 'the worker asks RSI nothing');
  assert.equal(x.stores.local.scanReminder.line, 'auto');
  within(alarm(x).when, t0 + DAY, Date.now() + DAY);
  // It read everything: the line says so, no notification.
  await report(x, { rows: [{ id: 'hangar', ok: true }] });
  await until(() => x.stores.local.scanReminder.line === 'scanned');
  assert.equal(x.notes.length, 0);
});

test('auto: held by the account check or signed out, the reminder notification instead', async () => {
  for (const more of [
    { held: 'other-account' },
    { held: 'signed-out', signedOut: true },
    { held: 'no-account' },
    { held: 'no-owner' },
    { held: 'not-linked' },
    { bad: true, rows: [{ id: 'hangar', ok: false }] },
    { signedOut: true, rows: [{ id: 'hangar', ok: true }] },
  ]) {
    const x = autoWorker();
    await fire(x);
    await report(x, more);
    await until(() => x.notes.length === 1);
    assert.equal(x.notes[0].title, 'Time to Scan', JSON.stringify(more));
    assert.equal(x.stores.local.scanReminder.line, 'shown');
    // Its second write (after the sync) is the same run: no second notification.
    await x.chrome.storage.local.set({
      scanReport: { ...x.stores.local.scanReport, sync: { state: 'off' } },
    });
    await settle();
    assert.equal(x.notes.length, 1);
  }
  // Paused or another scan running: no reason to scan, so no notification.
  for (const held of ['paused', 'busy']) {
    const x = autoWorker();
    await fire(x);
    await report(x, { held });
    await settle();
    assert.equal(x.notes.length, 0, held);
  }
});

test('auto: off, no hidden page, or a store build: the notification as before', async () => {
  const off = autoWorker({ local: { autoScanRunOn: false } });
  await fire(off);
  assert.equal(off.notes.length, 1);
  assert.equal(off.stores.session.scanRequest, undefined);
  // No hidden page (offscreen documents off): never a tab, the notification instead, and
  // the popup's Scan isn't held back by it.
  const none = autoWorker({ offscreen: false });
  await fire(none);
  assert.deepEqual(none.opened, []);
  assert.equal(none.notes.length, 1);
  assert.ok(!none.stores.session.scanAskedAt, 'it did not count as a request');
  // The store build has no Auto Scan: the switch does nothing.
  const store = autoWorker({ flags: STORE_FLAGS });
  await fire(store);
  assert.equal(store.notes.length, 1);
  assert.equal(store.docs.length, 0);
  // The reminder off: no alarm, so nothing at all.
  const quiet = autoWorker({ local: { scanReminderOn: false } });
  await settle();
  assert.equal(alarm(quiet), undefined);
});
