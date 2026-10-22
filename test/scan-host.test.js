'use strict';
// The hidden scan page (src/scan-host.js in the background worker, src/scan-shim.js and
// ui/scan/main.js in the page): where a scan runs (Chrome and Edge's offscreen document,
// Firefox's frame, the tab as the fallback), the kill switch, the one message type the
// page may send and who may send it, its marks and its end, and the update that waits
// for it. The worker as scripts/pack.mjs builds it (test/bridge-env.js). Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { HANGAR, CHROME_ID, loadBackground } = require('./bridge-env.js');

const CONNECTOR = {
  sync: true,
  orgFleet: false,
  localMode: true,
  connector: true,
  wishlistImport: true,
};
const POPUP = `chrome-extension://${CHROME_ID}/src/popup.html`;
const BASIC = `chrome-extension://${CHROME_ID}/src/basic.html`;
const SCAN = `chrome-extension://${CHROME_ID}/src/scan.html`;
const fromPopup = (x, msg = { ohPopup: 'scan' }) =>
  x.sendInternal(msg, { id: CHROME_ID, url: POPUP });
const host = (x) => vm.runInContext('scanHost', x.ctx);
const runOf = (url) => new URL(url, 'chrome-extension://x/').searchParams.get('run');
const tick = () => new Promise((r) => setTimeout(r, 0));
// A minute later: requestScan's limit (in the worker's memory and in session storage)
// lets the next one through.
function later(x) {
  x.stores.session.scanAskedAt = 0;
  vm.runInContext('scanAskedAt = 0', x.ctx);
}
const chromeX = (o = {}) => loadBackground({ flags: CONNECTOR, offscreen: true, ...o });
const firefoxX = (o = {}) =>
  loadBackground({ browser: 'firefox', flags: CONNECTOR, frames: true, contexts: [], ...o });

// --- Where a scan runs ----------------------------------------------------------------

test('Chrome and Edge: the popup Scan opens the offscreen page, no tab', async () => {
  const x = chromeX();
  const r = await fromPopup(x);
  assert.deepEqual(r, { ok: true, opened: false, by: 'offscreen' });
  assert.deepEqual(x.opened, [], 'no tab');
  assert.deepEqual(x.focused, []);
  assert.equal(x.docs.length, 1);
  const doc = x.docs[0];
  assert.deepEqual(doc.reasons, ['DOM_PARSER']);
  assert.match(doc.justification, /RSI pages as HTML.*DOMParser.*without opening a tab/);
  const url = new URL(doc.url, 'chrome-extension://x/');
  assert.equal(url.pathname, '/src/scan.html');
  assert.equal(url.searchParams.get('by'), 'offscreen');
  // The version the page can't read itself (src/scan-shim.js).
  assert.equal(url.searchParams.get('v'), '0.3.0');
  // The request names the page's run, never a tab.
  const req = x.stores.session.scanRequest;
  assert.deepEqual(Object.keys(req).sort(), ['at', 'by', 'reason', 'run', 'tabId']);
  assert.equal(req.run, url.searchParams.get('run'));
  assert.match(req.run, /^[a-z0-9]+-[0-9a-f]{12}$/);
  assert.equal(req.tabId, null);
  assert.equal(req.by, 'offscreen');
  assert.equal(req.reason, 'popup');
  assert.equal(x.stores.session.scanAskedBy, 'offscreen');
  // Scanning: the popup's next Scan is busy and opens nothing.
  later(x);
  assert.deepEqual(await fromPopup(x), { ok: false, error: 'busy' });
  assert.deepEqual(x.opened, []);
  assert.equal(x.docs.length, 1);
});

test('Firefox: the popup Scan opens a hidden frame in the event page, no tab', async () => {
  const x = firefoxX();
  const r = await x.sendInternal(
    { ohPopup: 'scan' },
    { id: 'open-hangar@draco-foundry', url: 'moz-extension://uuid/src/popup.html' },
  );
  assert.deepEqual(r, { ok: true, opened: false, by: 'frame' });
  assert.deepEqual(x.opened, []);
  assert.equal(x.frames.length, 1);
  const f = x.frames[0];
  assert.equal(f.tag, 'iframe');
  assert.equal(f.id, 'oh-scan');
  assert.equal(f.hidden, true);
  assert.equal(f.attrs['aria-hidden'], 'true');
  assert.match(f.src, /^moz-extension:\/\/uuid\/src\/scan\.html\?run=[\w-]+&by=frame&v=0\.3\.0$/);
  assert.equal(x.stores.session.scanRequest.run, runOf(f.src));
  assert.equal(x.stores.session.scanRequest.by, 'frame');
});

test('our hangar page: the same scan, and the answer the website knows', async () => {
  const x = chromeX();
  // Bridge v2's answer stays { ok, opened: true } wherever the scan runs (the website is
  // coordinated with it).
  assert.deepEqual(await x.send({ type: 'oh-request-scan' }, HANGAR), { ok: true, opened: true });
  assert.equal(x.docs.length, 1);
  assert.deepEqual(x.opened, []);
  assert.equal(x.stores.session.scanRequest.reason, 'site');
  assert.equal((await x.send({ type: 'oh-scan-status' }, HANGAR)).running, true);
});

