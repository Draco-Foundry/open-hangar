// openhangar.space: the static site in ../site, except the home page, which the
// website Worker (open-hangar-server, app.openhangar.space) renders with live
// Star Citizen data, the extension page (/extension), the Store (/store and the
// data it loads, /api/store/*) and the public feeds the extension reads
// (/api/game-status, /api/ships, /api/catalog, /api/referral-events,
// /api/known-issues): the extension only talks to RSI and this site.
// Only the paths below reach this script (run_worker_first in
// wrangler.jsonc); everything else, including the extension's status.json kill
// switch and rates.json, is served straight from the static files as before.
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
      return staticHome(request, env);
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

// The old static landing page (site/index.html), as a fallback.
function staticHome(request, env) {
  return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
}
