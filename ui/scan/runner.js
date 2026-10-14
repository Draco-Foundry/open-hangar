// The scan, for any extension page that runs one: the basic page today (src/basic.html,
// ui/basic/hub.svelte.js), a hidden page later. Plain JavaScript: no Svelte, no words a
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
//   session scanProgress { run, at, part, page, count, retry }: about two writes a
//                        second at most (and one as each part starts, the newest always
//                        written), removed at the end. part: 'start' | 'account'
//                        | 'hangar' | 'buybacks' | 'referrals' | 'packs' | 'sync'. For
//                        packs, page is the packs read so far and count how many to read.
//   local scanReport     the last scan's report (REPORT_V, below), ids and counts only
//   local avatarImg      { nickname, src, at, url }: a small copy of the RSI portrait
//                        (src: a data URL; url: the RSI address it's a copy of, so it's
//                        read again only when that changes). A page shows src, never an
//                        RSI address: the popup never asks RSI anything.
import { afterScan, retryDue, scanElsewhere, syncWhen } from './sync-timing.js';
import { importWishlist } from './wishlist-import.js';

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
  function setProgress(part, page = null, count = null, retry = null) {
    const p = { part, page, count, retry: retry ? { attempt: retry.attempt, of: retry.of } : null };
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
  // AVATAR_MAX characters, read again only when RSI's address for it changes. Anything
  // else (another host, too big, not a picture, no network) keeps what's there.
  async function keepPortrait(acct) {
    try {
      const url = typeof acct?.avatar === 'string' ? acct.avatar : '';
      const nickname = acct?.nickname;
      if (!acct?.loggedIn || !nickname || !url.startsWith(AVATAR_ORIGIN)) return;
      const { avatarImg: had } = await store.get('avatarImg');
      if (had?.src && had.url === url && had.nickname === nickname) return;
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
      if (!bytes.length || bytes.length > most) return;
      const src = `data:${type};base64,${base64(bytes)}`;
      if (src.length > AVATAR_MAX) return;
      await store.set({ avatarImg: { nickname, src, at: now(), url } });
    } catch {
      /* the portrait is optional */
    }
  }

  // --- Scan ---------------------------------------------------------------------------
  const row = (id, r, n) =>
    r?.ok
      ? { id, ok: true, partial: r.partial || null, n, error: null }
      : { id, ok: false, partial: null, n: null, error: r?.error ?? null };
  const progress = (part) => (page, count, retry) => {
    mark(true);
    setProgress(part, page, count, retry);
  };

  // → the report (REPORT_V): { v, run, by, reason, startedAt, at, ms, held, signedOut,
  // switched, rows: [{ id, ok, partial, n, error }], bad, sync }, or null when this page
  // is scanning already. A row's ok: that part was read and saved (partial: why it's
  // short); bad: the rows not ok or partial. held: 'busy' (another page is scanning),
  // 'no-rsi' (no access to RSI: nothing read), 'paused' (status.json paused every
  // part), else null. sync: the sync after it (see sync()), null when there was none.
  let starting = false;
  async function scan({ reason = 'page' } = {}) {
    if (busy || starting) return null;
    starting = true;
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
        bad: 0,
        sync: null,
      };
      await writeReport(report);
      return report;
    };
    try {
      // Another page is scanning: two at once would read RSI twice.
      if (await otherScan()) return await held('busy');
      // No access to RSI: no scan that can only fail. The page asks instead.
      if (!(await mayReadRsi())) {
        OH.log('info', 'status', 'scan held: no access to robertsspaceindustries.com');
        return await held('no-rsi');
      }
      busy = true;
    } finally {
      starting = false;
    }
    hooks.start?.();
    setProgress('start');
    mark(true);
    const rows = [];
    const paused = new Set();
    let signedOut = false;
    let switched = null;
    let db = null;
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
        rows.push(row('hangar', h, h?.items?.length ?? 0));
        const b = await OH.scanSource('buybacks', progress('buybacks'), { account });
        if (b?.paused) paused.add('buybacks');
        rows.push(row('buybacks', b, b?.items?.length ?? 0));
        const r = await OH.getReferral((phase, n) => progress('referrals')(null, n), { account });
        if (r?.paused) paused.add('referrals');
        if (r) rows.push(row('referrals', r, null));
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
    const bad = rows.filter((r) => !r.ok || r.partial).length;
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
    };
    await writeReport(report);
    await hooks.scanned?.(report, { db });
    // Connected: every finished scan syncs once, with the whole hangar, as the
    // dashboard's does. A sync asked for while it ran (Connect, Sync Now, the website's
    // Sync My Hangar Now) was kept for this one (#658). This scan's mark is gone first,
    // so the sync doesn't wait on it.
    await writes;
    const isLinked = await linked();
    const go = afterScan({ linked: isLinked, signedOut, kept: await takeKeptSync() });
    if (go) {
      setProgress('sync');
      const s = await sync({ auto: go.auto, scanDone: true });
      report.sync = s && { state: s.state, msg: s.msg, at: s.at };
    } else if (!isLinked) report.sync = { state: 'off', msg: null, at: now() };
    endProgress();
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
  let syncing = false;
  async function sync({ auto = false, scanDone = false, again = false, asked } = {}) {
    if (syncing) return null;
    syncing = true;
    let result;
    try {
      if (!(await linked())) return null;
      if (!(await (asked || mayShare()))) result = { state: 'off', msg: null, at: now() };
      else {
        const when = syncWhen({ busyHere: busy, elsewhere: await otherScan(), scanDone });
        if (when === 'after-scan') {
          await keepSyncForScan(auto);
          result = { state: 'kept', msg: null, at: now() };
        }
      }
      if (result) {
        syncing = false;
        await hooks.synced?.(result);
        return result;
      }
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
      await wishlistToAccount();
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

  return {
    scan,
    readPacks,
    sync,
    keepSyncForScan,
    takeKeptSync,
    retryIfDue,
    wishlistToAccount,
    otherScan,
    reconcile,
    // Every session write so far has landed (a page that hands a scan request back
    // once the scan has marked itself).
    written: () => writes,
    get busy() {
      return busy;
    },
  };
}