test('the tab when there is no hidden page: a browser without one, or no connector', async () => {
  // Chrome without chrome.offscreen (or getContexts): the basic page, as before.
  const bare = loadBackground({ flags: CONNECTOR });
  assert.deepEqual(await fromPopup(bare), { ok: true, opened: true });
  assert.deepEqual(bare.opened, [BASIC]);
  assert.equal(bare.stores.session.scanRequest.by, 'tab');
  assert.equal(bare.stores.session.scanRequest.tabId, 100);
  assert.equal(bare.stores.session.scanAskedBy, 'tab');
  // offscreen but no getContexts (Chrome before 116): the tab too.
  const old = loadBackground({ flags: CONNECTOR, offscreen: true });
  delete old.chrome.runtime.getContexts;
  assert.deepEqual(await fromPopup(old), { ok: true, opened: true });
  assert.equal(old.docs.length, 0);
  // A build without the connector has no hidden page: the dashboard's tab.
  const dash = loadBackground({ flags: { ...CONNECTOR, connector: false }, offscreen: true });
  assert.deepEqual(await dash.send({ type: 'oh-request-scan' }, HANGAR), {
    ok: true,
    opened: true,
  });
  assert.equal(dash.docs.length, 0);
  assert.equal(vm.runInContext('scanHost', dash.ctx), null);
});

test('the kill switch sends scans to the tab, and only ever turns the hidden page off', async () => {
  const status = (sources) => ({ remoteStatus: { at: Date.now(), data: { sources } } });
  const off = chromeX({ local: status({ scanHidden: { enabled: false } }) });
  assert.deepEqual(await fromPopup(off), { ok: true, opened: true });
  assert.equal(off.docs.length, 0);
  assert.deepEqual(off.opened, [BASIC]);
  assert.equal(off.stores.session.scanAskedBy, 'tab');
  const ffOff = firefoxX({ local: status({ scanHidden: { enabled: false } }) });
  assert.equal(await host(ffOff).choose(), 'tab');
  assert.equal(await host(firefoxX()).choose(), 'frame');
  // Anything else in the file leaves the hidden page as it is.
  for (const sources of [
    { scanHidden: { enabled: true } },
    { scanHidden: {} },
    { hangar: { enabled: false } },
    { scanHidden: 'off' },
  ]) {
    const x = chromeX({ local: status(sources) });
    assert.equal((await fromPopup(x)).by, 'offscreen', JSON.stringify(sources));
  }
  const { switchedOff } = vm.runInContext('self.OHScanHost', off.ctx);
  assert.equal(switchedOff({ data: { sources: { scanHidden: { enabled: false } } } }), true);
  assert.equal(switchedOff(null), false);
  assert.equal(switchedOff({ data: null }), false);
});

test('access to RSI off: the tab, whose page asks for it on a click and scans', async () => {
  const x = chromeX({ rsi: false });
  assert.deepEqual(await fromPopup(x), { ok: true, opened: true });
  assert.equal(x.docs.length, 0, 'a hidden scan could only be held');
  assert.deepEqual(x.opened, [BASIC]);
  assert.equal(x.stores.session.scanRequest.by, 'tab');
  const ff = firefoxX({ rsi: false });
  assert.equal(await host(ff).choose(), 'tab');
});

test('a hidden page that cannot be made: the tab takes the scan, and no request is left', async () => {
  const x = chromeX({ failOffscreen: true });
  const warned = [];
  x.ctx.console = { ...console, warn: (...a) => warned.push(a.join(' ')) };
  assert.deepEqual(await fromPopup(x), { ok: true, opened: true });
  assert.deepEqual(x.opened, [BASIC]);
  assert.equal(x.stores.session.scanRequest.by, 'tab');
  assert.equal(x.stores.session.scanRequest.tabId, 100);
  assert.equal(x.stores.session.scanAskedBy, 'tab');
  assert.ok(warned.some((w) => /hidden scan page/.test(w)));
});

test('one offscreen document: a page still open (reading packs) gets the next scan', async () => {
  const x = chromeX();
  await fromPopup(x);
  const run = x.stores.session.scanRequest.run;
  // The page took the request and finished its scan; it's reading packs now (no mark).
  delete x.stores.session.scanRequest;
  later(x);
  x.sent.length = 0;
  assert.deepEqual(await fromPopup(x), { ok: true, opened: false, by: 'offscreen' });
  assert.equal(x.docs.length, 1, 'never a second document');
  assert.equal(x.stores.session.scanRequest.run, run, 'the open page is asked');
  assert.deepEqual(x.sent, [{ ohScanPage: { op: 'go', run } }], 'and told');
  // Two at once (the popup and our hangar page, past the minute's limit): one document.
  const y = chromeX();
  const sh = host(y);
  const both = await Promise.all([sh.start('popup'), sh.start('site')]);
  assert.equal(y.docs.length, 1);
  assert.equal(both[0].run, both[1].run);
});

