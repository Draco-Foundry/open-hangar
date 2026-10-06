/*
 * background.js — service worker (Manifest V3).
 * ---------------------------------------------------------------------------
 * Thin. The action has no popup, so clicking the toolbar icon fires
 * action.onClicked here and we open the full-page hub (Home). The hub does the
 * scanning itself.
 *
 * Rescan reminder: when the last hangar scan is a week old, the toolbar icon
 * gets an amber "!" and a tooltip saying how old it is. Checked when the
 * browser starts, when the extension installs/updates, and whenever the stored
 * data changes (so a new scan clears it at once). No alarms permission needed.
 * Turned off with the Home page toggle (storage key `remindRescan`).
 *
 * Updates: the browser downloads new versions itself. If a dashboard tab is
 * open we don't yank it away mid-scan; we store `updateReady` and the
 * dashboard shows a "Reload to update" bar. With nothing open we apply it at
 * once. After an update, `justUpdated` lets the dashboard point at the
 * Updates page, and a Reload from the bar reopens the dashboard there
 * (`reopenAfterUpdate`, checked each time the worker starts).
 */

const STALE_DAYS = 7;

async function updateReminder() {
  const { db, remindRescan } = await chrome.storage.local.get(['db', 'remindRescan']);
  const at = db && db.sources && db.sources.hangar && db.sources.hangar.scannedAt;
  const days = at ? (Date.now() - at) / 86400000 : null;
  if (remindRescan !== false && days != null && days >= STALE_DAYS) {
    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setBadgeBackgroundColor({ color: '#d29922' });
    await chrome.action.setTitle({
      title: `Open Hangar: your hangar scan is ${Math.floor(days)} days old. Click to rescan.`,
    });
  } else {
    await chrome.action.setBadgeText({ text: '' });
    await chrome.action.setTitle({ title: 'Open Hangar' });
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  console.debug('[OpenHangar] installed:', details.reason);
  updateReminder();
  if (details.reason !== 'update') return;
  const to = chrome.runtime.getManifest().version;
  await chrome.storage.local.remove('updateReady');
  if (details.previousVersion && details.previousVersion !== to) {
    await chrome.storage.local.set({ justUpdated: { from: details.previousVersion, to } });
  }
});

// The dashboard's "Reload to update" button sets `reopenAfterUpdate` and
// reloads; this runs when the (new) worker starts and brings the tab back.
chrome.storage.local.get('reopenAfterUpdate').then(({ reopenAfterUpdate }) => {
  if (!reopenAfterUpdate) return;
  chrome.storage.local.remove(['reopenAfterUpdate', 'updateReady']);
  chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard.html#updates') });
});

// Is a dashboard (or any extension tab) open right now?
async function dashboardOpen() {
  try {
    if (chrome.runtime.getContexts) {
      return (await chrome.runtime.getContexts({ contextTypes: ['TAB'] })).length > 0;
    }
    if (chrome.extension && chrome.extension.getViews) {
      return chrome.extension.getViews({ type: 'tab' }).length > 0;
    }
  } catch {
    /* unknown: play safe and wait */
  }
  return true;
}

chrome.runtime.onUpdateAvailable?.addListener(async (details) => {
  if (await dashboardOpen()) chrome.storage.local.set({ updateReady: details.version });
  else chrome.runtime.reload();
});
chrome.runtime.onStartup.addListener(updateReminder);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.db || changes.remindRescan)) updateReminder();
});

// Clicking the toolbar icon opens the hub home page in a tab.
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard.html') });
  updateReminder();
});

