// What the toolbar popup shows, from what's stored in this browser. Pure, so it's
// tested directly (test/connector.test.js, test/popup.test.js); ui/popup/Popup.svelte
// reads storage and draws it. The popup never asks RSI anything: the account value uses
// the ship prices the extension already has (OH.getShipIndex: the bundled list, plus
// the public ship list from openhangar.space, read at most once a day and bundled-only
// offline), the last RSI account read (the `account` key) for Store Credit, and the
// portrait the scan saved (`avatarImg`, a data URL: never an RSI address).

// The extension's own page in the connector build, where Connect lives (and, with an
// older background, where scans run).
export const HUB_PAGE = 'src/basic.html';

// The toolbar badge's rule (src/background.js updateReminder).
export const STALE_DAYS = 7;
// src/background.js counts a scan mark this old as a page that went away mid-scan, and
// a scan request as pending for a minute.
const SCAN_RUN_MAX = 10 * 60e3;
const SCAN_ASK_GAP = 60e3;
// Progress this quiet, with no scan mark left, is a scan that stopped (the page that
// ran it went away before it could say so).
const PROGRESS_QUIET = 2 * 60e3;

// The three tabs, in order. The bell opens the Alerts view on top of them.
export const TABS = ['hangar', 'wishlist', 'settings'];

const time = (t) => {
  const ms = typeof t === 'number' ? t : typeof t === 'string' ? Date.parse(t) : NaN;
  return Number.isFinite(ms) ? ms : null;
};
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

// Open My Hangar: the website's My Hangar once this browser syncs there, else our
// hangar page, which shows the hangar this browser scanned with no account (Local
// Mode). null when this build has neither.
export function myHangarUrl({ link, siteUrl, hangarPage }) {
  if (link && siteUrl) return `${siteUrl}/hangar`;
  if (hangarPage) return `${hangarPage}/`;
  return null;
}

// A scan running, or asked for in the last minute (src/background.js scanRunning,
// without its open-tab check).
export function scanBusy({ scanRunning, scanRequest }, now = Date.now()) {
  if (Number.isFinite(scanRequest?.at) && now - scanRequest.at < SCAN_ASK_GAP) return true;
  return Number.isFinite(scanRunning?.at) && now - scanRunning.at < SCAN_RUN_MAX;
}

// Store Credit in dollars from the cached RSI account, or null.
export function storeCredit(account) {
  const c = account?.credits?.store?.value;
  return Number.isFinite(c) ? c / 100 : null;
}

// Under the value when some pledges have no price (no store price and no melt
// value): the owner's words (2026-10-12), singular for one.
export const unpricedLine = (n) =>
  `Not counted: ${n.toLocaleString('en-US')} ${n === 1 ? 'pledge' : 'pledges'} with no price.`;

// → { scannedAt, staleDays, items, melt, unpriced, handle, name, nickname, signedOut,
// connected, myHangar, tokens }. `syncWait` is OH.siteSyncWait: the website took a sync
// for this account moments ago (429, too soon), so the next one waits until
// connected.waitUntil.
export function popupView(
  { db, account, link, siteUrl, hangarPage },
  { now = Date.now(), totalValue, syncWait } = {},
) {
  const items = Array.isArray(db?.sources?.hangar?.items) ? db.sources.hangar.items : [];
  const scannedAt = time(db?.sources?.hangar?.scannedAt);
  const days = scannedAt == null ? null : Math.floor((now - scannedAt) / 86400000);
  const live = account?.loggedIn ? account : null;
  const tokens = db?.sources?.buybacks?.meta?.tokens;
  return {
    scannedAt,
    staleDays: days != null && days >= STALE_DAYS ? days : null,
    items,
    melt: totalValue ? totalValue(items) : null,
    // Pledges with no melt value: left out of `melt`, and said so under it.
    unpriced: items.filter((p) => !Number.isFinite(p?.value)).length,
    handle:
      (live && (live.displayname || live.nickname)) ||
      db?.owner?.displayname ||
      db?.owner?.nickname ||
      '',
    // The RSI handle (the portrait's owner) and the display name under it.
    nickname: (live && live.nickname) || db?.owner?.nickname || '',
    name: (live && live.displayname) || db?.owner?.displayname || '',
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
    // Buy-back tokens from the last buy-back scan's first page, or null.
    tokens: Number.isInteger(tokens) && tokens >= 0 ? tokens : null,
  };
}