test('a page gone quiet is closed, and scans go to the tab for the rest of the session', async () => {
  // A request a minute old that the page never took (it never loaded, say): it's stuck.
  const x = chromeX();
  await fromPopup(x);
  x.stores.session.scanRequest.at -= 61e3;
  later(x);
  assert.deepEqual(await fromPopup(x), { ok: true, opened: true });
  assert.equal(x.docs.length, 0, 'closed, and no new one');
  assert.deepEqual(x.opened, [BASIC]);
  assert.equal(x.stores.session.scanRequest.by, 'tab');
  assert.equal(x.stores.session.scanHiddenOff.why, 'stuck');
  // The next scan too: the hidden page is off until the browser starts again.
  delete x.stores.session.scanRequest;
  later(x);
  assert.deepEqual(await fromPopup(x), { ok: true, opened: true });
  assert.equal(x.docs.length, 0);
  assert.equal(await host(x).choose(), 'tab');
  // A mark older than any running scan's: the same, and the mark goes with its page.
  const y = chromeX();
  await fromPopup(y);
  const old = y.stores.session.scanRequest.run;
  delete y.stores.session.scanRequest;
  y.stores.session.scanRunning = {
    at: Date.now() - 11 * 60e3,
    tabId: null,
    run: old,
    by: 'offscreen',
  };
  y.stores.session.scanProgress = { at: Date.now() - 11 * 60e3, run: old, part: 'hangar' };
  later(y);
  assert.deepEqual(await fromPopup(y), { ok: true, opened: true });
  assert.equal(y.docs.length, 0);
  assert.equal('scanRunning' in y.stores.session, false);
  assert.equal('scanProgress' in y.stores.session, false);
  assert.equal(y.stores.session.scanHiddenOff.why, 'stuck');
  // Firefox: its frame, the same.
  const ff = firefoxX();
  await ff.fromPage({ type: 'oh-request-scan' }, `${HANGAR}/`);
  ff.stores.session.scanRequest.at -= 61e3;
  later(ff);
  await ff.fromPage({ type: 'oh-request-scan' }, `${HANGAR}/`);
  assert.equal(ff.frames.length, 0);
  assert.equal(ff.stores.session.scanRequest.by, 'tab');
  // A page that only reads packs (no request, no mark) isn't quiet: it gets the next scan.
  const z = chromeX();
  await fromPopup(z);
  delete z.stores.session.scanRequest;
  later(z);
  assert.equal((await fromPopup(z)).by, 'offscreen');
  assert.equal(z.stores.session.scanHiddenOff, undefined);
});

test('a page that stopped on an error: closed, its request dropped, and scans go to the tab', async () => {
  const x = chromeX();
  await fromPopup(x);
  const run = x.stores.session.scanRequest.run;
  const q = `?run=${run}&by=offscreen&v=0.3.0`;
  // Its request still waiting (taking it failed): closed all the same, never "again".
  assert.deepEqual(
    await x.fromScanPage({ ohScan: { op: 'done', run, arg: { failed: true } } }, q),
    { ok: true, value: {} },
  );
  assert.equal(x.docs.length, 0);
  assert.equal('scanRequest' in x.stores.session, false);
  assert.equal(x.stores.session.scanHiddenOff.why, 'failed');
  later(x);
  assert.deepEqual(await fromPopup(x), { ok: true, opened: true });
  assert.equal(x.docs.length, 0);
  assert.deepEqual(x.opened, [BASIC]);
});

test('a scan that read nothing frees the minute once its page is done; one that read keeps it', async () => {
  // Signed out of RSI: the scan ends in a second, and Scan right after Log In to RSI
  // must scan, not say one is running (Firefox 0.5.1, 2026-10-20).
  const ended = async (report) => {
    const x = chromeX();
    await fromPopup(x);
    const run = x.stores.session.scanRequest.run;
    delete x.stores.session.scanRequest; // the page took it
    x.stores.local.scanReport = { v: 1, run, by: 'offscreen', startedAt: Date.now(), ...report };
    const q = `?run=${run}&by=offscreen&v=0.3.0`;
    assert.deepEqual(await x.fromScanPage({ ohScan: { op: 'done', run } }, q), {
      ok: true,
      value: {},
    });
    return x;
  };
  const out = await ended({ signedOut: true, held: null, rows: [] });
  assert.equal('scanAskedAt' in out.stores.session, false);
  assert.equal((await fromPopup(out)).ok, true, 'Scan scans again at once');
  const held = await ended({ signedOut: false, held: 'no-rsi', rows: [] });
  assert.equal((await fromPopup(held)).ok, true);
  // A scan that read RSI's lists: still one a minute.
  const read = await ended({
    signedOut: false,
    held: null,
    rows: [{ id: 'hangar', ok: true, partial: null, n: 3, error: null }],
  });
  assert.deepEqual(await fromPopup(read), { ok: false, error: 'busy' });
  // An older report (not this request's scan) frees nothing.
  const old = await ended({ signedOut: true, held: null, rows: [], startedAt: 1 });
  assert.deepEqual(await fromPopup(old), { ok: false, error: 'busy' });
});

test("a hidden page's mark left behind when it went away never holds the next scan", async () => {
  // The offscreen page's renderer crashed mid-scan: its mark, renewed a moment ago, stays.
  const x = chromeX();
  await fromPopup(x);
  const dead = x.stores.session.scanRequest.run;
  delete x.stores.session.scanRequest;
  const at = Date.now() - 5000;
  x.stores.session.scanRunning = { at, tabId: null, run: dead, by: 'offscreen' };
  x.stores.session.scanProgress = { at, run: dead, part: 'hangar' };
  x.docs.length = 0;
  later(x);
  assert.equal((await fromPopup(x)).by, 'offscreen');
  const run = runOf(x.docs[0].url);
  assert.notEqual(run, dead);
  assert.equal('scanRunning' in x.stores.session, false, "the gone page's mark goes");
  assert.equal('scanProgress' in x.stores.session, false);
  assert.equal(x.stores.session.scanRequest.run, run);
  // The new page's runner sees no other scan (ui/scan/sync-timing.js scanElsewhere).
  const { scanElsewhere } = await import('../ui/scan/sync-timing.js');
  assert.equal(scanElsewhere(x.stores.session.scanRunning, { tabId: null, run }), false);
  // Another page's progress, with no mark, is left alone; so is the open page's own mark.
  const y = chromeX();
  await fromPopup(y);
  const open = y.stores.session.scanRequest.run;
  delete y.stores.session.scanRequest;
  y.stores.session.scanRunning = {
    at: Date.now() - 5000,
    tabId: null,
    run: 'old-run-001',
    by: 'frame',
  };
  y.stores.session.scanProgress = { at: Date.now(), run: open, part: 'packs' };
  later(y);
  await fromPopup(y);
  assert.equal(
    'scanRunning' in y.stores.session,
    false,
    'a frame mark with the offscreen page open',
  );
  assert.equal(y.stores.session.scanProgress.run, open);
  // A tab's mark is the tab's (its page takes it with it).
  const t = chromeX({
    contexts: [],
    session: { scanRunning: { at: Date.now() - 5000, tabId: 7, run: 'r-tab0', by: 'tab' } },
  });
  await fromPopup(t);
  assert.equal(t.stores.session.scanRunning.run, 'r-tab0');
  // Firefox's event page restarted, the frame with it.
  const ff = firefoxX({
    session: {
      scanRunning: { at: Date.now() - 5000, tabId: null, run: 'gone-frame1', by: 'frame' },
    },
  });
  assert.equal((await ff.fromPage({ type: 'oh-request-scan' }, `${HANGAR}/`)).ok, true);
  assert.equal(ff.frames.length, 1);
  assert.equal('scanRunning' in ff.stores.session, false);
  // The tab's scan (the kill switch here) isn't held by one either.
  const off = chromeX({
    local: {
      remoteStatus: { at: Date.now(), data: { sources: { scanHidden: { enabled: false } } } },
    },
    session: {
      scanRunning: { at: Date.now() - 5000, tabId: null, run: 'gone-page1', by: 'offscreen' },
    },
  });
  assert.deepEqual(await fromPopup(off), { ok: true, opened: true });
  assert.equal('scanRunning' in off.stores.session, false);
});

