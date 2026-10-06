/*
 * rsi-cart.js — "Add to RSI Cart" for ship upgrades (CCUs), new and buy-back (#288).
 * ---------------------------------------------------------------------------
 * Talks to RSI's own upgrade tool in the user's signed-in RSI session (cookies,
 * like every other RSI read here), the same calls RSI's upgrade window makes:
 *
 *   1. POST /api/ship-upgrades/setContextToken  { fromShipId, toShipId, toSkuId }
 *      (+ pledgeId for a buy-back upgrade: the session switches to buy-back mode)
 *   2. filterShips(toId = target SKU)  → from.ships = ships that can
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
  const AUTH_URL = `${RSI}/api/account/v2/setAuthToken`;
  const CONTEXT_URL = `${RSI}/api/ship-upgrades/setContextToken`;
  const UPGRADE_URL = `${RSI}/pledge-store/api/upgrade/graphql`;
  const CART_URL = `${RSI}/en/store/pledge/cart`;
  const SIGN_IN_URL = `${RSI}/connect`;
  const PLEDGE_STORE_URL = `${RSI}/en/pledge`;

  // RSI's own queries (initShipUpgrade trimmed to what we use, like lib.js does).
  const SHIPS_QUERY =
    'query initShipUpgrade { ships { id name owned msrp medias { productThumbMediumAndSmall } } app { mode isAnonymous } }';
  const APP_QUERY = 'query initShipUpgrade { app { mode isAnonymous } }';
  // Only RSI's "from" half: which of your ships can upgrade to the target SKU. Its
  // "to" half, asked with no From ship, makes RSI answer "Ship not found".
  const FILTER_QUERY =
    'query filterShips($toId: Int, $fromFilters: [FilterConstraintValues]) {\n  from(to: $toId, filters: $fromFilters) {\n    ships {\n      id\n    }\n  }\n}\n';
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

  // The security token every RSI page carries (<meta name="csrf-token">). RSI's
  // upgrade window sends it as X-CSRF-TOKEN on each GraphQL call; without it RSI
  // answers as if nobody were signed in.
  function parseCsrf(html) {
    const tag = String(html || '').match(/<meta[^>]+name=["']csrf-token["'][^>]*>/i);
    const m = tag && tag[0].match(/content=["']([^"']+)["']/i);
    return m ? m[1] : null;
  }

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
  const filterBody = (toSkuId) =>
    gql('filterShips', FILTER_QUERY, { toId: toInt(toSkuId), fromFilters: [] });
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

    // How RSI's own upgrade window signs in (its rsi-store-common code):
    // setAuthToken and setContextToken carry the Rsi-Token cookie as x-rsi-token,
    // and every GraphQL call carries the page's csrf-token as X-CSRF-TOKEN.
    const cookieToken =
      deps.rsiToken ||
      (async () => {
        try {
          const c = root.chrome && root.chrome.cookies;
          if (!c || !c.get) return null;
          const got = await c.get({ url: RSI, name: 'Rsi-Token' });
          if (!got || !got.value) return null;
          try {
            return decodeURIComponent(got.value);
          } catch {
            return got.value;
          }
        } catch {
          return null;
        }
      });
    let csrf = null; // { value, at }: read from an RSI page, kept 10 minutes
    const CSRF_TTL = 10 * 60e3;

    // One request in the lane: paced, held after a 429. → { res } or { error, retryAt? }.
    function send(url, init) {
      const run = async () => {
        if (now() < holdUntil) return { error: 'busy', retryAt: holdUntil };
        const wait = last + GAP_MS + rand() * GAP_MS * 1.5 - now();
        if (last && wait > 0) await sleep(wait);
        last = now();
        let res;
        try {
          res = await fetchFn(url, {
            credentials: 'include',
            ...init,
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
        return { res };
      };
      const p = lane.then(run, run);
      lane = p.catch(() => {});
      return p;
    }

    async function csrfToken() {
      if (csrf && now() - csrf.at < CSRF_TTL) return csrf.value;
      const r = await send(PLEDGE_STORE_URL, { method: 'GET', headers: { accept: 'text/html' } });
      if (r.error || !r.res.ok) return null;
      let value = null;
      try {
        value = parseCsrf(await r.res.text());
      } catch {
        value = null;
      }
      csrf = value ? { value, at: now() } : null;
      return value;
    }

    // One POST. → { json } or { error, retryAt? }. Never retried here.
    async function post(url, body) {
      const token = url === UPGRADE_URL ? await csrfToken() : await cookieToken();
      const tokenHeader =
        url === UPGRADE_URL
          ? token
            ? { 'X-CSRF-TOKEN': token }
            : {}
          : token
            ? { 'x-rsi-token': token }
            : {};
      const r = await send(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json;charset=UTF-8',
          accept: 'application/json',
          ...tokenHeader,
        },
        body: JSON.stringify(body),
      });
      if (r.error) return r;
      const res = r.res;
      if (res.status === 401) return { error: 'signed-out' };
      if (res.status === 403) return { error: 'refused' };
      if (!res.ok) return { error: 'network' };
      if (url !== UPGRADE_URL) return { json: null }; // only their cookies matter
      try {
        return { json: await res.json() };
      } catch {
        return { error: 'network' };
      }
    }
    // Opens RSI's upgrade window: sign the tool in, then set what's being upgraded
    // (RSI's own window does both, every time it opens).
    const setContext = async (ids) => {
      const a = await post(AUTH_URL, {});
      if (a.error) return a;
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
      if (app && app.anonymous) {
        csrf = null; // read a fresh token next time
        return { ok: false, error: 'signed-out' };
      }
      // RSI doesn't sell an upgrade to every edition (the C8X's BIS Warbond answers
      // "Ship not found"), so try the other editions in turn (opts.skus).
      const skus = [toInt(toSkuId), ...(opts.skus || []).map(toInt)].filter(
        (v, i, a) => v && a.indexOf(v) === i,
      );
      let fromIds = null;
      let lastErr = null;
      for (const sku of skus) {
        const f = await ask(filterBody(sku));
        if (f.error && f.error !== 'refused') return fail(f);
        const ids = f.error ? null : parseFrom(f.json);
        if (ids && ids.length) {
          fromIds = ids;
          toSkuId = sku;
          break;
        }
        lastErr = f;
      }
      if (!fromIds)
        return lastErr && lastErr.error ? fail(lastErr) : { ok: false, error: 'refused' };
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
      return { ok: true, mode: app ? app.mode : null, options, toSkuId };
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
      if (app && app.anonymous) {
        csrf = null; // read a fresh token next time
        return { ok: false, error: 'signed-out' };
      }
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
    AUTH_URL,
    CONTEXT_URL,
    UPGRADE_URL,
    // Pure pieces, for tests.
    contextBody,
    parseCsrf,
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
