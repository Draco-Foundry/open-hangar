// openhangar.space: the static site in ../site, except the home page, which the
// website Worker (open-hangar-server, app.openhangar.space) renders with live
// Star Citizen data, the extension page (/extension), the Store (/store and the
// data it loads, /api/store/*) and the public game status feed the extension's
// Game Status pill reads (/api/game-status).
// Only the paths below reach this script (run_worker_first in
// wrangler.jsonc); everything else, including the extension's status.json kill
// switch and rates.json, is served straight from the static files as before.
//
// If the website Worker is down or errors, the old static home page is served
// instead, so openhangar.space never goes blank.

const HOME_TTL_S = 60; // the home and extension pages are cached at the edge for a minute
const FEED = '/api/game-status'; // public JSON, same for everyone; the website sets its 10 min cache

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const home = url.pathname === '/';
    // The extension's own page (owner, 2026-10-04), rendered by the website
    // (open-hangar-server pages/extension.astro). The news home's "Get the
    // Extension" links come here. The static site/index.html is its fallback.
    const extension = url.pathname === '/extension';
    const page = home || extension;
    const feed = url.pathname === FEED;

    // These pages are the same for every visitor (always signed out here), so
    // one copy a minute serves everyone. Only a plain GET is cached.
    const cacheable = (page || feed) && request.method === 'GET' && !url.search;
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
    // The feed answers in JSON even when the website can't, so the pill just waits.
    if (feed && (!res || res.status >= 500)) {
      return new Response(JSON.stringify({ error: 'game status unavailable' }), {
        status: 503,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'access-control-allow-origin': '*',
          'retry-after': '600',
        },
      });
    }
    if (!res) return new Response('Lost the signal. Try again in a moment.', { status: 502 });

    if (cacheable && res.ok && !res.headers.has('set-cookie')) {
      const copy = new Response(res.body, res);
      // The feed keeps the website's own cache time (public, 10 min).
      if (page) copy.headers.set('cache-control', `public, max-age=0, s-maxage=${HOME_TTL_S}`);
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
