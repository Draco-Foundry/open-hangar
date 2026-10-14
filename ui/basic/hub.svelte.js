// The basic page's state and what it does (the connector build, src/basic.html). The
// one extension page left when the website is the full app: it scans, keeps the
// hangar, exports it and holds the settings. Everything goes through lib.js
// (window.OH); nothing here reads RSI markup or the website's pages. It works with no
// network: the lists, totals and exports read only what's stored.
//
// The scan is the dashboard's Scan All without the store check (src/dashboard.js
// runScan): one RSI account read, then the hangar, buy-backs and referrals, each
// saved as it lands, then up to BB_AUTO_MAX buy-back packs never read before, then a
// sync when connected. Scan depth is the same; the wishlist and Subscriber Store reads
// went to the website.
import { t } from './copy.js';
import { importWishlist } from './wishlist-import.js';
import { afterScan, retryDue, scanElsewhere, syncWhen } from './sync-timing.js';
import { flag } from '../lib/flags.js';

const OH = globalThis.OH;
const SITE_DATA = {
  data_collection: ['personallyIdentifyingInfo', 'financialAndPaymentInfo', 'websiteContent'],
};
// The scan reads robertsspaceindustries.com. Firefox lets you turn that access off on
// the add-ons page (and Chrome or Edge can hold it back): then a scan only fails, so it
// asks first (rsiAllow).
const RSI_HOST = { origins: ['https://robertsspaceindustries.com/*'] };
const BB_AUTO_MAX = 30; // src/dashboard.js: never-read packs read after a scan
const firefox = () => !!chrome.runtime.getManifest().browser_specific_settings?.gecko;

export const hub = $state({
  ready: false,
  items: [],
  buybacks: [],
  scannedAt: null,
  bbScannedAt: null,
  owner: null,
  bbDetails: {},
  account: null,
  // Access to robertsspaceindustries.com: off means the Allow Access to RSI card instead
  // of a scan (rsiAllow).
  rsiOk: true,
  // The scan: busy, what it's on, and the last report ({ rows, signedOut, problem }).
  scan: { busy: false, detail: '', report: null },
  // Another Open Hangar tab is scanning (its scanRunning mark): this one waits.
  scanElsewhere: false,
  // openhangar.space: link { name, connectedAt, lastSync } (never the token), Firefox's
  // yes, and an ask waiting: 'connect' | 'local' (Firefox's card), pilot (a new RSI
  // account to sync or not: { handle, record }).
  site: {
    enabled: false,
    link: null,
    syncing: false,
    msg: '',
    calm: false,
    dataOk: true,
    askFirefox: null,
    pilot: null,
  },
  profiles: [],
  update: null, // a newer version waiting for this tab to let it in
  banner: null, // the kill switch's banner (status.json), { message, level }
  note: '', // the last thing a button did ("Exported …", "Cleared …")
});

// --- Data -------------------------------------------------------------------------
async function loadDB() {
  const db = await OH.loadDB();
  hub.items = db.sources.hangar?.items || [];
  hub.scannedAt = db.sources.hangar?.scannedAt || null;
  hub.buybacks = (db.sources.buybacks?.items || []).map((b) => ({
    ...b,
    kind: globalThis.OpenHangar?.classifyBuyback?.(b.name, b.contains) || b.kind,
  }));
  hub.bbScannedAt = db.sources.buybacks?.scannedAt || null;
  hub.owner = db.owner || null;
  hub.bbDetails = { ...(await OH.getBuybackDetails()) };
}

// The live hangar belongs to the RSI account signed in here: another one's is parked
// and comes back when you sign in as them (OH.switchProfile). → a note, or ''.
async function reconcile(acct) {
  if (!acct?.loggedIn || !acct.nickname || !hub.owner?.nickname) return '';
  if (acct.nickname.toLowerCase() === String(hub.owner.nickname).toLowerCase()) return '';
  const who = acct.displayname || acct.nickname;
  const { restored } = await OH.switchProfile(acct.nickname, acct.displayname);
  await loadDB();
  return t(restored ? 'basic.switched-back' : 'basic.switched-new', { who });
}

export async function refreshProfiles() {
  hub.profiles = await OH.listProfiles().catch(() => []);
}

