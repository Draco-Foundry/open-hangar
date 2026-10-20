'use strict';
// Connect from the website (src/background.js, sync builds only): our site may ask
// for a PKCE challenge and hand back a one-time code; the extension trades it with
// the verifier it kept, saves the link and opens the basic page's settings (the
// dashboard's Home in a developer's build without the connector). Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadBackground, CHROME_ID, STORE_FLAGS } = require('./bridge-env.js');

// The background worker as a store build makes it (test/bridge-env.js: sync, Local
// Mode and the connector), its token exchange answered here. staging: a developer's
// build pointed at staging (npm run build:staging), which lets staging's pages in; the
// store builds don't. flags: a developer's build's own.
function load({
  staging = true,
  browser = 'chrome',
  granted = true,
  flags = STORE_FLAGS,
  contexts = null,
  local = {},
  revoke = async () => ({ ok: true }),
} = {}) {
  const fetched = [];
  const x = loadBackground({
    browser,
    staging,
    granted,
    flags,
    contexts,
    local,
    fetch: async (url, init) => {
      if (init.method === 'DELETE') {
        fetched.push({ url, method: 'DELETE', auth: init.headers.authorization });
        return revoke();
      }
      fetched.push({ url, body: JSON.parse(init.body) });
      return { ok: true, json: async () => ({ token: 'oht_x', name: 'ExamplePilot' }) };
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
const b64 = (buf) => Buffer.from(buf).toString('base64url');

test('our site: hello, begin with a PKCE challenge, finish with the code', async () => {
  const x = load();
  assert.deepEqual(await x.send({ type: 'oh-hello' }, SITE), HELLO_APP);
  const begin = await x.send({ type: 'oh-connect-begin' }, SITE);
  assert.ok(begin.ok);
  assert.equal(begin.redirect_uri, `https://${CHROME_ID}.chromiumapp.org/`);
  const verifier = x.stores.session.siteConnect.verifier;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  assert.equal(begin.challenge, b64(digest));

  const done = await x.send({ type: 'oh-connect-finish', code: 'one-time', sync: true }, SITE);
  assert.deepEqual(done, { ok: true, name: 'ExamplePilot' });
  assert.equal(x.fetched[0].url, `${SITE}/api/link/token`);
  assert.deepEqual(x.fetched[0].body, {
    code: 'one-time',
    code_verifier: verifier,
    redirect_uri: begin.redirect_uri,
  });
  assert.equal(x.stores.local.siteLink.token, 'oht_x');
  assert.equal(x.stores.local.siteUrl, SITE);
  assert.ok(x.stores.local.siteSyncRequested);
  // The basic page opens on its settings, where it syncs (siteSyncRequested).
  assert.deepEqual(x.opened, [`chrome-extension://${CHROME_ID}/src/basic.html#settings`]);
  assert.equal(x.stores.session.siteConnect, undefined, 'the verifier is used once');
  // A developer's build without the connector: the dashboard's Home, as before.
  const dash = load({ flags: { ...STORE_FLAGS, connector: false } });
  await dash.send({ type: 'oh-connect-begin' }, SITE);
  await dash.send({ type: 'oh-connect-finish', code: 'one-time', sync: true }, SITE);
  assert.deepEqual(dash.opened, [`chrome-extension://${CHROME_ID}/src/dashboard.html#home`]);
});

test('an Open Hangar tab already open comes to the front, no second tab (#658)', async () => {
  const BASIC = `chrome-extension://${CHROME_ID}/src/basic.html`;
  const x = load({
    contexts: [{ contextType: 'TAB', tabId: 7, windowId: 3, documentUrl: `${BASIC}#home` }],
  });
  await x.send({ type: 'oh-connect-begin' }, SITE);
  const done = await x.send({ type: 'oh-connect-finish', code: 'one-time', sync: true }, SITE);
  assert.ok(done.ok);
  assert.deepEqual(x.opened, [], 'no new tab: a scan running there keeps going');
  assert.deepEqual(x.focused, [
    { tab: 7, active: true },
    { window: 3, focused: true },
  ]);
  assert.ok(x.stores.local.siteSyncRequested, 'the open tab syncs (after its scan)');
});

test('no sync asked, no sync flagged', async () => {
  const x = load();
  await x.send({ type: 'oh-connect-begin' }, SITE);
  await x.send({ type: 'oh-connect-finish', code: 'c', sync: false }, SITE);
  assert.equal(x.stores.local.siteSyncRequested, undefined);
});

// Connecting again while connected (#741): the old link is revoked at the site it was
// made on, so the account's Connected Extensions list doesn't keep a dead row.
const OLD = 'https://app.openhangar.space';
test('connecting again revokes the old link at its own site', async () => {
  const x = load({ local: { siteLink: { token: 'oht_old' }, siteUrl: OLD } });
  await x.send({ type: 'oh-connect-begin' }, SITE);
  await x.send({ type: 'oh-connect-finish', code: 'c' }, SITE);
  assert.deepEqual(x.fetched[1], {
    url: `${OLD}/api/v1/sync`,
    method: 'DELETE',
    auth: 'Bearer oht_old',
  });
  assert.equal(x.stores.local.siteLink.token, 'oht_x');
  assert.equal(x.stores.local.siteUrl, SITE);
});

test('the same token back is not revoked', async () => {
  const x = load({ local: { siteLink: { token: 'oht_x' }, siteUrl: SITE } });
  await x.send({ type: 'oh-connect-begin' }, SITE);
  await x.send({ type: 'oh-connect-finish', code: 'c' }, SITE);
  assert.equal(x.fetched.length, 1, 'only the token exchange');
  assert.equal(x.stores.local.siteLink.token, 'oht_x');
});

test('a revoke that fails still keeps the new link', async () => {
  const x = load({
    local: { siteLink: { token: 'oht_old' } },
    revoke: async () => {
      throw new Error('offline');
    },
  });
  await x.send({ type: 'oh-connect-begin' }, SITE);
  const done = await x.send({ type: 'oh-connect-finish', code: 'c' }, SITE);
  assert.deepEqual(done, { ok: true, name: 'ExamplePilot' });
  assert.equal(x.fetched[1].url, `${SITE}/api/v1/sync`, 'no siteUrl kept: the site connected on');
  assert.equal(x.stores.local.siteLink.token, 'oht_x');
});

test('other websites get no answer; finishing needs a begin from the same site', async () => {
  const x = load();
  assert.equal(await x.send({ type: 'oh-hello' }, 'https://evil.example'), undefined);
  const lone = await x.send({ type: 'oh-connect-finish', code: 'c' }, SITE);
  assert.equal(lone.ok, false);
  await x.send({ type: 'oh-connect-begin' }, SITE);
  const cross = await x.send(
    { type: 'oh-connect-finish', code: 'c' },
    'https://app.openhangar.space',
  );
  assert.equal(cross.ok, false);
  assert.equal(x.fetched.length, 0);
  assert.equal(x.stores.local.siteLink, undefined);
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
const loadFirefox = ({ granted = true } = {}) => load({ browser: 'firefox', granted });

test('firefox: our site connects through the bridge, with Firefox’s own redirect', async () => {
  const x = loadFirefox();
  assert.deepEqual(await x.fromPage({ type: 'oh-hello' }, `${SITE}/link`), HELLO_APP);
  const begin = await x.fromPage({ type: 'oh-connect-begin' }, `${SITE}/link`);
  assert.ok(begin.ok);
  assert.equal(begin.redirect_uri, 'https://abc123.extensions.allizom.org/');
  const done = await x.fromPage(
    { type: 'oh-connect-finish', code: 'c', sync: true },
    `${SITE}/link`,
  );
  assert.deepEqual(done, { ok: true, name: 'ExamplePilot' });
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
  // The basic page's Firefox card (ui/basic/FirefoxCard.svelte) shows on any of its tabs.
  assert.deepEqual(x.opened, ['moz-extension://uuid/src/basic.html#settings']);
  assert.ok(x.stores.session.siteAskFirefox);
  assert.equal(x.stores.session.siteConnect, undefined);
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
