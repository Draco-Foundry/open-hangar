// openhangar.space: the static site in ../site, except the home page, which the
// website Worker (open-hangar-server, app.openhangar.space) renders with live
// Star Citizen data, the extension page (/extension), the Store (/store and the
// data it loads, /api/store/*), the Ship Explorer (/ships, /ships/<ship>), What's
// Next (/whats-next), Help (/help) and the public feeds the extension reads
// (/api/game-status, /api/ships, /api/catalog, /api/referral-events,
// /api/known-issues): the extension only talks to RSI and this site.
// The paths below reach this script first (run_worker_first in wrangler.jsonc),
// and so does any path with no file in ../site; any of those that isn't a route
// named here gets a 404 page (site/404.html), never the website's own pages, so
// they aren't duplicated here for search engines. Every file there, including the
// extension's status.json kill switch and the Troubleshooting page (/help.html),
// is served straight from the static files as before.
//
// The extension's exchange rates (/rates.json) are built here from the ECB, with
// two stand-in sources, and kept at the edge for about 6 hours, so they stay
// fresh without a Pages run. A reading that fails the checks, or is older than the
// static copy in ../site (built by each Pages run), gives way to that copy.
//
// If the website Worker is down or errors, openhangar.space never goes blank:
// the home page and /extension get the old static home page (site/index.html),
// /help the Troubleshooting page (site/help.html), the Ship Explorer and What's
// Next a 503 that says try again, and the feeds a JSON 503.
//
// The website's pages and feeds go through its edge gateway (EDGE, the
// open-hangar-edge Worker): a signed-out page comes from Cloudflare's edge near the
// visitor, kept per host and per Day or Night look, and a feed the same way, the
// gateway checking the caller's Origin and rate there; anything it doesn't keep
// goes on to the website as before. Without the EDGE binding, straight to the
// website.

import { USER_AGENT, pickRates } from './rates.mjs';

// The website's pages (not its feeds or files) that may come through the gateway.
const PAGES = new Set([
  '/',
  '/extension',
  '/store',
  '/ships',
  '/whats-next',
  '/help',
  '/updates',
  '/about',
  '/news',
]);
// The extension's feeds, and its alerts' sale feed (under /api/store/*). The
// website's gateway answers them (its edge copy, ETag, Origin check and rate
// limit), so they pass straight through, never cached here: the answer depends on
// the caller's Origin.
const FEEDS = new Set([
  '/api/game-status',
  '/api/ships',
  '/api/catalog',
  '/api/referral-events',
  '/api/known-issues',
  '/api/store/on-sale',
]);

// Everything else the website serves on openhangar.space, by prefix: the Store's
// data, the Ship Explorer's ships, and the files the home page loads.
const PREFIXES = ['/api/store/', '/ships/', '/_astro/', '/fonts/', '/home/'];
const FILES = new Set(['/favicon.svg']);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/rates.json') return rates(request, env, ctx);
    const home = url.pathname === '/';
    // The extension's own page (owner, 2026-10-04), rendered by the website
    // (open-hangar-server pages/extension.astro). The news home's "Get the
    // Extension" links come here. The static site/index.html is its fallback.
    const extension = url.pathname === '/extension';
    const page = home || extension;
    const feed = FEEDS.has(url.pathname);
    // The website's newer pages (owner, 2026-10-08): the Ship Explorer, each
    // ship's page, What's Next and Help. Each is dark behind its own flag there,
    // and its 404 passes straight through until the owner switches it on. Never
    // cached here (the website's edge gateway keeps signed-out pages). The website
    // answers /help/ like /help, so a trailing slash gets the same fallback.
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
    const help = path === '/help';
    const newPage =
      help || path === '/whats-next' || path === '/ships' || path.startsWith('/ships/');

    // Any other address: this site's 404 page, not the website's pages.
    if (
      !(PAGES.has(path) || FEEDS.has(path) || FILES.has(path)) &&
      !PREFIXES.some((prefix) => path.startsWith(prefix))
    ) {
      return notFound(request, env);
    }

    // Pages and feeds through the gateway, the request as it came: the gateway
    // decides from it whether a kept copy may answer.
    const viaEdge = env.EDGE && (PAGES.has(path) || path.startsWith('/ships/') || feed);

    let res;
    try {
      res = await (viaEdge ? env.EDGE : env.APP).fetch(request);
    } catch {
      res = null;
    }
    // Also the static page if the website doesn't have /extension (yet).
    if (page && (!res || res.status >= 500 || (extension && res.status === 404))) {
      return staticPage('/index.html', request, env);
    }
    // If the website can't answer, never the old home page at these addresses.
    // Help still helps: the static Troubleshooting page (its canonical stays
    // /help.html). The others say try again, as a 503 so a passing outage never
    // reads as a missing page.
    if (newPage && (!res || res.status >= 500)) {
      if (help) return staticPage('/help.html', request, env);
      return new Response('Lost the signal. Try again in a moment.', {
        status: 503,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-store',
          'retry-after': '60',
        },
      });
    }
    // A feed answers in JSON even when the website can't, so the extension keeps
    // its saved copy and tries again later. The caller's Origin is echoed so the
    // extension can read the 503 (our feeds never answer other sites anyway).
    if (feed && (!res || res.status >= 500)) {
      const origin = request.headers.get('origin');
      return new Response(JSON.stringify({ error: 'feed unavailable' }), {
        status: 503,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'retry-after': '600',
          vary: 'Origin',
          ...(origin ? { 'access-control-allow-origin': origin } : {}),
        },
      });
    }
    if (!res) return new Response('Lost the signal. Try again in a moment.', { status: 502 });
    return res;
  },
};

