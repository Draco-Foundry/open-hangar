'use strict';
// Extension Alerts in the background worker (src/background.js, the `alerts` flag's
// block): turned on and off by the basic page's switch (`alertsOn`), checks on an
// alarm, the badge, notifications only while allowed, the popup marking matches seen,
// a notification's click, a new scan matched again with nothing asked. In the sandbox
// with a stand-in browser (test/bridge-env.js); the network is a stand-in too, the sale
// feed invented in the website's v1 shape. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { CHROME_ID, cutFlags, loadBackground } = require('./bridge-env.js');
const fs = require('node:fs');
const path = require('node:path');

const ALERTS = { sync: true, orgFleet: false, localMode: true, connector: true, alerts: true };
const POPUP = `chrome-extension://${CHROME_ID}/src/popup.html`;
const FEED = {
  v: 1,
  updatedAt: '2026-10-11T11:55:00.000Z',
  ships: [{ slug: 'cutlass-black', name: 'Cutlass Black', keys: ['cutlass black'] }],
  items: [
    {
      id: 'sku-20',
      kind: 'paint',
      name: 'Cutlass - Coalfire Paint',
      price: 15,
      sale: ['listed'],
      ships: ['cutlass-black'],
    },
    {
      id: 'sku-10',
      kind: 'ship',
      name: 'Cutlass Black',
      price: 110,
      sale: ['warbond'],
      ships: ['cutlass-black'],
    },
  ],
};
const DB = {
  schemaVersion: 3,
  sources: {
    hangar: {
      scannedAt: Date.now(),
      items: [
        { id: '1', name: 'Cutlass Black', contents: [{ kind: 'Ship', label: 'Cutlass Black' }] },
      ],
    },
  },
};
const json = (body, status = 200, headers = {}) =>
  new Response(body == null ? null : JSON.stringify(body), { status, headers });

// The worker with alerts, its network answering `answers` in turn, and every request,
// badge and title it makes.
function worker({ local = {}, answers = [], notify = true, flags = ALERTS } = {}) {
  const asked = [];
  const x = loadBackground({
    flags,
    local: { db: structuredClone(DB), ...local },
    notify,
    changes: true,
    fetch: async (url, init) => {
      asked.push({ url, init });
      const a = answers.shift();
      if (!a) throw new Error('no network');
      return a;
    },
  });
  const badges = [];
  x.chrome.action.setBadgeText = async (o) => void badges.push(o.text);
  x.chrome.action.setTitle = async () => {};
  return { ...x, asked, badges };
}
// Waits for the worker's async work (a check is several awaits) to settle.
async function until(ok, ms = 1000) {
  const end = Date.now() + ms;
  while (!ok()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 2));
  }
}
const fromPopup = (x, msg, sender = {}) =>
  x.sendInternal(msg, { id: CHROME_ID, url: POPUP, ...sender });

test('turned on: one check, the feed only (not connected), the badge, notifications, the next alarm', async () => {
  const x = worker({ answers: [json(FEED, 200, { etag: 'W/"1"' })] });
  const t0 = Date.now();
  await x.chrome.storage.local.set({ alertsOn: true });
  await until(() => x.stores.local.alerts);
  await until(() => x.alarms.has('oh-alerts'));
  assert.equal(x.asked.length, 1);
  assert.equal(x.asked[0].url, 'https://openhangar.space/api/store/on-sale');
  assert.equal(x.asked[0].init.credentials, 'omit');
  assert.deepEqual(
    x.stores.local.alerts.items.map((m) => [m.id, m.why.map((w) => w.why)]),
    [
      ['sku-20', ['paint']],
      ['sku-10', ['warbond']],
    ],
  );
  await until(() => x.notes.length === 2);
  assert.deepEqual(
    x.notes.map((n) => [n.id, n.type, n.title]),
    [
      ['oh-alerts:sku-20', 'basic', 'Cutlass - Coalfire Paint'],
      ['oh-alerts:sku-10', 'basic', 'Cutlass Black'],
    ],
  );
  assert.ok(x.badges.includes('2'));
  const when = x.alarms.get('oh-alerts').when;
  assert.ok(
    when >= t0 + 30 * 60e3 && when <= Date.now() + 35 * 60e3,
    'next check in 30 to 35 minutes',
  );
});

