'use strict';
// Connect from the website (src/background.js, sync builds only; connect hardening,
// #669). Our site may only ask: the basic page comes to the front and runs its own
// sign-in window (ui/basic/sign-in.js), whose one-time code comes back through the
// browser, never through a page. A page can't hand in a code, and an account switch is
// asked on the basic page first (OH.siteSwitches). Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadBackground, CHROME_ID, STORE_FLAGS } = require('./bridge-env.js');

// The background worker as a store build makes it (test/bridge-env.js: sync, Local
// Mode and the connector). staging: a developer's build pointed at staging (npm run
// build:staging), which lets staging's pages in; the store builds don't. flags: a
// developer's build's own.
function load({
  staging = true,
  browser = 'chrome',
  granted = true,
  flags = STORE_FLAGS,
  contexts = null,
  local = {},
  session = {},
} = {}) {
  const fetched = [];
  const x = loadBackground({
    browser,
    staging,
    granted,
    flags,
    contexts,
    local,
    session,
    fetch: async (url, init) => {
      fetched.push({ url, init });
      return { ok: true, json: async () => ({ token: 'oht_other', name: 'Someone Else' }) };
    },
  });
  return { ...x, fetched };
}
// The site's hello in a sync build (bridge v2; cart and connect for older pages).
const HELLO_APP = {
  ok: true,
  v: 2,
  version: '0.3.0',
  caps: ['hello', 'addToCart', 'addItems', 'connect'],
  cart: true,
  buyback: true,
  connect: true,
};

const SITE = 'https://staging.openhangar.space';
const BASIC = `chrome-extension://${CHROME_ID}/src/basic.html`;
const UNKNOWN = { ok: false, error: 'unknown request' };

test('our site: begin brings up the basic page to connect, and hands the page nothing', async () => {
  const x = load();
  assert.deepEqual(await x.send({ type: 'oh-hello' }, SITE), HELLO_APP);
  const begin = await x.send({ type: 'oh-connect-begin' }, SITE);
  assert.deepEqual(begin, { ok: true, window: true }, 'no challenge, no redirect address');
  assert.deepEqual(x.opened, [`${BASIC}#settings`]);
  // The ask names the tab that runs it (ui/basic/hub.svelte.js connectIfAsked).
  assert.equal(x.stores.session.siteConnectAsk.tabId, 100);
  assert.ok(x.stores.session.siteConnectAskedAt);
  // Nothing sent anywhere, nothing kept that a code could be traded with.
  assert.deepEqual(x.fetched, []);
  assert.equal(x.stores.session.siteConnect, undefined, 'no verifier in the worker');
  assert.equal(x.stores.local.siteLink, undefined);
});

test('an Open Hangar tab already open comes to the front, no second tab (#658)', async () => {
  const x = load({
    contexts: [{ contextType: 'TAB', tabId: 7, windowId: 3, documentUrl: `${BASIC}#home` }],
  });
  assert.deepEqual(await x.send({ type: 'oh-connect-begin' }, SITE), { ok: true, window: true });
  assert.deepEqual(x.opened, [], 'no new tab: a scan running there keeps going');
  assert.deepEqual(x.focused, [
    { tab: 7, active: true },
    { window: 3, focused: true },
  ]);
  assert.equal(x.stores.session.siteConnectAsk.tabId, 7);
});

test('a page asking again and again opens one window, until the basic page is done', async () => {
  const x = load();
  const answers = await Promise.all(
    [1, 2, 3].map(() => x.send({ type: 'oh-connect-begin' }, SITE)),
  );
  for (const a of answers) assert.deepEqual(a, { ok: true, window: true });
  assert.equal(x.opened.length, 1, 'three asks at once: one tab');
  // A worker that stopped and started again still holds it (session storage).
  const again = load({ session: { siteConnectAskedAt: Date.now() } });
  await again.send({ type: 'oh-connect-begin' }, SITE);
  assert.deepEqual(again.opened, []);
  // The basic page's window closed (it clears siteConnectAskedAt), or a minute went by:
  // the next ask opens.
  const later = load({ session: { siteConnectAskedAt: Date.now() - 61e3 } });
  await later.send({ type: 'oh-connect-begin' }, SITE);
  assert.equal(later.opened.length, 1);
});

