// The Wishlist tab's own read and writes (0.4.0; the privacy policy's "Your Wishlist"):
// while this browser is connected, the account's Wishlist on openhangar.space, with the
// sync token, and the one change you make to it: which item, and the target price if
// you set one. Nothing else is sent with it (a Target Price save leaves the insurance
// out, and the website keeps the stored one). Nothing typed in the search goes anywhere
// (the search is ./wishlist.js, on this device).
//
//   GET  <site>/api/v1/wishlist?with=items     (Authorization: Bearer <sync token>)
//        → 200 { v: 1, keys, items: [{ key, name, category, target, insurance, from, at }] }
//          (the website's extension_wishlist_write on: the tab can change it), or
//          { v: 1, keys } (off: the list read only), 404 (the Wishlist is off on the
//          website for this account: the tab keeps today's read-only list), 401 (a token
//          the website no longer knows), 429 or 5xx (asked again later).
//   POST <site>/api/v1/wishlist                 (the same token, application/json)
//        { v: 1, do: 'add', item }              item: { kind: 'ship', name }
//                                               | { kind: 'pack'|'paint'|'gear'|'addon',
//                                                   id: 'sku-N', name }
//                                               | { kind: 'ccu', id: 'upgrade-N', name }
//        { v: 1, do: 'remove', key }
//        { v: 1, do: 'save', key, target }      target: US dollars as typed
//                                               ('150', '89.50') or null; nothing else
//                                               (the website keeps the stored insurance)
//        → 200 { ok, outcome, key, on, item? }: `item` the item as stored now
//
// Polite (docs/dev/requests.md): a copy younger than FRESH_MS is used as it is; a read
// that fails waits longer each time (Retry-After when the website says, doubling up to
// 6 hours), and a 404 waits OFF_MS. Writes go one at a time, each only from a click,
// never tried again by themselves, and none goes while the website asked to wait (its
// Retry-After, or HOLD_MS when the answer doesn't let the popup read one).
//
// The copy (`popupWish`) is this connection's: another connection's, or one with no
// connection left, is deleted (Disconnect deletes it too: src/lib.js siteDisconnect).
// `env` is { get, set, remove, fetch, now, site(), mayShare() }; popupEnv() is the
// browser's.

export const WISH_PATH = '/api/v1/wishlist';
export const COPY_KEY = 'popupWish';
export const FRESH_MS = 5 * 60e3;
export const OFF_MS = 6 * 3600e3;
export const BACKOFF_MS = 60e3;
export const BACKOFF_MAX_MS = 6 * 3600e3;
export const RETRY_AFTER_MAX_MS = 24 * 3600e3;
// A write the website answered 429 or 5xx with no Retry-After the popup can read: the
// next one waits this long (the website's own RETRY_AFTER_S).
export const HOLD_MS = 60e3;
export const TIMEOUT_MS = 10e3;
// The website's limit per login (src/alerts.js WISH_MAX).
export const WISH_MAX = 300;
// The website's longest target, in cents (its lib/wishlist.ts TARGET_MAX_CENTS).
export const TARGET_MAX_CENTS = 10_000_000;
const NAME_MAX = 200;

const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const KEY_RE = /^(?:ship:[a-z0-9]+(?:-[a-z0-9]+)*|sku:[1-9]\d{0,9}|ccu:[1-9]\d{0,9})$/;
const INSURANCE = ['either', 'lti', '120'];
export const isKey = (k) => typeof k === 'string' && k.length <= 90 && KEY_RE.test(k);

