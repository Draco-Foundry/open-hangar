/*
 * site-pages.js — which of our web pages may talk to the extension, and what each may
 * ask (bridge v2).
 * ---------------------------------------------------------------------------
 * Two lists of pages, each with its own requests (capabilities):
 *   hangar  our own hangar page, hangar.openhangar.space (Local Mode, the `localMode`
 *           build flag): hello, the hangar this browser scanned (getHangar), how fresh
 *           it is (getScanStatus), a scan (requestScan) and Add to RSI Cart (addToCart)
 *   site    the website, openhangar.space and its app: hello, Add to RSI Cart, and
 *           Connect This Browser (connect) on the pages in `connect` (the app, in
 *           builds with sync)
 * A request from the other list's pages gets the same answer as one that doesn't
 * exist, so a page can't find out what the others may ask.
 *
 * scripts/pack.mjs writes each build's lists into BUILD_PAGES in the built copy, and
 * builds the manifest's lists from the same values (externally_connectable on Chrome
 * and Edge, the site bridge's matches on Firefox); the build and
 * scripts/check-store-build.mjs check they agree. The repo's copy is empty: a copy that
 * wasn't built answers no page.
 *
 * Pure. Loaded by the background worker (importScripts; Firefox's event page lists it
 * in its manifest, scripts/pack.mjs) and node tests. Exposes self.OHPages.
 */
(function (root) {
  // Set per build by scripts/pack.mjs. Keep it empty here.
  const BUILD_PAGES = { hangar: [], site: [], connect: [] };

  // Each capability's message types. The older ones keep their names, so the
  // website's pages from before bridge v2 still work.
  const CAPS = {
    hello: ['oh-hello'],
    getHangar: ['oh-get-hangar'],
    getScanStatus: ['oh-scan-status'],
    requestScan: ['oh-request-scan'],
    addToCart: ['oh-upgrade-options', 'oh-upgrade-price', 'oh-add-upgrade'],
    connect: ['oh-connect-begin', 'oh-connect-finish'],
  };
  const LISTS = {
    hangar: ['hello', 'getHangar', 'getScanStatus', 'requestScan', 'addToCart'],
    site: ['hello', 'addToCart', 'connect'],
  };
  const TYPES = Object.values(CAPS).flat();

  // What each message may carry besides its type: [check, needed]. The website's own
  // pages send exactly these. skus (every edition on offer) is cleaned and capped by
  // its handler, as before; v (the bridge version the page speaks) is allowed and not
  // read.
  const MAX_BYTES = 16 * 1024;
  const posInt = (v) => Number.isInteger(v) && v > 0;
  const code = (v) => typeof v === 'string' && v.length > 0 && v.length <= 512;
  const bool = (v) => typeof v === 'boolean';
  const ID = [posInt, true];
  const SHAPES = {
    'oh-hello': { v: [posInt, false] },
    'oh-get-hangar': {},
    'oh-scan-status': {},
    'oh-request-scan': {},
    'oh-upgrade-options': { toShipId: ID, toSkuId: ID, skus: [Array.isArray, false] },
    'oh-upgrade-price': { fromShipId: ID, toSkuId: ID, toShipId: [posInt, false] },
    'oh-add-upgrade': { fromShipId: ID, toShipId: ID, toSkuId: ID },
    'oh-connect-begin': {},
    'oh-connect-finish': { code: [code, true], sync: [bool, false] },
  };

  const pages = Object.freeze({
    hangar: Object.freeze([...BUILD_PAGES.hangar]),
    site: Object.freeze([...BUILD_PAGES.site]),
    connect: Object.freeze([...BUILD_PAGES.connect]),
  });

  // A page's origin → 'hangar', 'site' or null (none of ours in this build).
  function kind(origin, p = pages) {
    if (typeof origin !== 'string') return null;
    if (p.hangar.includes(origin)) return 'hangar';
    if (p.site.includes(origin)) return 'site';
    return null;
  }

  // What this page may ask in this build: its list, Connect only on the pages in
  // `connect`, and only what this build has a handler for (`has(type)`; a build's
  // flags cut handlers), so its hello never offers what it can't do.
  function capsFor(origin, has = () => true, p = pages) {
    const k = kind(origin, p);
    if (!k) return [];
    return LISTS[k].filter(
      (c) => (c !== 'connect' || p.connect.includes(origin)) && CAPS[c].every(has),
    );
  }

  // Plain data only: an object straight from a message (any realm's Object), never an
  // array, a class instance or something that can't be sent.
  function isPlain(m) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return false;
    const proto = Object.getPrototypeOf(m);
    return proto === null || Object.getPrototypeOf(proto) === null;
  }
  function bytes(m) {
    try {
      return new TextEncoder().encode(JSON.stringify(m)).length;
    } catch {
      return Infinity;
    }
  }

  // A message from one of our pages → { type } when its handler may run, else
  // { error } with the answer it gets instead:
  //   'bad request'      not a plain object, over 16 KB, no type, or a type this page
  //                      may ask with a key it doesn't take or a value of the wrong kind
  //   'unknown request'  a type this page may not ask, here or anywhere
  // The first checks come before the page's list and don't depend on it, so the
  // answers tell a page nothing about another page's requests. A key left undefined
  // counts as absent (Firefox's window messages keep those).
  function vet(msg, origin, has = () => true, p = pages) {
    if (!isPlain(msg) || bytes(msg) > MAX_BYTES || typeof msg.type !== 'string')
      return { error: 'bad request' };
    const type = msg.type;
    if (!capsFor(origin, has, p).some((c) => CAPS[c].includes(type)))
      return { error: 'unknown request' };
    const shape = SHAPES[type];
    for (const [k, v] of Object.entries(msg)) {
      if (k === 'type' || v === undefined) continue;
      if (!Object.hasOwn(shape, k) || !shape[k][0](v)) return { error: 'bad request' };
    }
    for (const [k, [, needed]] of Object.entries(shape))
      if (needed && msg[k] === undefined) return { error: 'bad request' };
    return { type };
  }

  const api = {
    CAPS,
    LISTS,
    TYPES,
    MAX_BYTES,
    pages,
    kind,
    known: (origin) => kind(origin) !== null,
    capsFor,
    vet,
  };
  root.OHPages = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