// The portrait the scan saved ({ nickname, src, at }), only when it's this account's
// and a picture (a data URL), never an address the popup would have to fetch.
export function portrait(avatarImg, nickname) {
  if (!isObj(avatarImg) || typeof avatarImg.src !== 'string') return null;
  if (!/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(avatarImg.src)) return null;
  const who = String(avatarImg.nickname || '').toLowerCase();
  return who && who === String(nickname || '').toLowerCase() ? avatarImg.src : null;
}

// The header's scan age: { tone: 'never' | 'fresh' | 'stale', n, unit: 'm' | 'h' | 'd' }.
// Green while fresh, amber from STALE_DAYS (the badge's "!"), grey before any scan.
export function scanAge(scannedAt, now = Date.now()) {
  const at = time(scannedAt);
  if (at == null) return { tone: 'never', n: null, unit: null };
  const mins = Math.max(1, Math.floor((now - at) / 60e3));
  const tone = mins >= STALE_DAYS * 1440 ? 'stale' : 'fresh';
  if (mins < 60) return { tone, n: mins, unit: 'm' };
  if (mins < 1440) return { tone, n: Math.floor(mins / 60), unit: 'h' };
  return { tone, n: Math.floor(mins / 1440), unit: 'd' };
}

// --- The scan, from the shared keys (session scanRunning and scanProgress, local
// scanReport) -----------------------------------------------------------------------
const STEPS = ['hangar', 'buybacks', 'referrals'];
// How far along each part is, start and end, for the bar under the header. Pages are
// counted as they come (RSI never says how many), so a part fills towards its end.
const SPAN = {
  start: [0.02, 0.05],
  account: [0.05, 0.1],
  hangar: [0.1, 0.5],
  buybacks: [0.5, 0.8],
  referrals: [0.8, 0.9],
  packs: [0.9, 0.95],
  sync: [0.95, 0.98],
};
export function progressFraction(p) {
  const [from, to] = SPAN[p?.part] || SPAN.start;
  const page = Number.isFinite(p?.page) && p.page > 0 ? p.page : 0;
  return Math.round((from + (to - from) * (page / (page + 3))) * 1000) / 1000;
}
// The three steps the popup lists ('done' | 'now' | 'todo'), for the part running.
export function scanSteps(part) {
  const at = part === 'packs' || part === 'sync' ? STEPS.length : Math.max(0, STEPS.indexOf(part));
  return STEPS.map((id, i) => ({ id, state: i < at ? 'done' : i === at ? 'now' : 'todo' }));
}

// → { phase: 'idle' | 'running' | 'stopped', hidden, progress, run }. `hidden`: the
// scan runs without a tab (its mark's `by` isn't 'tab'), so nothing else shows it.
// A mark with a run id belongs to that run; progress counts only for the run marked.
export function scanState(
  { scanRunning, scanRequest, scanProgress, scanReport },
  now = Date.now(),
) {
  const mark = isObj(scanRunning) && Number.isFinite(scanRunning.at) ? scanRunning : null;
  const fresh = mark && now - mark.at < SCAN_RUN_MAX;
  const prog = isObj(scanProgress) && Number.isFinite(scanProgress.at) ? scanProgress : null;
  const mine = prog && (!mark?.run || !prog.run || prog.run === mark.run) ? prog : null;
  if (fresh) {
    const by = typeof mark.by === 'string' ? mark.by : Number.isInteger(mark.tabId) ? 'tab' : null;
    return {
      phase: 'running',
      hidden: !!by && by !== 'tab',
      progress: mine,
      run: mark.run || null,
    };
  }
  if (Number.isFinite(scanRequest?.at) && now - scanRequest.at < SCAN_ASK_GAP)
    return { phase: 'running', hidden: false, progress: null, run: null };
  // A mark left behind, or progress gone quiet with no mark and no report for its run:
  // the scan stopped before it could finish (the last good scan stays).
  const reported = (run) => !!run && isObj(scanReport) && scanReport.run === run;
  if (mark && !reported(mark.run)) return { phase: 'stopped', hidden: false, progress: null };
  if (prog && now - prog.at >= PROGRESS_QUIET && !reported(prog.run))
    return { phase: 'stopped', hidden: false, progress: null };
  return { phase: 'idle', hidden: false, progress: null, run: null };
}