// --- Scan -------------------------------------------------------------------------
let thisTab = null;
const thisTabId = () =>
  (thisTab ??= chrome.tabs?.getCurrent
    ? chrome.tabs.getCurrent().then(
        (x) => x?.id ?? null,
        () => null,
      )
    : Promise.resolve(null));
// A scan running in this tab, for our hangar page's scan status and the popup
// (src/background.js scanRunning): renewed at most once a minute, cleared at the end.
let markAt = 0;
let markWrite = Promise.resolve();
function scanMark(on) {
  if (!chrome.storage.session) return;
  const now = Date.now();
  if (on && now - markAt < 60e3) return;
  markAt = on ? now : 0;
  markWrite = markWrite
    .then(async () =>
      on
        ? chrome.storage.session.set({ scanRunning: { at: now, tabId: await thisTabId() } })
        : chrome.storage.session.remove('scanRunning'),
    )
    .catch(() => {});
}
addEventListener('pagehide', () => {
  if (markAt) chrome.storage.session?.remove('scanRunning').catch(() => {});
});
// Another Open Hangar tab scanning right now (its scanRunning mark): this tab's Scan
// waits, and so does any sync (sync-timing.js).
async function otherScan() {
  if (hub.scan.busy || !chrome.storage.session) return false;
  const { scanRunning } = await chrome.storage.session.get('scanRunning');
  return scanElsewhere(scanRunning, await thisTabId());
}
async function noteOtherScan() {
  hub.scanElsewhere = await otherScan().catch(() => false);
}
const progress = (part) => (page, count, retry) => {
  scanMark(true);
  hub.scan.detail = retry
    ? t('basic.progress-retry', { part, page, n: retry.attempt, of: retry.of })
    : t('basic.progress', { part, page, count });
};

// → whether this extension may read robertsspaceindustries.com. A browser that can't
// say counts as yes (the scan then says what went wrong).
async function rsiAccess() {
  if (!chrome.permissions?.contains) return true;
  return (hub.rsiOk = await chrome.permissions.contains(RSI_HOST).catch(() => true));
}
// Allow Access to RSI: the click the browser's ask needs, so it's asked before any
// await; yes runs the scan right away (the one that was waiting, or the one pressed).
export function rsiAllow() {
  const asked = chrome.permissions.request(RSI_HOST).catch(() => false);
  return asked.then(async (yes) => {
    hub.rsiOk = !!yes || (await rsiAccess());
    if (!hub.rsiOk) return;
    await scan();
  });
}
// The Scan button: with RSI access off, the click goes to the browser's ask instead.
export function scanClick() {
  if (!hub.rsiOk) return rsiAllow();
  return scan();
}

