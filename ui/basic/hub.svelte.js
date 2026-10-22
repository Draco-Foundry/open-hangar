// The basic page's state and what it does (the connector build, src/basic.html). Since
// 0.4.0 the popup holds the hangar and the settings and scans run in a hidden page
// (src/scan-host.js), so this page is for what needs a page that stays open: the
// browser's asks (RSI access, Firefox's yes to share), the new RSI account question,
// Connect, and a scan that can't run hidden. Everything goes through lib.js
// (window.OH); nothing here reads RSI markup or the website's pages.
//
// The scan itself, the pack reads and the sync after a scan are the scan runner's
// (ui/scan/runner.js), which any page can run. This page runs it in its own tab
// (`by: 'tab'`) and draws what it says in this page's words (./report-lines.js).
import { t } from './copy.js';
import { progressLine, reportLines, reportSummary } from './report-lines.js';
import { afterConnect } from './after-connect.js';
import { connectLink } from './link-code.js';
import { createRunner, newRun } from '../scan/runner.js';

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
  owner: null, // whose hangar is stored (the handle beside the title)
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
  // account to sync or not: { handle, record }), switchTo (Connect came back with
  // another account than the one connected: { from, to }, the two names; the new token
  // waits in `switching`, never here), code (no sign-in window here: the code waiting
  // for Approve on the website's code page, { code, url }; ./link-code.js).
  site: {
    enabled: false,
    link: null,
    syncing: false,
    msg: '',
    calm: false,
    dataOk: true,
    askFirefox: null,
    pilot: null,
    switchTo: null,
    code: null,
  },
  update: null, // a newer version waiting for this tab to let it in
  banner: null, // the kill switch's banner (status.json), { message, level }
  note: '', // the last thing that happened (another RSI account signed in)
});

// --- Data -------------------------------------------------------------------------
// Whose hangar is stored (`db`: one the scan just read, else read here).
async function loadDB(db) {
  db = db || (await OH.loadDB());
  hub.owner = db.owner || null;
}

// The runner's account switch (OH.switchProfile) → this page's note.
const switchedNote = (s) =>
  t(s.restored ? 'basic.switched-back' : 'basic.switched-new', { who: s.who });

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

// Our hangar page or the popup asked for a scan that can't run hidden
// (src/background.js requestScan): the request names this tab and who asked. Taken once
// the scan has its scanRunning mark stored (or won't run), so the worker always sees
// one or the other. A request for the hidden page (src/scan-host.js) names no tab.
async function scanIfAsked() {
  if (!chrome.storage.session) return;
  const { scanRequest: r } = await chrome.storage.session.get('scanRequest');
  if (!r || (r.by && r.by !== 'tab')) return;
  const tab = await thisTabId();
  if (tab == null || r.tabId !== tab) return;
  const go = Date.now() - r.at < 60e3 && !hub.scan.busy;
  const reason = r.reason === 'site' ? 'site' : 'popup';
  const running = go ? scan({ reason }) : null;
  await runner.marked();
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
  await connectIfAsked();
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
  if (why === 'connect') await connect({ asked, fromSite: true });
}

// The website's Connect This Browser (src/background.js oh-connect-begin): this tab was
// brought to the front, or opened, to run Connect's sign-in window. Only in the tab the
// ask names; other Open Hangar tabs leave it.
async function connectIfAsked() {
  if (!chrome.storage.session) return;
  const { siteConnectAsk: ask } = await chrome.storage.session.get('siteConnectAsk');
  if (!ask || (ask.tabId != null && ask.tabId !== (await thisTabId()))) return;
  await chrome.storage.session.remove('siteConnectAsk');
  // Not awaited: the window stays open for as long as you take.
  if (Date.now() - ask.at < 60e3) connect({ fromSite: true });
}