// --- Who may ask, and what ----------------------------------------------------------------

test("the page's one message type: only the scan page, never a tab or another page", async () => {
  const x = chromeX({ local: { db: { a: 1 }, other: 2 }, session: { s: 1 } });
  const get = { ohScan: { op: 'local.get', arg: 'db' } };
  assert.deepEqual(await x.fromScanPage(get, '?run=abc123-0011&by=offscreen&v=0.3.0'), {
    ok: true,
    value: { db: { a: 1 } },
  });
  assert.deepEqual(await x.fromScanPage(get), { ok: true, value: { db: { a: 1 } } });
  // Not the page: no answer at all (as a message that doesn't exist).
  for (const sender of [
    { tab: { id: 3 } }, // the page's address loaded in a tab
    { id: 'another-extension' },
    { url: POPUP },
    { url: BASIC },
    { url: `${SCAN}x` },
    { url: `chrome-extension://${CHROME_ID}/src/ui/scan.html` },
    { url: 'https://openhangar.space/src/scan.html' },
    { url: undefined },
  ])
    assert.equal(await x.fromScanPage(get, '', sender), undefined, JSON.stringify(sender));
  // The page, asking what it may not: refused.
  for (const m of [
    { op: 'local.clear' },
    { op: 'tabs.create', arg: { url: 'x' } },
    { op: 'local.set', arg: ['db'] },
    { op: 'local.set', arg: 'db' },
    { op: 'local.remove', arg: 3 },
    { op: 'local.remove', arg: null },
    { op: 'local.get', arg: 7 },
    { op: 'permissions.contains', arg: { origins: ['x'], extra: [] } },
    { op: 'permissions.contains', arg: { origins: 'x' } },
    { op: 'done' }, // a run to close is needed
    { op: 'done', run: 'no spaces allowed' },
    { op: 'done', run: 'abc123-0011', arg: { failed: false } },
    { op: 'done', run: 'abc123-0011', arg: { failed: true, more: 1 } },
    { op: 'done', run: 'abc123-0011', arg: 'failed' },
    'local.get',
    null,
  ]) {
    const r = await x.fromScanPage({ ohScan: m });
    assert.equal(r?.ok, false, JSON.stringify(m));
  }
  // Other messages pass by untouched.
  assert.equal(await x.fromScanPage({ ohPopup: 'melt' }), undefined);
});

test("the offscreen page's storage and permission check, answered by the worker", async () => {
  const x = chromeX({ local: { db: { a: 1 }, history: [1, 2] }, session: {} });
  const ask = (op, arg) => x.fromScanPage({ ohScan: { op, arg } });
  assert.deepEqual(await ask('local.set', { scanReport: { v: 1 } }), { ok: true, value: null });
  assert.deepEqual(x.stores.local.scanReport, { v: 1 });
  assert.deepEqual(await ask('local.get', ['db', 'nope']), { ok: true, value: { db: { a: 1 } } });
  assert.deepEqual((await ask('local.get', null)).value.history, [1, 2]);
  assert.deepEqual(await ask('local.remove', ['history']), { ok: true, value: null });
  assert.equal('history' in x.stores.local, false);
  // getKeys from the worker's own storage (a browser without it: from get(null) there).
  assert.deepEqual((await ask('local.getKeys')).value.sort(), ['db', 'scanReport']);
  // getBytesInUse only where the browser has it.
  assert.equal((await ask('local.getBytesInUse', 'db')).ok, false);
  x.chrome.storage.local.getBytesInUse = async (k) => (k === 'db' ? 42 : 0);
  assert.deepEqual(await ask('local.getBytesInUse', 'db'), { ok: true, value: 42 });
  await ask('session.set', { scanRunning: { at: 1, run: 'r' } });
  assert.deepEqual(x.stores.session.scanRunning, { at: 1, run: 'r' });
  assert.deepEqual(await ask('session.get', 'scanRunning'), {
    ok: true,
    value: { scanRunning: { at: 1, run: 'r' } },
  });
  await ask('session.remove', 'scanRunning');
  assert.equal('scanRunning' in x.stores.session, false);
  const rsi = { origins: ['https://robertsspaceindustries.com/*'] };
  assert.deepEqual(await ask('permissions.contains', rsi), { ok: true, value: true });
  const no = chromeX({ rsi: false });
  assert.deepEqual(await no.fromScanPage({ ohScan: { op: 'permissions.contains', arg: rsi } }), {
    ok: true,
    value: false,
  });
  // Firefox's frame pings; the worker just answers.
  assert.deepEqual(await ask('ping'), { ok: true, value: {} });
});