export async function scan() {
  if (hub.scan.busy) return;
  // Another Open Hangar tab is scanning: two at once would read RSI twice.
  if (await otherScan()) return void (hub.scanElsewhere = true);
  // No access to RSI: no scan that can only fail. The card asks instead.
  if (!(await rsiAccess())) {
    OH.log('info', 'status', 'scan held: no access to robertsspaceindustries.com');
    return;
  }
  hub.scan = { busy: true, detail: t('basic.scan-start'), report: null };
  hub.note = '';
  scanMark(true);
  const rows = [];
  let signedOut = false;
  try {
    const account = (await OH.getAccount({ force: true }).catch(() => null)) || undefined;
    hub.account = account || hub.account;
    const switched = await reconcile(account);
    if (switched) hub.note = switched;
    // Signed out: RSI's signed-out pages read as an empty hangar, and a scan of
    // nothing must never be saved over yours.
    signedOut = account?.loggedIn === false;
    if (!signedOut) {
      const h = await OH.scanSource('hangar', progress('Hangar'), { account });
      rows.push(
        h.ok
          ? { name: 'Hangar', ok: !h.partial, text: t('basic.row-pledges', { n: h.items.length }) }
          : { name: 'Hangar', ok: false, text: h.error },
      );
      const b = await OH.scanSource('buybacks', progress('Buy-Backs'), { account });
      rows.push(
        b.ok
          ? {
              name: 'Buy-Backs',
              ok: !b.partial,
              text: t('basic.row-buybacks', { n: b.items.length }),
            }
          : { name: 'Buy-Backs', ok: false, text: b.error },
      );
      const r = await OH.getReferral(
        (phase, n) => {
          scanMark(true);
          hub.scan.detail = t('basic.progress-referrals', { n });
        },
        { account },
      );
      if (r)
        rows.push(
          r.ok
            ? {
                name: 'Referrals',
                ok: !r.partial,
                text: t('basic.row-referrals'),
                box: t('basic.row-referrals-box'),
              }
            : { name: 'Referrals', ok: false, text: r.error },
        );
      await loadDB();
      // Buy-backs filled from your own hangar history first (no RSI read), as the
      // dashboard does.
      if (b.ok)
        await OH.fillBuybackDetailsFromHistory(hub.buybacks, {
          history: await OH.getHistory(),
        }).catch((e) =>
          OH.log('warn', 'buybacks', `details from history failed: ${e?.message || e}`),
        );
    }
  } catch (e) {
    rows.push({ name: 'Hangar', ok: false, text: String(e?.message || e) });
  }
  const bad = rows.filter((r) => !r.ok).length;
  hub.scan = {
    busy: false,
    detail: '',
    report: signedOut || bad ? { rows, signedOut, bad } : { rows, signedOut: false, bad: 0 },
  };
  if (signedOut || bad)
    OH.log(
      'error',
      'status',
      rows.map((r) => `${r.name}: ${r.ok ? 'ok' : 'problem'}`).join(' · ') || 'signed out',
    );
  scanMark(false);
  hub.bbDetails = { ...(await OH.getBuybackDetails()) };
  await refreshProfiles();
  // Connected: every finished scan syncs once, with the whole hangar, as the
  // dashboard's does. A sync asked for while it ran (Connect, Sync Now, the website's
  // Sync My Hangar Now) was kept for this one (#658). This scan's mark is gone first,
  // so the sync doesn't wait on it.
  await markWrite;
  if (!hub.site.link) await refreshSite();
  const go = afterScan({ linked: !!hub.site.link, signedOut, kept: await takeKeptSync() });
  if (go) await syncNow({ auto: go.auto, asked: Promise.resolve(hub.site.dataOk), scanDone: true });
  // Packs never read: their contents, paced, in the background (Scan stays fast).
  if (rows.some((r) => r.name === 'Buy-Backs' && r.ok)) readPacks();
}

let packsReading = false;
async function readPacks() {
  if (packsReading) return;
  const todo = hub.buybacks
    .filter((b) => !b.isCCU && (b.kind === 'pack' || b.kind === 'package'))
    .filter((b) => !hub.bbDetails[b.id] || hub.bbDetails[b.id].partial)
    .slice(0, BB_AUTO_MAX)
    .map((b) => String(b.id));
  if (!todo.length) return;
  packsReading = true;
  try {
    await OH.fetchBuybackDetails(todo, () => {});
  } finally {
    packsReading = false;
    hub.bbDetails = { ...(await OH.getBuybackDetails()) };
  }
}

// Our hangar page or the popup asked for a scan (src/background.js requestScan): the
// request names this tab. Taken once the scan has marked itself running.
async function scanIfAsked() {
  if (!chrome.storage.session) return;
  const { scanRequest: r } = await chrome.storage.session.get('scanRequest');
  if (!r) return;
  const tab = await thisTabId();
  if (tab == null || r.tabId !== tab) return;
  const go = Date.now() - r.at < 60e3 && !hub.scan.busy;
  const running = go ? scan() : null;
  await markWrite;
  await chrome.storage.session.remove('scanRequest');
  await running;
}

