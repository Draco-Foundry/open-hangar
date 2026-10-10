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

// Build flags (src/flags.js) as self.OH.flags. Firefox's event page loads the file
// itself, listed first in its manifest (scripts/pack.mjs).
if (typeof importScripts === 'function' && !self.OH?.flags) importScripts('flags.js');
// The sync payload's schema and the shared shaping of the stored hangar (#441,
// src/hangar-shape.js: self.OHShape), the same code the dashboard's backup and sync
// use. Firefox's event page lists them in its manifest too.
if (typeof importScripts === 'function' && !self.OHShape)
  importScripts('schema-check.js', 'sync-schema.js', 'hangar-shape.js');

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
  // Caches of RSI news, which Home no longer shows (0.3.0): drop them.
  await chrome.storage.local.remove(['rsiNews', 'twisc2']);
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
// Bridge v2. Which of our pages may talk to the extension, and what each may ask, is
// src/site-pages.js (self.OHPages): its lists are written per build by
// scripts/pack.mjs from the same values as the manifest's, externally_connectable on
// Chrome and Edge, and on Firefox (which doesn't let web pages reach extensions) the
// matches of src/site-bridge.js, a content script that passes our own pages' messages
// here (#434). Every message is checked there before its handler runs, and a request
// a page may not ask gets the same answer as one that doesn't exist.
if (typeof importScripts === 'function' && !self.OHPages) importScripts('site-pages.js');
const siteHandlers = {};
const handles = (type) => Object.hasOwn(siteHandlers, type);

// Hello, the version handshake: what this page may ask in this build (a build's flags
// cut handlers, and what's cut is never offered). cart and connect stay for the
// website's pages from before v2, which read an answer without `v` as v1.
siteHandlers['oh-hello'] = (msg, origin) => {
  const caps = self.OHPages.capsFor(origin, handles);
  return {
    ok: true,
    v: 2,
    version: chrome.runtime.getManifest().version,
    caps,
    cart: caps.includes('addToCart'),
    connect: caps.includes('connect'),
  };
};

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

// @sync-start: the `sync` build flag's code, in every store build (src/flags.js, #187)
// Connect from the website (Chrome and Edge, owner 2026-10-04). The website's Connect
// page (openhangar.space's /link) asks whether Open Hangar is installed here; only
// our own site can talk to the extension. Connect This Browser there:
//   oh-connect-begin  → a PKCE pair; the challenge and this extension's redirect
//                       address go to the page, the verifier stays here
//   oh-connect-finish → the page's one-time code, traded for the sync token with the
//                       verifier; then the dashboard opens on Home (and syncs, if
//                       Sync My Hangar Now was ticked)
// Only the pages in src/site-pages.js's `connect` list may ask (the app, never the
// public front page), so a build that leaves staging out (npm run build:beta) can't
// connect there either.
const b64url = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

// Firefox asks before an extension sends anything off the device (the Firefox
// manifest's optional data collection, scripts/pack.mjs), and only from a click in
// the extension. So the first Connect from the website opens Home with Firefox's
// card already up (src/dashboard.js siteAskFirefox): its Continue is that click.
const SITE_DATA = {
  data_collection: ['personallyIdentifyingInfo', 'financialAndPaymentInfo', 'websiteContent'],
};
const firefoxNeedsOk = async () =>
  !!chrome.runtime.getManifest().browser_specific_settings?.gecko &&
  !(await chrome.permissions.contains(SITE_DATA).catch(() => false));
