/*
 * alerts.js — Extension Alerts (the `alerts` build flag, docs/FLAGS.md "Alerts").
 * ---------------------------------------------------------------------------
 * A badge and notifications for what a pilot cares about in RSI's store, without
 * anyone learning their wishlist or hangar, us included. A check downloads one public
 * file, openhangar.space's sale feed (/api/store/on-sale: the same file for everyone,
 * nothing about you in the request), and matches it HERE, on this device, against:
 *   - the account's Wishlist, only while this browser is connected: its item keys,
 *     read with the sync token (/api/v1/wishlist), read only, nothing sent back;
 *   - the hangar and buy-backs this browser scanned, which never leave it, by the
 *     owner's rules (2026-10-10):
 *       buyback  a ship in your buy-backs is in the store again
 *       paint    a ship you own gets a paint that just arrived in the store
 *       warbond  a ship you own is sold as a warbond edition
 *       limited  a ship you own is back on a limited-time sale
 * Each match says why. The badge counts the items with a match you haven't seen (the
 * popup lists them, and opening it marks them seen); a match that's new gets one
 * notification while Notifications are allowed (an optional permission, asked when you
 * turn alerts on). Not connected: the hangar rules only.
 *
 * Polite (docs/dev/requests.md): a check at most every 30 minutes, 30 to 35 apart (an
 * alarm, with jitter); the feed asked with its ETag; Retry-After honored; after a
 * failure the next try waits longer (doubling, up to 6 hours). The website holds the
 * knowledge (which ship a store name means, every spelling, which ships a paint fits):
 * here a name is only folded (nameKey, the website's saleKey) and looked up, so a miss
 * is possible and a wrong match isn't.
 *
 * Loaded by the background worker (importScripts; Firefox's event page lists it in its
 * manifest) and the popup. Pure apart from the `env` it's handed, so it's tested
 * directly (test/alerts.test.js). Exposes self.OHAlerts.
 */