// Connect: the browser's sign-in window on the website's /connect (./sign-in.js). The
// popup's Connect and the website's Connect This Browser both end up here. Without the
// window (Firefox for Android), a code on the website's code page. One at a time.
let connecting = false;
export async function connect({ asked, fromSite = false } = {}) {
  const ok = asked || dataOk();
  if (connecting) return;
  connecting = true;
  try {
    await connectOnce(ok, fromSite);
  } finally {
    connecting = false;
    // The website may ask again (src/background.js holds its asks while a window is open).
    await chrome.storage.session?.remove('siteConnectAskedAt').catch(() => {});
  }
}
async function connectOnce(ok, fromSite) {
  hub.site.msg = '';
  if (!(await ok)) return void (hub.site.msg = t('basic.firefox-no'));
  const base = await OH.siteUrl();
  const w = { stop: false };
  codeWait = w;
  let got;
  try {
    got = await connectLink({
      base,
      identity: globalThis.chrome?.identity || globalThis.browser?.identity,
      log: (line) => OH.log('warn', 'site', line),
      OH,
      session: chrome.storage.session,
      open: (url) => chrome.tabs.create({ url }),
      show: (c) => (hub.site.code = c),
      shouldGo: () => codeWait === w && !w.stop,
    });
  } catch (err) {
    OH.log('warn', 'site', `link code: ${err?.message || err}`);
    got = { failed: true };
  } finally {
    if (codeWait === w) codeWait = null;
    hub.site.code = null;
  }
  if (got.failed) return void (hub.site.msg = t('basic.connect-failed'));
  if (got.expired) return void (hub.site.msg = t('basic.code-expired'));
  if (got.cancelled) return;
  const { link, sync } = got;
  const forConnect = fromSite || location.hash === '#settings';
  // Another account than the one connected: nothing is replaced or synced until you
  // say so here, with both names in front of you (switchAnswer).
  const was = await OH.getSiteLink();
  if (OH.siteSwitches(was, link)) {
    if (switching) await OH.siteTokenDrop(switching.link.token); // an older one, unanswered
    switching = { link, sync, forConnect };
    hub.site.switchTo = { from: was.name || '', to: link.name || '' };
    return;
  }
  await connected(link, sync, forConnect, base);
}
// The code waiting for Approve (hub.site.code): Cancel stops the wait, Open the Page
// Again brings the website's code page back.
let codeWait = null;
export function codeCancel() {
  if (codeWait) codeWait.stop = true;
  hub.site.code = null;
}
export function codeReopen() {
  if (hub.site.code) chrome.tabs.create({ url: hub.site.code.url });
}
// The new link waiting for the switch question (hub.site.switchTo), token and all.
let switching = null;
export async function switchAnswer(yes) {
  const w = switching;
  switching = null;
  hub.site.switchTo = null;
  if (!w) return;
  if (!yes) return void (await OH.siteTokenDrop(w.link.token));
  await connected(w.link, w.sync, w.forConnect, await OH.siteUrl());
}
// A new link kept: the old one revoked (OH.siteLinkSave), the first sync if /connect
// asked for it, then on to My Hangar when this page was opened for Connect.
async function connected(link, sync, forConnect, base) {
  await OH.siteLinkSave(link);
  await refreshSite();
  if (sync) await syncNow();
  await runner.wishlistToAccount();
  const onward = () => {
    const next = afterConnect({
      forConnect,
      scanning: hub.scan.busy,
      msg: hub.site.msg,
      pilot: !!hub.site.pilot,
      siteUrl: base,
      linked: !!hub.site.link,
    });
    if (next) location.assign(next);
  };
  // The first sync asked which pilot (hub.site.pilot): the tab waits for the answer and
  // goes on from pilotAnswer, after Sync It's sync or straight after a no.
  afterPilot = hub.site.pilot ? onward : null;
  onward();
}
// Connect's way on to My Hangar, held while its pilot question is open (connect).
let afterPilot = null;

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
  const onward = afterPilot;
  afterPilot = null;
  onward?.();
}
export async function disconnect() {
  hub.site.msg = '';
  hub.site.pilot = null;
  afterPilot = null;
  await OH.siteDisconnect().catch((e) => (hub.site.msg = String(e?.message || e)));
  await refreshSite();
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
  await Promise.all([refreshSite(), rsiAccess()]);
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
    if (area === 'local' && c.db && !hub.scan.busy) loadDB();
    if (area === 'session' && c.scanRequest?.newValue) scanIfAsked();
    if (area === 'session' && c.scanRunning) noteOtherScan();
    if (area === 'session' && (c.siteAskFirefox || c.localAskFirefox)) refreshSite();
    if (area === 'session' && c.siteConnectAsk?.newValue) connectIfAsked();
  });
  await noteOtherScan();
  await runner.wishlistToAccount();
  await scanIfAsked();
}