// --- openhangar.space ----------------------------------------------------------------
let waitTimer = null;
export async function refreshSite() {
  const s = hub.site;
  s.enabled = await OH.siteEnabled();
  const link = s.enabled ? await OH.getSiteLink() : null;
  // A too-soon sync holds every sync until `waitUntil` (OH.siteSyncWait); the line
  // that says so goes when the wait is over.
  const until = (link && OH.siteSyncWait(link)?.until) || null;
  s.link = link && {
    name: link.name || '',
    connectedAt: link.connectedAt,
    lastSync: link.lastSync,
    waitUntil: until,
  };
  clearTimeout(waitTimer);
  if (until) waitTimer = setTimeout(refreshSite, Math.max(0, until - Date.now()) + 500);
  else if (link && !s.syncing) retryIfDue(link).catch(() => {});
  s.dataOk = !firefox() || (await chrome.permissions.contains(SITE_DATA).catch(() => false));
  if (!firefox() || s.dataOk || !chrome.storage.session) return;
  // Connect was pressed on the website, or our hangar page asked for the hangar,
  // before Firefox said yes (src/background.js): this page opened with its card up.
  const { siteAskFirefox: at, localAskFirefox: ask } = await chrome.storage.session.get([
    'siteAskFirefox',
    'localAskFirefox',
  ]);
  if (at && !s.link) {
    await chrome.storage.session.remove('siteAskFirefox');
    if (Date.now() - at < 5 * 60e3) s.askFirefox = 'connect';
  }
  if (ask && (ask.tabId == null || ask.tabId === (await thisTabId()))) {
    await chrome.storage.session.remove('localAskFirefox');
    if (Date.now() - ask.at < 5 * 60e3) s.askFirefox = 'local';
  }
}

// Firefox asks before an extension sends anything off the device, and only from a
// click: call this first thing in one, before any await. Elsewhere: always yes.
export function dataOk() {
  if (!firefox()) return Promise.resolve(true);
  return chrome.permissions
    .request(SITE_DATA)
    .catch(() => chrome.permissions.contains(SITE_DATA).catch(() => false))
    .then((ok) => (hub.site.dataOk = !!ok));
}

// Firefox's card: Continue asks Firefox (the click), then connects unless it was our
// hangar page asking (then that page just asks again).
export async function firefoxContinue() {
  const asked = dataOk();
  const why = hub.site.askFirefox;
  hub.site.askFirefox = null;
  if (!(await asked)) return void (hub.site.msg = t('basic.firefox-no'));
  if (why === 'connect') await connect({ asked });
}

const b64url = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const random = (n) => b64url(crypto.getRandomValues(new Uint8Array(n)));

// Connect: the browser's sign-in window on the website's /connect, as the dashboard's
// (PKCE: the verifier never leaves this page). Without the window, the website's
// Connect This Browser page instead, which asks the extension itself (bridge v2).
export async function connect({ asked } = {}) {
  const ok = asked || dataOk();
  hub.site.msg = '';
  if (!(await ok)) return void (hub.site.msg = t('basic.firefox-no'));
  const base = await OH.siteUrl();
  const identity = globalThis.chrome?.identity || globalThis.browser?.identity;
  if (!identity?.launchWebAuthFlow || !identity.getRedirectURL) {
    chrome.tabs.create({ url: `${base}/link` });
    return;
  }
  const redirect = identity.getRedirectURL();
  const verifier = random(32);
  const state = random(16);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const url = `${base}/connect?${new URLSearchParams({
    response_type: 'code',
    code_challenge: b64url(new Uint8Array(digest)),
    code_challenge_method: 'S256',
    state,
    redirect_uri: redirect,
  })}`;
  let back;
  try {
    back = await identity.launchWebAuthFlow({ url, interactive: true });
  } catch (err) {
    if (/approve|cancel|denied|closed/i.test(String(err?.message || err))) return;
    OH.log('warn', 'site', `sign-in window: ${err?.message || err}`);
    chrome.tabs.create({ url: `${base}/link` });
    return;
  }
  const answer = new URL(back).searchParams;
  if (answer.get('state') !== state || answer.get('error') || !answer.get('code')) return;
  const res = await fetch(`${base}/api/link/token`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      code: answer.get('code'),
      code_verifier: verifier,
      redirect_uri: redirect,
    }),
  }).catch(() => null);
  if (!res || !res.ok) return void (hub.site.msg = t('basic.connect-failed'));
  const j = await res.json();
  await chrome.storage.local.set({
    siteLink: { token: j.token, name: j.name || '', connectedAt: Date.now(), lastSync: null },
  });
  await refreshSite();
  if (answer.get('sync') === '1') await syncNow();
  await wishlistToAccount();
}