test('notifications not allowed: the badge only', async () => {
  const x = worker({ answers: [json(FEED)], notify: false });
  await x.chrome.storage.local.set({ alertsOn: true });
  await until(() => x.stores.local.alerts);
  await until(() => x.badges.includes('2'));
  assert.equal(x.notes.length, 0);
});

test('the alarm: a check, with the saved copy while it is fresh (nothing asked)', async () => {
  const x = worker({ answers: [json(FEED)] });
  await x.chrome.storage.local.set({ alertsOn: true });
  await until(() => x.stores.local.alerts);
  await x.fireAlarm('oh-alerts');
  await x.fireAlarm('someone-else');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(x.asked.length, 1);
});

test('the popup open: every match seen, the badge back to the reminder', async () => {
  const x = worker({ answers: [json(FEED)] });
  await x.chrome.storage.local.set({ alertsOn: true });
  await until(() => x.stores.local.alerts && x.badges.includes('2'));
  // Not from a tab, not from another page.
  assert.equal(await fromPopup(x, { ohPopup: 'alerts-seen' }, { tab: { id: 1 } }), undefined);
  assert.equal(
    await fromPopup(
      x,
      { ohPopup: 'alerts-seen' },
      { url: `chrome-extension://${CHROME_ID}/src/basic.html` },
    ),
    undefined,
  );
  assert.deepEqual(await fromPopup(x, { ohPopup: 'alerts-seen' }), { ok: true });
  assert.equal(Object.keys(x.stores.local.alerts.seen).length, 2);
  assert.equal(x.badges.at(-1), '');
});

test('deleted in the popup: one, then Clear All, the badge follows (#701)', async () => {
  const x = worker({ answers: [json(FEED)] });
  await x.chrome.storage.local.set({ alertsOn: true });
  await until(() => x.stores.local.alerts && x.badges.includes('2'));
  // Only the popup may.
  assert.equal(
    await fromPopup(x, { ohPopup: 'alerts-hide', id: 'sku-20' }, { tab: { id: 1 } }),
    undefined,
  );
  const AL = require('../src/alerts.js');
  const ids = AL.shown(x.stores.local.alerts).map((m) => m.id);
  assert.equal(ids.length, 2);
  assert.deepEqual(await fromPopup(x, { ohPopup: 'alerts-hide', id: ids[0] }), { ok: true });
  assert.deepEqual(
    AL.shown(x.stores.local.alerts).map((m) => m.id),
    [ids[1]],
  );
  assert.equal(x.badges.at(-1), '1');
  assert.deepEqual(await fromPopup(x, { ohPopup: 'alerts-hide' }), { ok: true });
  assert.equal(AL.shown(x.stores.local.alerts).length, 0);
  assert.equal(x.badges.at(-1), '');
});

test("a notification clicked: that item on our Store's page, seen", async () => {
  const x = worker({ answers: [json(FEED)] });
  await x.chrome.storage.local.set({ alertsOn: true });
  await until(() => x.notes.length === 2);
  await x.clickNote('oh-alerts:sku-20');
  await until(() => x.opened.length === 1);
  assert.deepEqual(x.opened, ['https://openhangar.space/store#item=20']);
  await until(() => Object.keys(x.stores.local.alerts.seen).length === 1);
  await x.clickNote('oh-alerts:more');
  await until(() => x.opened.length === 2);
  assert.equal(x.opened[1], 'https://openhangar.space/store');
  await x.clickNote('someone-else:1');
  assert.equal(x.opened.length, 2);
});

