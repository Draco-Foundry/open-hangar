'use strict';
// Connect from the website (src/background.js, sync builds only): our site may ask
// for a PKCE challenge and hand back a one-time code; the extension trades it with
// the verifier it kept, saves the link and opens the dashboard. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadBackground, CHROME_ID } = require('./bridge-env.js');

// The background worker as a sync build makes it (test/bridge-env.js), its token
// exchange answered here. staging: a developer's build pointed at staging (npm run
// build:staging), which lets staging's pages in; the store builds don't.
function load({ staging = true, browser = 'chrome', granted = true } = {}) {
  const fetched = [];
  const x = loadBackground({
    browser,
    staging,
    granted,
    flags: { sync: true, orgFleet: false, localMode: false },
    fetch: async (url, init) => {
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
  caps: ['hello', 'addToCart', 'connect'],
  cart: true,
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
  assert.match(x.opened[0], /dashboard\.html#home$/);
  assert.equal(x.stores.session.siteConnect, undefined, 'the verifier is used once');
});

test('no sync asked, no sync flagged', async () => {
  const x = load();
  await x.send({ type: 'oh-connect-begin' }, SITE);
  await x.send({ type: 'oh-connect-finish', code: 'c', sync: false }, SITE);
  assert.equal(x.stores.local.siteSyncRequested, undefined);
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
// it ran in. The first Connect waits for Firefox's own yes, asked from Home.
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

test('firefox: before Firefox says yes, Connect opens Home with its card up', async () => {
  const x = loadFirefox({ granted: false });
  const begin = await x.fromPage({ type: 'oh-connect-begin' }, `${SITE}/link`);
  assert.deepEqual(begin, { ok: false, firefoxAsk: true });
  assert.deepEqual(x.opened, ['moz-extension://uuid/src/dashboard.html#home']);
  assert.ok(x.stores.session.siteAskFirefox);
  assert.equal(x.stores.session.siteConnect, undefined);
});
