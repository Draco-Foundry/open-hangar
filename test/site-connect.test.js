'use strict';
// Connect from the website (src/background.js, sync builds only): our site may ask
// for a PKCE challenge and hand back a one-time code; the extension trades it with
// the verifier it kept, saves the link and opens the dashboard. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(matches = ['https://app.openhangar.space/*', 'https://staging.openhangar.space/*']) {
  const stores = { local: {}, session: {} };
  const area = (name) => ({
    get: async (k) => {
      const keys = [].concat(k);
      return Object.fromEntries(
        keys.filter((x) => x in stores[name]).map((x) => [x, stores[name][x]]),
      );
    },
    set: async (o) => Object.assign(stores[name], o),
    remove: async (k) => [].concat(k).forEach((x) => delete stores[name][x]),
  });
  const listen = () => ({ addListener() {} });
  let external;
  const opened = [];
  const fetched = [];
  const chrome = {
    storage: { local: area('local'), session: area('session'), onChanged: listen() },
    runtime: {
      id: 'aeabioadfphghjennmdbnpelojlhndjl',
      onInstalled: listen(),
      onStartup: listen(),
      onUpdateAvailable: listen(),
      onMessageExternal: { addListener: (f) => (external = f) },
      getManifest: () => ({
        version: '0.0.0',
        externally_connectable: { matches },
      }),
      getURL: (p) => `chrome-extension://id/${p}`,
    },
    action: { onClicked: listen(), setBadgeText() {}, setTitle() {}, setBadgeBackgroundColor() {} },
    tabs: { create: (o) => opened.push(o.url) },
  };
  const fetch = async (url, init) => {
    fetched.push({ url, body: JSON.parse(init.body) });
    return { ok: true, json: async () => ({ token: 'oht_x', name: 'ExamplePilot' }) };
  };
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'background.js'), 'utf8');
  vm.runInNewContext(src, { chrome, fetch, console, crypto, TextEncoder, btoa, Date, setTimeout });
  const send = (msg, origin) =>
    new Promise((res) => {
      // Copied out of the sandbox, so deepEqual compares plain values.
      const async = external(msg, { origin }, (r) => res(r && JSON.parse(JSON.stringify(r))));
      if (!async) res(undefined);
    });
  return { send, stores, opened, fetched };
}

const SITE = 'https://staging.openhangar.space';
const b64 = (buf) => Buffer.from(buf).toString('base64url');

test('our site: hello, begin with a PKCE challenge, finish with the code', async () => {
  const x = load();
  assert.deepEqual(await x.send({ type: 'oh-hello' }, SITE), {
    ok: true,
    cart: true,
    connect: true,
  });
  const begin = await x.send({ type: 'oh-connect-begin' }, SITE);
  assert.ok(begin.ok);
  assert.equal(begin.redirect_uri, 'https://aeabioadfphghjennmdbnpelojlhndjl.chromiumapp.org/');
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
  const x = load(['https://openhangar.space/*', 'https://app.openhangar.space/*']);
  const prod = await x.send({ type: 'oh-hello' }, 'https://app.openhangar.space');
  assert.equal(prod.connect, true);
  assert.equal(await x.send({ type: 'oh-hello' }, SITE), undefined, 'staging gets no answer');
  const front = await x.send({ type: 'oh-hello' }, 'https://openhangar.space');
  assert.equal(front.connect, false, 'Connect stays on the app');
});

// Firefox (#434): no externally_connectable; src/site-bridge.js, a content script on
// our own site only, passes the page's messages on, and the browser says which page
// it ran in. The first Connect waits for Firefox's own yes, asked from Home.
function loadFirefox({ granted = true } = {}) {
  const stores = { local: {}, session: {} };
  const area = (name) => ({
    get: async (k) =>
      Object.fromEntries(
        []
          .concat(k)
          .filter((x) => x in stores[name])
          .map((x) => [x, stores[name][x]]),
      ),
    set: async (o) => Object.assign(stores[name], o),
    remove: async (k) => [].concat(k).forEach((x) => delete stores[name][x]),
  });
  const listen = () => ({ addListener() {} });
  let internal;
  const opened = [];
  const ID = 'open-hangar@draco-foundry';
  const chrome = {
    storage: { local: area('local'), session: area('session'), onChanged: listen() },
    runtime: {
      id: ID,
      onInstalled: listen(),
      onStartup: listen(),
      onUpdateAvailable: listen(),
      onMessage: { addListener: (f) => (internal = f) },
      getManifest: () => ({
        version: '0.0.0',
        browser_specific_settings: { gecko: { id: ID } },
        content_scripts: [
          {
            matches: ['https://app.openhangar.space/*', 'https://staging.openhangar.space/*'],
            js: ['src/site-bridge.js'],
          },
        ],
      }),
      getURL: (p) => `moz-extension://uuid/${p}`,
    },
    identity: { getRedirectURL: () => 'https://abc123.extensions.allizom.org/' },
    permissions: { contains: async () => granted },
    action: { onClicked: listen(), setBadgeText() {}, setTitle() {}, setBadgeBackgroundColor() {} },
    tabs: { create: (o) => opened.push(o.url) },
  };
  const fetch = async () => ({
    ok: true,
    json: async () => ({ token: 'oht_x', name: 'ExamplePilot' }),
  });
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'background.js'), 'utf8');
  vm.runInNewContext(src, {
    chrome,
    fetch,
    console,
    crypto,
    TextEncoder,
    btoa,
    Date,
    setTimeout,
    URL,
  });
  const send = (msg, sender) =>
    new Promise((res) => {
      const async = internal(msg, sender, (r) => res(r && JSON.parse(JSON.stringify(r))));
      if (!async) res(undefined);
    });
  const fromPage = (msg, url) => send({ ohSite: msg }, { id: ID, tab: { id: 1 }, url });
  return { send, fromPage, stores, opened, ID };
}

test('firefox: our site connects through the bridge, with Firefox’s own redirect', async () => {
  const x = loadFirefox();
  assert.deepEqual(await x.fromPage({ type: 'oh-hello' }, `${SITE}/link`), {
    ok: true,
    cart: true,
    connect: true,
  });
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
  // Not from a tab, or not our extension: no answer.
  assert.equal(
    await x.send({ ohSite: { type: 'oh-hello' } }, { id: x.ID, url: `${SITE}/` }),
    undefined,
  );
  assert.equal(
    await x.send({ ohSite: { type: 'oh-hello' } }, { id: 'other', tab: {}, url: `${SITE}/` }),
    undefined,
  );
  // The dashboard's own messages aren't the website's.
  assert.equal(
    await x.send({ type: 'oh-hello' }, { id: x.ID, tab: {}, url: `${SITE}/` }),
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