test('a new scan: matched again from the saved feed, nothing asked; a sync changes nothing', async () => {
  const x = worker({ answers: [json(FEED)] });
  await x.chrome.storage.local.set({ alertsOn: true });
  await until(() => x.stores.local.alerts && x.stores.local.alerts.items.length === 2);
  const db = structuredClone(DB);
  db.sources.hangar.items = [];
  await x.chrome.storage.local.set({ db });
  await until(() => x.stores.local.alerts.items.length === 0);
  // A sync after a scan only moves lastSync.
  await x.chrome.storage.local.set({ siteLink: { token: 't', connectedAt: 1, lastSync: 2 } });
  await new Promise((r) => setTimeout(r, 20));
  const n = x.asked.length;
  await x.chrome.storage.local.set({ siteLink: { token: 't', connectedAt: 1, lastSync: 3 } });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(x.asked.length, n);
});

test('turned off: no alarm, the matches and the Wishlist keys gone', async () => {
  const x = worker({ answers: [json(FEED)] });
  await x.chrome.storage.local.set({ alertsOn: true });
  await until(() => x.alarms.has('oh-alerts') && x.stores.local.alerts);
  await x.chrome.storage.local.set({ alertsWish: { keys: ['sku:1'], connectedAt: 1 } });
  await x.chrome.storage.local.set({ alertsOn: false });
  await until(() => !x.alarms.has('oh-alerts') && !('alerts' in x.stores.local));
  assert.ok(!('alertsWish' in x.stores.local));
  assert.ok('alertsFeed' in x.stores.local, 'the public feed stays (nothing of the pilot in it)');
});

// A worker whose network holds the request `hold(url)` picks until let go (`release`).
function holding(hold, { local = {}, answer } = {}) {
  const asked = [];
  const held = [];
  const x = loadBackground({
    flags: ALERTS,
    notify: true,
    changes: true,
    local: { db: structuredClone(DB), ...local },
    fetch: async (url) => {
      asked.push(url);
      const wish = url.endsWith('/api/v1/wishlist');
      if (hold(url) && !held.length) await new Promise((r) => held.push(r));
      if (answer) return answer(url);
      return json(wish ? { v: 1, keys: ['ship:cutlass-black', 'sku:42'] } : FEED);
    },
  });
  return { x, asked, held, release: () => held.forEach((r) => r()) };
}
const settle = () => new Promise((r) => setTimeout(r, 30));
const LINK = { siteLink: { token: 'oht_test', connectedAt: 1 } };

test('turned off while a check waits on the network: nothing of it comes back', async () => {
  for (const which of ['feed', 'wishlist']) {
    const h = holding((url) => url.endsWith('/api/v1/wishlist') === (which === 'wishlist'), {
      local: LINK,
    });
    await h.x.chrome.storage.local.set({ alertsOn: true });
    await until(() => h.held.length === 1);
    const before = h.asked.length;
    await h.x.chrome.storage.local.set({ alertsOn: false });
    h.release();
    await settle();
    const local = h.x.stores.local;
    assert.ok(!('alerts' in local), `${which}: no matches kept`);
    assert.ok(!('alertsWish' in local), `${which}: no Wishlist keys kept`);
    assert.ok(!h.x.alarms.has('oh-alerts'), `${which}: no next check`);
    assert.equal(h.x.notes.length, 0, `${which}: no notification`);
    assert.equal(h.asked.length, before, `${which}: nothing more asked after Off`);
    assert.ok('alertsFeed' in local, `${which}: the public feed's record stays`);
  }
});