(function (root) {
  // ---- Storage keys ----
  const ON_KEY = 'alertsOn'; // true once the pilot turns alerts on (off by default)
  const STATE_KEY = 'alerts'; // the matches, and which the pilot has seen
  const FEED_KEY = 'alertsFeed'; // the last good sale feed, its ETag and when to ask again
  const WISH_KEY = 'alertsWish'; // the account's Wishlist keys, for the connection
  const ALARM = 'oh-alerts';

  // ---- Timing ----
  const CHECK_MS = 30 * 60e3; // never more often
  const JITTER_MS = 5 * 60e3; // 30 to 35 minutes apart
  const BACKOFF_MAX_MS = 6 * 3600e3;
  const RETRY_AFTER_MAX_MS = 24 * 3600e3;
  // A 404 from the Wishlist read (its flag is off on the website): ask again this late.
  const WISH_OFF_MS = 6 * 3600e3;
  const FETCH_TIMEOUT_MS = 10e3;
  // The feed's own browser lifetime (the website's 10 minutes): a copy this fresh is used.
  const FEED_FRESH_MS = 10 * 60e3;
  // A match gone from the store this long is forgotten, so it can alert again later.
  const GONE_KEEP_MS = 24 * 3600e3;
  // Notifications in one check; the rest get one notification together.
  const NOTIFY_MAX = 3;

  // ---- Sizes (test/storage-budget.test.js) ----
  const FEED_ITEMS_MAX = 2000;
  const FEED_SHIPS_MAX = 1000;
  const KEYS_PER_SHIP_MAX = 24;
  const SHIPS_PER_ITEM_MAX = 60;
  const WISH_MAX = 300; // the website's limit per login
  const MATCH_MAX = 200;
  // Pairs remembered (known, seen, gone each): the newest kept.
  const PAIRS_MAX = 2000;

  // ---- Where ----
  const FEED_PATH = '/api/store/on-sale';
  const WISH_PATH = '/api/v1/wishlist';
  const PRODUCTION_SITE = 'https://app.openhangar.space';
  const PUBLIC_SITE = 'https://openhangar.space';
  // The sync site built in (scripts/pack.mjs writes it, like src/lib.js's). Always empty
  // in the repo.
  const SITE_BUILT_IN = '';

  // Every word alerts show, in one place: placeholders until Claude chat writes them and
  // the owner approves them (CLAUDE.md). The note beside each says what it must say.
  // {name} parts are filled in by t(). The popup's own words are in ui/popup/copy.js.
  const COPY = {
    // The toolbar button's tooltip while alerts wait: how many, and that the popup
    // shows them.
    'alerts.badge-title': '[copy: alerts.badge-title {n}]',
    // Why an item is an alert, one line each:
    // On the pilot's account Wishlist (only while this browser is connected).
    'alerts.why.wishlist': '[copy: alerts.why.wishlist]',
    // A ship in your buy-backs is sold in the store again. Mustn't promise RSI will
    // sell the buy-back back (its own rules apply: tokens, store credit).
    'alerts.why.buyback': '[copy: alerts.why.buyback {ship}]',
    // A paint for a ship you own arrived in the store in the last week (our own
    // record of the store). Never "new", "first" or "never sold before".
    'alerts.why.paint': '[copy: alerts.why.paint {ship}]',
    // A ship you own is sold as a warbond edition now (new money only, cheaper).
    'alerts.why.warbond': '[copy: alerts.why.warbond {ship}]',
    // A ship you own is on a limited-time sale now (the Store's Limited-Time Sales).
    'alerts.why.limited': '[copy: alerts.why.limited {ship}]',
    // The sale's last day, only when RSI's own post gives it, e.g. "Oct 15".
    'alerts.ends': '[copy: alerts.ends {day}]',
    // One notification for the rest when more than three arrive at once: how many
    // more, and that the toolbar button shows them all.
    'alerts.notify-more-title': '[copy: alerts.notify-more-title {n}]',
    'alerts.notify-more-body': '[copy: alerts.notify-more-body]',
  };
  function t(key, vars = {}) {
    const s = COPY[key];
    if (s == null) throw new Error(`alerts copy: no "${key}"`);
    return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  }

  const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  const str = (v, n = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);

  // ---- Names ----
  // How a name is compared, here and on the website (open-hangar-server lib/sale-feed.ts
  // saleKey, the same test strings in both repos): no accents, lowercase, quotes
  // dropped, any other run of non-letters and non-digits one space.
  const nameKey = (s) =>
    String(s ?? '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[‘’'"“”]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  // A buy-back's title as the ship it gives back: RSI's store label in front and its
  // insurance and edition words behind off ("Standalone Ships - Cutlass Black - LTI",
  // "Sabre Raven EX Warbond Edition"), an extra after "plus" or "with" too. The ship's
  // own words never come off. As the website reads buy-backs (lib/buyback-ships.ts).
  const LABEL_RE = /^\s*(?:standalone\s+ships?|ships?|warbonds?)\s*[-–:]\s*/i;
  const TAIL_RE =
    /\s*[-–]?\s*\(?\b(?:lti|lifetime(?:\s+insurance)?|\d+\s*[- ]?\s*(?:years?|months?|mo)(?:\s+insurance)?|warbond(?:\s+edition)?|standard(?:\s+edition)?|wb|upgraded)\)?\s*$/i;
  const EXTRA_RE = /\s+(?:plus\s+|with\s+|w\/\s*)\S.*$/i;
  function untail(s) {
    let n = s;
    for (let k = 0; k < 6; k++) {
      const next = n.replace(TAIL_RE, '').replace(/\s*[-–]\s*$/, '');
      if (next === n) break;
      n = next;
    }
    return n;
  }
  function bareShipName(name) {
    let n = String(name || '').replace(LABEL_RE, '');
    n = untail(n);
    n = untail(n.replace(EXTRA_RE, ''));
    return n.replace(/\s+/g, ' ').trim();
  }
  // The ship names a pack's Contains line gives ("Aurora MR and 3 other items"), each
  // only a candidate: it counts when it's exactly a ship's.
  function containsNames(contains) {
    const out = [];
    for (const chunk of String(contains || '').split(/\s+·\s+|\s*\|\s*/)) {
      const head = chunk.replace(/\s+and\s+\d+\s+(?:other\s+)?items?\.?\s*$/i, '');
      for (const part of head.split(/\s*,\s*|\s+and\s+/i)) {
        const p = part.replace(/\s+/g, ' ').trim().slice(0, 80);
        if (p && !out.includes(p)) out.push(p);
      }
    }
    return out.slice(0, 12);
  }

  // ---- The sale feed (v1) ----
  const SALE_KINDS = ['warbond', 'discount', 'limited', 'listed', 'back'];
  const ITEM_ID = /^(sku|upgrade)-[1-9]\d{0,11}$/;
  const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const DAY = /^\d{4}-\d{2}-\d{2}$/;
  // The feed as fetched → the same shape with every field checked (a bad item or ship
  // left out, a field this version doesn't read dropped), or null for anything that
  // isn't v1. What's saved is its answer, so reading a saved copy again changes nothing.
  function readFeed(json) {
    if (!isObj(json) || json.v !== 1 || !Array.isArray(json.items) || !Array.isArray(json.ships))
      return null;
    const ships = [];
    for (const s of json.ships.slice(0, FEED_SHIPS_MAX)) {
      if (!isObj(s) || typeof s.slug !== 'string' || !SLUG.test(s.slug)) continue;
      const name = str(s.name);
      if (!name) continue;
      const keys = (Array.isArray(s.keys) ? s.keys : [])
        .filter((k) => typeof k === 'string' && k && k === nameKey(k))
        .slice(0, KEYS_PER_SHIP_MAX);
      ships.push({ slug: s.slug, name, keys });
    }
    const items = [];
    const seen = new Set();
    for (const i of json.items.slice(0, FEED_ITEMS_MAX)) {
      if (!isObj(i) || typeof i.id !== 'string' || !ITEM_ID.test(i.id) || seen.has(i.id)) continue;
      const name = str(i.name);
      const kind = str(i.kind, 20);
      if (!name || !kind) continue;
      seen.add(i.id);
      items.push({
        id: i.id,
        kind,
        name,
        price:
          typeof i.price === 'number' && Number.isFinite(i.price) && i.price >= 0 ? i.price : null,
        sale: SALE_KINDS.filter((k) => Array.isArray(i.sale) && i.sale.includes(k)),
        endsOn: typeof i.endsOn === 'string' && DAY.test(i.endsOn) ? i.endsOn : null,
        ships: (Array.isArray(i.ships) ? i.ships : [])
          .filter((x) => typeof x === 'string' && SLUG.test(x))
          .slice(0, SHIPS_PER_ITEM_MAX),
      });
    }
    const updatedAt = typeof json.updatedAt === 'string' ? json.updatedAt.slice(0, 40) : null;
    return { v: 1, updatedAt, ships, items };
  }

  // The Wishlist read (v1) → its keys, or null for anything else.
  const WISH_KEY_RE = /^(?:ship:[a-z0-9]+(?:-[a-z0-9]+)*|sku:[1-9]\d{0,9}|ccu:[1-9]\d{0,9})$/;
  function readWish(json) {
    if (!isObj(json) || json.v !== 1 || !Array.isArray(json.keys)) return null;
    return [...new Set(json.keys.filter((k) => typeof k === 'string' && k.length <= 90))]
      .filter((k) => WISH_KEY_RE.test(k))
      .slice(0, WISH_MAX);
  }

  // The feed's ship spellings → (a hangar name → its ship). A key two ships share
  // (the website leaves those out) is nobody's here too.
  function shipIndex(feed) {
    const owners = new Map();
    for (const s of feed.ships)
      for (const k of s.keys)
        owners.set(k, owners.has(k) && owners.get(k) !== s.slug ? null : s.slug);
    const names = new Map(feed.ships.map((s) => [s.slug, s.name]));
    const find = (label) => {
      const full = nameKey(label);
      if (owners.get(full)) return owners.get(full);
      // RSI's tag after a dash ("MISC RAPTOR - Referral Reward"): the name before it.
      const dash = /^(.+?)\s+[-–]\s+[^-–]+$/.exec(String(label || '').trim());
      return (dash && owners.get(nameKey(dash[1]))) || null;
    };
    return { find, name: (slug) => names.get(slug) || slug };
  }

  // ---- The pilot's side (this browser's scan, never sent) ----
  const SHIP_KIND = /^(ship|vehicle)s?$/i;
  const PAINT_KIND = /^(paints?|skins?|liver(?:y|ies))$/i;
  const items = (db, id) => {
    const v = db && db.sources && db.sources[id] && db.sources[id].items;
    return Array.isArray(v) ? v.filter(isObj) : [];
  };
  // The ships in the hangar, by the feed's ship → the hangar's name for it. An upgrade
  // pledge owns no ship (its contents are the upgrade).
  function ownedShips(db, index) {
    const out = new Map();
    for (const p of items(db, 'hangar')) {
      if (p.isCCU || p.ccu) continue;
      for (const c of Array.isArray(p.contents) ? p.contents : []) {
        if (!isObj(c) || !SHIP_KIND.test(String(c.kind || '').trim())) continue;
        const slug = index.find(c.label);
        if (slug && !out.has(slug)) out.set(slug, String(c.label).trim());
      }
    }
    return out;
  }
  // The ships your buy-backs give back: a standalone ship (its title) or a ship pack (its
  // Contains line). Upgrades, paints, add-ons and game packages never count.
  function buybackShips(db, index) {
    const out = new Map();
    for (const b of items(db, 'buybacks')) {
      if (b.isCCU || b.ccu) continue;
      const names =
        b.kind === 'ship'
          ? [bareShipName(b.name)]
          : b.kind === 'pack'
            ? containsNames(b.contains)
            : [];
      for (const n of names) {
        const slug = n ? index.find(n) : null;
        if (slug && !out.has(slug)) out.set(slug, n);
      }
    }
    return out;
  }
  // A paint's name to compare by: letters and digits only, RSI's label in front off,
  // so "Paints - Cutlass - Coalfire Paint" owned is "Cutlass - Coalfire Paint" in the store.
  const paintKey = (s) =>
    nameKey(s)
      .replace(/^(?:paints?|skins?|liver(?:y|ies)) /, '')
      .replace(/ /g, '');
  function ownedPaints(db) {
    const out = new Set();
    for (const p of items(db, 'hangar')) {
      if (p.isPaint && typeof p.name === 'string') out.add(paintKey(p.name));
      for (const c of Array.isArray(p.contents) ? p.contents : [])
        if (isObj(c) && typeof c.label === 'string' && PAINT_KIND.test(String(c.kind || '').trim()))
          out.add(paintKey(c.label));
    }
    out.delete('');
    return out;
  }

  // ---- Matching ----
  // The Wishlist keys an item answers to (the website's lib/wishlist.ts keys).
  function wishKeysOf(item) {
    const n = item.id.replace(/^\D+-/, '');
    if (item.id.startsWith('upgrade-')) return [`ccu:${n}`];
    const out = [`sku:${n}`];
    if (item.kind === 'ship' || item.kind === 'vehicle')
      for (const s of item.ships) out.push(`ship:${s}`);
    return out;
  }
  // The feed against this browser's scan (`db`) and the account's Wishlist keys (`wish`:
  // null when not connected) → the matches, each with why: [{ why, ships: [names] }].
  function matchAll(feed, db, wish) {
    const index = shipIndex(feed);
    const owned = ownedShips(db, index);
    const backs = buybackShips(db, index);
    const paints = ownedPaints(db);
    const wished = wish ? new Set(wish) : null;
    const out = [];
    for (const item of feed.items) {
      const why = [];
      if (wished && wishKeysOf(item).some((k) => wished.has(k)))
        why.push({ why: 'wishlist', ships: [] });
      const ship = item.kind === 'ship' || item.kind === 'vehicle';
      const mine = (from) => item.ships.filter((s) => from.has(s)).map((s) => index.name(s));
      if (ship) {
        const bb = mine(backs);
        if (bb.length) why.push({ why: 'buyback', ships: bb });
        const own = mine(owned);
        if (own.length && item.sale.includes('warbond')) why.push({ why: 'warbond', ships: own });
        if (own.length && item.sale.includes('limited')) why.push({ why: 'limited', ships: own });
      } else if (
        item.kind === 'paint' &&
        (item.sale.includes('listed') || item.sale.includes('back')) &&
        !paints.has(paintKey(item.name))
      ) {
        const own = mine(owned);
        if (own.length) why.push({ why: 'paint', ships: own });
      }
      if (why.length)
        out.push({
          id: item.id,
          name: item.name,
          kind: item.kind,
          price: item.price,
          sale: item.sale,
          endsOn: item.endsOn,
          why,
        });
    }
    return out.slice(0, MATCH_MAX);
  }

  // ---- What the pilot has seen ----
  // Each (item, why) pair is tracked on its own, so an item that gains a reason alerts
  // again. `known`: pairs matched so far (when first); `seen`: pairs the pilot has seen
  // (the popup opened); `gone`: pairs no longer matched (since when), forgotten after
  // GONE_KEEP_MS so a sale that comes back later alerts again, and a short gap (sold
  // out between two reads) doesn't.
  const pairsOf = (m) => m.why.map((w) => `${m.id}|${w.why}`);
  const emptyState = () => ({ v: 1, items: [], known: {}, seen: {}, gone: {} });
  function cleanState(s) {
    if (!isObj(s) || s.v !== 1) return emptyState();
    const map = (x) =>
      isObj(x) ? Object.fromEntries(Object.entries(x).filter(([, v]) => Number.isFinite(v))) : {};
    return {
      ...s,
      items: Array.isArray(s.items) ? s.items.filter(isObj) : [],
      known: map(s.known),
      seen: map(s.seen),
      gone: map(s.gone),
    };
  }
  // → { state, fresh }: fresh are the matches with a pair never matched before.
  function nextState(prev, matches, now) {
    const s = cleanState(prev);
    const live = new Set(matches.flatMap(pairsOf));
    const known = { ...s.known };
    const seen = { ...s.seen };
    const gone = { ...s.gone };
    const fresh = matches.filter((m) => pairsOf(m).some((p) => !(p in known)));
    for (const p of live) {
      if (!(p in known)) known[p] = now;
      delete gone[p];
    }
    for (const p of Object.keys(known)) {
      if (live.has(p)) continue;
      gone[p] ??= now;
      if (now - gone[p] >= GONE_KEEP_MS) {
        delete known[p];
        delete seen[p];
        delete gone[p];
      }
    }
    const cap = (m) =>
      Object.fromEntries(
        Object.entries(m)
          .sort((x, y) => y[1] - x[1])
          .slice(0, PAIRS_MAX),
      );
    return {
      state: { ...s, items: matches, known: cap(known), seen: cap(seen), gone: cap(gone) },
      fresh,
    };
  }
  // Items with a pair the pilot hasn't seen: the badge's count.
  const unseen = (state) => {
    const s = cleanState(state);
    return s.items.filter((m) => pairsOf(m).some((p) => !(p in s.seen)));
  };
  // Every current pair seen (the popup opened), or one item's (its notification clicked).
  function markSeen(state, now, id = null) {
    const s = cleanState(state);
    const seen = { ...s.seen };
    for (const m of s.items)
      if (id == null || m.id === id) for (const p of pairsOf(m)) seen[p] ??= now;
    return { ...s, seen };
  }

  // ---- Words ----
  const WHY_KEYS = { wishlist: 1, buyback: 1, paint: 1, warbond: 1, limited: 1 };
  const whyLine = (w) =>
    WHY_KEYS[w.why] ? t(`alerts.why.${w.why}`, { ship: (w.ships || []).join(', ') }) : '';
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const shortDay = (ymd) => {
    const [, m, d] = String(ymd).split('-').map(Number);
    return m >= 1 && m <= 12 && d ? `${MON[m - 1]} ${d}` : '';
  };
  function lines(m) {
    const out = m.why.map(whyLine).filter(Boolean);
    if (m.endsOn) out.push(t('alerts.ends', { day: shortDay(m.endsOn) }));
    return out;
  }
  // The notifications for the fresh matches: one each, NOTIFY_MAX at most, then one for
  // the rest. → [{ id, title, message }].
  function notesFor(fresh) {
    const one = fresh.slice(0, fresh.length > NOTIFY_MAX ? NOTIFY_MAX - 1 : NOTIFY_MAX);
    const out = one.map((m) => ({
      id: `${ALARM}:${m.id}`,
      title: m.name,
      message: lines(m).join('\n'),
    }));
    const rest = fresh.length - one.length;
    if (rest > 0)
      out.push({
        id: `${ALARM}:more`,
        title: t('alerts.notify-more-title', { n: rest }),
        message: t('alerts.notify-more-body'),
      });
    return out;
  }
  // The toolbar badge while matches wait, or null (the rescan reminder's then).
  function badgeFor(on, state) {
    if (on !== true) return null;
    const n = unseen(state).length;
    if (!n) return null;
    return { text: n > 9 ? '9+' : String(n), title: t('alerts.badge-title', { n }) };
  }

  // ---- Where things are ----
  // The sync site (a developer's `siteUrl`, else the built-in one), and where the feeds
  // are: openhangar.space for production (app.openhangar.space only ever hears from a
  // connected extension), a developer's own site for both.
  function sitesOf(siteUrl) {
    const site = String(siteUrl || SITE_BUILT_IN || PRODUCTION_SITE).replace(/\/+$/, '');
    return { site, feeds: site === PRODUCTION_SITE ? PUBLIC_SITE : site };
  }
  // Our Store's page for an item (the website's lib/fleet-on-sale.ts storeHref): its
  // panel by store id, an upgrade by its name.
  function itemUrl(feeds, m) {
    const sku = /^sku-(\d+)$/.exec(m.id);
    return `${feeds}/store#item=${sku ? sku[1] : encodeURIComponent(m.name)}`;
  }
  // The kill switch (site/status.json, as the extension's pages cached it): "alerts":
  // { "enabled": false } pauses the checks without a release.
  const paused = (status) =>
    !!(
      status &&
      isObj(status.data) &&
      isObj(status.data.sources) &&
      isObj(status.data.sources.alerts) &&
      status.data.sources.alerts.enabled === false
    );

  // ---- Asking politely ----
  // Retry-After (seconds or an HTTP date) → ms, or 0.
  function retryAfterMs(value, now) {
    const v = String(value || '').trim();
    if (!v) return 0;
    const ms = /^\d+$/.test(v) ? Number(v) * 1000 : Date.parse(v) - now;
    return Number.isFinite(ms) && ms > 0 ? Math.min(ms, RETRY_AFTER_MAX_MS) : 0;
  }
  // After `fails` failures in a row: how long to wait, never under the normal gap.
  const backoffMs = (fails) => Math.min(CHECK_MS * 2 ** Math.max(0, fails - 1), BACKOFF_MAX_MS);
  // When the next check may run: 30 to 35 minutes on, or later when a source asked.
  const nextAt = (now, rand, ...later) =>
    Math.max(now + CHECK_MS + Math.floor(rand * JITTER_MS), ...later.filter(Number.isFinite));

  // One GET with nothing of ours but what `headers` says: no cookies, a timeout.
  async function getJson(env, url, headers) {
    const res = await env.fetch(url, {
      credentials: 'omit',
      headers: { Accept: 'application/json', ...headers },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const h = (n) => (res.headers && res.headers.get && res.headers.get(n)) || null;
    let json = null;
    if (res.ok) json = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, json, etag: h('etag'), retryAfter: h('retry-after') };
  }
  // The sale feed, from the saved copy or asked again (with its ETag) → the record to save.
  // A copy younger than FEED_FRESH_MS is used as it is, so switching alerts off and on
  // again, or connecting, never asks twice in a row.
  async function freshFeed(env, feeds, rec, now) {
    const last = isObj(rec) && rec.data ? rec : null;
    if (isObj(rec) && rec.retryAt > now) return rec;
    if (last && now - last.at >= 0 && now - last.at < FEED_FRESH_MS && !last.retryAt) return rec;
    try {
      const r = await getJson(
        env,
        feeds + FEED_PATH,
        last && last.etag ? { 'If-None-Match': last.etag } : {},
      );
      if (r.status === 304 && last) return { data: last.data, etag: last.etag, at: now, fails: 0 };
      const data = r.ok ? readFeed(r.json) : null;
      if (data) return { data, etag: r.etag, at: now, fails: 0 };
      const fails = ((rec && rec.fails) || 0) + 1;
      const wait = Math.max(retryAfterMs(r.retryAfter, now), backoffMs(fails));
      return { ...(last || {}), retryAt: now + wait, fails };
    } catch {
      const fails = ((rec && rec.fails) || 0) + 1;
      return { ...(last || {}), retryAt: now + backoffMs(fails), fails };
    }
  }
  // The account's Wishlist keys for this connection, from the saved copy or asked again.
  // A 401 or 404 keeps nothing (a link the website no longer knows, or its Wishlist off
  // for this pilot): the hangar rules still run.
  async function freshWish(env, site, link, rec, now) {
    const mine = isObj(rec) && rec.connectedAt === link.connectedAt ? rec : null;
    if (mine && mine.retryAt > now) return mine;
    try {
      const r = await getJson(env, site + WISH_PATH, { Authorization: `Bearer ${link.token}` });
      const keys = r.ok ? readWish(r.json) : null;
      if (keys)
        return { keys, at: now, connectedAt: link.connectedAt, retryAt: now + CHECK_MS, fails: 0 };
      const fails = ((mine && mine.fails) || 0) + 1;
      const wait =
        r.status === 404
          ? WISH_OFF_MS
          : Math.max(retryAfterMs(r.retryAfter, now), backoffMs(fails));
      const keep = r.status === 401 || r.status === 404 ? null : mine && mine.keys;
      return {
        keys: keep,
        at: mine ? mine.at : null,
        connectedAt: link.connectedAt,
        retryAt: now + wait,
        fails,
      };
    } catch {
      const fails = ((mine && mine.fails) || 0) + 1;
      return {
        keys: (mine && mine.keys) || null,
        at: mine ? mine.at : null,
        connectedAt: link.connectedAt,
        retryAt: now + backoffMs(fails),
        fails,
      };
    }
  }

  // ---- A check ----
  // env: { get(keys), set(obj), remove(keys), fetch, now(), rand(), mayShare() (Firefox's
  // data yes, for the Wishlist read), notify(notes), badge(), schedule(at) }.
  // network: false matches again from what's saved (a new scan), asking nothing.
  async function check(env, { network = true } = {}) {
    const s = await env.get([
      ON_KEY,
      STATE_KEY,
      FEED_KEY,
      WISH_KEY,
      'siteLink',
      'siteUrl',
      'remoteStatus',
      'db',
    ]);
    const now = env.now();
    if (s[ON_KEY] !== true) return { ran: false, why: 'off' };
    if (paused(s.remoteStatus)) {
      if (network) await env.schedule(nextAt(now, env.rand()));
      return { ran: false, why: 'paused' };
    }
    const { site, feeds } = sitesOf(s.siteUrl);
    const link =
      isObj(s.siteLink) && typeof s.siteLink.token === 'string' && s.siteLink.token
        ? s.siteLink
        : null;
    let feedRec = isObj(s[FEED_KEY]) ? s[FEED_KEY] : null;
    let wishRec =
      link && isObj(s[WISH_KEY]) && s[WISH_KEY].connectedAt === link.connectedAt
        ? s[WISH_KEY]
        : null;
    const save = {};
    if (network) {
      feedRec = await freshFeed(env, feeds, feedRec, now);
      save[FEED_KEY] = feedRec;
      // Firefox asks before anything goes off the device: the sync token is sync's yes.
      if (link && (await env.mayShare())) {
        wishRec = await freshWish(env, site, link, wishRec, now);
        save[WISH_KEY] = wishRec;
      }
    }
    const feed = feedRec && feedRec.data ? readFeed(feedRec.data) : null;
    const wish =
      wishRec && Array.isArray(wishRec.keys) ? readWish({ v: 1, keys: wishRec.keys }) : null;
    let fresh = [];
    let state = null;
    if (feed) {
      const r = nextState(s[STATE_KEY], matchAll(feed, s.db, wish), now);
      fresh = r.fresh;
      const was = isObj(s[STATE_KEY]) ? s[STATE_KEY].checkedAt : null;
      state = { ...r.state, checkedAt: network ? now : Number.isFinite(was) ? was : null };
      save[STATE_KEY] = state;
    }
    if (Object.keys(save).length) await env.set(save);
    // Not connected (or another connection now): no Wishlist kept for a link that isn't.
    if (!link || !wishRec) await env.remove(WISH_KEY);
    if (fresh.length) await env.notify(notesFor(fresh));
    await env.badge();
    if (network) await env.schedule(nextAt(now, env.rand(), feedRec && feedRec.retryAt));
    return { ran: true, matches: state ? state.items.length : null, fresh: fresh.length };
  }

  // Alerts switched off: the matches and the account's Wishlist keys go (the public
  // feed's copy stays, nothing of the pilot's in it).
  const OFF_KEYS = [STATE_KEY, WISH_KEY];

  const api = {
    ON_KEY,
    STATE_KEY,
    FEED_KEY,
    WISH_KEY,
    OFF_KEYS,
    ALARM,
    CHECK_MS,
    JITTER_MS,
    BACKOFF_MAX_MS,
    WISH_OFF_MS,
    FEED_FRESH_MS,
    GONE_KEEP_MS,
    NOTIFY_MAX,
    MATCH_MAX,
    PAIRS_MAX,
    FEED_ITEMS_MAX,
    FEED_SHIPS_MAX,
    KEYS_PER_SHIP_MAX,
    FEED_PATH,
    WISH_PATH,
    COPY,
    t,
    nameKey,
    bareShipName,
    containsNames,
    readFeed,
    readWish,
    shipIndex,
    ownedShips,
    buybackShips,
    ownedPaints,
    wishKeysOf,
    matchAll,
    nextState,
    unseen,
    markSeen,
    lines,
    notesFor,
    badgeFor,
    sitesOf,
    itemUrl,
    paused,
    retryAfterMs,
    backoffMs,
    nextAt,
    check,
  };
  root.OHAlerts = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
