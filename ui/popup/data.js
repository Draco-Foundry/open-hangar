// What the toolbar popup shows, from what's stored in this browser. Pure, so it's
// tested directly (test/popup.test.js); ui/popup/Popup.svelte reads storage and
// draws it. The popup never asks RSI anything: the account value uses the ship prices
// the extension already has (OH.getShipIndex: the bundled list, plus the public ship
// list from openhangar.space, read at most once a day and bundled-only offline) and the
// last RSI account read (the `account` key) for Store Credit.

// The extension's own page in the connector build, where scans run and Connect lives.
export const HUB_PAGE = 'src/basic.html';

// The toolbar badge's rule (src/background.js updateReminder).
export const STALE_DAYS = 7;
// src/background.js counts a scan mark this old as a page that went away mid-scan, and
// a scan request as pending for a minute.
const SCAN_RUN_MAX = 10 * 60e3;
const SCAN_ASK_GAP = 60e3;

const time = (t) => {
  const ms = typeof t === 'number' ? t : typeof t === 'string' ? Date.parse(t) : NaN;
  return Number.isFinite(ms) ? ms : null;
};

// Open My Hangar: the website's My Hangar once this browser syncs there, else our
// hangar page, which shows the hangar this browser scanned with no account (Local
// Mode). null when this build has neither.
export function myHangarUrl({ link, siteUrl, hangarPage }) {
  if (link && siteUrl) return `${siteUrl}/hangar`;
  if (hangarPage) return `${hangarPage}/`;
  return null;
}

// A scan running in the extension's page, or asked for in the last minute
// (src/background.js scanRunning, without its open-tab check).
export function scanBusy({ scanRunning, scanRequest }, now = Date.now()) {
  if (Number.isFinite(scanRequest?.at) && now - scanRequest.at < SCAN_ASK_GAP) return true;
  return Number.isFinite(scanRunning?.at) && now - scanRunning.at < SCAN_RUN_MAX;
}

// Store Credit in dollars from the cached RSI account, or null.
export function storeCredit(account) {
  const c = account?.credits?.store?.value;
  return Number.isFinite(c) ? c / 100 : null;
}

// → { scannedAt, staleDays, items, melt, unpriced, handle, signedOut, connected, myHangar }.
// `syncWait` is OH.siteSyncWait: the website took a sync for this account moments ago
// (429, too soon), so the next one waits until connected.waitUntil.
// Under the value when some pledges have no price (no store price and no melt
// value): the owner's words (2026-10-12), singular for one.
export const unpricedLine = (n) =>
  `Not counted: ${n.toLocaleString('en-US')} ${n === 1 ? 'pledge' : 'pledges'} with no price.`;

export function popupView(
  { db, account, link, siteUrl, hangarPage },
  { now = Date.now(), totalValue, syncWait } = {},
) {
  const items = Array.isArray(db?.sources?.hangar?.items) ? db.sources.hangar.items : [];
  const scannedAt = time(db?.sources?.hangar?.scannedAt);
  const days = scannedAt == null ? null : Math.floor((now - scannedAt) / 86400000);
  return {
    scannedAt,
    staleDays: days != null && days >= STALE_DAYS ? days : null,
    items,
    melt: totalValue ? totalValue(items) : null,
    // Pledges with no melt value: left out of `melt`, and said so under it.
    unpriced: items.filter((p) => !Number.isFinite(p?.value)).length,
    handle:
      (account?.loggedIn && (account.displayname || account.nickname)) ||
      db?.owner?.displayname ||
      db?.owner?.nickname ||
      '',
    // Only a confirmed sign-out: an account read that failed (null) says nothing.
    signedOut: account?.loggedIn === false,
    connected: link
      ? {
          name: link.name || '',
          lastSync: time(link.lastSync),
          waitUntil: (syncWait && syncWait(link, { now })?.until) || null,
        }
      : null,
    myHangar: myHangarUrl({ link, siteUrl, hangarPage }),
  };
}