// The scan report to show, once: one newer than the last the popup showed.
export function newReport(report, seenAt) {
  if (!isObj(report) || report.v !== 1 || !Number.isFinite(report.at)) return null;
  return report.at > (Number.isFinite(seenAt) ? seenAt : 0) ? report : null;
}
// A report's length as { m, s }, or null.
export function took(ms) {
  if (!Number.isFinite(ms) || ms < 0) return null;
  const s = Math.max(1, Math.round(ms / 1000));
  return { m: Math.floor(s / 60), s: s % 60 };
}
// A report held before it read anything (`held`: 'busy' another page was scanning,
// 'no-rsi' no access to RSI, 'paused' status.json paused every part) never counts as a
// scan that went fine, and neither does one with a part not read or read only in part
// (`partial`, counted in `bad`) or one signed out of RSI.
const readAll = (r) => isObj(r) && !r.held && !r.bad && !r.signedOut;
// "Scanned in 38s": how long a scan that read everything took, or null.
export function reportDone(report) {
  return readAll(report) ? took(report.ms) : null;
}
// A report older than a scan since (`scannedAt` newer) says nothing any more.
const since = (report, scannedAt) =>
  Number.isFinite(scannedAt) && Number.isFinite(report.at) && scannedAt > report.at + 60e3;
// The rows of the last scan that went wrong (not read, or read only in part), unless a
// scan since went fine. Held reports read nothing: none.
export function reportTrouble(report, scannedAt) {
  if (!isObj(report) || report.held || !report.bad || report.signedOut) return [];
  if (since(report, scannedAt)) return [];
  return (Array.isArray(report.rows) ? report.rows : []).filter(
    (r) => isObj(r) && (!r.ok || !!r.partial),
  );
}
// A scan status.json paused (every part): its message (the status file's words, the
// ones the basic page shows), or ''.
export function reportPaused(report, scannedAt) {
  if (!isObj(report) || report.held !== 'paused' || since(report, scannedAt)) return '';
  const row = (Array.isArray(report.rows) ? report.rows : []).find(
    (r) => isObj(r) && typeof r.error === 'string' && r.error,
  );
  return row ? row.error : '';
}
// The sync after the scan asked first (state 'ask': an RSI account this link hasn't
// synced). The report keeps no handle, so it's the account the scan read: → { handle,
// record } for the question, or null.
export function reportPilot(report, { account, db } = {}) {
  const s = isObj(report) ? report.sync : null;
  if (!isObj(s) || s.state !== 'ask') return null;
  const live = account?.loggedIn ? account : null;
  const handle = String((live && live.nickname) || db?.owner?.nickname || '').trim();
  return handle ? { handle, record: (live && live.citizenRecord) || null } : null;
}

// --- Account Value since an earlier scan -----------------------------------------------
// The change since the newest earlier scan that valued differently (`valueOf` is
// OH.snapshotValue on today's prices, so pledges still owned count the same): → { delta,
// at } or null. The last snapshot is this scan itself, so it's left out.
export function valueSince(history, total, valueOf, scannedAt) {
  if (!Array.isArray(history) || !Number.isFinite(total) || typeof valueOf !== 'function')
    return null;
  const now = time(scannedAt);
  for (let i = history.length - 1; i >= 0; i--) {
    const s = history[i];
    if (!isObj(s) || !Array.isArray(s.items) || !Number.isFinite(s.at)) continue;
    if (now != null && s.at >= now - 60e3) continue;
    const v = valueOf(s);
    if (!Number.isFinite(v)) continue;
    const delta = Math.round(total - v);
    if (Math.abs(delta) >= 1) return { delta, at: s.at };
  }
  return null;
}

