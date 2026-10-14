// The Wishlist tab's list: the account's Wishlist keys the store alerts read
// (src/alerts.js freshWish, kept in `alertsWish`), read only. The popup asks the website
// nothing itself: the privacy policy lets the extension read the Wishlist only while
// store alerts are on, and the alerts' own check reads it then, politely (its backoff,
// Retry-After, and what a 401 or 404 means). Named in ./data.js wishRows.
import { shipSlug } from './data.js';

// → { off: true } (alerts off, not connected, or a build without alerts), { pending:
// true } (alerts on, not read yet for this connection), { failed: true } (the last read
// didn't go through and nothing is kept), or { keys }. Never throws.
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