// --- Its marks and its end ---------------------------------------------------------------

test('a hidden scan counts while its page is open, and only its own run', async () => {
  const x = chromeX();
  await fromPopup(x);
  const run = x.stores.session.scanRequest.run;
  delete x.stores.session.scanRequest;
  const mark = (r = run) => ({ at: Date.now() - 5000, tabId: null, run: r, by: 'offscreen' });
  x.stores.session.scanRunning = mark();
  assert.equal((await x.send({ type: 'oh-scan-status' }, HANGAR)).running, true);
  x.stores.session.scanRunning = mark('another-run1');
  assert.equal((await x.send({ type: 'oh-scan-status' }, HANGAR)).running, false);
  x.stores.session.scanRunning = mark();
  x.docs.length = 0; // the page went away (it crashed, say)
  assert.equal((await x.send({ type: 'oh-scan-status' }, HANGAR)).running, false);
  // Firefox: its frame's mark, while the frame is there.
  const ff = firefoxX();
  await ff.fromPage({ type: 'oh-request-scan' }, `${HANGAR}/`);
  const frun = ff.stores.session.scanRequest.run;
  delete ff.stores.session.scanRequest;
  ff.stores.session.scanRunning = { at: Date.now(), tabId: null, run: frun, by: 'frame' };
  assert.equal((await ff.fromPage({ type: 'oh-scan-status' }, `${HANGAR}/`)).running, true);
  ff.frames.length = 0; // a new event page: the frame went with the old one
  assert.equal((await ff.fromPage({ type: 'oh-scan-status' }, `${HANGAR}/`)).running, false);
});

test('busy with a hidden scan: the popup stays as it is, nothing opens', async () => {
  const x = chromeX();
  await fromPopup(x);
  // The scan's mark, then a request a moment later (the minute's limit passed).
  const run = x.stores.session.scanRequest.run;
  delete x.stores.session.scanRequest;
  x.stores.session.scanRunning = { at: Date.now(), tabId: null, run, by: 'offscreen' };
  later(x);
  assert.deepEqual(await fromPopup(x), { ok: false, error: 'busy' });
  assert.deepEqual(x.opened, []);
  assert.deepEqual(x.focused, []);
  // Done, page closed, still inside the minute's limit: busy, and still no tab.
  delete x.stores.session.scanRunning;
  x.docs.length = 0;
  x.stores.session.scanAskedAt = Date.now();
  assert.deepEqual(await fromPopup(x), { ok: false, error: 'busy' });
  assert.deepEqual(x.opened, []);
  // A scan in the tab (the fallback) still brings its tab to the front.
  const tab = { contextType: 'TAB', tabId: 7, windowId: 3, documentUrl: BASIC };
  const t = chromeX({
    contexts: [tab],
    session: { scanRunning: { at: Date.now(), tabId: 7, run: 'r-tab', by: 'tab' } },
  });
  assert.deepEqual(await fromPopup(t), { ok: false, error: 'busy' });
  assert.ok(t.focused.some((f) => f.tab === 7 && f.active));
});

test('done: the page closes and its marks go, unless a scan was asked of it meanwhile', async () => {
  const x = chromeX();
  await fromPopup(x);
  const run = x.stores.session.scanRequest.run;
  const q = `?run=${run}&by=offscreen&v=0.3.0`;
  // Asked again while it was finishing: it's told to go on.
  assert.deepEqual(await x.fromScanPage({ ohScan: { op: 'done', run } }, q), {
    ok: true,
    value: { again: true },
  });
  assert.equal(x.docs.length, 1);
  // Done for real: closed, this run's leftovers gone, another run's kept.
  delete x.stores.session.scanRequest;
  x.stores.session.scanRunning = { at: Date.now(), run, by: 'offscreen' };
  x.stores.session.scanProgress = { at: Date.now(), run, part: 'packs' };
  x.stores.session.syncAfterScan = { at: 1 };
  assert.deepEqual(await x.fromScanPage({ ohScan: { op: 'done', run } }, q), {
    ok: true,
    value: {},
  });
  assert.equal(x.docs.length, 0);
  assert.equal('scanRunning' in x.stores.session, false);
  assert.equal('scanProgress' in x.stores.session, false);
  assert.deepEqual(x.stores.session.syncAfterScan, { at: 1 }, 'not the page’s to drop');
  // Another run's done never closes this page.
  later(x);
  await fromPopup(x);
  const now = runOf(x.docs[0].url);
  delete x.stores.session.scanRequest;
  x.stores.session.scanRunning = { at: Date.now(), run: now, by: 'offscreen' };
  await x.fromScanPage({ ohScan: { op: 'done', run: 'old-run-00' } });
  assert.equal(x.docs.length, 1);
  assert.equal(x.stores.session.scanRunning.run, now);
  // Firefox: done takes the frame out of the event page.
  const ff = firefoxX();
  await ff.fromPage({ type: 'oh-request-scan' }, `${HANGAR}/`);
  const frun = ff.stores.session.scanRequest.run;
  delete ff.stores.session.scanRequest;
  const sender = {
    id: 'open-hangar@draco-foundry',
    url: `moz-extension://uuid/src/scan.html?run=${frun}&by=frame&v=0.3.0`,
  };
  assert.deepEqual(await ff.sendInternal({ ohScan: { op: 'ping', run: frun } }, sender), {
    ok: true,
    value: {},
  });
  assert.equal(ff.frames.length, 1);
  await ff.sendInternal({ ohScan: { op: 'done', run: frun } }, sender);
  assert.equal(ff.frames.length, 0);
});