// A page that hands the extension a one-time code of its own choosing: there's no
// message for it any more, and nothing it sends is kept.
test('a page can never hand in a code: no finish, no token, no sync', async () => {
  const x = load({ local: { siteLink: { token: 'oht_mine', name: 'Me' } } });
  await x.send({ type: 'oh-connect-begin' }, SITE);
  for (const msg of [
    { type: 'oh-connect-finish', code: 'some-code', sync: true },
    { type: 'oh-connect-finish', code: 'some-code' },
    { type: 'oh-connect-finish' },
  ])
    assert.deepEqual(await x.send(msg, SITE), UNKNOWN, JSON.stringify(msg));
  const odd = await x.send({ type: 'oh-connect-begin', code: 'some-code' }, SITE);
  assert.deepEqual(odd, { ok: false, error: 'bad request' });
  assert.deepEqual(x.fetched, [], 'no token trade, no revoke');
  assert.deepEqual(x.stores.local.siteLink, { token: 'oht_mine', name: 'Me' }, 'the link stays');
  assert.equal(x.stores.local.siteSyncRequested, undefined, 'no sync asked');
  // Nor through Firefox's bridge (whose own list doesn't pass it on: test/bridge-v2.test.js).
  const ff = loadFirefox();
  assert.deepEqual(
    await ff.fromPage({ type: 'oh-connect-finish', code: 'c', sync: true }, `${SITE}/link`),
    UNKNOWN,
  );
  assert.equal(ff.stores.local.siteLink, undefined);
});

test('other websites, and the public front page, get no Connect', async () => {
  const x = load();
  assert.equal(await x.send({ type: 'oh-hello' }, 'https://evil.example'), undefined);
  assert.equal(await x.send({ type: 'oh-connect-begin' }, 'https://evil.example'), undefined);
  assert.deepEqual(await x.send({ type: 'oh-connect-begin' }, 'https://openhangar.space'), UNKNOWN);
  assert.deepEqual(x.opened, []);
});

test("a developer's build without the connector connects from its own dashboard only", async () => {
  const dash = load({ flags: { ...STORE_FLAGS, connector: false } });
  const begin = await dash.send({ type: 'oh-connect-begin' }, SITE);
  assert.equal(begin.ok, false);
  assert.deepEqual(dash.opened, []);
});

// The beta build (npm run build:beta) leaves staging out of the manifest, so the
// extension won't connect there either: production only.
test('a build without staging in the manifest connects to production only', async () => {
  const x = load({ staging: false });
  const prod = await x.send({ type: 'oh-hello' }, 'https://app.openhangar.space');
  assert.equal(prod.connect, true);
  assert.equal(await x.send({ type: 'oh-hello' }, SITE), undefined, 'staging gets no answer');
  const front = await x.send({ type: 'oh-hello' }, 'https://openhangar.space');
  assert.equal(front.connect, false, 'Connect stays on the app');
});

// Firefox (#434): no externally_connectable; src/site-bridge.js, a content script on
// our own site only, passes the page's messages on, and the browser says which page
// it ran in. The first Connect waits for Firefox's own yes, asked from the basic page.
function loadFirefox({ granted = true, browser = 'firefox' } = {}) {
  return load({ browser, granted });
}

test('firefox: our site asks through the bridge, and the basic page connects', async () => {
  const x = loadFirefox();
  assert.deepEqual(await x.fromPage({ type: 'oh-hello' }, `${SITE}/link`), HELLO_APP);
  const begin = await x.fromPage({ type: 'oh-connect-begin' }, `${SITE}/link`);
  assert.deepEqual(begin, { ok: true, window: true });
  assert.deepEqual(x.opened, ['moz-extension://uuid/src/basic.html#settings']);
  assert.ok(x.stores.session.siteConnectAsk);
});

