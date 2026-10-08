'use strict';

/*
 * openhangar.space's front Worker (site-worker/src/index.js): which paths it
 * hands to the website Worker, what each one gets when the website can't
 * answer, and that every file in site/ stays a plain static file.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORKER_DIR = path.join(__dirname, '..', 'site-worker');
const SITE_DIR = path.join(__dirname, '..', 'site');

// The worker is an ES module in a package with no "type" field; loading its
// source as a data: URL runs it as one without Node's module-type warning.
const source = fs.readFileSync(path.join(WORKER_DIR, 'src', 'index.js'), 'utf8');
const load = import('data:text/javascript;base64,' + Buffer.from(source).toString('base64')).then(
  (m) => m.default,
);

// One request through the worker. `app` is what the website Worker does: a
// status code it answers with, or 'down' when the call itself fails.
async function visit(pathname, app) {
  const worker = await load;
  const calls = { app: [], assets: [], cache: [] };
  globalThis.caches = {
    default: {
      match: async (req) => {
        calls.cache.push(`match ${new URL(req.url).pathname}`);
        return undefined;
      },
      put: async (req) => {
        calls.cache.push(`put ${new URL(req.url).pathname}`);
      },
    },
  };
  const env = {
    APP: {
      fetch: async (req) => {
        calls.app.push(new URL(req.url).pathname);
        if (app === 'down') throw new Error('website unreachable');
        const headers =
          app >= 300 && app < 400 ? { location: 'https://openhangar.space/ships/aurora' } : {};
        return new Response(`website ${app}`, { status: app, headers });
      },
    },
    ASSETS: {
      fetch: async (req) => {
        const file = new URL(req.url).pathname;
        calls.assets.push(file);
        return new Response(`static ${file}`, { status: 200 });
      },
    },
  };
  const ctx = { waitUntil: () => {} };
  const res = await worker.fetch(new Request(`https://openhangar.space${pathname}`), env, ctx);
  return { res, body: await res.text(), calls };
}

const NEW_PAGES = ['/ships', '/ships/aurora-mk-ii', '/whats-next', '/help'];

test("the website's newer pages pass its answer straight through, never cached here", async () => {
  for (const page of NEW_PAGES) {
    // 200 once a flag is on, 404 while it's off, 301 for a renamed ship.
    for (const status of [200, 404, 301]) {
      const { res, body, calls } = await visit(page, status);
      assert.equal(res.status, status, `${page} ${status}`);
      assert.equal(body, `website ${status}`, `${page} ${status}`);
      assert.deepEqual(calls.app, [page]);
      assert.deepEqual(calls.assets, [], `${page} ${status} never reads a static file`);
      assert.deepEqual(calls.cache, [], `${page} ${status} never touches the edge cache`);
    }
  }
});

test('Help falls back to the static Troubleshooting page when the website fails', async () => {
  for (const page of ['/help', '/help/']) {
    for (const app of ['down', 500, 503]) {
      const { res, body, calls } = await visit(page, app);
      assert.equal(res.status, 200, `${page} ${app}`);
      assert.equal(body, 'static /help.html', `${page} ${app}`);
      assert.deepEqual(calls.assets, ['/help.html']);
    }
  }
});

test("the Ship Explorer and What's Next say try again when the website fails", async () => {
  const pages = [
    '/ships',
    '/ships/',
    '/ships/aurora-mk-ii',
    '/ships?q=aurora',
    '/whats-next',
    '/whats-next/',
  ];
  for (const page of pages) {
    for (const app of ['down', 502]) {
      const { res, body, calls } = await visit(page, app);
      assert.equal(res.status, 503, `${page} ${app}`);
      assert.equal(res.headers.get('retry-after'), '60', `${page} ${app}`);
      assert.equal(res.headers.get('cache-control'), 'no-store', `${page} ${app}`);
      assert.match(body, /Try again/);
      assert.deepEqual(calls.assets, [], `${page} ${app} never shows the old home page`);
    }
  }
});

test('the home page and /extension keep the old static home page as their fallback', async () => {
  for (const [page, app] of [
    ['/', 'down'],
    ['/', 500],
    ['/extension', 'down'],
    ['/extension', 404],
  ]) {
    const { res, body } = await visit(page, app);
    assert.equal(res.status, 200, `${page} ${app}`);
    assert.equal(body, 'static /index.html', `${page} ${app}`);
  }
  const { body, calls } = await visit('/', 200);
  assert.equal(body, 'website 200');
  assert.deepEqual(calls.cache, ['match /', 'put /']);
});

test('look-alike paths get no new-page fallback', async () => {
  for (const page of ['/helpdesk', '/shipsx', '/whats-next-time']) {
    const { res, calls } = await visit(page, 'down');
    assert.equal(res.status, 502, page);
    assert.deepEqual(calls.assets, [], page);
  }
});

// run_worker_first in wrangler.jsonc, comments dropped.
function runWorkerFirst() {
  const text = fs.readFileSync(path.join(WORKER_DIR, 'wrangler.jsonc'), 'utf8');
  const start = text.indexOf('"run_worker_first"');
  const list = text.slice(text.indexOf('[', start), text.indexOf(']', start));
  return list
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .flatMap((line) => [...line.matchAll(/"([^"]+)"/g)].map((m) => m[1]));
}

// A run_worker_first pattern as a RegExp: `*` matches anything, the rest is literal.
function patternToRegExp(pattern) {
  const literal = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${pattern.split('*').map(literal).join('.*')}$`);
}

test('run_worker_first names the new pages and never shadows a static file', () => {
  const patterns = runWorkerFirst();
  for (const page of ['/ships', '/ships/*', '/whats-next', '/help']) {
    assert.ok(patterns.includes(page), `${page} is in run_worker_first`);
  }
  const files = fs
    .readdirSync(SITE_DIR, { withFileTypes: true })
    .filter((f) => f.isFile() && !f.name.startsWith('_'))
    .map((f) => `/${f.name}`);
  assert.ok(files.includes('/help.html'));
  for (const pattern of patterns) {
    const re = patternToRegExp(pattern);
    for (const file of files) {
      assert.ok(!re.test(file), `${pattern} would send ${file} to the script`);
    }
  }
});

test('the sitemap lists only pages openhangar.space serves, the Store among them', () => {
  const xml = fs.readFileSync(path.join(SITE_DIR, 'sitemap.xml'), 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  for (const page of ['/', '/extension', '/store']) {
    assert.ok(locs.includes(`https://openhangar.space${page}`), `${page} is in the sitemap`);
  }
  // Each one is a file in site/ or a page this Worker hands to the website.
  const patterns = runWorkerFirst();
  for (const loc of locs) {
    const url = new URL(loc);
    assert.equal(url.origin, 'https://openhangar.space', loc);
    const file = fs.statSync(path.join(SITE_DIR, url.pathname), { throwIfNoEntry: false });
    const served = patterns.includes(url.pathname) || Boolean(file?.isFile());
    assert.ok(served, `${loc} is served here`);
  }
});