// --- Updates --------------------------------------------------------------------------------

test('an update waits for a hidden scan, and comes in once its page is done', async () => {
  const x = chromeX();
  await fromPopup(x);
  const run = x.stores.session.scanRequest.run;
  await x.updateAvailable({ version: '0.4.1' });
  assert.equal(x.stores.local.updateReady, '0.4.1', 'held while the page is open');
  assert.equal(x.reloaded.length, 0);
  delete x.stores.session.scanRequest;
  await x.fromScanPage({ ohScan: { op: 'done', run } });
  await tick();
  assert.equal(x.reloaded.length, 1, 'the page is done: the update comes in');
  // Nothing open: at once.
  const idle = chromeX();
  await idle.updateAvailable({ version: '0.4.1' });
  assert.equal(idle.reloaded.length, 1);
  assert.equal(idle.stores.local.updateReady, undefined);
  // A tab open too: the tab's Reload to Update lets it in, not the page's end.
  const tab = { contextType: 'TAB', tabId: 7, windowId: 3, documentUrl: BASIC };
  const both = chromeX({ contexts: [tab] });
  await fromPopup(both);
  const brun = both.stores.session.scanRequest.run;
  await both.updateAvailable({ version: '0.4.1' });
  delete both.stores.session.scanRequest;
  await both.fromScanPage({ ohScan: { op: 'done', run: brun } });
  await tick();
  assert.equal(both.reloaded.length, 0);
  assert.equal(both.stores.local.updateReady, '0.4.1');
  // A done with no update waiting reloads nothing.
  const plain = chromeX();
  await fromPopup(plain);
  const prun = plain.stores.session.scanRequest.run;
  delete plain.stores.session.scanRequest;
  await plain.fromScanPage({ ohScan: { op: 'done', run: prun } });
  await tick();
  assert.equal(plain.reloaded.length, 0);
});

// --- The page's side: src/scan-shim.js --------------------------------------------------------

const SHIM = fs.readFileSync(path.join(__dirname, '..', 'src', 'scan-shim.js'), 'utf8');
function shimIn(chrome, search = '?run=abc123-00&by=offscreen&v=0.4.0') {
  const ctx = vm.createContext({ chrome, location: { search }, URLSearchParams });
  vm.runInContext(SHIM, ctx);
  return ctx.chrome;
}

test('the shim: storage, the permission check and the version, each one message', async () => {
  const sent = [];
  const answers = { 'local.get': { db: 1 }, 'local.getKeys': ['db'], 'permissions.contains': true };
  const runtime = {
    id: CHROME_ID,
    getURL: (p) => `chrome-extension://${CHROME_ID}/${p}`,
    sendMessage: async (m) => {
      sent.push(JSON.parse(JSON.stringify(m)));
      return { ok: true, value: answers[m.ohScan.op] ?? null };
    },
  };
  const c = shimIn({ runtime });
  assert.deepEqual(await c.storage.local.get('db'), { db: 1 });
  assert.equal(await c.storage.local.set({ a: 1 }), undefined);
  await c.storage.local.remove(['a']);
  assert.deepEqual(await c.storage.local.getKeys(), ['db']);
  await c.storage.local.getBytesInUse('db');
  await c.storage.session.get(['scanRequest']);
  await c.storage.session.set({ scanRunning: { at: 1 } });
  await c.storage.session.remove('scanRunning');
  assert.equal(await c.permissions.contains({ origins: ['x'] }), true);
  await c.storage.local.get();
  assert.deepEqual(
    sent.map((m) => m.ohScan),
    [
      { op: 'local.get', arg: 'db' },
      { op: 'local.set', arg: { a: 1 } },
      { op: 'local.remove', arg: ['a'] },
      { op: 'local.getKeys', arg: null },
      { op: 'local.getBytesInUse', arg: 'db' },
      { op: 'session.get', arg: ['scanRequest'] },
      { op: 'session.set', arg: { scanRunning: { at: 1 } } },
      { op: 'session.remove', arg: 'scanRunning' },
      { op: 'permissions.contains', arg: { origins: ['x'] } },
      { op: 'local.get', arg: null },
    ],
  );
  assert.deepEqual(JSON.parse(JSON.stringify(c.runtime.getManifest())), {
    manifest_version: 3,
    version: '0.4.0',
  });
  assert.equal(
    shimIn({ runtime: { ...runtime, getManifest: undefined } }, '?v=evil').runtime.getManifest()
      .version,
    null,
  );
  // A refusal is an error, as a failed storage call is.
  const refused = shimIn({
    runtime: { ...runtime, sendMessage: async () => ({ ok: false, error: 'no' }) },
  });
  await assert.rejects(refused.storage.local.get('db'), /no/);
  const silent = shimIn({ runtime: { ...runtime, sendMessage: async () => undefined } });
  await assert.rejects(silent.storage.local.get('db'), /no answer/);
});

test('the shim leaves a page with storage alone (Firefox frame, a tab)', () => {
  const storage = { local: {}, session: {} };
  const getManifest = () => ({ version: '9' });
  const c = shimIn({ storage, permissions: {}, runtime: { sendMessage() {}, getManifest } });
  assert.equal(c.storage, storage);
  assert.equal(c.runtime.getManifest, getManifest);
});