// --- What the website sends -----------------------------------------------------------
// One item from ?with=items → the fields the tab uses, checked, or null.
function readItem(i) {
  if (!isObj(i) || !isKey(i.key)) return null;
  const name = typeof i.name === 'string' ? i.name.trim().slice(0, NAME_MAX) : '';
  if (!name) return null;
  const target =
    Number.isInteger(i.target) && i.target > 0 && i.target <= TARGET_MAX_CENTS ? i.target : null;
  const from =
    isObj(i.from) && Number.isInteger(i.from.id) && typeof i.from.name === 'string'
      ? { id: i.from.id, name: i.from.name.slice(0, NAME_MAX) }
      : null;
  return {
    key: i.key,
    name,
    category: typeof i.category === 'string' ? i.category.slice(0, 20) : '',
    target,
    insurance: INSURANCE.includes(i.insurance) ? i.insurance : null,
    from,
    at: Number.isFinite(i.at) ? i.at : 0,
  };
}
// The read → { keys, items } (items null: the website lets the tab only read the list),
// or null for anything that isn't v1.
export function readList(json) {
  if (!isObj(json) || json.v !== 1 || !Array.isArray(json.keys)) return null;
  const keys = [...new Set(json.keys.filter(isKey))].slice(0, WISH_MAX);
  if (!Array.isArray(json.items)) return { keys, items: null };
  const seen = new Set();
  const items = [];
  for (const raw of json.items) {
    const it = readItem(raw);
    if (!it || seen.has(it.key)) continue;
    seen.add(it.key);
    items.push(it);
    if (items.length >= WISH_MAX) break;
  }
  return { keys, items };
}

// --- Target prices -------------------------------------------------------------------
// What's typed in Target Price ("150", "89.50", "$1,234.5"; empty is none) → { ok, cents }
// by the website's own rule (its lib/wishlist.ts parseTarget), so nothing it would refuse
// is sent.
export function parseTarget(raw) {
  if (raw == null) return { ok: true, cents: null };
  if (typeof raw !== 'string' || raw.length > 20) return { ok: false };
  const s = raw
    .trim()
    .replace(/^\$\s*/, '')
    .replace(/,/g, '');
  if (!s) return { ok: true, cents: null };
  const m = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(s) || /^\.(\d{1,2})$/.exec(s);
  if (!m) return { ok: false };
  const [whole, frac] = m.length === 3 ? [m[1], m[2] || ''] : ['0', m[1]];
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return cents > 0 && cents <= TARGET_MAX_CENTS ? { ok: true, cents } : { ok: false };
}
// A target in cents as the field shows it and the website takes it: "150", "89.50".
export const centsText = (cents) =>
  cents == null ? '' : cents % 100 ? (cents / 100).toFixed(2) : String(cents / 100);

// --- Waiting politely ----------------------------------------------------------------
// Retry-After (seconds or an HTTP date) → ms, or 0.
export function retryAfterMs(value, now) {
  const v = String(value || '').trim();
  if (!v) return 0;
  const ms = /^\d+$/.test(v) ? Number(v) * 1000 : Date.parse(v) - now;
  return Number.isFinite(ms) && ms > 0 ? Math.min(ms, RETRY_AFTER_MAX_MS) : 0;
}
const backoff = (fails) => Math.min(BACKOFF_MS * 2 ** Math.max(0, fails - 1), BACKOFF_MAX_MS);
const header = (res, n) => (res && res.headers && res.headers.get && res.headers.get(n)) || null;

// --- The copy ------------------------------------------------------------------------
// → { mode, items, keys }: 'edit' (items, the tab can change them), 'keys' (the list read
// only), 'off' (the website's Wishlist is off for this account), 'error' (never read, or
// the website no longer knows this connection), 'none' (not connected).
function view(rec) {
  if (!rec) return { mode: 'error', items: null, keys: null };
  if (Array.isArray(rec.items)) return { mode: 'edit', items: rec.items, keys: null };
  if (Array.isArray(rec.keys)) return { mode: 'keys', items: null, keys: rec.keys };
  if (rec.off) return { mode: 'off', items: null, keys: null };
  return { mode: 'error', items: null, keys: null };
}
const linkOf = (got) =>
  isObj(got.siteLink) && typeof got.siteLink.token === 'string' && got.siteLink.token
    ? got.siteLink
    : null;
