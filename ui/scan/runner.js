// The scan, for any extension page that runs one: the hidden scan page (src/scan.html,
// ./main.js) and the basic page in a tab when there's none (src/basic.html,
// ui/basic/hub.svelte.js). Plain JavaScript: no Svelte, no words a
// player reads, no clicks (the browser's asks need a click, so the page asks and passes
// the answers in). Every OH call (src/lib.js, window.OH) is made when it's needed, so a
// page or a test that swaps one out is heard.
//
// The scan is the dashboard's Scan All without the store check (src/dashboard.js
// runScan): one RSI account read, then the hangar, buy-backs and referrals, each saved
// as it lands, then a sync when connected, then up to BB_AUTO_MAX buy-back packs never
// read before, paced, in the background. What it's doing and how it went go to
// storage, for any page to show in its own words:
//   session scanRunning  { at, tabId, run, by }: renewed at most once a minute while the
//                        scan runs, removed at its end (src/background.js scanRunning,
//                        ui/popup/data.js scanBusy, ./sync-timing.js scanElsewhere)
//   session scanProgress { run, at, part, page, count, retry, pages }: about two writes
//                        a second at most (and one as each part starts, the newest
//                        always written), removed at the end. part: 'start' | 'account'
//                        | 'hangar' | 'buybacks' | 'referrals' | 'packs' | 'sync'. For
//                        packs, page is the packs read so far and count how many to read.
//                        pages: how many pages RSI's pager shows for the hangar and
//                        buy-backs (null without one; page = pages when a rescan found
//                        nothing changed). For referrals, page is the lists read of
//                        `pages` (3) and count the people read across them.
//   local scanReport     the last scan's report (REPORT_V, below), ids and counts only
//   local scanStarted    { run, by, reason, at }: the last scan that began. Unlike the
//                        session marks it outlasts the browser closing mid-scan (the
//                        hidden page goes with it), so a start with no report for its
//                        run is a scan that stopped (#665). reason 'auto': Auto Scan
//                        Daily's full read (below), written only once one begins
//   local scanFull       { hangar?, buybacks?, referral? }: each part's scan time from
//                        its last read that was whole (./auto.js fullDue)
//   local autoScan       Auto Scan Daily's last run (autoScan(), ./auto.js record)
//   local avatarImg      { nickname, src, at, url }: a small copy of the RSI portrait
//                        (src: a data URL; url: the RSI address it's a copy of, so it's
//                        read again only when that changes). A page shows src, never an
//                        RSI address: the popup never asks RSI anything.
//   session avatarMiss   { nickname, url, at }: a portrait that couldn't be copied, not
//                        asked for again until its address changes or the browser starts
//                        again
import { afterScan, retryDue, scanElsewhere, syncWhen } from './sync-timing.js';
import { importWishlist } from './wishlist-import.js';
import {
  ASKS,
  PARTS,
  PAUSE_ID,
  bigDrop,
  connectedPilot,
  fullDue,
  goneCount,
  lineOf,
  newBuybackIds,
  owedSync,
  record,
  retryAtOf,
  sameHandle,
  syncTriedAfter,
} from './auto.js';

export const BB_AUTO_MAX = 30; // src/dashboard.js: never-read packs read after a scan
export const MARK_GAP = 60e3; // scanRunning renewed at most this often
export const PROGRESS_GAP = 500; // scanProgress written at most this often
export const AVATAR_MAX = 64 * 1024; // the portrait's data URL, characters
export const REPORT_V = 1;
// The portrait is copied only from RSI's own site (the scan's one host): anywhere else
// would be a request the extension's pages may not send.
const AVATAR_ORIGIN = 'https://robertsspaceindustries.com/';
const AVATAR_TYPES = /^image\/(png|jpeg|gif|webp)$/;
// The flight log's names for the report rows (never shown as copy).
const LOG_NAMES = { hangar: 'Hangar', buybacks: 'Buy-Backs', referrals: 'Referrals' };
// OH.getReferral's lists, in the order it reads them (src/lib.js).
const REFERRAL_LISTS = ['recruits (legacy)', 'recruits (current)', 'prospects'];
// RSI still asking a scan to slow down after every retry: how long the popup holds Scan
// back (ui/popup/data.js scanHold), RSI's Retry-After within these bounds.
export const WAIT_DEFAULT = 5 * 60e3; // no Retry-After
export const WAIT_MAX = 30 * 60e3;

// The report's `wait`: when RSI said a part could be asked again (ms), when a part
// stopped on RSI's slow-down (`slowDown`, src/lib.js scanSource), else null.
// `parse`: OH.retryAfterMs.
export function scanWait(results, at, parse) {
  const slow = (results || []).filter((r) => r?.slowDown);
  if (!slow.length || !Number.isFinite(at)) return null;
  const ms = Math.max(...slow.map((r) => (parse && parse(r.retryAfter, at)) || WAIT_DEFAULT));
  return at + Math.min(WAIT_MAX, ms);
}