test("the shim and the worker together: the offscreen page's storage is the worker's", async () => {
  const x = chromeX({ local: { db: { owner: { nickname: 'P' } } } });
  await fromPopup(x);
  const run = x.stores.session.scanRequest.run;
  const query = `?run=${run}&by=offscreen&v=0.3.0`;
  const c = shimIn(
    {
      runtime: {
        id: CHROME_ID,
        getURL: (p) => `chrome-extension://${CHROME_ID}/${p}`,
        sendMessage: (m) => x.fromScanPage(m, query),
      },
    },
    query,
  );
  assert.deepEqual(await c.storage.local.get('db'), { db: { owner: { nickname: 'P' } } });
  assert.deepEqual((await c.storage.session.get('scanRequest')).scanRequest.run, run);
  await c.storage.local.set({ scanReport: { v: 1, run } });
  assert.deepEqual(x.stores.local.scanReport, { v: 1, run });
  assert.equal(c.runtime.getManifest().version, '0.3.0');
});

// --- The page's side: ui/scan/main.js ---------------------------------------------------------

// The page in Node: its globals stood in for, then the module loaded fresh.
let loads = 0;
async function scanPage({ run = 'page01-0a0b0c0d0e0f', by = 'offscreen', request, scan } = {}) {
  const local = {};
  const session = {};
  const sent = [];
  const area = (data) => ({
    get: async (k) =>
      Object.fromEntries(
        []
          .concat(k)
          .filter((x) => x in data)
          .map((x) => [x, structuredClone(data[x])]),
      ),
    set: async (o) => void Object.assign(data, structuredClone(o)),
    remove: async (k) => [].concat(k).forEach((x) => delete data[x]),
  });
  if (request)
    session.scanRequest = { at: Date.now(), tabId: null, reason: 'popup', run, by, ...request };
  const calls = [];
  const done = new Promise((resolve) => {
    globalThis.chrome = {
      storage: { local: area(local), session: area(session) },
      permissions: { contains: async () => true },
      runtime: {
        getManifest: () => ({ version: '0.4.0' }),
        onMessage: { addListener() {} },
        sendMessage: async (m) => {
          sent.push(m);
          if (m.ohScan?.op === 'done') resolve();
          return { ok: true, value: {} };
        },
      },
    };
  });
  globalThis.location = { search: `?run=${run}&by=${by}&v=0.4.0` };
  globalThis.OH = {
    flags: {},
    log: () => {},
    getAccount: async () => ({ loggedIn: true, nickname: 'P' }),
    loadDB: async () => ({ owner: { nickname: 'P' }, sources: {} }),
    scanSource: async (id, onProgress) => {
      calls.push(id);
      onProgress(1, 2);
      return scan ? scan(id) : { ok: true, items: [] };
    },
    getReferral: async () => ({ ok: true }),
    getHistory: async () => [],
    fillBuybackDetailsFromHistory: async () => {},
    getBuybackDetails: async () => ({}),
    flushBuybackDetails: async () => calls.push('flush'),
    storageSettled: async () => calls.push('settled'),
    siteEnabled: async () => false,
  };
  await import(`../ui/scan/main.js?page=${++loads}`);
  await Promise.race([done, new Promise((r) => setTimeout(r, 2000))]);
  return { local, session, sent, calls };
}

test('the page: scans the request for its run, saves, then says done', async () => {
  const p = await scanPage({ request: {} });
  assert.deepEqual(
    p.calls.filter((c) => c === 'hangar' || c === 'buybacks'),
    ['hangar', 'buybacks'],
  );
  assert.ok(p.calls.at(-1) === 'settled', 'everything saved before done');
  assert.equal(p.session.scanRequest, undefined, 'the request is taken');
  assert.equal(p.local.scanReport.by, 'offscreen');
  assert.equal(p.local.scanReport.run, 'page01-0a0b0c0d0e0f');
  assert.equal(p.local.scanReport.reason, 'popup');
  assert.deepEqual(p.sent.at(-1), { ohScan: { op: 'done', run: 'page01-0a0b0c0d0e0f' } });
  // No pings from an offscreen document: nothing suspends it.
  assert.ok(!p.sent.some((m) => m.ohScan?.op === 'ping'));
});

test("the page: another run's request is not its own; Firefox's frame pings while it works", async () => {
  const other = await scanPage({ request: { run: 'someone-else00' } });
  assert.deepEqual(
    other.calls.filter((c) => c === 'hangar'),
    [],
  );
  assert.equal(other.session.scanRequest.run, 'someone-else00', 'left for its page');
  assert.deepEqual(other.sent, [{ ohScan: { op: 'done', run: 'page01-0a0b0c0d0e0f' } }]);
  // An old request (over a minute): taken away, not scanned.
  const stale = await scanPage({ request: { at: Date.now() - 61e3 } });
  assert.deepEqual(
    stale.calls.filter((c) => c === 'hangar'),
    [],
  );
  assert.equal(stale.session.scanRequest, undefined);
  const ff = await scanPage({ by: 'frame', request: { reason: 'site' } });
  assert.ok(
    ff.sent.some((m) => m.ohScan?.op === 'ping'),
    'a ping after a page read',
  );
  assert.equal(ff.local.scanReport.by, 'frame');
  assert.equal(ff.local.scanReport.reason, 'site');
  delete globalThis.chrome;
  delete globalThis.location;
  delete globalThis.OH;
});

