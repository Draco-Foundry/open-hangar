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

// The extension's own page: the dashboard, or in the connector build (src/flags.js
// `connector`) the basic page, src/basic.html. `dash` is the dashboard's view to open
// (#home, #updates); the basic page has its settings for what #home is opened for
// (Connect, Firefox's ask) and its lists for the rest.
const HUB_PAGE = self.OH.flags.connector ? 'src/basic.html' : 'src/dashboard.html';
const hubUrl = (dash = '') =>
  chrome.runtime.getURL(
    HUB_PAGE + (self.OH.flags.connector ? (dash === '#home' ? '#settings' : '') : dash),
  );

// Where a scan runs (src/scan-host.js): the hidden scan page, in the connector build.
// Without it (or in a browser with no hidden page) a scan runs in the extension's tab.
let scanHost = null;
// @flag-start connector: scans run in a hidden page, no tab (src/scan-host.js)
// Chrome and Edge: an offscreen document; Firefox: a frame in this event page. The
// page's messages (its storage on Chrome and Edge, Firefox's pings, done) are answered
// here, only for it. Done, its marks go, and an update that waited for it comes in.
if (typeof importScripts === 'function' && !self.OHScanHost) importScripts('scan-host.js');
scanHost = self.OHScanHost.create({
  chrome,
  document: typeof document === 'undefined' ? null : document,
  afterDone: () => updateIfIdle(),
});
chrome.runtime.onMessage.addListener(scanHost.heard);
// @flag-end connector

async function updateReminder() {
  // @flag-start alerts: store alerts waiting take the badge (src/alerts.js)
  const AL = self.OHAlerts;
  const got = await chrome.storage.local.get([AL.ON_KEY, AL.STATE_KEY]);
  const alert = AL.badgeFor(got[AL.ON_KEY], got[AL.STATE_KEY]);
  if (alert) {
    await chrome.action.setBadgeText({ text: alert.text });
    await chrome.action.setBadgeBackgroundColor({ color: '#3b6aed' });
    await chrome.action.setTitle({ title: alert.title });
    return;
  }
  // @flag-end alerts
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
  chrome.tabs.create({ url: hubUrl('#updates') });
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

// An update waits for an open dashboard tab, and for a scan in the hidden page (the
// page and its pack reads, src/scan-host.js); that one lets it in once it's done.
chrome.runtime.onUpdateAvailable?.addListener(async (details) => {
  if ((await dashboardOpen()) || (await scanHost?.busy()))
    chrome.storage.local.set({ updateReady: details.version });
  else chrome.runtime.reload();
});
async function updateIfIdle() {
  const { updateReady } = await chrome.storage.local.get('updateReady');
  if (updateReady && !(await dashboardOpen()) && !(await scanHost?.busy())) chrome.runtime.reload();
}
chrome.runtime.onStartup.addListener(updateReminder);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.db || changes.remindRescan)) updateReminder();
});

