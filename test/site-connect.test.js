'use strict';
// Connect from the website (src/background.js, sync builds only): our site may ask
// for a PKCE challenge and hand back a one-time code; the extension trades it with
// the verifier it kept, saves the link and opens the dashboard. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load() {
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
      getManifest: () => ({ version: '0.0.0' }),
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
  assert.deepEqual(await x.send({ type: 'oh-hello' }, SITE), { ok: true });
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
