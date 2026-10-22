'use strict';
// The connector build (src/flags.js `connector`): the toolbar popup's Scan in the
// background worker (src/background.js) and what the popup shows (ui/popup/data.js).
// Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { HANGAR, CHROME_ID, loadBackground } = require('./bridge-env.js');

const CONNECTOR = { sync: true, orgFleet: false, localMode: true, connector: true };
const POPUP = `chrome-extension://${CHROME_ID}/src/popup.html`;
const BASIC = `chrome-extension://${CHROME_ID}/src/basic.html`;
const fromPopup = (x, msg = { ohPopup: 'scan' }, sender = {}) =>
  x.sendInternal(msg, { id: CHROME_ID, url: POPUP, ...sender });
const data = () => import('../ui/popup/data.js');

// --- The popup's Scan ------------------------------------------------------------------
test("popup Scan: the hangar page's scan, in the basic page", async () => {
  const x = loadBackground({ flags: CONNECTOR });
  assert.deepEqual(await fromPopup(x), { ok: true, opened: true });
  assert.deepEqual(x.opened, [BASIC]);
  assert.equal(x.stores.session.scanRequest.tabId, 100, 'the request names the tab it opened');
  // And who asked, for the scan's report (ui/scan/runner.js scanReport.reason).
  assert.equal(x.stores.session.scanRequest.reason, 'popup');
  const site = loadBackground({ flags: CONNECTOR });
  assert.deepEqual(await site.send({ type: 'oh-request-scan' }, HANGAR), {
    ok: true,
    opened: true,
  });
  assert.equal(site.stores.session.scanRequest.reason, 'site', 'our hangar page asked');
  // Asked again within the minute: busy, and the page still comes to the front.
  const open = loadBackground({
    flags: CONNECTOR,
    session: { scanAskedAt: Date.now() - 5000 },
    contexts: [{ contextType: 'TAB', tabId: 7, windowId: 3, documentUrl: `${BASIC}#settings` }],
  });
  assert.deepEqual(await fromPopup(open), { ok: false, error: 'busy' });
  assert.deepEqual(open.opened, []);
  assert.ok(open.focused.some((f) => f.tab === 7 && f.active));
  // The popup and the hangar page share the one-a-minute limit.
  assert.deepEqual(await x.send({ type: 'oh-request-scan' }, HANGAR), { ok: false, error: 'busy' });
});

test("popup Scan: the scan runner's mark (with its run) holds it as before", async () => {
  // ui/scan/runner.js marks { at, tabId, run, by }: a tab's mark counts while its tab is
  // open, and one with no tab (a page that isn't a tab) for its 10 minutes.
  const mark = (tabId, by = 'tab') => ({
    scanRunning: { at: Date.now() - 5000, tabId, run: 'mq1x-0a1b2c3d4e5f', by },
  });
  const tab = { contextType: 'TAB', tabId: 7, windowId: 3, documentUrl: BASIC };
  const open = loadBackground({ flags: CONNECTOR, session: mark(7), contexts: [tab] });
  assert.deepEqual(await fromPopup(open), { ok: false, error: 'busy' });
  assert.equal((await open.send({ type: 'oh-scan-status' }, HANGAR)).running, true);
  const closed = loadBackground({ flags: CONNECTOR, session: mark(7), contexts: [] });
  assert.equal((await closed.send({ type: 'oh-scan-status' }, HANGAR)).running, false);
  const hidden = loadBackground({
    flags: CONNECTOR,
    session: mark(null, 'offscreen'),
    contexts: [],
  });
  assert.equal((await hidden.send({ type: 'oh-scan-status' }, HANGAR)).running, true);
  assert.deepEqual(await fromPopup(hidden), { ok: false, error: 'busy' });
  // The popup's own reading of it (ui/popup/data.js).
  const { scanBusy } = await data();
  assert.equal(scanBusy(mark(null, 'offscreen')), true);
  assert.equal(
    scanBusy({ scanRunning: { ...mark(7).scanRunning, at: Date.now() - 11 * 60e3 } }),
    false,
  );
});

