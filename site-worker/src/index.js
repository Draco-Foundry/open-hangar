// openhangar.space: the static site in ../site, except the home page, which the
// website Worker (open-hangar-server, app.openhangar.space) renders with live
// Star Citizen data, the extension page (/extension), the Store (/store and the
// data it loads, /api/store/*), the Ship Explorer (/ships, /ships/<ship>), What's
// Next (/whats-next), Help (/help) and the public feeds the extension reads
// (/api/game-status, /api/ships, /api/catalog, /api/referral-events,
// /api/known-issues): the extension only talks to RSI and this site.
// The paths below reach this script first (run_worker_first in wrangler.jsonc),
// and so does any path with no file in ../site. Every file there, including the
// extension's status.json kill switch, rates.json and the Troubleshooting page
// (/help.html), is served straight from the static files as before.
//
// If the website Worker is down or errors, the old static home page is served
// instead, so openhangar.space never goes blank.

const HOME_TTL_S = 60; // the home and extension pages are cached at the edge for a minute
// The extension's feeds. The website answers them itself (its own cache, ETag,
// Origin check and rate limit), so they pass straight through, never cached here:
// the answer depends on the caller's Origin.
const FEEDS = new Set([
  '/api/game-status',
  '/api/ships',
  '/api/catalog',
  '/api/referral-events',
  '/api/known-issues',
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
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
    // cached here: the website sets their cache headers itself.
    const help = url.pathname === '/help';
    const newPage =
      help ||
      url.pathname === '/whats-next' ||
      url.pathname === '/ships' ||
      url.pathname.startsWith('/ships/');

    // These pages are the same for every visitor (always signed out here), so
    // one copy a minute serves everyone. Only a plain GET is cached.
    const cacheable = page && request.method === 'GET' && !url.search;
    const cache = caches.default;
    if (cacheable) {
      const hit = await cache.match(request);
      if (hit) return hit;
    }

    let res;
    try {
      res = await env.APP.fetch(request);
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

    if (cacheable && res.ok && !res.headers.has('set-cookie')) {
      const copy = new Response(res.body, res);
      copy.headers.set('cache-control', `public, max-age=0, s-maxage=${HOME_TTL_S}`);
      ctx.waitUntil(cache.put(request, copy.clone()));
      return copy;
    }
    return res;
  },
};

// A page from the static site, as a fallback: the old landing page
// (site/index.html) or the Troubleshooting page (site/help.html).
function staticPage(path, request, env) {
  return env.ASSETS.fetch(new Request(new URL(path, request.url), request));
}
