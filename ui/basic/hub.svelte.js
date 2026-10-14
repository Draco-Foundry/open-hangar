// The basic page's state and what it does (the connector build, src/basic.html). The
// one extension page left when the website is the full app: it scans, keeps the
// hangar, exports it and holds the settings. Everything goes through lib.js
// (window.OH); nothing here reads RSI markup or the website's pages. It works with no
// network: the lists, totals and exports read only what's stored.
//
// The scan itself, the pack reads and the sync after a scan are the scan runner's
// (ui/scan/runner.js), which any page can run. This page runs it in its own tab
// (`by: 'tab'`), draws what it says in this page's words (./report-lines.js) and keeps
// what needs a click here: the browser's asks (RSI access, Firefox's yes to share),
// the new RSI account question, Connect.
import { t } from './copy.js';
import { progressLine, reportLines, reportSummary } from './report-lines.js';
import { buybacksOf, createRunner, newRun } from '../scan/runner.js';

const OH = globalThis.OH;
const SITE_DATA = {
  data_collection: ['personallyIdentifyingInfo', 'financialAndPaymentInfo', 'websiteContent'],
};
// The scan reads robertsspaceindustries.com. Firefox lets you turn that access off on
// the add-ons page (and Chrome or Edge can hold it back): then a scan only fails, so it
// asks first (rsiAllow).
const RSI_HOST = { origins: ['https://robertsspaceindustries.com/*'] };
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
// The stored hangar into the page (`db`: one the scan just read, else read here).
async function loadDB(db) {
  db = db || (await OH.loadDB());
  hub.items = db.sources.hangar?.items || [];
  hub.scannedAt = db.sources.hangar?.scannedAt || null;
  hub.buybacks = buybacksOf(db);
  hub.bbScannedAt = db.sources.buybacks?.scannedAt || null;
  hub.owner = db.owner || null;
  hub.bbDetails = { ...(await OH.getBuybackDetails()) };
}

// The runner's account switch (OH.switchProfile) → this page's note.
const switchedNote = (s) =>
  t(s.restored ? 'basic.switched-back' : 'basic.switched-new', { who: s.who });

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

// → whether this extension may read robertsspaceindustries.com. A browser that can't
// say counts as yes (the scan then says what went wrong).
async function rsiAccess() {
  if (!chrome.permissions?.contains) return true;
  return (hub.rsiOk = await chrome.permissions.contains(RSI_HOST).catch(() => true));
}

// The scan runner, in this tab. What it does shows here as it happens.
const runner = createRunner({
  OH,
  store: chrome.storage.local,
  session: chrome.storage.session || null,
  me: { by: 'tab', tabId: thisTabId(), run: newRun() },
  mayReadRsi: rsiAccess,
  // Without a click: the yes Firefox gave already (dataOk asks on one).
  mayShare: () => Promise.resolve(hub.site.dataOk),
  hooks: {
    start() {
      hub.scan = { busy: true, detail: t('basic.scan-start'), report: null };
      hub.note = '';
    },
    progress(p) {
      if (hub.scan.busy) hub.scan.detail = progressLine(p, t);
    },
    async account(account, switched) {
      hub.account = account || hub.account;
      if (!switched) return;
      await loadDB();
      hub.note = switchedNote(switched);
    },
    async scanned(report, { db }) {
      hub.scan = { busy: false, detail: '', report: reportLines(report, t) };
      if (db) await loadDB(db);
      else hub.bbDetails = { ...(await OH.getBuybackDetails()) };
      await refreshProfiles();
      if (!hub.site.link) await refreshSite();
    },
    syncStart() {
      hub.site.syncing = true;
      hub.site.msg = '';
      hub.site.calm = false;
    },
    // A calm refusal (sync not open yet, or one moments ago) is a note, not a problem;
    // an RSI account this link hasn't synced asks first (hub.site.pilot).
    async synced(r) {
      const s = hub.site;
      if (r.state === 'off') return void (s.msg = t('basic.firefox-no'));
      if (r.state === 'kept') return;
      if (r.state === 'ask') s.pilot = r.ask;
      else if (r.msg) {
        s.msg = r.msg;
        s.calm = r.state === 'calm' || r.state === 'held';
      }
      s.syncing = false;
      await refreshSite();
    },
    async packs() {
      hub.bbDetails = { ...(await OH.getBuybackDetails()) };
    },
  },
});

// Another Open Hangar tab scanning right now (its scanRunning mark): this tab's Scan
// waits, and so does any sync (ui/scan/sync-timing.js).
async function noteOtherScan() {
  hub.scanElsewhere = await runner.otherScan().catch(() => false);
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

export async function scan({ reason = 'page' } = {}) {
  if (hub.scan.busy) return;
  const report = await runner.scan({ reason });
  // Another Open Hangar tab is scanning: two at once would read RSI twice.
  if (report?.held === 'busy') hub.scanElsewhere = true;
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
  // The request doesn't say yet whether the popup or our hangar page asked.
  const reason = r.reason === 'site' ? 'site' : 'popup';
  const running = go ? scan({ reason }) : null;
  await runner.written();
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
  else if (link && !s.syncing) runner.retryIfDue(link).catch(() => {});
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
  await runner.wishlistToAccount();
}

// Sync Now, and a sync this page asks for (auto). The runner sends it (ui/scan/runner.js
// sync): while a scan runs, here or in another Open Hangar tab, it's kept for the
// scan's own sync at its end (#658). Firefox's ask is this click's, before any await.
export function syncNow({ auto = false, asked, scanDone = false, again = false } = {}) {
  const s = hub.site;
  if (s.syncing || !s.link) return Promise.resolve();
  const ok = asked || (auto ? Promise.resolve(s.dataOk) : dataOk());
  return runner.sync({ auto, asked: ok, scanDone, again }).then(() => {});
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
  const url = OH.scanProblemUrl({
    summary: reportSummary(hub.scan.report, hub.scan.report?.signedOut),
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
  const switched = await runner.reconcile(acct, { owner: hub.owner });
  if (switched) {
    await loadDB();
    hub.note = switchedNote(switched);
  }
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
    if (area === 'local' && c.siteLink) refreshSite().then(runner.wishlistToAccount);
    if (area === 'local' && c.siteSyncRequested?.newValue) syncIfAsked();
    if (area === 'local' && c.db && !hub.scan.busy) loadDB();
    if (area === 'session' && c.scanRequest?.newValue) scanIfAsked();
    if (area === 'session' && c.scanRunning) noteOtherScan();
    if (area === 'session' && (c.siteAskFirefox || c.localAskFirefox)) refreshSite();
  });
  await noteOtherScan();
  await syncIfAsked();
  await runner.wishlistToAccount();
  await scanIfAsked();
}