test('popup Scan: only our own popup is heard', async () => {
  const x = loadBackground({ flags: CONNECTOR });
  // From a tab (a page could load the popup's address in one), another extension, or
  // another of our pages: no answer.
  assert.equal(await fromPopup(x, undefined, { tab: { id: 1 } }), undefined);
  assert.equal(await fromPopup(x, undefined, { id: 'someone-else' }), undefined);
  assert.equal(await fromPopup(x, undefined, { url: BASIC }), undefined);
  assert.equal(await fromPopup(x, { ohPopup: 'melt' }), undefined);
  assert.deepEqual(x.opened, []);
  // Its address with a hash is still the popup.
  assert.deepEqual(await fromPopup(x, undefined, { url: `${POPUP}#x` }), {
    ok: true,
    opened: true,
  });
});

test('popup Scan: cut from builds without the connector', async () => {
  const x = loadBackground({ flags: { ...CONNECTOR, connector: false } });
  assert.equal(await fromPopup(x), undefined);
  assert.deepEqual(x.opened, []);
});

test("connector build: the bridge's Firefox messages still get through", async () => {
  const x = loadBackground({ browser: 'firefox', flags: CONNECTOR });
  const r = await x.fromPage({ type: 'oh-hello' }, `${HANGAR}/`);
  assert.equal(r.ok, true);
  assert.ok(r.caps.includes('requestScan'));
});

test('connector build: every page the background opens is the basic page', async () => {
  // Our hangar page's scan, Firefox's ask for it (Home → the settings) and an open
  // dashboard that isn't the basic page doesn't count.
  const x = loadBackground({
    flags: CONNECTOR,
    contexts: [
      {
        contextType: 'TAB',
        tabId: 4,
        windowId: 1,
        documentUrl: `chrome-extension://${CHROME_ID}/src/dashboard.html`,
      },
    ],
  });
  assert.deepEqual(await x.send({ type: 'oh-request-scan' }, HANGAR), { ok: true, opened: true });
  assert.deepEqual(x.opened, [BASIC]);
  const ff = loadBackground({ browser: 'firefox', flags: CONNECTOR, granted: false, contexts: [] });
  assert.deepEqual(await ff.fromPage({ type: 'oh-get-hangar' }, `${HANGAR}/`), {
    ok: false,
    error: 'firefox-ask',
  });
  assert.deepEqual(ff.opened, ['moz-extension://uuid/src/basic.html#settings']);
  // Without the connector: the dashboard, as before.
  const dash = loadBackground({ flags: { ...CONNECTOR, connector: false } });
  await dash.send({ type: 'oh-request-scan' }, HANGAR);
  assert.deepEqual(dash.opened, [`chrome-extension://${CHROME_ID}/src/dashboard.html`]);
});

// --- What the popup shows ----------------------------------------------------------------
const NOW = Date.UTC(2026, 9, 11, 12);
const DAY = 86400000;
const hangar = (items, scannedAt) => ({ sources: { hangar: { items, scannedAt } } });

test('popup view: a fresh browser, a scan, a stale one', async () => {
  const { popupView } = await data();
  const total = (items) => items.reduce((s, p) => s + p.value, 0);
  const none = popupView({ db: { sources: {} } }, { now: NOW, totalValue: total });
  assert.equal(none.scannedAt, null);
  assert.equal(none.staleDays, null);
  assert.equal(none.melt, 0);
  assert.equal(none.handle, '');
  const items = [{ value: 45 }, { value: 110 }];
  const fresh = popupView({ db: hangar(items, NOW - DAY) }, { now: NOW, totalValue: total });
  assert.equal(fresh.melt, 155);
  assert.equal(fresh.staleDays, null);
  // A week old: the badge's "!" rule. Stored times may be ISO strings too.
  const old = popupView(
    { db: hangar(items, new Date(NOW - 8 * DAY).toISOString()) },
    { now: NOW, totalValue: total },
  );
  assert.equal(old.staleDays, 8);
});

test('popup view: pledges with no melt value are counted, not added', async () => {
  const { popupView } = await data();
  const total = (items) => items.reduce((s, p) => s + (Number.isFinite(p.value) ? p.value : 0), 0);
  const v = popupView(
    { db: hangar([{ value: 45 }, { value: null }, {}, { value: 0 }], NOW) },
    { now: NOW, totalValue: total },
  );
  assert.equal(v.melt, 45);
  assert.equal(v.unpriced, 2); // a real $0 is a price
  assert.equal(popupView({ db: { sources: {} } }, { now: NOW }).unpriced, 0);
});