// The page and the worker together: Chrome's offscreen page (its storage the worker's,
// as the shim makes it), the page's messages answered by the worker and the worker's
// heard by the page. `clock.t` is the time on both sides. A buy-back pack to read after
// each scan, held until `packsGo()`.
async function pageAndWorker({ failGet = false } = {}) {
  const x = chromeX();
  const clock = { t: Date.now() };
  const realNow = Date.now;
  Date.now = () => clock.t;
  x.ctx.__clock = clock;
  vm.runInContext('Date.now = () => __clock.t', x.ctx);
  const listeners = [];
  x.chrome.runtime.sendMessage = async (m) => {
    x.sent.push(structuredClone(m));
    for (const f of listeners) f(structuredClone(m), {}, () => {});
  };
  await fromPopup(x);
  const query = new URL(x.docs[0].url, 'chrome-extension://x/').search;
  const pageSent = [];
  const session = failGet
    ? {
        ...x.chrome.storage.session,
        get: async () => {
          throw new Error('the worker went away');
        },
      }
    : x.chrome.storage.session;
  globalThis.chrome = {
    storage: { local: x.chrome.storage.local, session, onChanged: { addListener() {} } },
    permissions: { contains: async () => true },
    runtime: {
      getManifest: () => ({ version: '0.4.0' }),
      onMessage: { addListener: (f) => listeners.push(f) },
      sendMessage: (m) => {
        pageSent.push(structuredClone(m));
        return x.fromScanPage(structuredClone(m), query);
      },
    },
  };
  globalThis.location = { search: query };
  const calls = [];
  let packsGo;
  const held = new Promise((r) => (packsGo = r));
  const db = {
    owner: { nickname: 'P' },
    sources: { buybacks: { items: [{ id: '701', name: 'Pack', kind: 'pack', isCCU: false }] } },
  };
  globalThis.OH = {
    flags: {},
    log: () => {},
    getRemoteStatus: async () => void calls.push('status'),
    getAccount: async () => {
      calls.push('account');
      return { loggedIn: true, nickname: 'P' };
    },
    loadDB: async () => structuredClone(db),
    scanSource: async (id, onProgress) => {
      onProgress(1, 1);
      return { ok: true, items: id === 'buybacks' ? db.sources.buybacks.items : [] };
    },
    getReferral: async () => ({ ok: true }),
    getHistory: async () => [],
    fillBuybackDetailsFromHistory: async () => {},
    getBuybackDetails: async () => ({}),
    fetchBuybackDetails: async (ids, say) => {
      calls.push('packs');
      say(1, ids.length);
      await held;
      return { done: ids.length, errors: 0, total: ids.length };
    },
    flushBuybackDetails: async () => {},
    storageSettled: async () => {},
    siteEnabled: async () => false,
  };
  await import(`../ui/scan/main.js?page=${++loads}`);
  const until = async (fn, what) => {
    for (let i = 0; i < 500 && !fn(); i++) await new Promise((r) => setTimeout(r, 1));
    assert.ok(fn(), `waited for ${what}`);
  };
  const restore = () => {
    Date.now = realNow;
    delete globalThis.chrome;
    delete globalThis.location;
    delete globalThis.OH;
  };
  return { x, clock, calls, packsGo, pageSent, until, restore, run: runOf(x.docs[0].url) };
}
const count = (list, what) => list.filter((c) => c === what).length;

test('the page: a scan asked for while its packs are read runs at once, however long they take', async () => {
  const p = await pageAndWorker();
  try {
    const s = p.x.stores.session;
    await p.until(() => p.calls.includes('packs') && !s.scanRunning, 'the pack reads');
    assert.equal(count(p.calls, 'account'), 1);
    assert.ok(p.calls.includes('status'), "the kill switch's file, read as the page opened");
    // Over a minute into the pack reads, Scan again: the open page is asked, and scans.
    p.clock.t += 61e3;
    later(p.x);
    assert.deepEqual(await fromPopup(p.x), { ok: true, opened: false, by: 'offscreen' });
    await p.until(() => count(p.calls, 'account') === 2, 'the second scan');
    await p.until(() => p.x.stores.local.scanReport?.startedAt === p.clock.t, 'its report');
    assert.equal('scanRequest' in s, false, 'taken at once');
    assert.equal(p.x.docs.length, 1, 'the packs still being read');
    // The pack reads outlast that request's minute too, then end: done, and closed.
    p.clock.t += 61e3;
    p.packsGo();
    await p.until(() => p.x.docs.length === 0, 'the page closed');
    assert.equal(count(p.calls, 'packs'), 1, 'one pack read, shared by both scans');
    assert.deepEqual(
      Object.keys(s).filter((k) => /^scan(Request|Running|Progress)$/.test(k)),
      [],
    );
    assert.equal(s.scanHiddenOff, undefined);
    assert.deepEqual(p.pageSent.at(-1), { ohScan: { op: 'done', run: p.run } });
  } finally {
    p.restore();
  }
});

test('the page: stopped on an error, it says so, and the next scan goes to the tab', async () => {
  const p = await pageAndWorker({ failGet: true });
  try {
    await p.until(() => p.x.docs.length === 0, 'the page closed');
    assert.deepEqual(p.pageSent.at(-1), {
      ohScan: { op: 'done', run: p.run, arg: { failed: true } },
    });
    assert.equal('scanRequest' in p.x.stores.session, false);
    assert.equal(p.x.stores.session.scanHiddenOff.why, 'failed');
    assert.equal(count(p.calls, 'account'), 0);
    later(p.x);
    assert.deepEqual(await fromPopup(p.x), { ok: true, opened: true });
    assert.equal(p.x.docs.length, 0);
  } finally {
    p.restore();
  }
});
