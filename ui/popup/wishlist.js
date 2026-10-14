// The Wishlist tab's list: the account's Wishlist keys, read with the sync token from
// the website's Wishlist read (GET /api/v1/wishlist, src/alerts.js WISH_PATH), read only,
// nothing sent back. Named from the sale feed the store alerts keep (wishRows in
// ./data.js). Polite (docs/dev/requests.md): the keys the store alerts read in the last
// half hour are used as they are, and the popup's own read is kept for ten minutes in
// session storage, so opening the tab again asks nothing.
const ALERTS_FRESH = 30 * 60e3;
const OWN_FRESH = 10 * 60e3;
const TIMEOUT = 10e3;
const SITE_DATA = {
  data_collection: ['personallyIdentifyingInfo', 'financialAndPaymentInfo', 'websiteContent'],
};

// → { keys } or { error: true }; never throws.
export async function readWishlist({ now = Date.now(), fetchFn = fetch } = {}) {
  const AL = globalThis.OHAlerts;
  const OH = globalThis.OH;
  if (!AL || !OH) return { error: true };
  const got = await chrome.storage.local.get(['siteLink', AL.WISH_KEY]);
  const link = got.siteLink;
  if (!link?.token) return { error: true };
  const kept = got[AL.WISH_KEY];
  if (
    kept?.connectedAt === link.connectedAt &&
    Array.isArray(kept.keys) &&
    Number.isFinite(kept.at) &&
    now - kept.at < ALERTS_FRESH
  )
    return { keys: AL.readWish({ v: 1, keys: kept.keys }) || [] };
  const session = chrome.storage.session;
  const own = session ? (await session.get('popupWish')).popupWish : null;
  if (own?.connectedAt === link.connectedAt && Number.isFinite(own.at) && now - own.at < OWN_FRESH)
    return { keys: own.keys };
  // Firefox's yes before the sync token goes to the website (sync's own).
  const gecko = !!chrome.runtime.getManifest().browser_specific_settings?.gecko;
  if (gecko && !(await chrome.permissions.contains(SITE_DATA).catch(() => false)))
    return { error: true };
  try {
    const res = await fetchFn((await OH.siteUrl()) + AL.WISH_PATH, {
      credentials: 'omit',
      headers: { Accept: 'application/json', Authorization: `Bearer ${link.token}` },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const keys = res.ok ? AL.readWish(await res.json().catch(() => null)) : null;
    if (!keys) return { error: true };
    await session?.set({ popupWish: { keys, at: now, connectedAt: link.connectedAt } });
    return { keys };
  } catch {
    return { error: true };
  }
}
