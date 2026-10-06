/*
 * rsi-cart.js — "Add to RSI Cart" for ship upgrades (CCUs), new and buy-back (#288).
 * ---------------------------------------------------------------------------
 * Talks to RSI's own upgrade tool in the user's signed-in RSI session (cookies,
 * like every other RSI read here), the same calls RSI's upgrade window makes:
 *
 *   1. POST /api/ship-upgrades/setContextToken  { fromShipId, toShipId, toSkuId }
 *      (+ pledgeId for a buy-back upgrade: the session switches to buy-back mode)
 *   2. filterShips(fromId, toId = target SKU)  → from.ships = ships that can
 *      upgrade to it; we keep the ones you own (initShipUpgrade's `owned`)
 *   3. getPrice(from = ship id, to = SKU id)   → price { amount } in cents
 *   4. mutation addToCart(from, to)            → { jwt }: that alone puts the
 *      upgrade in the RSI cart at the difference price. Nothing is bought here.
 *
 * Loaded by the dashboard (before lib.js, which exposes it as OH.upgradeOptions,
 * OH.upgradePrice and OH.addUpgradeToCart) and by the background worker, which
 * answers the website's store panel (src/background.js).
 *
 * Polite: only ever on a click, one request at a time with a short random pause
 * between them, and after RSI's "slow down" (429) nothing more until its
 * Retry-After has passed. addToCart is NEVER retried automatically: a retry
 * could put the upgrade in the cart twice.
 */
