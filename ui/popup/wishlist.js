// The Wishlist tab's on-device parts: the search that finds what to add, the ship list
// it names ships from, and the read-only list the store alerts keep. Nothing here asks
// anything of anyone, and nothing typed leaves this page: the search looks only at what
// the extension already keeps (the ship list from openhangar.space, OH.getShipCatalog,
// and with store alerts on the sale feed, `alertsFeed`). The website's own read and
// writes are ./wish-client.js.
import { shipSlug } from './data.js';

// The store alerts' copy of the account's Wishlist keys (src/alerts.js freshWish, kept in
// `alertsWish`): the read-only list when the website's Wishlist read doesn't answer for
// the tab. → { off: true } (alerts off, not connected, or a build without alerts),
// { pending: true } (alerts on, not read yet for this connection), { failed: true } (the
// last read didn't go through and nothing is kept), or { keys }. Never throws.
export async function readWishlist() {
  const AL = globalThis.OHAlerts;
  if (!AL) return { off: true };
  try {
    const got = await chrome.storage.local.get(['siteLink', AL.ON_KEY, AL.WISH_KEY]);
    const link = got.siteLink;
    if (!link?.token || got[AL.ON_KEY] !== true) return { off: true };
    const kept = got[AL.WISH_KEY];
    if (!kept || kept.connectedAt !== link.connectedAt) return { pending: true };
    if (!Array.isArray(kept.keys)) return { failed: true };
    return { keys: AL.readWish({ v: 1, keys: kept.keys }) || [] };
  } catch {
    return { failed: true };
  }
}

// The sale feed the store alerts keep, only while they're on (the privacy policy: the
// Wishlist tab uses it with store alerts on), or null. Never asked for here.
export async function saleFeed() {
  const AL = globalThis.OHAlerts;
  if (!AL) return null;
  try {
    const got = await chrome.storage.local.get([AL.ON_KEY, AL.FEED_KEY]);
    return got[AL.ON_KEY] === true ? got[AL.FEED_KEY]?.data || null : null;
  } catch {
    return null;
  }
}

// Ship names by the website's slug (ship:<slug>), from the ship list the extension
// already keeps for prices (OH.getShipCatalog: bundled, plus the public list from
// openhangar.space at most once a day). → Map, empty when there's none.
export async function shipNames() {
  const OH = globalThis.OH;
  const names = new Map();
  try {
    const list = OH?.getShipCatalog ? await OH.getShipCatalog() : [];
    for (const s of Array.isArray(list) ? list : []) {
      if (!s || typeof s.name !== 'string' || !s.name) continue;
      const slug = shipSlug(s.name);
      if (slug && !names.has(slug)) names.set(slug, s.name);
    }
  } catch {
    // No ship list: those keys stay counted, never guessed.
  }
  return names;
}

// --- The search ------------------------------------------------------------------------
// What the store sells, by the sale feed's kind, as the website's add takes it (the
// import's kinds: starter packs fold into packs, subscriber items into add-ons). Ships and
// vehicles come from the ship list instead (the Wishlist keeps the ship, not one of its
// store editions); anything else can't go on the Wishlist.
const FEED_KIND = {
  pack: 'pack',
  starter: 'pack',
  paint: 'paint',
  gear: 'gear',
  addon: 'addon',
  subscriber: 'addon',
  upgrade: 'ccu',
};
const fold = (s) =>
  String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[‘’'"“”]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const NAME_MAX = 200;

// Everything the search can offer → [{ key, kind, name, item, hay }]: `item` is what the
// add sends (the website places it), `key` the Wishlist key it becomes. `onList`: the
// keys already on the Wishlist, left out. Ships from the sale feed's ship list (the
// website's own names) first, then the ship list; store items and upgrades from the
// sale feed. Pure.
export function searchEntries({ names = null, feed = null, onList = [] } = {}) {
  const out = [];
  const taken = new Set(onList);
  const add = (key, kind, name, item) => {
    if (taken.has(key)) return;
    taken.add(key);
    out.push({ key, kind, name, item, hay: fold(name) });
  };
  const ship = (slug, raw) => {
    const name = typeof raw === 'string' ? raw.trim().slice(0, NAME_MAX) : '';
    if (slug && name) add(`ship:${slug}`, 'ship', name, { kind: 'ship', name });
  };
  for (const s of Array.isArray(feed?.ships) ? feed.ships : []) ship(s?.slug, s?.name);
  if (names instanceof Map) for (const [slug, name] of names) ship(slug, name);
  for (const i of Array.isArray(feed?.items) ? feed.items : []) {
    const kind = FEED_KIND[i?.kind];
    const m = /^(sku|upgrade)-([1-9]\d{0,9})$/.exec(String(i?.id || ''));
    const name = typeof i?.name === 'string' ? i.name.trim().slice(0, NAME_MAX) : '';
    if (!kind || !m || !name || (kind === 'ccu') !== (m[1] === 'upgrade')) continue;
    add(`${kind === 'ccu' ? 'ccu' : 'sku'}:${m[2]}`, kind, name, { kind, id: i.id, name });
  }
  return out;
}

// The search box's words (copy.js keys): with the sale feed (store alerts on) ships,
// paints and upgrades; without it ships only, since store items come with the feed.
export const searchHint = (feed) => (feed ? 'popup.wish-search' : 'popup.wish-search-ships');

// Whether what's typed is searched at all (two letters at least): only then can the tab
// say nothing matched.
export const searched = (query) => fold(query).length >= 2;

// The entries for what's typed: every word somewhere in the name, a name that is or
// starts with it first, then one with a word that starts with it, then the shortest.
// Fewer than two letters finds nothing. Pure, and it sends nothing.
export function searchWish(entries, query, max = 6) {
  if (!searched(query)) return [];
  const q = fold(query);
  const words = q.split(' ');
  const rank = (e) =>
    e.hay === q ? 0 : e.hay.startsWith(q) ? 1 : ` ${e.hay}`.includes(` ${words[0]}`) ? 2 : 3;
  return (Array.isArray(entries) ? entries : [])
    .filter((e) => words.every((w) => e.hay.includes(w)))
    .map((e) => ({ e, r: rank(e) }))
    .sort(
      (a, b) => a.r - b.r || a.e.name.length - b.e.name.length || a.e.name.localeCompare(b.e.name),
    )
    .slice(0, max)
    .map((x) => x.e);
}