test('popup view: who, signed out, and where Open My Hangar goes', async () => {
  const { popupView, myHangarUrl } = await data();
  const db = { ...hangar([], NOW), owner: { nickname: 'TestPilot' } };
  assert.equal(popupView({ db }, { now: NOW }).handle, 'TestPilot');
  const live = { loggedIn: true, nickname: 'Wingmate', displayname: 'Wing Mate' };
  assert.equal(popupView({ db, account: live }, { now: NOW }).handle, 'Wing Mate');
  // Only a confirmed sign-out counts; a failed read (null) says nothing.
  assert.equal(popupView({ db, account: { loggedIn: false } }, { now: NOW }).signedOut, true);
  assert.equal(popupView({ db, account: { loggedIn: null } }, { now: NOW }).signedOut, false);
  // Synced: the website's My Hangar. Not: our hangar page. Neither: no button.
  const app = 'https://app.openhangar.space';
  assert.equal(
    myHangarUrl({ link: { name: 'x' }, siteUrl: app, hangarPage: HANGAR }),
    `${app}/hangar`,
  );
  assert.equal(myHangarUrl({ link: null, siteUrl: app, hangarPage: HANGAR }), `${HANGAR}/`);
  assert.equal(myHangarUrl({ link: null, siteUrl: app, hangarPage: '' }), null);
  const v = popupView(
    { db, link: { name: 'pilot@site', lastSync: NOW - 60e3, token: 'secret' }, siteUrl: app },
    { now: NOW },
  );
  assert.deepEqual(v.connected, { name: 'pilot@site', lastSync: NOW - 60e3, waitUntil: null });
  assert.ok(!JSON.stringify(v).includes('secret'), 'the sync token never reaches the popup view');
});

test('popup view: a too-soon sync waits until its time, nothing else does', async () => {
  const { popupView } = await data();
  // OH.siteSyncWait's rule, as the popup calls it (Sync Now, so not-open never holds).
  const syncWait = (link, { now }) =>
    link.wait && link.wait.reason === 'too-soon' && link.wait.until > now ? link.wait : null;
  const view = (wait) =>
    popupView(
      { db: hangar([], NOW), link: { name: 'p', lastSync: NOW - 60e3, wait } },
      {
        now: NOW,
        syncWait,
      },
    ).connected.waitUntil;
  assert.equal(view({ reason: 'too-soon', until: NOW + 4 * 60e3 }), NOW + 4 * 60e3);
  assert.equal(view({ reason: 'too-soon', until: NOW - 1 }), null, 'over');
  assert.equal(view({ reason: 'not-open', until: NOW + 60e3 }), null);
  assert.equal(view(undefined), null);
});

test('when.at: a time ahead reads as the time today, the date and time after', async () => {
  const { at } = await import('../ui/site/when.js');
  const soon = new Date();
  soon.setHours(18, 2, 0, 0);
  assert.equal(
    at(soon.getTime()),
    soon.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
  );
  const later = new Date(soon.getTime() + 2 * DAY);
  assert.match(at(later.getTime()), /, /);
  assert.equal(at(null), '');
});

test('popup view: a scan running, Store Credit', async () => {
  const { scanBusy, storeCredit } = await data();
  assert.equal(scanBusy({}, NOW), false);
  assert.equal(scanBusy({ scanRequest: { at: NOW - 30e3 } }, NOW), true);
  assert.equal(scanBusy({ scanRequest: { at: NOW - 90e3 } }, NOW), false);
  assert.equal(scanBusy({ scanRunning: { at: NOW - 5 * 60e3 } }, NOW), true);
  assert.equal(scanBusy({ scanRunning: { at: NOW - 11 * 60e3 } }, NOW), false);
  assert.equal(storeCredit({ credits: { store: { value: 12345 } } }), 123.45);
  assert.equal(storeCredit({}), null);
});

test("popup: the line for pledges with no price, in the owner's words (2026-10-12)", async () => {
  const { unpricedLine } = await data();
  assert.equal(unpricedLine(1), 'Not counted: 1 pledge with no price.');
  assert.equal(unpricedLine(3), 'Not counted: 3 pledges with no price.');
  assert.equal(unpricedLine(1200), 'Not counted: 1,200 pledges with no price.');
});