test('firefox: only our own content script on our own site gets an answer', async () => {
  const x = loadFirefox();
  // Another site (the bridge never runs there, but if it did): no answer.
  assert.equal(await x.fromPage({ type: 'oh-hello' }, 'https://evil.example/link'), undefined);
  // Not from a tab, not our extension, or not the top frame: no answer.
  const id = x.chrome.runtime.id;
  const hello = { ohSite: { type: 'oh-hello' } };
  assert.equal(await x.sendInternal(hello, { id, frameId: 0, url: `${SITE}/` }), undefined);
  assert.equal(
    await x.sendInternal(hello, { id: 'other', tab: {}, frameId: 0, url: `${SITE}/` }),
    undefined,
  );
  assert.equal(
    await x.sendInternal(hello, { id, tab: {}, frameId: 2, url: `${SITE}/` }),
    undefined,
  );
  // The dashboard's own messages aren't the website's.
  assert.equal(
    await x.sendInternal({ type: 'oh-hello' }, { id, tab: {}, frameId: 0, url: `${SITE}/` }),
    undefined,
  );
});

test("firefox: before Firefox says yes, Connect opens the basic page's settings with its card up", async () => {
  const x = loadFirefox({ granted: false });
  const begin = await x.fromPage({ type: 'oh-connect-begin' }, `${SITE}/link`);
  assert.deepEqual(begin, { ok: false, firefoxAsk: true });
  // The basic page's Firefox card (ui/basic/FirefoxCard.svelte) shows on any of its tabs;
  // its Continue runs the same sign-in window.
  assert.deepEqual(x.opened, ['moz-extension://uuid/src/basic.html#settings']);
  assert.ok(x.stores.session.siteAskFirefox);
  assert.equal(x.stores.session.siteConnectAsk, undefined);
});

test('firefox for android: no sign-in window, so no Connect from the website', async () => {
  const x = loadFirefox({ browser: 'firefox-android' });
  const begin = await x.fromPage({ type: 'oh-connect-begin' }, `${SITE}/link`);
  assert.equal(begin.ok, false);
  assert.deepEqual(x.opened, []);
});

// --- The sign-in window (ui/basic/sign-in.js), with a stand-in identity API ----------
const signIn = () => import('../ui/basic/sign-in.js');
const REDIRECT = `https://${CHROME_ID}.chromiumapp.org/`;
// answer: what the window comes back with, as /connect would send it (by default the
// code, this window's state and the first sync, on the extension's own address).
function fakeIdentity({ approve = true, redirect = REDIRECT, answer } = {}) {
  const asked = [];
  return {
    asked,
    getRedirectURL: () => redirect,
    launchWebAuthFlow: async ({ url, interactive }) => {
      asked.push({ url: new URL(url), interactive });
      if (!approve) throw new Error('The user did not approve access.');
      const state = new URL(url).searchParams.get('state');
      return answer ? answer(state) : `${redirect}?code=one-time&state=${state}&sync=1`;
    },
  };
}
function fakeFetch(body = { token: 'oht_new', name: 'Pilot' }, ok = true) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), credentials: init.credentials });
    return { ok, json: async () => body };
  };
  return { fetch, calls };
}
const b64 = (buf) => Buffer.from(buf).toString('base64url');

test('the sign-in window: /connect with S256, then the code traded with the verifier', async () => {
  const { signInWindow } = await signIn();
  const identity = fakeIdentity();
  const net = fakeFetch();
  const got = await signInWindow({ base: SITE, identity, fetch: net.fetch });
  assert.equal(got.link.token, 'oht_new');
  assert.equal(got.link.name, 'Pilot');
  assert.equal(got.sync, true, "/connect's first sync");
  const { url, interactive } = identity.asked[0];
  assert.equal(interactive, true);
  assert.equal(url.origin + url.pathname, `${SITE}/connect`);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('redirect_uri'), REDIRECT);
  assert.equal(net.calls.length, 1);
  assert.equal(net.calls[0].url, `${SITE}/api/link/token`);
  assert.equal(net.calls[0].credentials, 'omit');
  assert.equal(net.calls[0].body.code, 'one-time');
  assert.equal(net.calls[0].body.redirect_uri, REDIRECT);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(net.calls[0].body.code_verifier),
  );
  assert.equal(b64(digest), url.searchParams.get('code_challenge'));
});