// --- Fleet News: the store alerts that are news for this hangar ------------------------
// Something on your Wishlist in the store, or a ship you own on sale (a warbond edition
// or a limited-time sale): up to `max`, the Wishlist first, unseen before seen.
const NEWS_WHY = ['wishlist', 'warbond', 'limited'];
export function fleetNews(items, unseen = new Set(), max = 3) {
  const rank = (m) =>
    (m.why.some((x) => x?.why === 'wishlist') ? 0 : 2) + (unseen.has(m.id) ? 0 : 1);
  return (Array.isArray(items) ? items : [])
    .filter((m) => isObj(m) && Array.isArray(m.why) && m.why.some((x) => NEWS_WHY.includes(x?.why)))
    .map((m, i) => ({ m, i, r: rank(m) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, max)
    .map((x) => x.m);
}

// The tab the popup opens on: Hangar while Fleet News has something unseen, else the
// one it was closed on.
export function openingTab(saved, newsUnseen) {
  if (newsUnseen > 0) return 'hangar';
  return TABS.includes(saved) ? saved : 'hangar';
}

// --- The Wishlist tab ----------------------------------------------------------------------
// The website's slug for a ship's name (its Ship Explorer's shipSlug), which its
// Wishlist keys use: "Zeus Mk II CL" → "zeus-mk-ii-cl".
export function shipSlug(name) {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[‘’'"“”]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// The account's Wishlist keys (the website's lib/wishlist.ts: ship:<slug>, sku:<n>,
// ccu:<n>) as rows, named from the sale feed the alerts keep (alertsFeed: every ship's
// name, and what's in the store with its price), then from `names` (slug → name, the
// ship list: ./wishlist.js shipNames). → { rows: [{ key, name, onSale, price }],
// unnamed }: a key nothing can name is counted, never guessed.
export function wishRows(keys, feed, names = null) {
  const ships = new Map();
  const items = new Map();
  for (const s of Array.isArray(feed?.ships) ? feed.ships : [])
    if (isObj(s) && s.slug && s.name) ships.set(s.slug, s.name);
  if (names instanceof Map)
    for (const [slug, name] of names) if (name && !ships.has(slug)) ships.set(slug, name);
  for (const i of Array.isArray(feed?.items) ? feed.items : [])
    if (isObj(i) && i.id) items.set(i.id, i);
  const cheapest = (slug) => {
    let best = null;
    for (const i of items.values())
      if ((i.kind === 'ship' || i.kind === 'vehicle') && i.ships?.includes(slug))
        if (!best || (i.price ?? Infinity) < (best.price ?? Infinity)) best = i;
    return best;
  };
  const rows = [];
  let unnamed = 0;
  for (const key of Array.isArray(keys) ? keys : []) {
    const [kind, id] = String(key).split(':');
    if (kind === 'ship') {
      const name = ships.get(id);
      if (!name) {
        unnamed++;
        continue;
      }
      const sale = cheapest(id);
      rows.push({ key, name, onSale: !!sale, price: sale?.price ?? null });
      continue;
    }
    const item = items.get(`${kind === 'ccu' ? 'upgrade' : 'sku'}-${id}`);
    if ((kind === 'sku' || kind === 'ccu') && item)
      rows.push({ key, name: item.name, onSale: true, price: item.price ?? null });
    else unnamed++;
  }
  return { rows, unnamed };
}

// --- openhangar.space in Settings ----------------------------------------------------------
// A sync that didn't go through: the website's pace held it back (a too-soon wait, with
// the time the next one can go), or the last one failed (`failed`: the message the popup
// or the last scan got). → { until, msg } or null. Nothing the popup starts tries again
// by itself (only the open basic page does, ui/basic/hub.svelte.js retryIfDue), so it
// never says it will.
export function syncTrouble({ connected, failed }, now = Date.now()) {
  if (!connected) return null;
  if (Number.isFinite(connected.waitUntil) && connected.waitUntil > now)
    return { until: connected.waitUntil, msg: '' };
  if (failed?.msg) return { until: null, msg: String(failed.msg) };
  return null;
}
// The last scan's sync, when it failed after the last sync that went through.
export function reportSyncFailed(report, link) {
  const s = isObj(report) ? report.sync : null;
  if (!isObj(s) || s.state !== 'error' || !s.msg) return null;
  const last = time(link?.lastSync);
  return last != null && Number.isFinite(s.at) && s.at <= last ? null : { msg: s.msg };
}

// The browser's shortcut that opens the popup (chrome.commands.getAll), '' when none
// is set, or null when this browser has no shortcuts (Firefox for Android).
export function popupShortcut(commands) {
  if (!Array.isArray(commands)) return null;
  const c = commands.find(
    (x) => x?.name === '_execute_action' || x?.name === '_execute_browser_action',
  );
  return c ? String(c.shortcut || '') : null;
}