// This connection's copy, or null; any other copy is deleted.
async function copyFor(env, got, link) {
  const rec = isObj(got[COPY_KEY]) ? got[COPY_KEY] : null;
  if (rec && link && rec.connectedAt === link.connectedAt) return rec;
  if (got[COPY_KEY] !== undefined) await env.remove(COPY_KEY);
  return null;
}

// The Wishlist: this connection's copy, or read again when it's old. Never throws.
export async function loadWish(env, { force = false } = {}) {
  try {
    const got = await env.get(['siteLink', COPY_KEY]);
    const link = linkOf(got);
    const mine = await copyFor(env, got, link);
    if (!link) return { mode: 'none', items: null, keys: null };
    const now = env.now();
    if (mine && Number.isFinite(mine.retryAt) && mine.retryAt > now) return view(mine);
    const age = mine && Number.isFinite(mine.at) ? now - mine.at : Infinity;
    if (!force && mine && age >= 0 && age < FRESH_MS) return view(mine);
    // Firefox asks before anything goes off the device: the sync token is sync's yes.
    if (!(await env.mayShare()))
      return mine ? view(mine) : { mode: 'off', items: null, keys: null };
    // A write the website asked to wait on still waits after a read.
    const hold = mine && mine.holdUntil > now ? { holdUntil: mine.holdUntil } : {};
    const base = { v: 1, connectedAt: link.connectedAt, ...hold };
    let next;
    try {
      const res = await env.fetch(`${await env.site()}${WISH_PATH}?with=items`, {
        credentials: 'omit',
        headers: { Accept: 'application/json', Authorization: `Bearer ${link.token}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const list = res.ok ? readList(await res.json().catch(() => null)) : null;
      if (list) next = { ...base, at: now, keys: list.items ? null : list.keys, items: list.items };
      else if (res.status === 404) next = { ...base, at: now, off: true, retryAt: now + OFF_MS };
      else if (res.status === 401) {
        // A connection the website ended: nothing of its Wishlist is kept, only when to
        // ask again (OFF_MS: connecting again starts a new copy at once), so opening the
        // tab doesn't send the dead token each time.
        next = { ...base, at: now, retryAt: now + OFF_MS };
      } else {
        const fails = ((mine && mine.fails) || 0) + 1;
        const wait = Math.max(retryAfterMs(header(res, 'retry-after'), now), backoff(fails));
        next = { ...(mine || base), retryAt: now + wait, fails };
      }
    } catch {
      const fails = ((mine && mine.fails) || 0) + 1;
      next = { ...(mine || base), retryAt: now + backoff(fails), fails };
    }
    // Disconnected (or connected again) while it was asked: that answer isn't kept.
    const still = linkOf(await env.get(['siteLink']));
    if (!still || still.connectedAt !== link.connectedAt)
      return { mode: 'none', items: null, keys: null };
    await env.set({ [COPY_KEY]: next });
    return view(next);
  } catch {
    return { mode: 'error', items: null, keys: null };
  }
}

// --- One change ----------------------------------------------------------------------
// One at a time: a second click waits for the first.
let lane = Promise.resolve();
// → { ok, outcome, items, error }: `items` the copy after (the website's answer applied),
// `error` 'not-connected' | 'held' (the website asked to wait) | 'not-allowed' (Firefox's
// data yes) | 'off' (the website no longer takes changes from the extension) | 'net'
// (it couldn't be reached, or it failed) | 'refused' (it didn't take this change).
export function writeWish(env, change) {
  const run = lane.then(() => writeNow(env, change));
  lane = run.catch(() => {});
  return run;
}
// Only the fields each change has, so nothing else is ever sent.
function bodyOf(c) {
  if (c.do === 'add') return { v: 1, do: 'add', item: c.item };
  if (c.do === 'remove') return { v: 1, do: 'remove', key: c.key };
  // Which item and the target only: the website keeps the stored insurance.
  return { v: 1, do: 'save', key: c.key, target: c.target ?? null };
}
// The copy's items after the website's answer: a removed item (or one a save found gone)
// leaves, an added or saved one is the website's own copy of it.
function applied(items, change, r) {
  const list = Array.isArray(items) ? items : [];
  const item = r.ok === true && r.item ? readItem(r.item) : null;
  const gone =
    (change.do === 'remove' && (r.ok === true || r.outcome === 'not-found')) ||
    (change.do === 'save' && r.outcome === 'not-found');
  if (gone) return list.filter((i) => i.key !== change.key);
  if (!item) return list;
  if (change.do === 'add')
    return [item, ...list.filter((i) => i.key !== item.key)].slice(0, WISH_MAX);
  return list.map((i) => (i.key === item.key ? item : i));
}
async function writeNow(env, change) {
  const fail = (error, items = null) => ({ ok: false, outcome: null, items, error });
  try {
    const got = await env.get(['siteLink', COPY_KEY]);
    const link = linkOf(got);
    const mine = await copyFor(env, got, link);
    if (!link) return fail('not-connected');
    const items = mine && Array.isArray(mine.items) ? mine.items : null;
    const now = env.now();
    if (mine && Number.isFinite(mine.holdUntil) && mine.holdUntil > now) return fail('held', items);
    if (!(await env.mayShare())) return fail('not-allowed', items);
    let res;
    try {
      res = await env.fetch(`${await env.site()}${WISH_PATH}`, {
        method: 'POST',
        credentials: 'omit',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${link.token}`,
        },
        body: JSON.stringify(bodyOf(change)),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      return fail('net', items);
    }
    const save = async (rec) => {
      const still = linkOf(await env.get(['siteLink']));
      if (still && still.connectedAt === link.connectedAt) await env.set({ [COPY_KEY]: rec });
    };
    if (res.status === 404) {
      // The website stopped taking changes: read the list again next time.
      if (mine) await save({ ...mine, at: 0, retryAt: 0 });
      return fail('off', items);
    }
    if (res.status === 429 || res.status >= 500) {
      // Retry-After when the browser lets the popup read it (a cross-origin answer hides
      // it unless the website exposes it), else the website's own minute.
      const wait = retryAfterMs(header(res, 'retry-after'), now) || HOLD_MS;
      if (mine) await save({ ...mine, holdUntil: now + wait });
      return fail('net', items);
    }
    if (!res.ok) return fail(res.status === 400 ? 'refused' : 'net', items);
    const r = await res.json().catch(() => null);
    if (!isObj(r) || typeof r.outcome !== 'string') return fail('net', items);
    const next = items ? applied(items, change, r) : items;
    const key = isKey(r.key) ? r.key : null;
    // Taken, with no copy of the item in the answer: the list is read again next time.
    const stale = r.ok === true && change.do !== 'remove' && !r.item;
    if (mine && (next !== items || stale))
      await save({ ...mine, items: next, ...(stale ? { at: 0 } : {}) });
    if (r.ok !== true) return { ok: false, outcome: r.outcome, key, items: next, error: 'refused' };
    return { ok: true, outcome: r.outcome, key, items: next, error: null, stale };
  } catch {
    return fail('net');
  }
}

// --- The browser's env -----------------------------------------------------------------
const SITE_DATA = {
  data_collection: ['personallyIdentifyingInfo', 'financialAndPaymentInfo', 'websiteContent'],
};
export function popupEnv() {
  const firefox = !!chrome.runtime.getManifest().browser_specific_settings?.gecko;
  return {
    get: (k) => chrome.storage.local.get(k),
    set: (o) => chrome.storage.local.set(o),
    remove: (k) => chrome.storage.local.remove(k),
    fetch: (...a) => fetch(...a),
    now: () => Date.now(),
    site: () => globalThis.OH.siteUrl(),
    mayShare: async () =>
      !firefox || (await chrome.permissions.contains(SITE_DATA).catch(() => false)),
  };
}