test("the sign-in window on Firefox: Firefox's own address", async () => {
  const { signInWindow } = await signIn();
  const redirect = 'https://abc123.extensions.allizom.org/';
  const net = fakeFetch();
  const identity = fakeIdentity({ redirect });
  const got = await signInWindow({ base: SITE, identity, fetch: net.fetch });
  assert.equal(got.link.token, 'oht_new');
  assert.equal(net.calls[0].body.redirect_uri, redirect);
});

test('the sign-in window: closed, cancelled, crossed or failed keeps nothing', async () => {
  const { signInWindow } = await signIn();
  const net = fakeFetch();
  const go = (identity, fetch = net.fetch) => signInWindow({ base: SITE, identity, fetch });
  assert.deepEqual(await go(fakeIdentity({ approve: false })), { cancelled: true });
  // Cancel on /connect.
  const cancel = fakeIdentity({
    answer: (state) => `${REDIRECT}?error=access_denied&state=${state}`,
  });
  assert.deepEqual(await go(cancel), { cancelled: true });
  // Another window's state, or an address that isn't this extension's.
  const crossed = fakeIdentity({ answer: () => `${REDIRECT}?code=c&state=other` });
  assert.deepEqual(await go(crossed), { cancelled: true });
  const elsewhere = fakeIdentity({
    answer: (state) => `https://evil.example/?code=c&state=${state}`,
  });
  assert.deepEqual(await go(elsewhere), { cancelled: true });
  assert.equal(net.calls.length, 0, 'no code traded');
  // The trade refused, or no token in its answer.
  assert.deepEqual(await go(fakeIdentity(), fakeFetch({}, false).fetch), { failed: true });
  assert.deepEqual(await go(fakeIdentity(), fakeFetch({}).fetch), { failed: true });
  // No window here (Firefox for Android): the caller uses the website's page.
  assert.equal(await go({}), null);
});

// The whole Connect This Browser, as it runs: the website asks, the worker brings up
// the basic page with the ask, and the basic page's window (here, the stand-in)
// connects. The switch question is OH.siteSwitches (test/site-sync.test.js).
test('Connect This Browser, end to end with a stand-in identity API', async () => {
  const x = load({ staging: false });
  const APP = 'https://app.openhangar.space';
  assert.deepEqual(await x.send({ type: 'oh-connect-begin' }, APP), { ok: true, window: true });
  const ask = x.stores.session.siteConnectAsk;
  assert.ok(Date.now() - ask.at < 60e3);
  const { signInWindow } = await signIn();
  const net = fakeFetch();
  const got = await signInWindow({ base: APP, identity: fakeIdentity(), fetch: net.fetch });
  assert.deepEqual(
    { token: got.link.token, name: got.link.name, sync: got.sync },
    { token: 'oht_new', name: 'Pilot', sync: true },
  );
  assert.equal(net.calls[0].url, `${APP}/api/link/token`);
  assert.deepEqual(x.fetched, [], 'the worker itself traded nothing');
});

// Connect with a code (src/dashboard.js siteConnect, when the sign-in window can't
// open): the dashboard keeps the code it's waiting for in session storage, and the
// website's code page fills a code in only when this says it's that one.
const PENDING = (o = {}) => ({
  siteLinkPending: { code: 'K7Q-4PX', origin: SITE, until: Date.now() + 600e3, ...o },
});
const check = (x, code, from = SITE) => x.send({ type: 'oh-link-check', code }, from);