// A run id: one per page that scans, so its own mark is never another page's scan.
export function newRun() {
  const bytes = globalThis.crypto?.getRandomValues?.(new Uint8Array(6));
  const tail = bytes
    ? [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
    : Math.random().toString(16).slice(2, 14);
  return `${Date.now().toString(36)}-${tail}`;
}

// The stored buy-backs with their type as the lists read it.
export function buybacksOf(db) {
  return (db?.sources?.buybacks?.items || []).map((b) => ({
    ...b,
    kind: globalThis.OpenHangar?.classifyBuyback?.(b.name, b.contains) || b.kind,
  }));
}

// Bytes → base64, in slices (a big spread would overflow the call stack).
function base64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// env:
//   OH        window.OH (src/lib.js)
//   store     chrome.storage.local
//   session   chrome.storage.session, or null where there's none
//   me        { by: 'tab' | 'offscreen' | 'frame', tabId, run }: tabId a number, null,
//             or a promise of one (a page that learns its tab late); run from newRun()
//   mayReadRsi () → Promise<boolean>: may this page read robertsspaceindustries.com
//   mayShare  () → Promise<boolean>: may this page send to openhangar.space (Firefox's
//             yes; a page asks on a click, this is the answer without one)
//   now       () → ms (Date.now)
//   rsiCookie () → Promise<'in' | 'out' | null>: whether RSI's sign-in cookie is in this
//             browser, and nothing more (ui/popup/rsi-cookie.js), for Auto Scan Daily's
//             signed-out days (optional: without it, RSI is asked)
//   fetchFn   the network (fetch), appVersion the extension's version (both optional)
//   hooks     what the page draws, all optional: start(), progress(p) (unthrottled),
//             account(account, switched) and scanned(report, { db }) (awaited, in the
//             scan's order), syncStart(), synced(result) (awaited), packs(result)
export function createRunner(env) {
  const { OH, store, me } = env;
  const session = env.session || null;
  const hooks = env.hooks || {};
  const now = env.now || (() => Date.now());
  const mayReadRsi = env.mayReadRsi || (async () => true);
  const mayShare = env.mayShare || (async () => true);
  const fetchFn = env.fetchFn || ((...a) => globalThis.fetch(...a));
  const appVersion = () =>
    env.appVersion ?? globalThis.chrome?.runtime?.getManifest?.()?.version ?? null;
  // This build's flags (src/flags.js), as ui/lib/flags.js reads them.
  const flag = (name) => OH?.flags?.[name] === true;
  const myTab = async () => (await me.tabId) ?? null;

  // --- Session marks ------------------------------------------------------------------
  // Every session write in one queue, so the end's removals land after the last write.
  let writes = Promise.resolve();
  const queue = (fn) => (writes = writes.then(fn).catch(() => {}));

  let markAt = 0;
  function mark(on) {
    if (!session) return;
    const at = now();
    if (on && markAt && at - markAt < MARK_GAP) return;
    markAt = on ? at : 0;
    queue(async () =>
      on
        ? session.set({ scanRunning: { at, tabId: await myTab(), run: me.run, by: me.by } })
        : session.remove('scanRunning'),
    );
  }

  let progressNow = null; // the newest progress, written or waiting
  let progressAt = 0;
  let progressPart = null;
  let progressTimer = null;
  function setProgress(part, page = null, count = null, retry = null, pages = null) {
    const p = {
      part,
      page,
      count,
      retry: retry ? { attempt: retry.attempt, of: retry.of } : null,
      pages: Number.isInteger(pages) && pages > 0 ? pages : null,
    };
    hooks.progress?.(p);
    if (!session) return;
    progressNow = { run: me.run, at: now(), ...p };
    const wait = PROGRESS_GAP - (now() - progressAt);
    if (part !== progressPart || !progressAt || wait <= 0) return writeProgress();
    progressTimer ??= setTimeout(writeProgress, wait);
  }
  function writeProgress() {
    clearTimeout(progressTimer);
    progressTimer = null;
    if (!progressNow) return;
    const scanProgress = progressNow;
    progressAt = now();
    progressPart = scanProgress.part;
    queue(() => session.set({ scanProgress }));
  }
  function endProgress() {
    clearTimeout(progressTimer);
    progressTimer = null;
    const was = progressNow || progressAt;
    progressNow = null;
    progressAt = 0;
    progressPart = null;
    if (session && was) queue(() => session.remove('scanProgress'));
  }
  // A page that goes away mid-scan takes its marks with it.
  globalThis.addEventListener?.('pagehide', () => {
    if (markAt) session?.remove('scanRunning').catch(() => {});
    if (progressNow || progressAt) session?.remove('scanProgress').catch(() => {});
  });

  // Another page scanning right now (its scanRunning mark): this one's Scan waits, and
  // so does any sync (./sync-timing.js).
  let busy = false;
  async function otherScan() {
    if (busy || !session) return false;
    const { scanRunning } = await session.get('scanRunning');
    return scanElsewhere(scanRunning, { tabId: await myTab(), run: me.run }, now());
  }

  // Buy-back details are saved a moment after they change (src/lib.js): saved now, and
  // every queued save landed, so whatever reads storage next has it all.
  async function settle() {
    await OH.flushBuybackDetails?.();
    await OH.storageSettled?.();
  }

  const writeReport = (report) => store.set({ scanReport: report }).catch(() => {});

  // --- Account ------------------------------------------------------------------------
  // The live hangar belongs to the RSI account signed in here: another one's is parked
  // and comes back when you sign in as them (OH.switchProfile). → { who, restored } when
  // it switched, else null. `owner`: the live hangar's, when the page has it at hand.
  async function reconcile(acct, { owner } = {}) {
    if (!acct?.loggedIn || !acct.nickname) return null;
    const own = owner !== undefined ? owner : (await OH.loadDB()).owner;
    if (!own?.nickname) return null;
    if (acct.nickname.toLowerCase() === String(own.nickname).toLowerCase()) return null;
    const who = acct.displayname || acct.nickname;
    const { restored } = await OH.switchProfile(acct.nickname, acct.displayname);
    return { who, restored: !!restored };
  }

  // The portrait, copied while the scan is reading RSI anyway: a data URL of at most
  // AVATAR_MAX characters, read again only when RSI's address for it changes. The copy
  // is always the signed-in pilot's picture or nothing: when there's no new one (another
  // host, too big, not a picture, no network), the one kept goes. One that couldn't be
  // copied isn't asked for again in this browser session (session avatarMiss).
  let missed = null; // avatarMiss, for a page without session storage
  // `pause`: waited before the picture is asked for (Auto Scan Daily's OH.autoPause).
  async function keepPortrait(acct, { pause } = {}) {
    try {
      const url = typeof acct?.avatar === 'string' ? acct.avatar : '';
      const nickname = acct?.nickname;
      if (!acct?.loggedIn || !nickname) return;
      const { avatarImg: had } = await store.get('avatarImg');
      if (had?.src && had.url === url && had.nickname === nickname) return;
      const src = url.startsWith(AVATAR_ORIGIN) ? await portraitOf(url, nickname, pause) : null;
      if (src) await store.set({ avatarImg: { nickname, src, at: now(), url } });
      else if (had) await store.remove('avatarImg');
    } catch {
      /* the portrait is optional */
    }
  }
  // → the picture at `url` as a data URL, or null (that address missed before, or now).
  async function portraitOf(url, nickname, pause) {
    const miss = session ? (await session.get('avatarMiss')).avatarMiss : missed;
    if (miss?.url === url && miss.nickname === nickname) return null;
    await pause?.();
    const src = await copyPortrait(url).catch(() => null);
    if (src) return src;
    missed = { nickname, url, at: now() };
    await session?.set({ avatarMiss: missed });
    return null;
  }
  async function copyPortrait(url) {
    const res = await fetchFn(url, {
      credentials: 'omit',
      signal: globalThis.AbortSignal?.timeout?.(5000), // the scan waits for it
    });
    const type = String(res?.headers?.get?.('content-type') || '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    const most = Math.floor(((AVATAR_MAX - `data:${type};base64,`.length) * 3) / 4);
    if (!res?.ok || !AVATAR_TYPES.test(type) || Number(res.headers.get('content-length')) > most)
      return void res?.body?.cancel?.().catch(() => {});
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length || bytes.length > most) return null;
    const src = `data:${type};base64,${base64(bytes)}`;
    return src.length > AVATAR_MAX ? null : src;
  }

  // --- Scan ---------------------------------------------------------------------------
  // A part stopped because RSI changed its page (src/lib.js scanSource `pageChanged`):
  // its row says so, for the popup's scan bar (ui/popup/data.js reportPageChanged).
  const changedOf = (r) => (r?.pageChanged ? { pageChanged: true } : {});
  const row = (id, r, n) =>
    r?.ok
      ? { id, ok: true, partial: r.partial || null, n, error: null }
      : { id, ok: false, partial: null, n: null, error: r?.error ?? null, ...changedOf(r) };
  const progress = (part) => (page, count, retry, pages) => {
    mark(true);
    setProgress(part, page, count, retry, pages);
  };
  // Referrals' progress: OH.getReferral reads three lists in turn, each counting from 0.
  const referralProgress = () => {
    const say = progress('referrals');
    let list = null;
    let before = 0; // people read in the lists done
    let last = 0;
    return (phase, n) => {
      if (phase !== list) {
        before += last;
        last = 0;
        list = phase;
      }
      last = Number.isFinite(n) ? n : 0;
      say(Math.max(0, REFERRAL_LISTS.indexOf(phase)), before + last, null, REFERRAL_LISTS.length);
    };
  };

  // → the report (REPORT_V): { v, run, by, reason, startedAt, at, ms, held, signedOut,
  // switched, rows: [{ id, ok, partial, n, error }], bad, sync }, or null when this page
  // is scanning already. A row's ok: that part was read and saved (partial: why it's
  // short); bad: true when a row isn't ok or is partial. held: 'busy' (another page is
  // scanning), 'no-rsi' (no access to RSI: nothing read), 'paused' (status.json paused
  // every part), else null. sync: the sync after it (see sync()), null when there was
  // none. wait: when RSI kept asking it to slow down, the time it may be asked again
  // (scanWait), else null; absent from a held report. rsiDown: a part RSI didn't answer
  // for (a 5xx, or a 429 after every retry), whether or not it also asked to wait; the
  // popup and the basic page say so instead of showing the error or Log In to RSI.
  let starting = false;
  let marked = Promise.resolve(); // marked(), below
  // The start every scan shares (Scan's and Auto Scan Daily's): → true once this page is
  // scanning (busy, its mark and its progress), null when it's scanning already
  // (`marked` stays the running scan's), else what `held(why)` gives: another page is
  // scanning ('busy': two at once would read RSI twice) or there's no access to RSI
  // ('no-rsi': no scan that can only fail; the page asks instead). `started()` runs as
  // it begins.
  async function begin({ held = async () => false, started = () => {} } = {}) {
    if (busy || starting) return null;
    starting = true;
    let markedDone;
    marked = new Promise((r) => (markedDone = r));
    try {
      if (await otherScan()) return await held('busy');
      if (!(await mayReadRsi())) {
        OH.log('info', 'status', 'scan held: no access to robertsspaceindustries.com');
        return await held('no-rsi');
      }
      busy = true;
    } finally {
      starting = false;
      if (!busy) markedDone();
    }
    hooks.start?.();
    started();
    setProgress('start');
    mark(true);
    writes.then(markedDone);
    return true;
  }

  // The parts read whole (local scanFull: each one's scan time; null takes one out).
  async function noteFull(times) {
    const { scanFull: was } = await store.get('scanFull');
    const next = was && typeof was === 'object' && !Array.isArray(was) ? { ...was } : {};
    for (const [p, at] of Object.entries(times))
      if (Number.isFinite(at)) next[p] = at;
      else delete next[p];
    await store.set({ scanFull: next });
  }

  async function scan({ reason = 'page' } = {}) {
    const startedAt = now();
    const base = { v: REPORT_V, run: me.run, by: me.by, reason, startedAt };
    const held = async (why) => {
      const report = {
        ...base,
        at: now(),
        ms: 0,
        held: why,
        signedOut: false,
        switched: null,
        rows: [],
        bad: false,
        sync: null,
      };
      await writeReport(report);
      return report;
    };
    const go = await begin({
      held,
      started: () =>
        store
          .set({ scanStarted: { run: me.run, by: me.by, reason, at: startedAt } })
          .catch(() => {}),
    });
    if (go !== true) return go;
    const rows = [];
    const paused = new Set();
    let signedOut = false;
    let switched = null;
    let db = null;
    let wait = null;
    let rsiDown = false; // a part RSI didn't answer for (a 5xx, or a 429 after every retry)
    try {
      setProgress('account');
      const account = (await OH.getAccount({ force: true }).catch(() => null)) || undefined;
      switched = await reconcile(account);
      await hooks.account?.(account, switched);
      // Signed out: RSI's signed-out pages read as an empty hangar, and a scan of
      // nothing must never be saved over yours.
      signedOut = account?.loggedIn === false;
      if (!signedOut) {
        await keepPortrait(account);
        const h = await OH.scanSource('hangar', progress('hangar'), { account });
        if (h?.paused) paused.add('hangar');
        if (h?.rsiDown) rsiDown = true;
        rows.push(row('hangar', h, h?.items?.length ?? 0));
        const b = await OH.scanSource('buybacks', progress('buybacks'), { account });
        if (b?.paused) paused.add('buybacks');
        if (b?.rsiDown) rsiDown = true;
        rows.push(row('buybacks', b, b?.items?.length ?? 0));
        wait = scanWait([h, b], now(), OH.retryAfterMs);
        const r = await OH.getReferral(referralProgress(), { account });
        if (r?.paused) paused.add('referrals');
        if (r?.rsiDown) rsiDown = true;
        if (r) rows.push(row('referrals', r, null));
        // The parts read whole, for Auto Scan Daily's weekly full read (./auto.js).
        const whole = {};
        for (const [p, got] of [
          ['hangar', h],
          ['buybacks', b],
          ['referral', r],
        ])
          if (got?.ok && !got.partial && Number.isFinite(got.scannedAt)) whole[p] = got.scannedAt;
        if (Object.keys(whole).length) await noteFull(whole).catch(() => {});
        db = await OH.loadDB();
        // Buy-backs filled from your own hangar history first (no RSI read), as the
        // dashboard does.
        if (b?.ok)
          await OH.fillBuybackDetailsFromHistory(buybacksOf(db), {
            history: await OH.getHistory(),
          }).catch((e) =>
            OH.log('warn', 'buybacks', `details from history failed: ${e?.message || e}`),
          );
      }
    } catch (e) {
      rows.push({
        id: 'hangar',
        ok: false,
        partial: null,
        n: null,
        error: String(e?.message || e),
      });
    }
    const bad = rows.some((r) => !r.ok || !!r.partial);
    if (signedOut || bad)
      OH.log(
        'error',
        'status',
        rows
          .map((r) => `${LOG_NAMES[r.id]}: ${r.ok && !r.partial ? 'ok' : 'problem'}`)
          .join(' · ') || 'signed out',
      );
    await settle();
    busy = false;
    mark(false);
    const report = {
      ...base,
      at: now(),
      ms: now() - startedAt,
      held: rows.length && rows.every((r) => paused.has(r.id)) ? 'paused' : null,
      signedOut,
      switched,
      rows,
      bad,
      sync: null,
      wait,
      rsiDown,
    };
    await writeReport(report);
    // Whatever the page or the sync does next, the progress goes at the end.
    try {
      await hooks.scanned?.(report, { db });
      // Connected: every finished scan syncs once, with the whole hangar, as the
      // dashboard's does. A sync asked for while it ran (Connect, Sync Now, the
      // website's Sync My Hangar Now) was kept for this one (#658). This scan's mark is
      // gone first, so the sync doesn't wait on it.
      await writes;
      const isLinked = await linked();
      const go = afterScan({ linked: isLinked, signedOut, kept: await takeKeptSync() });
      if (go) {
        setProgress('sync');
        const s = await sync({ auto: go.auto, scanDone: true });
        report.sync = s && { state: s.state, msg: s.msg, at: s.at };
      } else if (!isLinked) report.sync = { state: 'off', msg: null, at: now() };
    } finally {
      endProgress();
    }
    if (report.sync) await writeReport(report);
    // Packs never read: their contents, paced, in the background (Scan stays fast).
    if (rows.some((r) => r.id === 'buybacks' && r.ok && !r.partial))
      readPacks({ db }).catch(() => {});
    return report;
  }

  // Up to `max` buy-back packs never read (or only half read), paced (src/lib.js
  // fetchBuybackDetails). One read at a time: asked again while it runs, the answer is
  // that one's. → { todo, done, errors, rateLimited?, retryAt? }, once every detail read
  // is saved.
  let packs = null;
  function readPacks(opts) {
    return (packs ??= readPacksNow(opts).finally(() => (packs = null)));
  }
  async function readPacksNow({ max = BB_AUTO_MAX, db } = {}) {
    const details = await OH.getBuybackDetails();
    const todo = buybacksOf(db || (await OH.loadDB()))
      .filter((b) => !b.isCCU && (b.kind === 'pack' || b.kind === 'package'))
      .filter((b) => !details[b.id] || details[b.id].partial)
      .slice(0, max)
      .map((b) => String(b.id));
    if (!todo.length) return { todo: 0, done: 0, errors: 0 };
    // A scan's own progress comes first: packs read meanwhile don't say so.
    const say = (page, count) => !busy && setProgress('packs', page, count);
    let out = null;
    try {
      say(0, todo.length);
      out = await OH.fetchBuybackDetails(todo, say);
    } finally {
      await settle();
      if (!busy) endProgress();
      await hooks.packs?.(out);
    }
    const slow = out?.rateLimited ? { rateLimited: true, retryAt: out.retryAt ?? null } : {};
    return { todo: todo.length, done: out?.done ?? 0, errors: out?.errors ?? 0, ...slow };
  }

  // --- openhangar.space ---------------------------------------------------------------
  // Connected: the website is on in this build and this browser has a link.
  async function linked() {
    return (await OH.siteEnabled()) ? !!(await OH.getSiteLink()) : false;
  }

  // A sync: Sync Now (a press), the sync after a scan (`auto`, `scanDone`) and the one
  // try more after the website's pace held one back (`again`, retryIfDue). `asked`: the
  // page's answer from a click (Firefox's ask), else mayShare(). While a scan runs (here
  // or in another page) it's kept for the scan's own sync at its end (syncAfterScan,
  // session storage), so the website gets the whole hangar, never half of one (#658).
  // → null when it didn't run (one is running, not connected), else { state, msg, at }
  // (+ ask: { handle, record } for 'ask'). state: 'sent'; 'kept' (for the scan running
  // now); 'off' (Firefox hasn't let it share; for a report, also not connected); 'held'
  // (the website's pace or opening date held it: msg is the website's words), 'calm'
  // (a refusal that isn't a problem: msg), 'error' (msg), 'ask' (an RSI account this
  // link hasn't synced: the page asks), 'quiet' (an account you said no to).
  // `syncing` only once it's being sent: a press that's only being kept never stops the
  // scan's own sync at its end. A refusal from the website carries its HTTP `status`.
  // `wishlist: false` (Auto Scan Daily): the old wishlist isn't sent after it.
  let syncing = false;
  async function sync({
    auto = false,
    scanDone = false,
    again = false,
    asked,
    wishlist = true,
  } = {}) {
    if (syncing) return null;
    if (!(await linked())) return null;
    let result;
    if (!(await (asked || mayShare()))) result = { state: 'off', msg: null, at: now() };
    else {
      const when = syncWhen({ busyHere: busy, elsewhere: await otherScan(), scanDone });
      if (when === 'after-scan') {
        await keepSyncForScan(auto);
        result = { state: 'kept', msg: null, at: now() };
      }
    }
    if (result) {
      await hooks.synced?.(result);
      return result;
    }
    if (syncing) return null;
    syncing = true;
    try {
      await hooks.syncStart?.();
      try {
        await OH.siteSync({ auto });
        await store.remove('siteSyncAgain');
        result = { state: 'sent', msg: null };
      } catch (err) {
        if (err?.ask) {
          result = { state: 'ask', msg: null, ask: err.ask };
          OH.log('info', 'site', 'asked before syncing an RSI account new to this link');
        } else if (err?.quiet) {
          result = { state: 'quiet', msg: null };
        } else {
          const msg = String(err?.message || err);
          result = { state: err?.held ? 'held' : err?.calm ? 'calm' : 'error', msg };
          if (Number.isInteger(err?.status)) result.status = err.status;
          OH.log(err?.calm ? 'info' : 'warn', 'site', msg);
        }
        // Held back by the website's pace ("synced moments ago"): tried once more when
        // the wait is over, so the newest scan still reaches the website.
        if (!again && !err?.ask && !err?.quiet) {
          const wait = OH.siteSyncWait(await OH.getSiteLink().catch(() => null));
          if (wait?.reason === 'too-soon') await store.set({ siteSyncAgain: { at: now(), auto } });
        }
      }
      result.at = now();
      syncing = false;
      await hooks.synced?.(result);
      if (wishlist) await wishlistToAccount();
      return result;
    } finally {
      syncing = false;
    }
  }
  // A sync asked for during a scan, for the scan's own sync (afterScan). One asked for
  // by a press (not `auto`) stays one, whatever is kept after it.
  async function keepSyncForScan(auto) {
    if (!session) return;
    const { syncAfterScan: prev } = await session.get('syncAfterScan');
    await session.set({ syncAfterScan: { at: now(), auto: auto && prev?.auto !== false } });
    OH.log('info', 'site', 'sync kept until the scan running now is done');
  }
  async function takeKeptSync() {
    if (!session) return null;
    const { syncAfterScan: kept } = await session.get('syncAfterScan');
    if (kept) await session.remove('syncAfterScan');
    return kept || null;
  }
  // The one try more for a sync the website's pace held back (siteSyncAgain), once no
  // wait holds it. `link`: the stored link, when the page has it at hand.
  async function retryIfDue(link) {
    if (link === undefined) link = await OH.getSiteLink().catch(() => null);
    const { siteSyncAgain: again } = await store.get('siteSyncAgain');
    if (!retryDue(again, OH.siteSyncWait(link))) return null;
    await store.remove('siteSyncAgain');
    return sync({ auto: again.auto !== false, again: true });
  }

  // The 0.3.x wishlist into the account, once per connection (./wishlist-import.js).
  // Only in a build with the `wishlistImport` flag (off until the privacy policy names it),
  // only once Firefox lets this extension share (the same yes sync needs), and never in a
  // loop: a website that doesn't take it yet is asked again hours later.
  let wishImporting = false;
  async function wishlistToAccount() {
    if (!flag('wishlistImport')) return;
    if (wishImporting) return;
    wishImporting = true;
    try {
      if (!(await linked()) || !(await mayShare())) return;
      const r = await importWishlist({
        store,
        fetchFn,
        siteUrl: await OH.siteUrl(),
        appVersion: appVersion(),
      });
      if (r === 'later') OH.log('info', 'site', 'wishlist not taken by the website yet; later');
    } catch (e) {
      OH.log('warn', 'site', `wishlist import: ${e?.message || e}`);
    } finally {
      wishImporting = false;
    }
  }

  // --- Auto Scan Daily (#666) ---------------------------------------------------------
  // The daily run src/background.js asks the hidden scan page for (./main.js), and only
  // that page: no tab, no report (scanReport stays Scan's), no pack reads, no
  // notifications. What it reads, keeps and sends is the privacy policy's Auto Scan
  // Daily section, word for word:
  //   1. Local checks, nothing asked of RSI: still connected and switched on; not paused
  //      (status.json `autoScan` or `hangar`); the live hangar is one this link syncs.
  //   2. Signed in? RSI's sign-in cookie missing: signed out, and RSI isn't asked. Else
  //      one read of who is signed in: the live hangar's own account, or (no hangar yet)
  //      one this link syncs. It never switches accounts (no reconcile here).
  //   3. A quick check, unless a full read is due (./auto.js fullDue): the newest page of
  //      the hangar, then of buy-backs. Nothing new: it stops there, saves nothing and
  //      sends nothing.
  //   4. A full read, part by part (hangar, buy-backs, referrals), each kept only when it
  //      was read whole, from the account it started on (asked again after each part),
  //      and, for the hangar, without a sudden drop that new buy-backs don't explain.
  //      A part not kept keeps your last good scan and is due next time.
  //   5. Its record (local autoScan, ./auto.js record), then the sync of what it saved
  //      (or of a saved scan whose sync never went out).
  const AUTO_ON = 'autoScanOn';
  const AUTO_STATE = 'autoScan';
  async function autoScan() {
    const startedAt = now();
    if ((await begin()) !== true) return null; // another page is scanning, or no RSI access
    const run = {
      line: null, // the record's line, or null (no line of its own)
      noRecord: false, // ended before anything: no record at all
      full: false, // a full read began (scanStarted)
      down: false, // RSI didn't answer: the next run backs off
      retryAfter: null,
      owed: false, // a saved scan's sync never went out
      mayOwe: false, // and it may go at the end
      stop: null, // 'bad' | 'out' | 'partway': no part read after it
      dropped: false, // the hangar dropped with nothing to explain it
      saved: [], // the parts kept
      changed: false, // a part kept is different from before
      pageChanged: null, // the part whose page RSI changed (nothing of it kept)
    };
    let was = null;
    try {
      was = (await store.get(AUTO_STATE))[AUTO_STATE] || null;
      await autoRun(run, startedAt, was);
    } catch (e) {
      OH.log('warn', 'status', `auto scan stopped: ${e?.message || e}`);
      run.line = run.full ? 'partway' : null;
    } finally {
      await settle();
      busy = false;
      mark(false);
    }
    // RSI didn't answer and nothing else explains the run (no part stopped partway): its
    // own line, a day skipped.
    if (run.down && !run.line && !run.stop) run.line = 'rsi-down';
    let rec = null;
    try {
      if (!run.noRecord) {
        const at = now();
        // A run that didn't finish backs off, whatever stopped it: RSI not answering, or
        // a part stopped partway (so a page RSI changed isn't read in full every day).
        const failed = run.down || run.line === 'partway' || run.line === 'out-partway';
        const fails = failed ? (Number(was?.fails) || 0) + 1 : 0;
        // The last run asked for a scan: whether one saved since (./auto.js record).
        const savedAt = ASKS.includes(was?.line)
          ? ((await OH.loadDB().catch(() => null))?.sources?.hangar?.scannedAt ?? null)
          : null;
        rec = record(was, {
          at: startedAt,
          ended: at,
          line: run.line,
          run: run.full ? me.run : null,
          startedAt: run.full ? startedAt : null,
          fails,
          retryAt: retryAtOf({ at, fails, retryAfter: run.retryAfter }),
          savedAt,
          pageChanged: run.pageChanged,
        });
        // Written before the sync: a browser that closes during it still has the run.
        await store.set({ autoScan: rec });
      }
      // The sync of what it saved, or of a saved scan whose sync never went out, and one
      // a page kept for the end of this run (#658). Never after a disconnect (sync()).
      await writes;
      const kept = await takeKeptSync();
      if (kept || run.saved.length || (run.owed && run.mayOwe)) {
        setProgress('sync');
        const s = await sync({
          auto: kept ? kept.auto !== false : true,
          scanDone: true,
          wishlist: false,
        });
        if (s && rec) {
          const tried = syncTriedAfter(s, OH.syncStamp(await OH.loadDB()), rec.syncTried);
          if (tried !== rec.syncTried) {
            rec = { ...rec, syncTried: tried };
            await store.set({ autoScan: rec });
          }
        }
      }
    } finally {
      endProgress();
    }
    return rec;
  }
  const autoLineOf = (run) =>
    lineOf({
      bad: run.stop === 'bad' || run.dropped,
      out: run.stop === 'out',
      partway: run.stop === 'partway',
      changed: run.changed,
    });
  // RSI didn't answer: the next run backs off (its Retry-After, if it sent one).
  const autoDown = (run, r) => {
    run.down = true;
    run.retryAfter = r?.retryAfter ?? run.retryAfter ?? null;
  };
  // Still connected and switched on (checked before each part, too).
  const autoOn = async () => (await linked()) && (await store.get(AUTO_ON))[AUTO_ON] === true;

  async function autoRun(run, startedAt, was) {
    // 1. Local checks: nothing asked of RSI.
    if (!(await autoOn())) return void (run.noRecord = true);
    if ((await OH.sourcePaused('autoScan')) || (await OH.sourcePaused('hangar')))
      return void (run.line = 'paused');
    const db = await OH.loadDB();
    const link = await OH.getSiteLink();
    const profiles = await OH.listProfiles().catch(() => []);
    const ours = (handle) => connectedPilot(handle, OH.sitePilotAnswer(link, { handle }), profiles);
    const owner = String(db?.owner?.nickname || '').trim();
    if (owner && !ours(owner)) return void (run.line = 'other');
    const paused = new Set();
    for (const p of PARTS)
      if (p !== 'hangar' && (await OH.sourcePaused(PAUSE_ID[p]))) paused.add(p);
    const { scanFull } = await store.get('scanFull');
    // A sync owed only counts when it can go (Firefox's yes to share): else it would read
    // everything every day for a sync that waits anyway.
    run.owed = owedSync({ stamp: OH.syncStamp(db), link, rec: was }) && (await mayShare());
    const due = fullDue(scanFull, db, paused, now(), { owed: run.owed });
    run.mayOwe = true;

    // 2. Signed in? Without RSI's sign-in cookie, signed out for sure: RSI isn't asked.
    setProgress('account');
    const cookie = env.rsiCookie ? await env.rsiCookie().catch(() => null) : null;
    if (cookie === 'out') return void (run.line = 'signed-out');
    const who = await OH.whoIsSignedIn();
    if (who?.state === 'out') return void (run.line = 'signed-out');
    if (who?.state !== 'in') return autoDown(run, who);
    if (owner ? !sameHandle(who.nickname, owner) : !ours(who.nickname)) {
      run.mayOwe = false;
      return void (run.line = 'other');
    }

    // 3. The quick check: the newest page of the hangar, then of buy-backs.
    if (!due) {
      setProgress('hangar');
      let peek = await OH.peekSource('hangar');
      if (peek?.same) {
        setProgress('buybacks');
        peek = await OH.peekSource('buybacks');
      }
      if (peek?.signedOut) return void (run.line = 'signed-out');
      if (peek?.error || !peek) return peek?.rsiDown ? autoDown(run, peek) : undefined;
      if (peek.same) return void (run.line = 'quick');
    }

    // 4. The full read.
    run.full = true;
    await store.set({ scanStarted: { run: me.run, by: me.by, reason: 'auto', at: startedAt } });
    setProgress('account');
    await OH.autoPause();
    const account = await OH.getAccount({ force: true, expect: who.nickname });
    if (account?.other) {
      run.mayOwe = false;
      return void (run.line = 'other');
    }
    if (account?.loggedIn === false) return void (run.line = 'signed-out');
    if (!account?.loggedIn) return autoDown(run, null);
    await keepPortrait(account, { pause: OH.autoPause });

    const before = Object.fromEntries(PARTS.map((p) => [p, db?.sources?.[p] || null]));
    const read = new Map(); // part → its result
    // The account it started on, asked again after a part: another one means nothing
    // more is read ('bad'); signed out, the part didn't finish ('out'); no answer, it
    // didn't finish either ('partway').
    const stillThem = async () => {
      await OH.autoPause();
      const got = await OH.whoIsSignedIn();
      if (got?.state === 'in' && sameHandle(got.nickname, who.nickname)) return true;
      if (got?.state === 'in') run.stop = 'bad';
      else if (got?.state === 'out') run.stop = 'out';
      else {
        run.stop = 'partway';
        autoDown(run, got);
      }
      return false;
    };
    // A hangar that suddenly drops much of what's in it is kept only when new buy-backs
    // explain it: buy-backs are read first then. If they don't finish, the hangar can't
    // be judged, and neither is kept.
    const keepHangar = async (items) => {
      const had = Array.isArray(before.hangar?.items) ? before.hangar.items : [];
      const gone = goneCount(had, items);
      if (!bigDrop({ saved: had.length, gone, next: items.length })) return true;
      let explained = 0;
      if (!paused.has('buybacks')) {
        const b = await readPart('buybacks');
        if (!b?.ok) {
          run.stop ||= 'partway';
          return false;
        }
        const bb = before.buybacks?.scannedAt ? before.buybacks.items || [] : null;
        explained = newBuybackIds(bb, b.items);
      }
      if (bigDrop({ saved: had.length, gone: Math.max(0, gone - explained), next: items.length })) {
        OH.log(
          'warn',
          'hangar',
          `auto scan: ${gone} pledges gone, ${explained} explained; not kept`,
        );
        run.dropped = true;
        return false;
      }
      return true;
    };
    const readPart = async (p) => {
      if (read.has(p)) return read.get(p);
      // Due from now until it's kept: a run that dies midway reads it in full next time.
      await noteFull({ [p]: null });
      const keep = async (got) => {
        if (!(await stillThem())) return false;
        return p === 'hangar' ? keepHangar(got.items) : true;
      };
      const r =
        p === 'referral'
          ? await OH.getReferral((phase, n) => progress('referrals')(null, n), {
              account,
              auto: true,
              keep,
            })
          : await OH.scanSource(p, progress(p), { account, auto: true, keep });
      read.set(p, r);
      if (r?.ok) {
        run.saved.push(p);
        if (Number.isFinite(r.scannedAt)) await noteFull({ [p]: r.scannedAt });
      } else if (!r?.paused && !r?.refused) {
        // Didn't finish (signed out midway: 'out'; RSI stopped answering, a page it
        // couldn't read, a save that failed: 'partway'): nothing more is read.
        run.stop ||= r?.signedOut ? 'out' : 'partway';
        if (r?.rsiDown) autoDown(run, r);
        if (r?.pageChanged) run.pageChanged ||= p;
      }
      return r;
    };
    for (const p of PARTS) {
      if (run.stop) break;
      if (read.has(p) || paused.has(p)) continue;
      if (!(await autoOn())) break; // switched off or disconnected: stops here
      setProgress(p === 'referral' ? 'referrals' : p);
      await readPart(p);
    }
    // Something wasn't kept: every part not kept is due (the popup asks for a scan).
    if (run.stop || run.dropped) {
      const left = PARTS.filter((p) => !paused.has(p) && !run.saved.includes(p));
      if (left.length) await noteFull(Object.fromEntries(left.map((p) => [p, null])));
    }

    // Buy-backs filled from your own hangar history (no RSI read), as Scan does. Never
    // the pack reads.
    const after = await OH.loadDB();
    if (run.saved.includes('buybacks'))
      await OH.fillBuybackDetailsFromHistory(buybacksOf(after), {
        history: await OH.getHistory(),
      }).catch((e) =>
        OH.log('warn', 'buybacks', `details from history failed: ${e?.message || e}`),
      );
    const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    run.changed = run.saved.some(
      (p) =>
        !same(before[p]?.items, after.sources?.[p]?.items) ||
        (p === 'buybacks' && !same(before[p]?.meta?.tokens, after.sources?.[p]?.meta?.tokens)),
    );
    run.line = autoLineOf(run);
  }

  return {
    scan,
    autoScan,
    readPacks,
    sync,
    keepSyncForScan,
    takeKeptSync,
    retryIfDue,
    wishlistToAccount,
    otherScan,
    reconcile,
    // Settles once the last scan asked for has its scanRunning mark stored, or won't
    // run (held, or this page scanning already): a page that hands a scan request back
    // then, so there's never a moment with neither.
    marked: () => marked,
    // Settles once the pack reads running now (the last scan's, or one asked for) are
    // done and saved: a page that closes after it loses nothing (./main.js).
    packsDone: () =>
      (packs || Promise.resolve()).then(
        () => {},
        () => {},
      ),
    get busy() {
      return busy;
    },
  };
}