// --- Messages from our website -------------------------------------------------------
// Which pages may talk to the extension is set in one place, the manifest's
// externally_connectable (added by scripts/pack.mjs for Chrome and Edge; Firefox
// doesn't let web pages reach extensions). Each message type has a handler here.
const siteHandlers = {};
function siteOrigins() {
  const m = chrome.runtime.getManifest().externally_connectable;
  // "https://host/*" → "https://host"
  return ((m && m.matches) || [])
    .map((p) => (/^(https:\/\/[^/*]+)\//.exec(p) || [])[1])
    .filter(Boolean);
}
siteHandlers['oh-hello'] = () => ({ ok: true, cart: true, connect: false });

// Add to RSI Cart from the website's store (#288), in every build: no account
// needed. The upgrade goes into the RSI cart in this browser's own RSI session
// (src/rsi-cart.js); the page gets back your ships that can upgrade, RSI's prices,
// the other ships RSI takes for it (Any Ship) and whether it worked. Nothing is
// bought, and an add is never retried.
//   oh-upgrade-options { toShipId, toSkuId, skus? }     → { ok, options, others, toSkuId }
//   oh-upgrade-price   { fromShipId, toSkuId }          → { ok, price }
// skus: every edition on offer, cheapest first. RSI sells no upgrade to some
// editions (the C8X's BIS Warbond), so the others are tried in turn and the one
// that worked comes back as toSkuId, for the price and the add (website #329).
//   oh-add-upgrade     { fromShipId, toShipId, toSkuId } → { ok } | { ok: false, error }
if (typeof importScripts === 'function' && !self.OHCart) importScripts('rsi-cart.js');
const cartLane = () => self.OHCart;
const SITE_SKUS = 6; // editions tried at most: a few asks to RSI, never a burst
const siteSkus = (v) =>
  Array.isArray(v) ? v.filter((x) => Number.isInteger(x) && x > 0).slice(0, SITE_SKUS) : [];
siteHandlers['oh-upgrade-options'] = (m) =>
  cartLane().upgradeOptions(m.toShipId, m.toSkuId, { priceLimit: 4, skus: siteSkus(m.skus) });
siteHandlers['oh-upgrade-price'] = (m) =>
  cartLane().upgradePrice(m.fromShipId, m.toSkuId, { toShipId: m.toShipId, setContext: true });
siteHandlers['oh-add-upgrade'] = (m) =>
  cartLane().addUpgradeToCart(m.fromShipId, m.toShipId, m.toSkuId);

// @sync-start: cut from store builds until sync launches (scripts/pack.mjs, #187)
// Connect from the website (Chrome and Edge, owner 2026-10-04). The website's Connect
// page (openhangar.space's /link) asks whether Open Hangar is installed here; only
// our own site can talk to the extension (externally_connectable, added by
// scripts/pack.mjs to builds with sync). Connect This Browser there:
//   oh-connect-begin  → a PKCE pair; the challenge and this extension's redirect
//                       address go to the page, the verifier stays here
//   oh-connect-finish → the page's one-time code, traded for the sync token with the
//                       verifier; then the dashboard opens on Home (and syncs, if
//                       Sync My Hangar Now was ticked)
const SITE_ORIGINS = ['https://app.openhangar.space', 'https://staging.openhangar.space'];
const b64url = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

siteHandlers['oh-connect-begin'] = async (msg, origin) => {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const redirect = `https://${chrome.runtime.id}.chromiumapp.org/`;
  await chrome.storage.session.set({
    siteConnect: { verifier, origin, redirect, at: Date.now() },
  });
  return { ok: true, challenge: b64url(new Uint8Array(digest)), redirect_uri: redirect };
};
siteHandlers['oh-connect-finish'] = async (msg, origin) => {
  const { siteConnect: p } = await chrome.storage.session.get('siteConnect');
  await chrome.storage.session.remove('siteConnect');
  if (!p || p.origin !== origin || Date.now() - p.at > 5 * 60e3)
    return { ok: false, error: 'That connect attempt drifted past its window. Try again.' };
  const res = await fetch(`${origin}/api/link/token`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      code: String(msg.code || ''),
      code_verifier: p.verifier,
      redirect_uri: p.redirect,
    }),
  }).catch(() => null);
  if (!res || !res.ok) return { ok: false, error: "That didn't dock. Try again." };
  const j = await res.json();
  await chrome.storage.local.set({
    siteLink: { token: j.token, name: j.name || '', connectedAt: Date.now(), lastSync: null },
    siteUrl: origin, // sync goes to the site you connected on
    ...(msg.sync ? { siteSyncRequested: Date.now() } : {}),
  });
  chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard.html#home') });
  return { ok: true, name: j.name || '' };
};
// Connecting needs the sync site itself, not just any page the manifest lets in;
// the website's Connect page asks `connect` before it offers the button.
siteHandlers['oh-hello'] = (msg, origin) => ({
  ok: true,
  cart: true,
  connect: SITE_ORIGINS.includes(origin),
});
for (const t of ['oh-connect-begin', 'oh-connect-finish']) {
  const run = siteHandlers[t];
  siteHandlers[t] = (msg, origin) =>
    SITE_ORIGINS.includes(origin) ? run(msg, origin) : { ok: false, error: 'unknown request' };
}
// @sync-end

// The website's messages, all of them: only from the pages the manifest's
// externally_connectable lets in (our own site, Chrome and Edge; scripts/pack.mjs).
chrome.runtime.onMessageExternal?.addListener((msg, sender, reply) => {
  if (!siteOrigins().includes(sender.origin)) return false;
  const handler = siteHandlers[msg?.type];
  Promise.resolve(
    handler ? handler(msg, sender.origin) : { ok: false, error: 'unknown request' },
  ).then(reply, (err) => reply({ ok: false, error: String(err?.message || err) }));
  return true; // answers later
});