test("popup copy: the owner's words (2026-10-13), filled in", async () => {
  const { t } = await import('../ui/popup/copy.js');
  assert.equal(t('popup.scan'), 'Scan');
  assert.equal(t('popup.synced', { when: '2h ago' }), 'Synced 2h ago');
  assert.equal(t('popup.alerts', { n: 2 }), 'Alerts: 2');
  assert.equal(
    t('popup.sync-wait', { time: '6:02 PM' }),
    'Try again at 6:02 PM. The last sync was moments ago.',
  );
  assert.throws(() => t('popup.nope'), /no "popup.nope"/);
  const src = require('node:fs').readFileSync(`${__dirname}/../ui/popup/copy.js`, 'utf8');
  assert.doesNotMatch(src, /\[copy:/);
});

test('popup: UEC and REC are compact for the card and full for the tooltip', async () => {
  const { compactCount, gameCredit } = await data();
  const nb = ' ';
  const cases = [
    [0, '0'],
    [950, '950'],
    [999, '999'],
    [1000, `1${nb}K`],
    [90000, `90${nb}K`],
    [999949, `999.9${nb}K`],
    [999950, `1${nb}M`],
    [1200000, `1.2${nb}M`],
    [2000000, `2${nb}M`],
    [3400000000, `3.4${nb}B`],
  ];
  for (const [n, text] of cases) assert.equal(compactCount(n), text, String(n));
  for (const bad of [undefined, null, NaN, '12', -5, Infinity])
    assert.equal(compactCount(bad), null);
  const account = { credits: { uec: { value: 1200000 }, rec: { value: 0 } } };
  assert.deepEqual(gameCredit(account, 'uec'), { text: `1.2${nb}M`, full: '1,200,000' });
  assert.deepEqual(gameCredit(account, 'rec'), { text: '0', full: '0' });
  assert.equal(gameCredit({ credits: { store: { value: 5 } } }, 'uec'), null);
  assert.equal(gameCredit({ credits: { uec: { value: null } } }, 'uec'), null);
  assert.equal(gameCredit(null, 'rec'), null);
});

test('popup: Buy-Back Tokens show 0 to 99, then 99+ with the real count', async () => {
  const { tokenCount } = await data();
  assert.deepEqual(tokenCount(0), { text: '0', full: '0' });
  assert.deepEqual(tokenCount(2), { text: '2', full: '2' });
  assert.deepEqual(tokenCount(99), { text: '99', full: '99' });
  assert.deepEqual(tokenCount(100), { text: '99+', full: '100' });
  assert.deepEqual(tokenCount(12345), { text: '99+', full: '12,345' });
  for (const bad of [null, undefined, -1, 1.5, NaN, '2']) assert.equal(tokenCount(bad), null);
});

test('popup: money fits its box, the full figure while it fits, then compact', async () => {
  const { moneyFit, FIT, fxFor } = await import('../ui/popup/currency.js');
  const nb = ' ';
  const credit = (usd) => moneyFit(usd, undefined, { cents: true, full: FIT.credit });
  // Store Credit: $9,999.99 is the widest full figure.
  assert.deepEqual(credit(51.56), { text: '$51.56', title: '', short: false });
  assert.equal(credit(9999.99).text, '$9,999.99');
  assert.equal(credit(9999.99).short, false);
  assert.equal(credit(10000).text, `$10${nb}K`);
  assert.equal(credit(12400).text, `$12.4${nb}K`);
  assert.deepEqual(credit(12000000), { text: `$12${nb}M`, title: '$12,000,000.00', short: true });
  assert.equal(credit(1.2e9).text, `$1.2${nb}B`);
  // Account Value: the full figure up to $999,999, then compact.
  const value = (usd) => moneyFit(usd);
  assert.equal(value(999999).text, '$999,999');
  assert.equal(value(999999).short, false);
  assert.equal(value(1000000).text, `$1${nb}M`);
  assert.equal(value(1234567).text, `$1.2${nb}M`);
  assert.deepEqual(value(100000000), { text: `$100${nb}M`, title: '$100,000,000', short: true });
  // The change line: up to $99,999.
  const change = (usd) => moneyFit(usd, undefined, { most: 0, full: FIT.change });
  assert.equal(change(90).text, '$90');
  assert.equal(change(99999).text, '$99,999');
  assert.equal(change(100000).text, `$100${nb}K`);
  // In another currency the threshold is the converted amount; the title keeps both.
  const eur = fxFor('EUR', { rates: { EUR: 0.9 }, date: '2026-10-23' });
  const big = moneyFit(10000000, eur);
  assert.equal(big.short, true);
  assert.match(big.text, /9/);
  assert.match(big.title, /\(\$10,000,000\)$/);
  assert.equal(moneyFit(NaN).text, '');
});