test("turned off mid-check: the feed's backoff is kept, so turning on again asks nothing", async () => {
  const h = holding(() => true, {
    answer: () => new Response(null, { status: 429, headers: { 'retry-after': '7200' } }),
  });
  await h.x.chrome.storage.local.set({ alertsOn: true });
  await until(() => h.held.length === 1);
  await h.x.chrome.storage.local.set({ alertsOn: false });
  h.release();
  await settle();
  assert.ok(h.x.stores.local.alertsFeed?.retryAt > Date.now(), 'the 429 is remembered');
  await h.x.chrome.storage.local.set({ alertsOn: true });
  await settle();
  assert.equal(h.asked.length, 1, 'nothing asked again before Retry-After');
});

test('turned off just as a check saves: cleaned up again once it settles', async () => {
  const x = worker({ answers: [json(FEED)] });
  // Off lands right after the check has kept its matches, past its last look at the
  // switch: the check goes on to set its next alarm, and the clean-up runs again.
  const set = x.chrome.storage.local.set;
  let flipped = false;
  x.chrome.storage.local.set = async (o) => {
    await set(o);
    if (!flipped && o && 'alerts' in o && 'alertsFeed' in o) {
      flipped = true;
      await set({ alertsOn: false });
    }
  };
  await x.chrome.storage.local.set({ alertsOn: true });
  await until(() => flipped);
  await settle();
  assert.ok(!('alerts' in x.stores.local), 'no matches kept');
  assert.ok(!x.alarms.has('oh-alerts'), 'no next check');
  assert.equal(x.notes.length, 0, 'no notification');
});

test('turned off and on again while a check waits: the late clean-up leaves the new state', async () => {
  const h = holding(() => true);
  await h.x.chrome.storage.local.set({ alertsOn: true });
  await until(() => h.held.length === 1);
  await h.x.chrome.storage.local.set({ alertsOn: false });
  // On again, its change not heard yet (the browser tells listeners later).
  h.x.stores.local.alertsOn = true;
  h.release();
  await settle();
  assert.ok(h.x.alarms.has('oh-alerts'), 'the next check is set');
  assert.equal(h.x.stores.local.alerts?.items.length, 2);
});

test('the worker starting with alerts on and no alarm: one, 30 minutes after the last check', async () => {
  const last = Date.now() - 5 * 60e3;
  const x = worker({
    local: {
      alertsOn: true,
      alerts: { v: 1, items: [], known: {}, seen: {}, gone: {}, checkedAt: last },
    },
  });
  await until(() => x.alarms.has('oh-alerts'));
  const when = x.alarms.get('oh-alerts').when;
  assert.ok(when >= last + 30 * 60e3 && when <= last + 35 * 60e3);
  assert.equal(x.asked.length, 0);
});

test('without the flag: no alerts code, no alarm, nothing asked', async () => {
  const x = worker({ flags: { ...ALERTS, alerts: false }, answers: [json(FEED)] });
  await x.chrome.storage.local.set({ alertsOn: true });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(x.asked.length, 0);
  assert.equal(x.alarms.size, 0);
  assert.equal(x.ctx.OHAlerts, undefined);
  const cut = cutFlags(
    fs.readFileSync(path.join(__dirname, '..', 'src', 'background.js'), 'utf8'),
    {
      ...ALERTS,
      alerts: false,
    },
  );
  assert.ok(!/OHAlerts|chrome\.alarms|chrome\.notifications|alerts\.js/.test(cut));
});

test('Remind Me off on every item: the list and the badge empty, the checks stop', async () => {
  const x = worker({
    local: { ...LINK },
    answers: [json(FEED), json({ v: 1, keys: ['sku:10'] }), json({ v: 1, keys: [] })],
  });
  await x.chrome.storage.local.set({ alertsOn: true });
  await until(() => x.stores.local.alerts?.items?.length);
  // A later check finds Remind Me on for nothing (turned off on the website, say).
  await x.chrome.storage.local.set({ alertsWish: { keys: [], connectedAt: 1, at: 0 } });
  await x.chrome.storage.local.set({ db: {} });
  await until(() => x.stores.local.alertsOn === false && !('alerts' in x.stores.local));
  assert.ok(!x.alarms.has('oh-alerts'));
});