// Clicking the toolbar icon opens the hub home page in a tab.
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: hubUrl() });
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
// website's pages from before v2, which read an answer without `v` as v1. buyback:
// Add to RSI Cart takes a buy-back upgrade too (pledgeId on its price and add).
siteHandlers['oh-hello'] = (msg, origin) => {
  const caps = self.OHPages.capsFor(origin, handles);
  return {
    ok: true,
    v: 2,
    version: chrome.runtime.getManifest().version,
    caps,
    cart: caps.includes('addToCart'),
    buyback: caps.includes('addToCart'),
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
// pledgeId (optional, price and add): a buy-back upgrade, priced and added in RSI's
// buy-back mode for that pledge; RSI's cart takes it alone. Without it, a new upgrade.
// A refused add can carry rsiSays: RSI's own short message, trimmed and with anything
// that looks like account data taken out, for the page to show as RSI's words. error
// is 'cart-conflict' only when that message names a buy-back, and 'signed-out' comes
// back before anything is asked of RSI when this browser holds no RSI session.
// Where its requests go and what they ask: the parser rules (src/parser-rules.js, which
// needs schema-check.js from above), loaded first. Firefox lists them in its manifest.
if (typeof importScripts === 'function' && !self.OHRules)
  importScripts('parser-rules-data.js', 'parser-rules.js');
if (typeof importScripts === 'function' && !self.OHCart) importScripts('rsi-cart.js');
const cartLane = () => self.OHCart;
const SITE_SKUS = 6; // editions tried at most: a few asks to RSI, never a burst
const siteSkus = (v) =>
  Array.isArray(v) ? v.filter((x) => Number.isInteger(x) && x > 0).slice(0, SITE_SKUS) : [];
siteHandlers['oh-upgrade-options'] = (m) =>
  cartLane().upgradeOptions(m.toShipId, m.toSkuId, { priceLimit: 4, skus: siteSkus(m.skus) });
const pledgeOf = (m) => (m.pledgeId ? { pledgeId: m.pledgeId } : {});
siteHandlers['oh-upgrade-price'] = (m) =>
  cartLane().upgradePrice(m.fromShipId, m.toSkuId, {
    toShipId: m.toShipId,
    setContext: true,
    ...pledgeOf(m),
  });
siteHandlers['oh-add-upgrade'] = (m) =>
  cartLane().addUpgradeToCart(m.fromShipId, m.toShipId, m.toSkuId, pledgeOf(m));
// The Store's Haul (#635): its store items into the RSI cart in one request, the same
// lane, never retried. Nothing is bought.
//   oh-add-items { items: [{ skuId, qty }] } → { ok, count, added, rsiSays? }
//                                             | { ok: false, error, reason?, rsiSays? }
// added: the SKU ids RSI says it added; the page compares them with what it sent.
siteHandlers['oh-add-items'] = (m) => cartLane().addItemsToCart(m.items);

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
    chrome.tabs.create({ url: hubUrl('#home') });
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
  // An Open Hangar tab already open comes to the front instead of a second one (#658):
  // a scan running there keeps going, and the sync waits for it.
  await dashboardTab('#home');
  return { ok: true, name: j.name || '' };
};
// Connect with a code (src/dashboard.js siteConnect, when the sign-in window can't
// open): the dashboard opens the website's code page with its code in the address, and
// keeps that code here while it waits (siteLinkPending, session storage). The page
// fills a code in only when it's this one:
//   oh-link-check { code } → { ok: true, mine }: true only for the code this extension
//   is waiting for, from the site it asked, before it runs out. The code never leaves.
const linkCode = (s) =>
  String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
siteHandlers['oh-link-check'] = async (msg, origin) => {
  const { siteLinkPending: p } = await chrome.storage.session.get('siteLinkPending');
  const mine =
    !!p &&
    p.origin === origin &&
    Number.isFinite(p.until) &&
    Date.now() < p.until &&
    linkCode(p.code).length > 0 &&
    linkCode(p.code) === linkCode(msg.code);
  return { ok: true, mine };
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
// A scan-running marker older than this is a page that went away mid-scan
// (src/dashboard.js scanMark refreshes it every minute while a scan runs).
const SCAN_RUN_MAX = 10 * 60e3;
// One scan request a minute at most, and none while a scan runs.
const SCAN_ASK_GAP = 60e3;
let scanAskedAt = 0;
// One Firefox ask for the hangar page a minute at most.
const FIREFOX_ASK_GAP = 60e3;
let firefoxAskedAt = 0;

// The open dashboard tabs ({ tabId, windowId }), or null when this browser can't tell.
async function dashboardTabs() {
  if (!chrome.runtime.getContexts) return null;
  const url = chrome.runtime.getURL(HUB_PAGE);
  try {
    const tabs = await chrome.runtime.getContexts({ contextTypes: ['TAB'] });
    return tabs.filter((c) => c.tabId >= 0 && String(c.documentUrl || '').startsWith(url));
  } catch {
    return null;
  }
}

// The dashboard tab to use: an open one, brought to the front, or a new one (with
// `hash`). → its tab id, or null.
async function dashboardTab(hash = '') {
  const open = (await dashboardTabs())?.[0];
  if (open) {
    try {
      await chrome.tabs.update(open.tabId, { active: true });
      if (chrome.windows?.update)
        await chrome.windows.update(open.windowId, { focused: true }).catch(() => {});
      return open.tabId;
    } catch {
      /* it closed just now: a new tab */
    }
  }
  const tab = await chrome.tabs.create({ url: hubUrl(hash) });
  return tab?.id ?? null;
}

// A scan running in a dashboard or the hidden scan page right now (its scanRunning
// mark), or one asked for in the last minute that its page hasn't started yet (it takes
// the request once the scan has begun, or drops it). A mark counts only while its tab
// or hidden page is still open, as far as this browser can tell, and for 10 minutes at
// most.
const hiddenBy = (by) => by === 'offscreen' || by === 'frame';
async function scanRunning() {
  const { scanRunning: mark, scanRequest: asked } = await chrome.storage.session.get([
    'scanRunning',
    'scanRequest',
  ]);
  const now = Date.now();
  if (Number.isFinite(asked?.at) && now - asked.at < SCAN_ASK_GAP) return true;
  if (!(Number.isFinite(mark?.at) && now - mark.at < SCAN_RUN_MAX)) return false;
  if (hiddenBy(mark.by)) return scanHost ? scanHost.alive(mark) : true;
  const tabs = await dashboardTabs();
  return !tabs || !Number.isInteger(mark.tabId) || tabs.some((c) => c.tabId === mark.tabId);
}

siteHandlers['oh-get-hangar'] = async () => {
  // Handing the hangar to a web page shares it, so Firefox asks first: the same yes
  // Connect needs. Until then Home opens with Firefox's card up, in the tab the ask
  // names (localAskFirefox, src/dashboard.js refreshSite). At most once a minute, so a
  // page asking again doesn't stack tabs: checked and set before any other wait, so
  // two asks at once can't both pass, and kept in session storage too, for a worker
  // that stopped and started again in between.
  if (await firefoxNeedsOk()) {
    const now = Date.now();
    if (now - firefoxAskedAt >= FIREFOX_ASK_GAP) {
      const held = firefoxAskedAt;
      firefoxAskedAt = now;
      const { localAskedAt: before } = await chrome.storage.session.get('localAskedAt');
      if (Number.isFinite(before) && now - before < FIREFOX_ASK_GAP) {
        firefoxAskedAt = held; // not asked now, so it doesn't count
      } else {
        await chrome.storage.session.set({ localAskedAt: now });
        const tabId = await dashboardTab('#home');
        await chrome.storage.session.set({ localAskFirefox: { at: now, tabId } });
      }
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

// A page runs the scan, never this worker, which never asks RSI anything for it: in the
// connector build the hidden scan page (src/scan-host.js, no tab), else the dashboard,
// the same scan its Scan button runs, in its own tab. The request names the page (its
// run, or its tab: src/dashboard.js scanIfAsked), so only that one scans. Our hangar
// page asks for it ('site'), and the toolbar popup in the connector build (below,
// 'popup'): the request says which, for the scan's report (ui/scan/runner.js
// scanReport.reason). → { ok, opened: true } for a tab, { ok, opened: false, by } for
// the hidden page, or { ok: false, error: 'busy' }.
async function requestScan(reason) {
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
  const hidden = await scanHost?.start(reason);
  await chrome.storage.session.set({ scanAskedBy: hidden ? hidden.by : 'tab' });
  if (hidden) return { ok: true, opened: false, by: hidden.by };
  const tabId = await dashboardTab();
  await chrome.storage.session.set({
    scanRequest: { at: Date.now(), tabId, reason, by: 'tab' },
  });
  return { ok: true, opened: true };
}
// The website's answer stays { ok, opened: true } wherever the scan runs (bridge v2,
// coordinated with the server repo).
siteHandlers['oh-request-scan'] = async () => {
  const r = await requestScan('site');
  return r.ok ? { ok: true, opened: true } : r;
};
// Busy: the tab that scans comes to the front. A scan in the hidden page has none, so
// nothing opens for it.
async function showScan() {
  const s = await chrome.storage.session.get(['scanRunning', 'scanRequest', 'scanAskedBy']);
  const now = Date.now();
  const fresh = (x, max) => Number.isFinite(x?.at) && now - x.at < max;
  const by =
    (fresh(s.scanRunning, SCAN_RUN_MAX) && s.scanRunning.by) ||
    (fresh(s.scanRequest, SCAN_ASK_GAP) && s.scanRequest.by) ||
    s.scanAskedBy;
  if (!hiddenBy(by)) await dashboardTab();
}
// @flag-end localMode

// @flag-start connector: the toolbar popup (needs localMode, scripts/pack.mjs)
// In the connector build the toolbar icon opens src/popup.html. Its Scan asks here,
// and gets the same scan our hangar page asks for (requestScan): in the hidden scan
// page, so the popup stays open and shows it from the scan's marks, or in the basic
// page's tab, which comes to the front and runs it. While a scan runs in a tab, or a
// minute after one was asked of it, that tab still comes to the front, so the popup's
// Scan is never a dead click.
//   { ohPopup: 'scan' } → { ok, opened: true } (a tab) | { ok, opened: false, by }
//                         (the hidden page) | { ok: false, error: 'busy' }
const POPUP = 'src/popup.html';
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || typeof msg !== 'object' || msg.ohPopup !== 'scan') return false;
  // Only our own popup: an extension page, not a tab, at exactly its address.
  if (sender.id !== chrome.runtime.id || sender.tab) return false;
  if (String(sender.url || '').split(/[?#]/)[0] !== chrome.runtime.getURL(POPUP)) return false;
  requestScan('popup')
    .then(async (r) => {
      if (!r.ok) await showScan();
      return r;
    })
    .then(reply, (err) => reply({ ok: false, error: String(err?.message || err) }));
  return true; // answers later
});
// @flag-end connector

// @flag-start alerts: Extension Alerts (needs connector, scripts/pack.mjs)
// Store alerts (src/alerts.js, self.OHAlerts), off until the pilot turns them on in the
// basic page's settings (`alertsOn`). A check runs on an alarm (the `alarms`
// permission, no install warning) at most every 30 minutes: it downloads the public
// sale feed and, while this browser is connected, the account's Wishlist keys, and
// matches them here against this browser's scan, which never leaves it. Unseen matches
// take the toolbar badge (updateReminder); a new one gets a notification while
// Notifications are allowed (an optional permission the settings switch asks for).
//   { ohPopup: 'alerts-seen' } → { ok }: the popup is open, every match is seen
if (typeof importScripts === 'function' && !self.OHAlerts) importScripts('alerts.js');
const NOTIFY = { permissions: ['notifications'] };
const notifyOk = async () =>
  !!chrome.notifications && (await chrome.permissions.contains(NOTIFY).catch(() => false));
const alertsEnv = {
  get: (k) => chrome.storage.local.get(k),
  set: (o) => chrome.storage.local.set(o),
  remove: (k) => chrome.storage.local.remove(k),
  fetch: (url, init) => fetch(url, init),
  now: () => Date.now(),
  rand: () => Math.random(),
  // Firefox's data yes (sync's) before the sync token goes to the website.
  mayShare: async () => !(await firefoxNeedsOk()),
  badge: () => updateReminder(),
  schedule: (when) => chrome.alarms.create(self.OHAlerts.ALARM, { when }),
  notify: async (notes) => {
    if (!(await notifyOk())) return;
    for (const n of notes)
      await chrome.notifications
        .create(n.id, {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon128.png'),
          title: n.title,
          message: n.message,
        })
        .catch(() => {});
  },
};
// One check at a time. Asked again while one runs (a scan saved, say): once it's done,
// one more from what's saved (asking nothing), or with the network if that's what was
// asked.
let alertsRun = null;
let alertsAgain = null;
function alertsCheck(o = {}) {
  if (alertsRun) {
    alertsAgain = { network: !!(alertsAgain?.network || o.network !== false) };
    return alertsRun;
  }
  alertsRun = self.OHAlerts.check(alertsEnv, o)
    .catch((e) => console.warn('[OpenHangar] alerts:', e?.message || e))
    .finally(() => {
      alertsRun = null;
      const next = alertsAgain;
      alertsAgain = null;
      if (next) alertsCheck(next);
    });
  return alertsRun;
}
// The worker started (the browser opened, an update, a wake-up): alerts on but no
// check scheduled (a browser restart can drop alarms), so one is, 30 to 35 minutes
// after the last, or a minute or two from now when that's past. Alerts off: none.
async function alertsWake() {
  const AL = self.OHAlerts;
  const got = await chrome.storage.local.get([AL.ON_KEY, AL.STATE_KEY]);
  if (got[AL.ON_KEY] !== true) return chrome.alarms.clear(AL.ALARM);
  if (await chrome.alarms.get(AL.ALARM)) return;
  const now = Date.now();
  const last = got[AL.STATE_KEY]?.checkedAt;
  const soon = now + 60e3 + Math.floor(Math.random() * 60e3);
  await chrome.alarms.create(AL.ALARM, {
    when: Number.isFinite(last) ? Math.max(soon, AL.nextAt(last, Math.random())) : soon,
  });
}
alertsWake();
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === self.OHAlerts.ALARM) alertsCheck();
});
chrome.storage.onChanged.addListener((c, area) => {
  if (area !== 'local') return;
  const AL = self.OHAlerts;
  if (c[AL.ON_KEY]) {
    if (c[AL.ON_KEY].newValue === true) alertsCheck();
    else {
      // Off: no more checks, and the matches and the Wishlist keys go; again once a
      // check that was already running settles, in case it wrote them back (unless
      // alerts are on again by then).
      const off = async () => {
        if ((await chrome.storage.local.get(AL.ON_KEY))[AL.ON_KEY] === true) return;
        chrome.alarms.clear(AL.ALARM);
        await chrome.storage.local.remove(AL.OFF_KEYS);
        return updateReminder();
      };
      off();
      if (alertsRun) alertsRun.finally(off);
    }
    return;
  }
  // A new scan or another connection: matched again from what's saved; connecting
  // reads the Wishlist now. A sync after a scan (lastSync) changes nothing here.
  const was = c.siteLink?.oldValue;
  const now = c.siteLink?.newValue;
  const relinked =
    !!c.siteLink && (was?.token !== now?.token || was?.connectedAt !== now?.connectedAt);
  if (c.db || relinked) alertsCheck({ network: relinked && !!now?.token });
});
// A notification clicked: our Store's page for that item (the one for "more" opens the
// Store), and that item counts as seen.
async function alertClicked(id) {
  const AL = self.OHAlerts;
  if (!String(id).startsWith(`${AL.ALARM}:`)) return;
  chrome.notifications.clear(id).catch(() => {});
  const got = await chrome.storage.local.get([AL.STATE_KEY, 'siteUrl']);
  const { feeds } = AL.sitesOf(got.siteUrl);
  const itemId = id.slice(AL.ALARM.length + 1);
  const m = got[AL.STATE_KEY]?.items?.find((x) => x.id === itemId);
  await chrome.tabs.create({ url: m ? AL.itemUrl(feeds, m) : `${feeds}/store` });
  if (m) {
    await chrome.storage.local.set({
      [AL.STATE_KEY]: AL.markSeen(got[AL.STATE_KEY], Date.now(), itemId),
    });
    await updateReminder();
  }
}
// chrome.notifications only exists once its optional permission is granted, so its
// listener goes on then too (once).
let clicksHeard = false;
function hearClicks() {
  if (clicksHeard || !chrome.notifications?.onClicked) return;
  clicksHeard = true;
  chrome.notifications.onClicked.addListener(alertClicked);
}
hearClicks();
chrome.permissions?.onAdded?.addListener(hearClicks);
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || typeof msg !== 'object' || msg.ohPopup !== 'alerts-seen') return false;
  if (sender.id !== chrome.runtime.id || sender.tab) return false;
  if (String(sender.url || '').split(/[?#]/)[0] !== chrome.runtime.getURL(POPUP)) return false;
  const AL = self.OHAlerts;
  chrome.storage.local
    .get(AL.STATE_KEY)
    .then((got) =>
      got[AL.STATE_KEY]
        ? chrome.storage.local.set({ [AL.STATE_KEY]: AL.markSeen(got[AL.STATE_KEY], Date.now()) })
        : null,
    )
    .then(updateReminder)
    .then(
      () => reply({ ok: true }),
      (err) => reply({ ok: false, error: String(err?.message || err) }),
    );
  return true; // answers later
});
// @flag-end alerts

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