test('the code check: yes only for the code this extension is waiting for', async () => {
  const x = load();
  assert.deepEqual(await check(x, 'K7Q-4PX'), { ok: true, mine: false }, 'nothing waiting');
  Object.assign(x.stores.session, PENDING());
  assert.deepEqual(await check(x, 'K7Q-4PX'), { ok: true, mine: true });
  assert.deepEqual(await check(x, ' k7q4px '), { ok: true, mine: true }, 'as people type it');
  for (const other of ['K7Q-4PY', 'K7Q', 'K7Q-4PXX', '-', '???'])
    assert.deepEqual(await check(x, other), { ok: true, mine: false }, other);
  // Only from the site it asked for that code, and not once it has run out.
  assert.deepEqual(await check(x, 'K7Q-4PX', 'https://app.openhangar.space'), {
    ok: true,
    mine: false,
  });
  Object.assign(x.stores.session, PENDING({ until: Date.now() - 1 }));
  assert.deepEqual(await check(x, 'K7Q-4PX'), { ok: true, mine: false }, 'run out');
  Object.assign(x.stores.session, PENDING({ code: '' }));
  assert.deepEqual(await check(x, ''), { ok: false, error: 'bad request' });
  assert.deepEqual(await check(x, '-'), { ok: true, mine: false }, 'an empty code never matches');
  // Nothing asked of the website, nothing changed here.
  assert.equal(x.fetched.length, 0);
  assert.equal(x.opened.length, 0);
});

test('the code check: only on the pages that may Connect, and only a short code', async () => {
  const x = load({ staging: false });
  Object.assign(x.stores.session, PENDING({ origin: 'https://app.openhangar.space' }));
  const app = 'https://app.openhangar.space';
  assert.deepEqual(await check(x, 'K7Q-4PX', app), { ok: true, mine: true });
  const UNKNOWN = { ok: false, error: 'unknown request' };
  assert.deepEqual(await check(x, 'K7Q-4PX', 'https://openhangar.space'), UNKNOWN);
  assert.equal(await check(x, 'K7Q-4PX', 'https://evil.example'), undefined);
  const BAD = { ok: false, error: 'bad request' };
  for (const code of [undefined, 1234567, 'K'.repeat(17), ['K7Q-4PX']])
    assert.deepEqual(await x.send({ type: 'oh-link-check', code }, app), BAD, String(code));
  assert.deepEqual(
    await x.send({ type: 'oh-link-check', code: 'K7Q-4PX', more: 1 }, app),
    BAD,
    'nothing else rides along',
  );
});

test('firefox: the code page checks its code through the bridge', async () => {
  const x = loadFirefox();
  Object.assign(x.stores.session, PENDING());
  const ask = (code) => x.fromPage({ type: 'oh-link-check', code }, `${SITE}/link?code=${code}`);
  assert.deepEqual(await ask('K7Q-4PX'), { ok: true, mine: true });
  assert.deepEqual(await ask('ABC-DEF'), { ok: true, mine: false });
});

// --- No sign-in window (Firefox for Android, #764): a code from the basic page ---------
// (ui/basic/link-code.js), with stand-ins for the website's start and poll.
const linkCode = () => import('../ui/basic/link-code.js');
function fakeCodeSite({ polls = [{ status: 'approved', token: 'oht_code', name: 'Pilot' }] } = {}) {
  const asked = [];
  const OH = {
    siteLinkStart: async () => ({
      device_code: 'dev-secret',
      user_code: 'K7Q-4PX',
      verification_uri: 'https://elsewhere.example/link',
      expires_in: 600,
      interval: 0.001,
    }),
    siteLinkWait: async (start, shouldGo, opts) => {
      asked.push({ device_code: start.device_code, opts });
      for (const j of polls) {
        if (!shouldGo()) return null;
        if (j.status === 'approved') return { token: j.token, name: j.name, lastSync: null };
        if (j.status === 'expired') return null;
      }
      return null;
    },
  };
  return { OH, asked };
}
function fakeSession() {
  const store = {};
  return {
    store,
    seen: [],
    get: async (k) => (k in store ? { [k]: store[k] } : {}),
    set: async function (o) {
      this.seen.push(structuredClone(o));
      Object.assign(store, o);
    },
    remove: async (k) => void delete store[k],
  };
}
const codeRun = async ({ polls, shouldGo, identity } = {}) => {
  const { connectLink } = await linkCode();
  const site = fakeCodeSite({ polls });
  const session = fakeSession();
  const opened = [];
  const shown = [];
  const got = await connectLink({
    base: SITE,
    identity,
    fetch: async () => assert.fail('no token trade without the window'),
    OH: site.OH,
    session,
    open: (url) => opened.push(url),
    show: (c) => shown.push(c),
    shouldGo,
  });
  return { got, site, session, opened, shown };
};