// A page from the static site, as a fallback: the old landing page
// (site/index.html) or the Troubleshooting page (site/help.html).
function staticPage(path, request, env) {
  return env.ASSETS.fetch(new Request(new URL(path, request.url), request));
}

// The 404 page (site/404.html) with a 404 status, kept out of search results.
async function notFound(request, env) {
  let body = 'Page not found.';
  try {
    const page = await staticPage('/404.html', request, env);
    if (page.ok) body = await page.text();
  } catch {
    // The plain line above is enough.
  }
  return new Response(body, {
    status: 404,
    headers: {
      'content-type': body.startsWith('<')
        ? 'text/html; charset=utf-8'
        : 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  });
}

// How long the edge keeps a fresh reading, and the static copy when no source
// passed (so a source outage costs one try an hour, not one per visitor).
const RATES_KEEP = 6 * 3600;
const RATES_RETRY = 3600;
// What the extension and browsers are told, as the static file always said
// (site/_headers): the extension reads it from its own pages, so it needs CORS.
const RATES_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=3600',
  'access-control-allow-origin': '*',
  'x-content-type-options': 'nosniff',
};

// /rates.json: the edge's kept copy, else a new reading that passes check()
// against the static copy, else the static copy itself. Same shape and address
// as the static file, so the extension and the website read it unchanged.
async function rates(request, env, ctx) {
  const cache = globalThis.caches?.default;
  const key = new Request(new URL('/rates.json', request.url));
  const kept = cache ? await cache.match(key).catch(() => undefined) : undefined;
  if (kept) return withHeaders(kept.body, kept.headers.get('x-rates'));

  let fallback = null;
  let previous = null;
  try {
    const res = await staticPage('/rates.json', request, env);
    if (res.ok) fallback = await res.text();
    previous = fallback ? JSON.parse(fallback) : null;
  } catch {
    previous = null;
  }
  let file = await pickRates(previous, getRates).catch(() => null);
  if (file && previous?.date && file.date < previous.date) file = null;

  const body = file ? JSON.stringify(file) + '\n' : fallback;
  if (body == null) {
    return new Response(JSON.stringify({ error: 'rates unavailable' }), {
      status: 503,
      headers: { ...RATES_HEADERS, 'cache-control': 'no-store', 'retry-after': '600' },
    });
  }
  const from = file ? 'built' : 'static';
  if (cache) {
    const keep = new Response(body, {
      headers: {
        ...RATES_HEADERS,
        'cache-control': `public, max-age=${file ? RATES_KEEP : RATES_RETRY}`,
        'x-rates': from,
      },
    });
    const put = cache.put(key, keep).catch(() => {});
    if (ctx?.waitUntil) ctx.waitUntil(put);
    else await put;
  }
  return withHeaders(body, from);
}

function withHeaders(body, from) {
  return new Response(body, { headers: { ...RATES_HEADERS, 'x-rates': from || 'static' } });
}

// One rates source's body, 'text' or 'json'; throws on a failed answer.
async function getRates(url, as) {
  const res = await fetch(url, {
    headers: { 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return as === 'json' ? res.json() : res.text();
}