// Sync Now, and the sync after a scan (auto). A calm refusal (sync not open yet, or
// one moments ago) is a note, not a problem; an RSI account this link hasn't synced
// asks first (hub.site.pilot).
// While a scan runs (here or in another Open Hangar tab) a sync is kept for the
// scan's own sync at its end (syncAfterScan, session storage), so the website gets the
// whole hangar, never half of one (#658). `scanDone`: that sync. `again`: the one try
// more after the website's pace held a sync back (retryIfDue).
export async function syncNow({ auto = false, asked, scanDone = false, again = false } = {}) {
  const s = hub.site;
  if (s.syncing || !s.link) return;
  if (!(await (asked || (auto ? Promise.resolve(s.dataOk) : dataOk()))))
    return void (s.msg = t('basic.firefox-no'));
  const when = syncWhen({ busyHere: hub.scan.busy, elsewhere: await otherScan(), scanDone });
  if (when === 'after-scan') return keepSyncForScan(auto);
  s.syncing = true;
  s.msg = '';
  s.calm = false;
  try {
    await OH.siteSync({ auto });
    await chrome.storage.local.remove('siteSyncAgain');
  } catch (err) {
    if (err?.ask) {
      s.pilot = err.ask;
      OH.log('info', 'site', 'asked before syncing an RSI account new to this link');
    } else if (!err?.quiet) {
      s.msg = String(err?.message || err);
      s.calm = !!err?.calm;
      OH.log(s.calm ? 'info' : 'warn', 'site', s.msg);
    }
    // Held back by the website's pace ("synced moments ago"): tried once more when the
    // wait is over, so the newest scan still reaches the website.
    if (!again && !err?.ask && !err?.quiet) {
      const wait = OH.siteSyncWait(await OH.getSiteLink().catch(() => null));
      if (wait?.reason === 'too-soon')
        await chrome.storage.local.set({ siteSyncAgain: { at: Date.now(), auto } });
    }
  }
  s.syncing = false;
  await refreshSite();
  await wishlistToAccount();
}
// A sync asked for during a scan, for the scan's own sync (afterScan). One asked for
// by a press (not `auto`) stays one, whatever is kept after it.
async function keepSyncForScan(auto) {
  if (!chrome.storage.session) return;
  const { syncAfterScan: prev } = await chrome.storage.session.get('syncAfterScan');
  await chrome.storage.session.set({
    syncAfterScan: { at: Date.now(), auto: auto && prev?.auto !== false },
  });
  OH.log('info', 'site', 'sync kept until the scan running now is done');
}
async function takeKeptSync() {
  if (!chrome.storage.session) return null;
  const { syncAfterScan: kept } = await chrome.storage.session.get('syncAfterScan');
  if (kept) await chrome.storage.session.remove('syncAfterScan');
  return kept || null;
}
// The one try more for a sync the website's pace held back (siteSyncAgain), once no
// wait holds it.
async function retryIfDue(link) {
  const { siteSyncAgain: again } = await chrome.storage.local.get('siteSyncAgain');
  if (!retryDue(again, OH.siteSyncWait(link))) return;
  await chrome.storage.local.remove('siteSyncAgain');
  await syncNow({
    auto: again.auto !== false,
    asked: Promise.resolve(hub.site.dataOk),
    again: true,
  });
}
export async function pilotAnswer(yes) {
  const who = hub.site.pilot;
  if (!who) return;
  const asked = yes ? dataOk() : null; // Sync It is the click Firefox needs
  hub.site.pilot = null;
  await OH.siteSyncAnswer(who, yes);
  if (yes) await syncNow({ asked });
}
export async function disconnect() {
  hub.site.msg = '';
  hub.site.pilot = null;
  await OH.siteDisconnect().catch((e) => (hub.site.msg = String(e?.message || e)));
  await refreshSite();
}
// "Sync My Hangar Now" from the website's Connect This Browser (src/background.js
// oh-connect-finish sets siteSyncRequested): once, here.
async function syncIfAsked() {
  const { siteSyncRequested: at } = await chrome.storage.local.get('siteSyncRequested');
  if (!at) return;
  await chrome.storage.local.remove('siteSyncRequested');
  if (Date.now() - at < 10 * 60e3) await syncNow({ auto: true });
}