// This extension's sign-in address: chromiumapp.org on Chrome and Edge,
// extensions.allizom.org on Firefox (the website checks it, lib/connect.ts). Firefox
// for Android has no identity API, so there it's worked out the way desktop Firefox
// does it (the SHA-1 of the add-on id, in hex). Nothing ever opens it here: the code
// comes back in oh-connect-finish. '' when there's none (then no Connect from the site).
async function connectRedirect() {
  if (chrome.identity?.getRedirectURL) return chrome.identity.getRedirectURL();
  if (!chrome.runtime.getManifest().browser_specific_settings?.gecko) return '';
  const d = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(chrome.runtime.id));
  const hex = [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `https://${hex}.extensions.allizom.org/`;
}
siteHandlers['oh-connect-begin'] = async (msg, origin) => {
  if (await firefoxNeedsOk()) {
    await chrome.storage.session.set({ siteAskFirefox: Date.now() });
    chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard.html#home') });
    return { ok: false, firefoxAsk: true };
  }
  const redirect = await connectRedirect();
  if (!redirect) return { ok: false, error: 'Connect from Open Hangar itself here.' };
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
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
// @sync-end

// @flag-start localMode: our own hangar page (Local Mode; needs sync, scripts/pack.mjs)
// hangar.openhangar.space shows the hangar this browser scanned, with no account.
// Only the hangar pages may ask these (src/site-pages.js):
//   oh-get-hangar   → { ok, hangar } | { ok: false, error: 'no-scan' | 'needs-upgrade'
//                     | 'schema' (+ path) | 'firefox-ask' }
//   oh-scan-status  → { ok, scannedAt: { hangar, buybacks }, running, stale }
//   oh-request-scan → { ok, opened: true } | { ok: false, error: 'busy' }
// The hangar is the stored shape, what the website keeps for a synced hangar, built by
// the backup file's and sync's own shaping (src/hangar-shape.js readHangarView): never
// the sync token, the site address, cookies, settings, the referral code or the
// prospects list. It's checked against the sync schema and the never-sent keys before
// it goes, and one that fails is never handed out. On Firefox the answer reaches the
// page through the window (src/site-bridge.js), where any script on that page could
// read it: the hangar page's strict script policy (no script but its own) is what
// keeps it there.
const DASHBOARD = 'src/dashboard.html';
// A scan-running marker older than this is a page that went away mid-scan
// (src/dashboard.js scanMark refreshes it every minute while a scan runs).
const SCAN_RUN_MAX = 10 * 60e3;
// One scan request a minute at most, and none while a scan runs.
const SCAN_ASK_GAP = 60e3;
let scanAskedAt = 0;

// The dashboard tab to use: an open one, brought to the front, or a new one (with
// `hash`). → its tab id, or null.
async function dashboardTab(hash = '') {
  const url = chrome.runtime.getURL(DASHBOARD);
  try {
    const tabs = chrome.runtime.getContexts
      ? await chrome.runtime.getContexts({ contextTypes: ['TAB'] })
      : [];
    const open = tabs.find((c) => c.tabId >= 0 && String(c.documentUrl || '').startsWith(url));
    if (open) {
      await chrome.tabs.update(open.tabId, { active: true });
      if (chrome.windows?.update)
        await chrome.windows.update(open.windowId, { focused: true }).catch(() => {});
      return open.tabId;
    }
  } catch {
    /* can't tell what's open: a new tab */
  }
  const tab = await chrome.tabs.create({ url: url + hash });
  return tab?.id ?? null;
}

// A scan running in a dashboard right now (src/dashboard.js scanMark).
async function scanRunning() {
  const { scanRunning: at } = await chrome.storage.session.get('scanRunning');
  return Number.isFinite(at) && Date.now() - at < SCAN_RUN_MAX;
}

siteHandlers['oh-get-hangar'] = async () => {
  // Handing the hangar to a web page shares it, so Firefox asks first: the same yes
  // Connect needs. Until then Home opens with Firefox's card up (src/dashboard.js
  // refreshSite, localAskFirefox), at most once a minute so a page asking again
  // doesn't stack tabs.
  if (await firefoxNeedsOk()) {
    const { localAskedAt: at } = await chrome.storage.session.get('localAskedAt');
    if (!(Number.isFinite(at) && Date.now() - at < 60e3)) {
      const now = Date.now();
      await chrome.storage.session.set({ localAskedAt: now, localAskFirefox: now });
      await dashboardTab('#home');
    }
    return { ok: false, error: 'firefox-ask' };
  }
  const r = await self.OHShape.readHangarView((keys) => chrome.storage.local.get(keys), {
    appVersion: chrome.runtime.getManifest().version,
  });
  if (r.ok) return { ok: true, hangar: r.hangar };
  return r.path ? { ok: false, error: r.error, path: r.path } : { ok: false, error: r.error };
};

siteHandlers['oh-scan-status'] = async () => {
  const { db } = await chrome.storage.local.get('db');
  const at = (id) => {
    const t = db?.sources?.[id]?.scannedAt;
    const ms = typeof t === 'number' ? t : typeof t === 'string' ? Date.parse(t) : NaN;
    return Number.isFinite(ms) ? ms : null;
  };
  const hangar = at('hangar');
  return {
    ok: true,
    scannedAt: { hangar, buybacks: at('buybacks') },
    running: await scanRunning(),
    // The toolbar badge's rule (updateReminder).
    stale: hangar != null && Date.now() - hangar >= STALE_DAYS * 86400000,
  };
};

// The dashboard runs the scan, the same one its Scan button runs, in its own tab: this
// worker never scans and never asks RSI anything for it. The request names the tab
// (src/dashboard.js scanIfAsked), so only that one scans.
siteHandlers['oh-request-scan'] = async () => {
  const now = Date.now();
  // Checked and set before any wait, so two requests at once can't both pass; kept in
  // session storage too, for a worker that stopped and started again in between.
  if (now - scanAskedAt < SCAN_ASK_GAP) return { ok: false, error: 'busy' };
  const held = scanAskedAt;
  scanAskedAt = now;
  const { scanAskedAt: before } = await chrome.storage.session.get('scanAskedAt');
  if ((Number.isFinite(before) && now - before < SCAN_ASK_GAP) || (await scanRunning())) {
    scanAskedAt = held; // refused, so it doesn't count as a request
    return { ok: false, error: 'busy' };
  }
  await chrome.storage.session.set({ scanAskedAt: now });
  const tabId = await dashboardTab();
  await chrome.storage.session.set({ scanRequest: { at: Date.now(), tabId } });
  return { ok: true, opened: true };
};
// @flag-end localMode

// The website's messages, all of them: only from our own pages (src/site-pages.js),
// each checked before its handler runs.
function answerSite(msg, origin, reply) {
  const v = self.OHPages.vet(msg, origin, handles);
  new Promise((done) =>
    done(v.type ? siteHandlers[v.type](msg, origin) : { ok: false, error: v.error }),
  ).then(reply, (err) => reply({ ok: false, error: String(err?.message || err) }));
  return true; // answers later
}
// Chrome and Edge: straight from the page; the browser says which page it is (our
// externally_connectable names no other extension, so none can call). Firefox has no
// externally_connectable: there this event carries other add-ons' messages, never a
// page's, so the Firefox build doesn't listen to it at all.
if (!chrome.runtime.getManifest().browser_specific_settings?.gecko)
  chrome.runtime.onMessageExternal?.addListener((msg, sender, reply) => {
    if (!self.OHPages.known(sender.origin)) return false;
    return answerSite(msg, sender.origin, reply);
  });
// Firefox: through src/site-bridge.js, our own content script, in the top frame of a
// tab on one of our pages. The browser says which page it ran in (sender.url), never
// the page itself.
chrome.runtime.onMessage?.addListener((msg, sender, reply) => {
  if (!msg || typeof msg !== 'object' || !('ohSite' in msg)) return false;
  if (sender.id !== chrome.runtime.id || !sender.tab || sender.frameId !== 0 || !sender.url)
    return false;
  let origin = '';
  try {
    origin = new URL(sender.url).origin;
  } catch {
    return false;
  }
  if (!self.OHPages.known(origin)) return false;
  return answerSite(msg.ohSite, origin, reply);
});