test('no sign-in window: Connect starts a code and opens the website code page', async () => {
  for (const identity of [undefined, {}, { getRedirectURL: () => REDIRECT }]) {
    const { got, site, session, opened, shown } = await codeRun({ identity });
    const page = `${SITE}/link?code=K7Q-4PX`;
    assert.deepEqual(opened, [page], 'this site, never the address the answer names');
    assert.deepEqual(shown, [{ code: 'K7Q-4PX', url: page }]);
    // The page may fill in this code only (background.js oh-link-check), until it's done.
    const pending = session.seen[0].siteLinkPending;
    assert.deepEqual([pending.code, pending.origin], ['K7Q-4PX', SITE]);
    assert.ok(pending.until > Date.now());
    assert.equal(session.store.siteLinkPending, undefined, 'cleared once approved');
    assert.ok(!JSON.stringify(session.seen).includes('dev-secret'), 'the device code stays');
    // Approved: the token comes back unsaved, for the account-switch question first.
    assert.deepEqual(site.asked, [{ device_code: 'dev-secret', opts: { save: false } }]);
    assert.equal(got.link.token, 'oht_code');
    assert.equal(got.sync, undefined);
  }
});

test('the code: refused or run out reads as expired, Cancel as cancelled', async () => {
  const expired = await codeRun({ polls: [{ status: 'pending' }, { status: 'expired' }] });
  assert.deepEqual(expired.got, { expired: true });
  assert.equal(expired.session.store.siteLinkPending, undefined);
  const cancelled = await codeRun({ shouldGo: () => false });
  assert.deepEqual(cancelled.got, { cancelled: true });
  assert.equal(cancelled.session.store.siteLinkPending, undefined);
});

test('the code: a newer code waiting is left alone', async () => {
  const { linkByCode } = await linkCode();
  const site = fakeCodeSite();
  const session = fakeSession();
  site.OH.siteLinkWait = async () => {
    session.store.siteLinkPending = { code: 'NEW-ONE' };
    return null;
  };
  await linkByCode({ OH: site.OH, base: SITE, session, open() {}, show() {} });
  assert.deepEqual(session.store.siteLinkPending, { code: 'NEW-ONE' });
});

test("the code's account: another account than the one connected still asks", async () => {
  const lib = require('node:fs').readFileSync(require.resolve('../src/lib.js'), 'utf8');
  const OH = {};
  // OH.siteSwitches only (pure): the basic page's question before anything is replaced.
  new Function('OH', lib.match(/OH\.siteSwitches = function[\s\S]*?\n {2}\};/)[0])(OH);
  const { got } = await codeRun();
  assert.equal(OH.siteSwitches({ token: 'oht_old', name: 'Other' }, got.link), true);
  assert.equal(OH.siteSwitches({ token: 'oht_old', name: 'Pilot' }, got.link), false);
  assert.equal(OH.siteSwitches(null, got.link), false);
  // ./hub.svelte.js takes Connect's link through that question, whichever way it came.
  const hub = require('node:fs').readFileSync(require.resolve('../ui/basic/hub.svelte.js'), 'utf8');
  assert.match(hub, /await connectLink\(/);
  assert.match(hub, /got\.expired[\s\S]*OH\.siteSwitches\(was, link\)/);
});