// The 0.3.x wishlist into the account, once per connection (ui/basic/wishlist-import.js).
// Only in a build with the `wishlistImport` flag (off until the privacy policy names it),
// only once Firefox lets this extension share (the same yes sync needs), and never in a
// loop: a website that doesn't take it yet is asked again hours later.
let wishImporting = false;
async function wishlistToAccount() {
  if (!flag('wishlistImport')) return;
  if (wishImporting || !hub.site.link || !hub.site.dataOk) return;
  wishImporting = true;
  try {
    const r = await importWishlist({
      store: chrome.storage.local,
      fetchFn: fetch,
      siteUrl: await OH.siteUrl(),
      appVersion: chrome.runtime.getManifest().version,
    });
    if (r === 'later') OH.log('info', 'site', 'wishlist not taken by the website yet; later');
  } catch (e) {
    OH.log('warn', 'site', `wishlist import: ${e?.message || e}`);
  } finally {
    wishImporting = false;
  }
}

// --- Settings ---------------------------------------------------------------------
export async function clearData() {
  await OH.clearData();
  await loadDB();
  await refreshProfiles();
  hub.scan.report = null;
  hub.note = t('basic.cleared');
}
export async function removeProfile(nickname) {
  await OH.deleteProfile(nickname);
  await refreshProfiles();
}
export async function logOut() {
  const r = await OH.logout();
  hub.note = r.ok ? t('basic.logged-out') : r.error || t('basic.logout-failed');
  if (r.ok) hub.account = { loggedIn: false };
}

// Report a Scan Problem: a new GitHub issue from the Scan Broken template, with the
// scan's counts and the flight log (no handle, no item names; OH.scanProblemUrl).
// Nothing is sent: you read it on GitHub and submit it yourself.
export async function reportProblem() {
  const rows = hub.scan.report?.rows || [];
  const summary =
    rows.map((r) => `${r.name}: ${r.ok ? 'ok' : 'problem'}`).join(' · ') ||
    (hub.scan.report?.signedOut ? 'signed out of RSI' : 'no scan this session');
  const url = OH.scanProblemUrl({
    summary,
    report: await OH.errorReport({ maxLines: 25 }),
    version: chrome.runtime.getManifest().version,
  });
  window.open(url, '_blank', 'noopener');
}

// The backup file (OH.exportDB: the referral code and its link left out).
export async function exportJson() {
  return OH.exportDB();
}

// --- Updates ----------------------------------------------------------------------
// The browser holds a new version while an extension tab is open (src/background.js):
// Reload lets it in and brings this page back (reopenAfterUpdate).
export async function reloadForUpdate() {
  await chrome.storage.local.set({ reopenAfterUpdate: Date.now() });
  chrome.runtime.reload();
}

// --- Start ------------------------------------------------------------------------
export async function start() {
  await loadDB();
  const acct = await OH.getAccount().catch(() => null);
  hub.account = acct;
  const switched = await reconcile(acct);
  if (switched) hub.note = switched;
  hub.ready = true;
  await Promise.all([refreshProfiles(), refreshSite(), rsiAccess()]);
  // Turned on or off on the browser's add-ons page while this page is open.
  chrome.permissions?.onAdded?.addListener(() => rsiAccess());
  chrome.permissions?.onRemoved?.addListener(() => rsiAccess());
  const { updateReady } = await chrome.storage.local.get('updateReady');
  hub.update = updateReady || null;
  OH.getRemoteStatus()
    .then((st) => (hub.banner = st.banner))
    .catch(() => {});
  chrome.storage.onChanged.addListener((c, area) => {
    if (area === 'local' && c.updateReady) hub.update = c.updateReady.newValue || null;
    if (area === 'local' && c.siteLink) refreshSite().then(wishlistToAccount);
    if (area === 'local' && c.siteSyncRequested?.newValue) syncIfAsked();
    if (area === 'local' && c.db && !hub.scan.busy) loadDB();
    if (area === 'session' && c.scanRequest?.newValue) scanIfAsked();
    if (area === 'session' && c.scanRunning) noteOtherScan();
    if (area === 'session' && (c.siteAskFirefox || c.localAskFirefox)) refreshSite();
  });
  await noteOtherScan();
  await syncIfAsked();
  await wishlistToAccount();
  await scanIfAsked();
}
