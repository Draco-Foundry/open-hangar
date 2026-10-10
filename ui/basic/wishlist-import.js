// The 0.3.x wishlist into your openhangar.space account, once (the connector build).
// The wishlist moved to the website; the one this browser kept (`wishlist`, the
// dashboard's Store page) goes up once per connection, the first time the basic page
// sees one, and the website adds it to the account's (a union: nothing there is
// removed). The copy here is never touched.
//
//   POST <site>/api/v1/wishlist/import   (Authorization: Bearer <sync token>)
//   { v: 1, appVersion, items: [{ kind: 'ship', name }
//                              | { kind: 'pack'|'paint'|'gear'|'addon', id, name }
//                              | { kind: 'ccu', id, name, from, to? }] }
//   → 2xx: done (wishImport records it for this connection)
//   → anything else (a 404 before the website takes it, 401, 429, 5xx, no network):
//     asked again later, at most every 6 hours (a sync forgets a connection the
//     website ended)
// Nothing is sent when the wishlist is empty: that's done too.

export const IMPORT_PATH = '/api/v1/wishlist/import';
export const MAX_ITEMS = 500;
const MAX_TEXT = 200;
const ITEM_KINDS = ['pack', 'paint', 'gear', 'addon', 'ccu'];
// Retried at most this often while the website doesn't take it yet or is busy.
export const RETRY_MS = 6 * 3600e3;

const text = (v) => (typeof v === 'string' ? v.trim().slice(0, MAX_TEXT) : '');

// The stored wishlist → the items to send: ships by name, store items by id, each
// once, in your order. Anything else is left out. Pure.
export function wishItems(list) {
  const out = [];
  const seen = new Set();
  for (const e of Array.isArray(list) ? list : []) {
    let item = null;
    if (typeof e === 'string') {
      const name = text(e);
      if (name) item = { kind: 'ship', name };
    } else if (e && typeof e === 'object' && ITEM_KINDS.includes(e.kind)) {
      const id = text(e.id);
      const name = text(e.name);
      if (/^(sku|upgrade)-\d+$/.test(id) && name) {
        item = { kind: e.kind, id, name };
        if (e.kind === 'ccu') {
          const from = text(e.from);
          if (!from) continue;
          item.from = from;
          if (text(e.to)) item.to = text(e.to);
        }
      }
    }
    if (!item) continue;
    const key =
      item.kind === 'ship' ? `ship|${item.name.toLowerCase()}` : `${item.id}|${item.from || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

// Which connection a record belongs to: its connect time (the token never goes in
// storage twice).
const linkId = (link) => (link && Number.isFinite(link.connectedAt) ? link.connectedAt : null);

// Sends the wishlist when this connection hasn't yet. → 'done' | 'empty' | 'later' |
// 'waiting' | 'skip'. `store` is chrome.storage.local; `fetchFn` the network.
export async function importWishlist({ store, fetchFn, siteUrl, appVersion, now = Date.now() }) {
  const {
    siteLink: link,
    wishlist,
    wishImport,
  } = await store.get(['siteLink', 'wishlist', 'wishImport']);
  const id = linkId(link);
  if (!link?.token || id == null) return 'skip';
  if (wishImport?.link === id && wishImport.done) return 'skip';
  if (wishImport?.link === id && Number.isFinite(wishImport.retryAt) && now < wishImport.retryAt)
    return 'waiting';
  const items = wishItems(wishlist);
  if (!items.length) {
    await store.set({ wishImport: { link: id, done: now, sent: 0 } });
    return 'empty';
  }
  const res = await fetchFn(`${siteUrl}${IMPORT_PATH}`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${link.token}` },
    body: JSON.stringify({ v: 1, appVersion, items }),
  }).catch(() => null);
  if (res && res.ok) {
    await store.set({ wishImport: { link: id, done: now, sent: items.length } });
    return 'done';
  }
  // Not taken (yet): try again later, never in a loop.
  await store.set({ wishImport: { link: id, retryAt: now + RETRY_MS, status: res?.status ?? 0 } });
  return 'later';
}