(function (root) {
  const RSI = 'https://robertsspaceindustries.com';
  const CONTEXT_URL = `${RSI}/api/ship-upgrades/setContextToken`;
  const UPGRADE_URL = `${RSI}/pledge-store/api/upgrade/graphql`;
  const CART_URL = `${RSI}/en/store/pledge/cart`;
  const SIGN_IN_URL = `${RSI}/connect`;
  const PLEDGE_STORE_URL = `${RSI}/en/pledge`;

  // RSI's own queries (initShipUpgrade trimmed to what we use, like lib.js does).
  const SHIPS_QUERY =
    'query initShipUpgrade { ships { id name owned msrp medias { productThumbMediumAndSmall } } app { mode isAnonymous } }';
  const APP_QUERY = 'query initShipUpgrade { app { mode isAnonymous } }';
  const FILTER_QUERY =
    'query filterShips($fromId: Int, $toId: Int, $fromFilters: [FilterConstraintValues], $toFilters: [FilterConstraintValues]) {\n  from(to: $toId, filters: $fromFilters) {\n    ships {\n      id\n    }\n  }\n  to(from: $fromId, filters: $toFilters) {\n    ships {\n      id\n      skus {\n        id\n        price\n        upgradePrice\n        available\n      }\n    }\n  }\n}\n';
  const PRICE_QUERY =
    'query getPrice($from: Int!, $to: Int!) {\n  price(from: $from, to: $to) {\n    amount\n    nativeAmount\n  }\n}\n';
  const ADD_QUERY =
    'mutation addToCart($from: Int!, $to: Int!) {\n  addToCart(from: $from, to: $to) {\n    jwt\n  }\n}\n';

  const GAP_MS = 300; // pause between two requests: 300 to 750 ms, never a fixed beat
  const SLOW_DOWN_MS = 60e3; // after a 429 without Retry-After
  const PRICE_LIMIT = 4; // options come with RSI's price for this many ships at most

  const toInt = (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
  };
  const absUrl = (u) => (typeof u === 'string' && u.startsWith('/') ? RSI + u : u || null);
  const unwrap = (json) => (Array.isArray(json) ? json[0] : json) || {};

  // --- Request bodies (pure) ------------------------------------------------------
  // setContextToken: only the ids we know. A buy-back adds its pledge id.
  function contextBody({ fromShipId, toShipId, toSkuId, pledgeId } = {}) {
    const out = {};
    if (toInt(fromShipId)) out.fromShipId = toInt(fromShipId);
    if (toInt(toShipId)) out.toShipId = toInt(toShipId);
    if (toInt(toSkuId)) out.toSkuId = toInt(toSkuId);
    if (toInt(pledgeId)) out.pledgeId = toInt(pledgeId);
    return out;
  }
  const gql = (operationName, query, variables = {}) => ({ operationName, variables, query });
  const shipsBody = () => gql('initShipUpgrade', SHIPS_QUERY);
  const appBody = () => gql('initShipUpgrade', APP_QUERY);
  const filterBody = (toSkuId, fromShipId = null) =>
    gql('filterShips', FILTER_QUERY, {
      fromId: toInt(fromShipId),
      toId: toInt(toSkuId),
      fromFilters: [],
      toFilters: [],
    });
  const priceBody = (fromShipId, toSkuId) =>
    gql('getPrice', PRICE_QUERY, { from: toInt(fromShipId), to: toInt(toSkuId) });
  const addBody = (fromShipId, toSkuId) =>
    gql('addToCart', ADD_QUERY, { from: toInt(fromShipId), to: toInt(toSkuId) });

  // --- Response parsing (pure) ----------------------------------------------------
  // GraphQL errors → our error kinds. Anything about who you are = signed out.
  function gqlError(json) {
    const errs = unwrap(json).errors;
    if (!Array.isArray(errs) || !errs.length) return null;
    const text = errs.map((e) => (e && e.message) || '').join(' ');
    return /auth|log(ged)? ?in|sign(ed)? ?in|anonymous|unauthori[sz]ed|session/i.test(text)
      ? 'signed-out'
      : 'refused';
  }
  function parseApp(json) {
    const app = unwrap(json).data && unwrap(json).data.app;
    if (!app) return null;
    return { mode: app.mode || null, anonymous: !!app.isAnonymous };
  }
  function parseShips(json) {
    const ships = (unwrap(json).data || {}).ships;
    if (!Array.isArray(ships)) return [];
    return ships
      .filter((s) => s && toInt(s.id) && typeof s.name === 'string' && s.name.trim())
      .map((s) => ({
        id: toInt(s.id),
        name: s.name.trim(),
        owned: Number(s.owned) > 0 || s.owned === true,
        msrp: Number(s.msrp) || 0,
        image: absUrl(
          s.medias && (s.medias.productThumbMediumAndSmall || s.medias.slideShow || null),
        ),
      }));
  }
  // filterShips → the ship ids that can upgrade to the target.
  function parseFrom(json) {
    const from = (unwrap(json).data || {}).from;
    const ships = from && Array.isArray(from.ships) ? from.ships : null;
    if (!ships) return null;
    return ships.map((s) => toInt(s && s.id)).filter(Boolean);
  }
  // getPrice → dollars (RSI sends cents), or null.
  function parsePrice(json) {
    const p = (unwrap(json).data || {}).price;
    if (!p || !Number.isFinite(Number(p.amount))) return null;
    return {
      price: Number(p.amount) / 100,
      native: Number.isFinite(Number(p.nativeAmount)) ? Number(p.nativeAmount) / 100 : null,
    };
  }
  const parseAdded = (json) => {
    const r = (unwrap(json).data || {}).addToCart;
    return !!(r && r.jwt);
  };

  // Your ships that RSI lets you upgrade from, best first (the dearest ship you own
  // makes the cheapest upgrade), then the ones you own that it doesn't allow.
  // When RSI marks nothing as owned, its `from` list is taken as "My ships".
  function buildOptions(ships, fromIds, toShipId) {
    const allowed = new Set(fromIds || []);
    const anyOwned = ships.some((s) => s.owned);
    const mine = ships.filter((s) =>
      anyOwned ? s.owned && s.id !== toInt(toShipId) : allowed.has(s.id),
    );
    const byValue = (a, b) => b.msrp - a.msrp || a.name.localeCompare(b.name);
    const ok = mine.filter((s) => allowed.has(s.id)).sort(byValue);
    const no = mine.filter((s) => !allowed.has(s.id)).sort((a, b) => a.name.localeCompare(b.name));
    const row = (s, eligible) => ({
      id: s.id,
      name: s.name,
      image: s.image,
      eligible,
      price: null,
    });
    return [...ok.map((s) => row(s, true)), ...no.map((s) => row(s, false))];
  }

  // --- The requests ------------------------------------------------------------------
  function make(deps = {}) {
    const fetchFn = (...a) => (deps.fetch || root.fetch)(...a);
    const sleep = deps.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
    const rand = deps.random || Math.random;
    const now = deps.now || (() => Date.now());
    let lane = Promise.resolve(); // one request at a time
    let last = 0;
    let holdUntil = 0; // RSI said slow down: nothing before this

    // RSI's pages send their session token back as a header; we do the same when the
    // browser lets us read it (the "cookies" permission), harmless otherwise.
    async function rsiToken() {
      try {
        const c = root.chrome && root.chrome.cookies;
        if (!c || !c.get) return null;
        const got = await c.get({ url: RSI, name: 'Rsi-Token' });
        return (got && got.value) || null;
      } catch {
        return null;
      }
    }

    // One POST. → { json } or { error, retryAt? }. Never retried here.
    function post(url, body) {
      const run = async () => {
        if (now() < holdUntil) return { error: 'busy', retryAt: holdUntil };
        const wait = last + GAP_MS + rand() * GAP_MS * 1.5 - now();
        if (last && wait > 0) await sleep(wait);
        last = now();
        const token = await rsiToken();
        let res;
        try {
          res = await fetchFn(url, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'content-type': 'application/json',
              accept: 'application/json',
              ...(token ? { 'x-rsi-token': token } : {}),
            },
            body: JSON.stringify(body),
            signal:
              root.AbortSignal && AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined,
          });
        } catch {
          return { error: 'network' };
        }
        if (res.status === 429) {
          const after = Number(res.headers && res.headers.get && res.headers.get('retry-after'));
          holdUntil = now() + (after > 0 ? Math.min(after * 1000, 15 * 60e3) : SLOW_DOWN_MS);
          return { error: 'busy', retryAt: holdUntil };
        }
        if (res.status === 401) return { error: 'signed-out' };
        if (res.status === 403) return { error: 'refused' };
        if (!res.ok) return { error: 'network' };
        if (url === CONTEXT_URL) return { json: null }; // only its cookie matters
        try {
          return { json: await res.json() };
        } catch {
          return { error: 'network' };
        }
      };
      const p = lane.then(run, run);
      lane = p.catch(() => {});
      return p;
    }
    const setContext = async (ids) => {
      const r = await post(CONTEXT_URL, contextBody(ids));
      return r.error ? r : { ok: true };
    };
    // A GraphQL call: → { json } or { error }.
    const ask = async (body) => {
      const r = await post(UPGRADE_URL, body);
      if (r.error) return r;
      const e = gqlError(r.json);
      return e ? { error: e } : r;
    };
    const fail = (r) => ({
      ok: false,
      error: r.error,
      ...(r.retryAt ? { retryAt: r.retryAt } : {}),
    });

    // RSI's price from one ship to the target SKU. → { ok, price, native } | { ok: false, error }
    async function price(fromShipId, toSkuId) {
      const r = await ask(priceBody(fromShipId, toSkuId));
      if (r.error) return fail(r);
      const p = parsePrice(r.json);
      return p ? { ok: true, ...p } : { ok: false, error: 'refused' };
    }

    // Your ships that can upgrade to toShipId / toSkuId, the first few priced by RSI.
    // opts.pledgeId: a buy-back upgrade (prices are its buy-back prices).
    async function upgradeOptions(toShipId, toSkuId, opts = {}) {
      if (!toInt(toShipId) || !toInt(toSkuId)) return { ok: false, error: 'refused' };
      const pledge = toInt(opts.pledgeId);
      const ctx = await setContext(
        pledge ? { fromShipId: opts.fromShipId, toShipId, toSkuId, pledgeId: pledge } : {},
      );
      if (ctx.error) return fail(ctx);
      const s = await ask(shipsBody());
      if (s.error) return fail(s);
      const app = parseApp(s.json);
      if (app && app.anonymous) return { ok: false, error: 'signed-out' };
      const f = await ask(filterBody(toSkuId, pledge ? opts.fromShipId : null));
      if (f.error) return fail(f);
      const fromIds = parseFrom(f.json);
      if (!fromIds) return { ok: false, error: 'refused' };
      const options = buildOptions(parseShips(s.json), fromIds, toShipId);
      const limit = Number.isInteger(opts.priceLimit) ? opts.priceLimit : PRICE_LIMIT;
      for (const o of options.filter((x) => x.eligible).slice(0, limit)) {
        const p = await price(o.id, toSkuId);
        if (!p.ok) {
          if (p.error === 'busy' || p.error === 'network' || p.error === 'signed-out') break;
          continue;
        }
        o.price = p.price;
      }
      return { ok: true, mode: app ? app.mode : null, options };
    }

    // The price of one upgrade, in the right mode (a buy-back sends its pledge id;
    // opts.setContext opens a fresh new-upgrade context first, as RSI's window does
    // when you pick a From ship).
    async function upgradePrice(fromShipId, toSkuId, opts = {}) {
      if (!toInt(fromShipId) || !toInt(toSkuId)) return { ok: false, error: 'refused' };
      const pledge = toInt(opts.pledgeId);
      if (pledge || opts.setContext) {
        const ctx = await setContext({
          fromShipId,
          toShipId: opts.toShipId,
          toSkuId,
          pledgeId: pledge,
        });
        if (ctx.error) return fail(ctx);
      }
      return price(fromShipId, toSkuId);
    }

    // Puts one upgrade in the RSI cart. → { ok: true } | { ok: false, error }.
    // Asked once: never retried, whatever happens (a retry could add it twice).
    async function addUpgradeToCart(fromShipId, toShipId, toSkuId, opts = {}) {
      if (!toInt(fromShipId) || !toInt(toShipId) || !toInt(toSkuId))
        return { ok: false, error: 'refused' };
      const pledge = toInt(opts.pledgeId);
      const ctx = await setContext({ fromShipId, toShipId, toSkuId, pledgeId: pledge });
      if (ctx.error) return fail(ctx);
      // Before adding: still signed in, and a buy-back really is in buy-back mode
      // (else RSI would add a new upgrade at today's price instead).
      const a = await ask(appBody());
      if (a.error) return fail(a);
      const app = parseApp(a.json);
      if (app && app.anonymous) return { ok: false, error: 'signed-out' };
      if (pledge && (!app || app.mode !== 'buyback')) return { ok: false, error: 'refused' };
      if (!pledge && app && app.mode === 'buyback') return { ok: false, error: 'refused' };
      const r = await ask(addBody(fromShipId, toSkuId));
      if (r.error) return fail(r);
      return parseAdded(r.json) ? { ok: true } : { ok: false, error: 'refused' };
    }

    return { upgradeOptions, upgradePrice, addUpgradeToCart };
  }

  const api = make();
  root.OHCart = {
    ...api,
    make,
    CART_URL,
    SIGN_IN_URL,
    PLEDGE_STORE_URL,
    CONTEXT_URL,
    UPGRADE_URL,
    // Pure pieces, for tests.
    contextBody,
    filterBody,
    priceBody,
    addBody,
    shipsBody,
    appBody,
    gqlError,
    parseApp,
    parseShips,
    parseFrom,
    parsePrice,
    parseAdded,
    buildOptions,
  };
})(typeof self !== 'undefined' ? self : globalThis);
