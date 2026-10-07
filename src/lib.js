/*
 * lib.js — shared helpers + the SOURCE REGISTRY for the extension's UI pages.
 * ---------------------------------------------------------------------------
 * Scanning runs HERE (extension page context), not in a content script: the
 * extension's host_permissions for robertsspaceindustries.com let
 * fetch(..., { credentials: 'include' }) carry the existing RSI session cookie,
 * so we read the account with no RSI tab open. Parsing uses window.OpenHangar
 * (parser.js, DOMParser-based) — which is why this lives in a page, not the
 * service worker.
 *
 * Every data source is declared in OH.SOURCES. Adding a source = adding one
 * entry (+ a parser). The whole account is stored as one versioned database,
 * with its scan history in a key of its own:
 *   db:        { schemaVersion, sources: { hangar: { items, scannedAt }, … }, owner }
 *   dbHistory: [ { at, items: [[id, name, value]] } ]
 * OH.loadDB() returns both together ({ …db, history }). Exposed on window.OH.
 *
 * EXPORT shape (what a backend/consumer sees) is that same DB plus provenance
 * and a flattened identity block, ordered identity-first → holdings:
 *   { app, appVersion, exportedAt, schemaVersion,
 *     account: { handle, displayName, …, organization:{name,sid,rank,logo},
 *                balances:{storeCredit,uec,rec} },
 *     sources: { hangar, buybacks },
 *     history: [ { at, items: [[id, name, value]] } ],   // scan snapshots
 *     pledgeArchive: { [pledgeId]: { id, name, value, …, goneAt } } }  // OH.leanArchive
 * See OH.exportDB. Schema v2 added the `account` block (v1 had sources only).
 */

(function () {
  const OH = (window.OH = window.OH || {});

  const PAGE_SIZE = 10;
  const DELAY_MS = 400; // politeness throttle between pages
  const MAX_PAGES = 1000; // safety cap: 10,000 pledges at RSI's 10 per page
  // Skipping an unchanged hangar (#294): only within a day of the last full scan,
  // and only when the probe (3 pages at most) saves real work.
  const PROBE_MAX_AGE_MS = 24 * 3600e3;
  const PROBE_MIN_PAGES = 3;
  const DB_KEY = 'db';
  const HISTORY_KEY = 'dbHistory';
  const ARCHIVE_KEY = 'pledgeArchive'; // pledges gone from the hangar (see archiveGone)
  const CORRUPT_KEY = 'dbCorrupt';
  // Two version numbers (they were one, 2, until storage v3):
  //   DB_VERSION is how the database is stored in this browser. Changing that
  //   shape needs a MIGRATIONS step (see the Storage section).
  //     v1 → v2: unchanged (only the export gained `account`)
  //     v2 → v3: scan history moved out of `db` into its own key
  //   EXPORT_VERSION is the backup-file format (OH.exportDB / OH.importDB).
  //     v2 added the `account` block (identity, org/rank, balances); v1 had
  //     sources only. Keeping it at 2 lets older versions import new backups.
  const DB_VERSION = 3;
  const EXPORT_VERSION = 2;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // --- Outbound requests: a time limit and "that site is down" memory ----------
  // Requests to RSI's public pages and our own site's files go through
  // OH.guarded(fetchFn): it gives up after 8 seconds, and once a site times out,
  // can't be reached or answers 429/5xx, further calls to it fail at once for 10
  // minutes (remembered across page loads) instead of each waiting on it again.
  // Every caller already falls back to its cached copy when a request throws.
  // RSI scans don't use this: they have their own retries (fetchPage).
  const NET_TIMEOUT_MS = 8000;
  const NET_DOWN_MS = 10 * 60e3;
  const NET_KEY = 'netDown';
  const hostOf = (url) => {
    try {
      return new URL(String(url)).host;
    } catch {
      return '';
    }
  };
  OH.guarded = function guarded(fetchFn = fetch, { timeout = NET_TIMEOUT_MS } = {}) {
    return async (url, init = {}) => {
      const host = hostOf(url);
      const { [NET_KEY]: down = {} } = await chrome.storage.local.get(NET_KEY);
      if (host && Date.now() - (down[host] || 0) < NET_DOWN_MS) {
        throw new Error(`${host} didn't answer recently; trying again in a few minutes`);
      }
      const markDown = () =>
        host &&
        mutateStored(NET_KEY, (cur = {}) => {
          const now = Date.now();
          const out = {};
          for (const [h, at] of Object.entries(cur)) if (now - at < NET_DOWN_MS) out[h] = at;
          out[host] = now;
          return out;
        }).catch(() => {});
      try {
        const res = await fetchFn(url, {
          ...init,
          signal: init.signal || AbortSignal.timeout(timeout),
        });
        if (res.status === 429 || res.status >= 500) await markDown();
        return res;
      } catch (e) {
        await markDown();
        throw e;
      }
    };
  };

  // --- openhangar.space public feeds ------------------------------------------
  // Owner rule: the extension talks only to RSI and openhangar.space. Everything
  // else it shows (ship prices and art, the game version, referral events, the
  // store catalog, known issues, the latest Firefox version) comes from our own
  // site's public feeds: the same JSON for everyone, read-only, no cookies and
  // nothing about you sent. Polite: one request per feed at a time, at most once
  // per `ttl`, If-None-Match with the stored ETag (304 keeps the cached copy), and
  // on 429/5xx, a timeout or no network the cached copy stays and the feed waits
  // for Retry-After (else 10 minutes, doubling up to 6 hours) before asking again.
  // Never throws: → { data, at, etag } (the last good copy) or null (never loaded).
  OH.SITE_FEEDS = 'https://openhangar.space/';
  const FEED_RETRY_MS = 10 * 60e3;
  const FEED_RETRY_MAX = 6 * 3600e3;
  const feedInflight = new Map();
  // Retry-After (seconds or an HTTP date) → ms to wait, kept between 1 minute and a day.
  OH.retryAfterMs = function retryAfterMs(value, now = Date.now()) {
    const v = String(value || '').trim();
    if (!v) return 0;
    const ms = /^\d+$/.test(v) ? Number(v) * 1000 : Date.parse(v) - now;
    return Number.isFinite(ms) && ms > 0 ? Math.min(Math.max(ms, 60e3), 24 * 3600e3) : 0;
  };
  const isV1 = (j) => !!j && typeof j === 'object' && j.v === 1;
  const header = (res, name) => (res.headers && res.headers.get && res.headers.get(name)) || null;
  OH.siteFeed = function siteFeed(path, opts) {
    const id = opts.key;
    if (feedInflight.has(id)) return feedInflight.get(id);
    const p = readFeed(path, opts).finally(() => feedInflight.delete(id));
    feedInflight.set(id, p);
    return p;
  };
  async function readFeed(
    path,
    { key: feedKey, ttl, fetchFn = fetch, force = false, valid = isV1 },
  ) {
    let saved = null;
    try {
      saved = (await chrome.storage.local.get(feedKey))[feedKey] || null;
    } catch {
      saved = null;
    }
    const now = Date.now();
    const last = saved && saved.data != null ? saved : null;
    const answer = (s) => (s ? { data: s.data, at: s.at, etag: s.etag || null } : null);
    // Told to wait (Retry-After, or backing off after a failure): even Check Now waits.
    if (saved && saved.retryAt && now < saved.retryAt) return answer(last);
    if (!force && last && now - (last.at || 0) < ttl) return answer(last);
    let next;
    try {
      const headers = { Accept: 'application/json' };
      if (last && last.etag) headers['If-None-Match'] = last.etag;
      const res = await fetchFn(OH.SITE_FEEDS + path, {
        credentials: 'omit',
        headers,
        signal: AbortSignal.timeout(NET_TIMEOUT_MS),
      });
      if (res.status === 304 && last) {
        next = { data: last.data, etag: last.etag, at: now };
      } else if (res.ok) {
        const json = await res.json();
        if (!valid(json)) throw new Error('not a feed this version reads');
        next = { data: json, etag: header(res, 'etag'), at: now };
      } else {
        const err = new Error('HTTP ' + res.status);
        err.wait = OH.retryAfterMs(header(res, 'retry-after'));
        throw err;
      }
    } catch (e) {
      const fails = ((saved && saved.fails) || 0) + 1;
      const wait = e.wait || Math.min(FEED_RETRY_MS * 2 ** (fails - 1), FEED_RETRY_MAX);
      next = { ...(last || {}), retryAt: now + wait, fails };
      OH.log('warn', 'feed', `${path}: ${e?.message || e}; keeping the last copy`);
    }
    try {
      await chrome.storage.local.set({ [feedKey]: next });
    } catch {
      // Not saved: asked again next time.
    }
    return answer(next.data != null ? next : null);
  }

  // Caches of the third-party sources the feeds above replaced: dropped once, so
  // they don't sit in storage forever. Never throws.
  OH.RETIRED_CACHES = [
    'shipCatalog',
    'scVersion',
    'wikiMainpage',
    'wikiFiles',
    'referralEvents',
    'knownIssues',
    'shipStock2',
    'gameStatus',
  ];
  OH.dropRetiredCaches = async function dropRetiredCaches() {
    try {
      await chrome.storage.local.remove(OH.RETIRED_CACHES);
    } catch {
      // Next time.
    }
  };

  // --- Source registry ------------------------------------------------------
  // type 'html'  → paginated server-rendered HTML, parsed by `parse(html)`.
  // (future) type 'graphql' → POST /graphql, parsed from JSON. See ROADMAP.md.
  OH.SOURCES = [
    {
      id: 'hangar',
      label: 'Hangar',
      type: 'html',
      url: 'https://robertsspaceindustries.com/account/pledges',
      pageSize: PAGE_SIZE,
      // If this marker is present in a signed-in page but parsing yields nothing,
      // RSI changed their markup (vs. a genuinely empty hangar). See scanHtmlSource.
      marker: /js-pledge-id/,
      // Rescans first check whether anything changed (#294). See unchangedSince.
      probe: true,
      parse: (html) => window.OpenHangar.parsePledges(html),
    },
    {
      id: 'buybacks',
      label: 'Buy-Backs',
      type: 'html',
      url: 'https://robertsspaceindustries.com/account/buy-back-pledges',
      pageSize: 100,
      // Buy-backs render the SAME server-side HTML as pledges (a list of <article>
      // cards) — not the GraphQL frontend earlier notes feared. Selector mapping
      // derived from the MIT-licensed SC-Open/hangarlink-hangarexport extension.
      emptyMarker: /no pledges available/i, // RSI's "you have no buy-backs" message
      requiresRender: true, // if RSI ever serves a JS-only shell, report it (don't silently say "empty")
      parse: (html) => window.OpenHangar.parseBuybacks(html),
      // Read once from page 1 and kept next to the items (db.sources.buybacks.meta).
      meta: (html) => ({ tokens: window.OpenHangar.parseBuybackTokens(html) }),
    },
    // { id: 'store', label: 'Store', type: 'api', … }  ← see ROADMAP.md
  ];

  OH.getSource = (id) => OH.SOURCES.find((s) => s.id === id) || null;

  // --- Remote status (kill switch) -------------------------------------------
  // When RSI changes a page, every copy of the extension breaks until a fix clears
  // store review. This small file on our own site lets us pause a broken scan (or
  // require the fixed version) and show a notice, without a release. Read-only:
  // nothing is sent. Cached for a few hours. Fails open: no file, a bad file or
  // no connection = scan as normal.
  //   { "sources": { "hangar": { "enabled": false, "message": "…" },
  //                  "buybacks": { "minVersion": "0.2.13" } },
  //     "banner": { "message": "…", "level": "warn", "until": "2026-10-08",
  //                 "maxVersion": "0.2.99" } }
  // A banner with maxVersion only shows on that version or older (e.g. the 0.2.x open
  // beta banner, which 0.3.0 replaces with its own card).
  // Source ids: hangar, buybacks, referrals.
  const STATUS_URL = 'https://openhangar.space/status.json';
  const STATUS_KEY = 'remoteStatus';
  const STATUS_TTL = 6 * 3600e3;
  const STATUS_MSG_MAX = 300;
  const statusText = (s) =>
    typeof s === 'string' && s.trim() ? s.trim().slice(0, STATUS_MSG_MAX) : '';

  // Raw status.json + this version → { paused: { [id]: message }, banner }. Pure.
  OH.evalStatus = function evalStatus(data, version, now = Date.now()) {
    const out = { paused: {}, banner: null };
    if (!data || typeof data !== 'object') return out;
    const sources = data.sources && typeof data.sources === 'object' ? data.sources : {};
    for (const [id, s] of Object.entries(sources)) {
      if (!s || typeof s !== 'object') continue;
      const tooOld =
        typeof s.minVersion === 'string' &&
        version &&
        OH.compareVersions(version, s.minVersion) < 0;
      if (s.enabled === false) {
        out.paused[id] =
          statusText(s.message) ||
          'RSI changed their site, so this scan is paused while we patch it. Your saved data is safe.';
      } else if (tooOld) {
        out.paused[id] =
          statusText(s.message) ||
          `RSI changed their site. Open Hangar ${s.minVersion} has the fix: update to keep scanning. Your saved data is safe.`;
      }
    }
    const b = data.banner;
    const until = b && typeof b.until === 'string' ? Date.parse(b.until) : NaN;
    const newer =
      b &&
      typeof b.maxVersion === 'string' &&
      version &&
      OH.compareVersions(version, b.maxVersion) > 0;
    if (b && statusText(b.message) && !(until <= now) && !newer) {
      out.banner = { message: statusText(b.message), level: b.level === 'info' ? 'info' : 'warn' };
    }
    return out;
  };

  let statusInflight = null;
  async function loadStatus(fetchFn, force) {
    const { [STATUS_KEY]: cached } = await chrome.storage.local.get(STATUS_KEY);
    if (!force && cached && Date.now() - cached.at < STATUS_TTL) return cached.data;
    let data = cached ? cached.data : null;
    let at = Date.now();
    try {
      const res = await fetchFn(STATUS_URL, {
        credentials: 'omit',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) data = await res.json();
      else if (res.status === 404)
        data = null; // no file = nothing paused
      else throw new Error('HTTP ' + res.status);
    } catch {
      // Offline, blocked or a bad file: keep the last copy, try again in 30 minutes.
      at = Date.now() - STATUS_TTL + 30 * 60e3;
    }
    await chrome.storage.local.set({ [STATUS_KEY]: { at, data } });
    return data;
  }

  // → evalStatus(…) for the running version, from cache or the site.
  OH.getRemoteStatus = async function getRemoteStatus(fetchFn = fetch, { force = false } = {}) {
    const version = chrome.runtime?.getManifest?.().version || null;
    if (!statusInflight) {
      statusInflight = loadStatus(fetchFn, force).finally(() => (statusInflight = null));
    }
    return OH.evalStatus(await statusInflight, version);
  };

  // The pause message for a source, or '' to scan. Never throws.
  OH.sourcePaused = async function sourcePaused(id) {
    try {
      return (await OH.getRemoteStatus()).paused[id] || '';
    } catch {
      return '';
    }
  };

  // --- Error log --------------------------------------------------------------
  // A small rolling log (last LOG_MAX entries) of errors, failed/partial scans and
  // RSI retries, so a user can copy a report into a bug post. Stays local like
  // everything else; messages are scrubbed of emails and referral codes, and
  // nothing logs item names or the user's handle.
  const LOG_KEY = 'errorLog';
  const LOG_MAX = 100;
  let logChain = Promise.resolve();

  OH.scrubLog = function scrubLog(text) {
    return String(text ?? '')
      .replace(/chrome-extension:\/\/[a-z]+\/|moz-extension:\/\/[\w-]+\//gi, '/')
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
      .replace(/\bSTAR-[A-Z0-9]{4}-[A-Z0-9]{4}\b/gi, '[referral]')
      .replace(/([?&](?:token|key|code|referral)=)[^&\s]+/gi, '$1[redacted]')
      .slice(0, 600);
  };

  // Append { at, level: info|warn|error, where, msg }. Never throws; writes are
  // chained so bursts (retries) don't overwrite each other.
  OH.log = function log(level, where, msg) {
    const entry = { at: Date.now(), level, where: String(where), msg: OH.scrubLog(msg) };
    logChain = logChain
      .then(async () => {
        const cur = (await chrome.storage.local.get(LOG_KEY))[LOG_KEY] || [];
        cur.push(entry);
        await chrome.storage.local.set({ [LOG_KEY]: cur.slice(-LOG_MAX) });
      })
      .catch(() => {});
    return logChain;
  };
  OH.getLog = async function getLog() {
    try {
      return (await chrome.storage.local.get(LOG_KEY))[LOG_KEY] || [];
    } catch {
      return [];
    }
  };
  OH.clearLog = () => chrome.storage.local.remove(LOG_KEY);

  // --- Storage size guard -------------------------------------------------------
  // The extension keeps `unlimitedStorage` (without it a big hangar would hit the
  // browser's 10 MB limit and writes would fail quietly), so nothing outside stops
  // a bug from growing storage forever. Every growing key has its own cap (see
  // test/storage-budget.test.js); this measures what's really there after each
  // scan. Past STORAGE_WARN_BYTES it logs a warning and the Developers page says
  // so. It never deletes or blocks anything.
  OH.STORAGE_WARN_BYTES = 50e6;
  // Saved accounts are stored under `profile:<handle>`: the handle stays out of
  // the log and the report.
  const storageKeyLabel = (k) => (/^profile:/.test(k) ? 'profile:(saved account)' : k);
  // → { total, keys: [{ key, bytes }] biggest first, over }. Uses the browser's own
  // count where it has one (Chrome), else the JSON size (Firefox has no
  // getBytesInUse on every version). No network, nothing written.
  OH.storageUsage = async function storageUsage() {
    const area = chrome.storage.local;
    const enc = new TextEncoder();
    let keys = null;
    let all = null;
    const perKey = typeof area.getBytesInUse === 'function';
    if (perKey && typeof area.getKeys === 'function') {
      try {
        keys = await area.getKeys();
      } catch {
        keys = null;
      }
    }
    if (!Array.isArray(keys)) {
      all = (await area.get(null)) || {};
      keys = Object.keys(all);
    }
    const sizes = new Map();
    for (const key of keys) {
      let bytes = null;
      if (perKey) {
        try {
          bytes = await area.getBytesInUse(key);
        } catch {
          bytes = null;
        }
      }
      if (!Number.isFinite(bytes)) {
        if (!all) all = (await area.get(null)) || {};
        try {
          bytes = enc.encode(key + JSON.stringify(all[key] ?? null)).length;
        } catch {
          bytes = 0;
        }
      }
      const label = storageKeyLabel(key);
      sizes.set(label, (sizes.get(label) || 0) + bytes);
    }
    const list = [...sizes].map(([key, bytes]) => ({ key, bytes }));
    list.sort((a, b) => b.bytes - a.bytes || (a.key < b.key ? -1 : 1));
    const total = list.reduce((s, x) => s + x.bytes, 0);
    return { total, keys: list, over: total > OH.STORAGE_WARN_BYTES };
  };
  // "4.2 MB" / "820 KB". Pure.
  OH.formatBytes = function formatBytes(n) {
    const b = Number(n) || 0;
    if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
    if (b >= 1e3) return `${Math.round(b / 1e3)} KB`;
    return `${b} B`;
  };
  // After a scan: measure, and log a warning when it's bigger than expected.
  // Never throws.
  OH.checkStorage = async function checkStorage() {
    try {
      const u = await OH.storageUsage();
      if (u.over) {
        const top = u.keys
          .slice(0, 3)
          .map((x) => `${x.key} ${OH.formatBytes(x.bytes)}`)
          .join(', ');
        await OH.log(
          'warn',
          'storage',
          `storage is ${OH.formatBytes(u.total)}, larger than expected. Biggest: ${top}`,
        );
      }
      return u;
    } catch {
      return null;
    }
  };
  // Debounced, so Scan All (three sources) measures once.
  let storageCheckTimer = null;
  function queueStorageCheck() {
    clearTimeout(storageCheckTimer);
    storageCheckTimer = setTimeout(() => OH.checkStorage(), 2000);
    storageCheckTimer?.unref?.(); // Node (tests): don't hold the process open
  }

  const stamp = (t) => {
    const d = new Date(t);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
      d.getMinutes(),
    )}:${p(d.getSeconds())}`;
  };
  const ago = (t) => {
    if (!t) return 'never';
    const h = (Date.now() - t) / 3600e3;
    return h < 1
      ? 'under an hour ago'
      : h < 48
        ? `${Math.round(h)}h ago`
        : `${Math.round(h / 24)} days ago`;
  };
  OH.formatLogLine = (e) =>
    `${stamp(e.at)}  ${String(e.level).toUpperCase().padEnd(5)}  ${String(e.where).padEnd(8)}  ${e.msg}`;

  // Browser + OS from the user agent, e.g. "Chrome 141 on Windows".
  function browserLabel(ua) {
    const m = /Edg\/(\d+)/.exec(ua)
      ? ['Edge', /Edg\/(\d+)/.exec(ua)[1]]
      : /Firefox\/(\d+)/.exec(ua)
        ? ['Firefox', /Firefox\/(\d+)/.exec(ua)[1]]
        : /Chrome\/(\d+)/.exec(ua)
          ? ['Chrome', /Chrome\/(\d+)/.exec(ua)[1]]
          : ['Unknown browser', ''];
    const os = /Windows/.test(ua)
      ? 'Windows'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /CrOS/.test(ua)
            ? 'ChromeOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'unknown OS';
    return `${m[0]} ${m[1]} on ${os}`.replace('  ', ' ');
  }

  // The error report's "Read:" line: how completely the last hangar scan read RSI's
  // page (#295, #296). Percentages and counts only.
  function shapeLine(s) {
    if (!s || !s.n) return 'no complete hangar scan yet';
    const pct = (x) => `${Math.round(x * 100)}%`;
    return (
      `${pct(s.date)} dates · ${pct(s.value)} values · ${pct(s.contents)} item lists · ${pct(s.image)} pictures` +
      ` · ${s.untyped} of ${s.tiles} items untyped (${s.guessed} placed by name)`
    );
  }

  // The Flight Log (#315), a copy-paste report for bug posts: version, browser, data counts, cache
  // state and the recent log. Wrapped in a code block so Discord/GitHub keep
  // the columns. Contains counts and dates only — no handle, codes or names.
  OH.errorReport = async function errorReport({ maxLines = 40 } = {}) {
    let manifest = {};
    try {
      manifest = chrome.runtime.getManifest();
    } catch {
      /* not in an extension page */
    }
    const db = await OH.loadDB();
    const src = (id) => db.sources[id] || {};
    const count = (s) =>
      Array.isArray(s.items) ? s.items.length : s.items && typeof s.items === 'object' ? 1 : 0;
    const store = await chrome.storage.local.get(['shipCatalog', 'shipMatrix']);
    const cat = store.shipCatalog || {};
    const mat = store.shipMatrix || {};
    const log = await OH.getLog();
    const damaged = await OH.getDamaged();
    const bbd = await OH.buybackDetailStats();
    const usage = await OH.storageUsage().catch(() => null);
    const lines = [
      '```',
      'Open Hangar flight log',
      `Version:   ${manifest.version || '?'} (${manifest.browser_specific_settings ? 'Firefox' : 'Chrome'} build)`,
      `Browser:   ${browserLabel((globalThis.navigator && globalThis.navigator.userAgent) || '')}`,
      `Hangar:    ${count(src('hangar'))} items, scanned ${ago(src('hangar').scannedAt)}`,
      `Buy-backs: ${count(src('buybacks'))} items, scanned ${ago(src('buybacks').scannedAt)}`,
      `Read:      ${shapeLine(src('hangar').meta?.shape)}`,
      `History:   ${Array.isArray(db.history) ? db.history.length : 0} snapshots`,
      `Bb detail: ${bbd.history} from hangar history · ${bbd.scan} value only from scan history · ${bbd.rsi} read from RSI · ${bbd.rejected} names didn't agree`,
      `Set aside: ${damaged.length ? damaged.map((d) => `${d.what} (${d.problems.slice(0, 3).join('; ')})`).join(', ') : 'nothing'}`,
      `Storage:   ${usage ? OH.formatBytes(usage.total) + (usage.over ? ', larger than expected' : '') : 'unknown'}`,
      `Catalog:   ${Array.isArray(cat.list) ? cat.list.length : 0} ships (v${cat.v || '?'}, ${ago(cat.at)}) · ship matrix ${Array.isArray(mat.list) ? mat.list.length : 0}`,
      `Log:       ${log.length ? `last ${Math.min(maxLines, log.length)} of ${log.length}` : 'empty'}`,
      ...log.slice(-maxLines).map(OH.formatLogLine),
      '```',
    ];
    return lines.join('\n');
  };

  // Known Issues page (#175): Open Hangar's open bug reports, from
  // openhangar.space/api/known-issues (v1: { issues: [{ number, title, url, labels,
  // createdAt }] }), which the site reads from the public GitHub tracker: issues
  // labelled bug or scan-broken, scan-broken first, then newest. Asked at most once
  // an hour, only when the page opens.
  OH.KNOWN_ISSUE_LABELS = ['scan-broken', 'bug'];
  OH.getKnownIssues = ({ force = false, fetchFn } = {}) =>
    OH.siteFeed('api/known-issues', {
      key: 'feedIssues',
      ttl: 60 * 60e3,
      force,
      fetchFn,
      valid: (j) => isV1(j) && Array.isArray(j.issues),
    });
  // The feed's issues, checked (links only to the repo's own issues) and in the
  // page's order. Pure, so it's tested directly.
  OH.shapeKnownIssues = function shapeKnownIssues(list) {
    if (!Array.isArray(list)) return [];
    return list
      .filter((i) => i && Number.isInteger(i.number) && typeof i.title === 'string')
      .map((i) => ({
        number: i.number,
        title: i.title.trim().slice(0, 300),
        url: String(i.url || ''),
        createdAt: String(i.createdAt || ''),
        labels: (Array.isArray(i.labels) ? i.labels : []).filter((l) => typeof l === 'string'),
      }))
      .filter((i) => i.labels.some((l) => OH.KNOWN_ISSUE_LABELS.includes(l)))
      .filter((i) => /^https:\/\/github\.com\/Draco-Foundry\/open-hangar\/issues\/\d+$/.test(i.url))
      .sort(
        (a, b) =>
          b.labels.includes('scan-broken') - a.labels.includes('scan-broken') ||
          Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
  };

  // "Report a Scan Problem" (#250): a new GitHub issue from the Scan Broken
  // template (.github/ISSUE_TEMPLATE/scan_broken.yml), prefilled through its
  // field ids. Only the scan summary (counts) and the error report go in, nothing
  // about the account, and nothing is sent: the person reads it on GitHub and
  // submits it themselves. Log lines are dropped from the top until the URL fits
  // GitHub's limit. Pure, so it's tested directly.
  OH.SCAN_REPORT_MAX_URL = 7000;
  OH.scanProblemUrl = function scanProblemUrl({ summary = '', report = '', version = '' } = {}) {
    const base = 'https://github.com/Draco-Foundry/open-hangar/issues/new';
    const build = (rep) =>
      `${base}?${new URLSearchParams({
        template: 'scan_broken.yml',
        title: 'Scan broken: ',
        what: `The scan said: ${summary}`,
        report: rep,
        version: version ? `v${version}` : '',
      })}`;
    const lines = String(report).split('\n');
    // Keep the header (fence, title, counts, up to "Log:"), the newest log lines
    // and the closing fence; trim the oldest log lines first.
    const logAt = lines.findIndex((l) => /^Log:/.test(l));
    const n = logAt >= 0 ? logAt + 1 : 10;
    const head = lines.slice(0, n);
    const tail = lines.slice(-1);
    let log = lines.slice(n, -1);
    let url = build(lines.join('\n'));
    while (url.length > OH.SCAN_REPORT_MAX_URL && log.length) {
      log = log.slice(Math.ceil(log.length / 4) || 1);
      url = build([...head, '(older log lines trimmed)', ...log, ...tail].join('\n'));
    }
    return url;
  };

  // --- Storage (versioned multi-source DB) ----------------------------------

  // Every load is checked (OH.checkDB): a malformed DB never crashes the dashboard.
  // The original is set aside untouched under `dbCorrupt` first (OH.getDamaged),
  // whatever is still valid is kept, and the dashboard offers "Restore from backup
  // file". Older stored versions go through MIGRATIONS. Any fix-up is written back
  // through the save queue, which reads storage again first, so it can never
  // overwrite a scan that saved in the meantime.

  const emptyDB = () => ({ schemaVersion: DB_VERSION, sources: {} });
  const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  const okTime = (t) =>
    Number.isFinite(t) || (typeof t === 'string' && t !== '' && !isNaN(Date.parse(t)));

  // Raw stored DB → { db, problems }. `db` always has the shape the rest of the
  // extension relies on; `problems` says what had to be dropped (empty = it was
  // fine). History embedded in the DB (before v3, or written by an older version
  // after a rollback) comes back as db.history. Pure.
  OH.checkDB = function checkDB(raw) {
    const problems = [];
    if (!isObj(raw)) return { db: emptyDB(), problems: ['not an object'] };
    let version = raw.schemaVersion;
    if (!Number.isInteger(version) || version < 1) {
      problems.push('no schema version');
      version = DB_VERSION;
    } else if (version > DB_VERSION) {
      problems.push(`made by a newer version of Open Hangar (v${version})`);
      version = DB_VERSION;
    }
    const db = { schemaVersion: version, sources: {} };
    if (!isObj(raw.sources)) problems.push('no sources');
    else {
      for (const [id, src] of Object.entries(raw.sources)) {
        if (!isObj(src)) {
          problems.push(`${id}: unreadable`);
          continue;
        }
        let items;
        if (Array.isArray(src.items)) {
          items = src.items.filter(isObj);
          const bad = src.items.length - items.length;
          if (bad) problems.push(`${id}: ${bad} unreadable row${bad === 1 ? '' : 's'}`);
        } else if (isObj(src.items)) {
          items = src.items; // the referral source is one object
        } else {
          problems.push(`${id}: no items`);
          continue;
        }
        const out = { items, scannedAt: okTime(src.scannedAt) ? src.scannedAt : null };
        if (src.scannedAt != null && out.scannedAt == null) problems.push(`${id}: bad scan time`);
        if (isObj(src.meta)) out.meta = src.meta;
        else if (src.meta !== undefined) problems.push(`${id}: bad meta`);
        db.sources[id] = out;
      }
    }
    if (raw.owner != null) {
      if (isObj(raw.owner) && typeof raw.owner.nickname === 'string' && raw.owner.nickname) {
        db.owner = {
          nickname: raw.owner.nickname,
          displayname: typeof raw.owner.displayname === 'string' ? raw.owner.displayname : null,
        };
      } else problems.push('unreadable owner');
    }
    if (raw.history !== undefined) {
      if (Array.isArray(raw.history)) {
        db.history = raw.history.map(cleanSnapshot).filter(Boolean);
        const bad = raw.history.length - db.history.length;
        if (bad) problems.push(`history: ${bad} unreadable snapshot${bad === 1 ? '' : 's'}`);
      } else problems.push('unreadable history');
    }
    return { db, problems };
  };

  // Storage migrations: MIGRATIONS[n] turns a v(n) DB into v(n+1). Add one with
  // every DB_VERSION bump, and a test (test/db.test.js). Scan history is never
  // touched here: it's split out of the DB on every load (readDB), which also
  // covers a DB that an older version wrote after a rollback.
  const MIGRATIONS = {
    1: (db) => db, // v1 → v2: stored shape unchanged (only the export gained `account`)
    2: (db) => db, // v2 → v3: history moves to its own key (writeDB stores it there)
  };
  OH.migrateDB = function migrateDB(db) {
    let out = db;
    while (out.schemaVersion < DB_VERSION) {
      const step = MIGRATIONS[out.schemaVersion];
      if (!step) throw new Error(`No migration from database v${out.schemaVersion}`);
      out = { ...step(out), schemaVersion: out.schemaVersion + 1 };
    }
    return out;
  };

  // A stored blob that isn't the live DB (a parked account, the recovery slot):
  // checked and migrated like the live one, history kept inside. Pure.
  const fromStored = (blob) => {
    const db = OH.migrateDB(OH.checkDB(blob).db);
    if (!db.history) db.history = [];
    return db;
  };

  // --- Damaged data, set aside ------------------------------------------------
  // Up to three originals that failed the check, newest last, kept until the
  // user clears their data: { id, at, what: 'db' | 'history', problems, raw }.
  // `id` is a hash of the content, so the same damage is only kept once.
  const CORRUPT_MAX = 3;
  function hashText(s) {
    let h = 0x811c9dc5; // FNV-1a
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
    return (h >>> 0).toString(16);
  }
  let asideChain = Promise.resolve();
  function setAside(what, raw, problems) {
    const run = asideChain.then(async () => {
      let id;
      try {
        id = hashText(JSON.stringify(raw) ?? String(raw));
      } catch {
        id = `t${Date.now()}`; // not even serialisable
      }
      const { [CORRUPT_KEY]: cur } = await chrome.storage.local.get(CORRUPT_KEY);
      const list = Array.isArray(cur) ? cur : [];
      if (list.some((x) => x && x.id === id)) return;
      list.push({ id, at: Date.now(), what, problems: problems.slice(0, 20), raw });
      await chrome.storage.local.set({ [CORRUPT_KEY]: list.slice(-CORRUPT_MAX) });
      OH.log('error', 'storage', `${what} set aside: ${problems.slice(0, 5).join('; ')}`);
    });
    asideChain = run.catch(() => {});
    return run;
  }
  // What was set aside, without the data itself: [{ id, at, what, problems, seen }].
  OH.getDamaged = async function getDamaged() {
    const { [CORRUPT_KEY]: cur } = await chrome.storage.local.get(CORRUPT_KEY);
    return (Array.isArray(cur) ? cur : [])
      .filter(isObj)
      .map(({ id, at, what, problems, seen }) => ({ id, at, what, problems, seen: !!seen }));
  };
  // The originals, to save as a file for a bug report.
  OH.exportDamaged = async function exportDamaged() {
    const { [CORRUPT_KEY]: cur } = await chrome.storage.local.get(CORRUPT_KEY);
    return Array.isArray(cur) ? cur : [];
  };
  // Hide the notice for what's set aside now (the copies stay until Clear Data).
  OH.dismissDamaged = async function dismissDamaged() {
    const { [CORRUPT_KEY]: cur } = await chrome.storage.local.get(CORRUPT_KEY);
    if (!Array.isArray(cur) || !cur.length) return;
    await chrome.storage.local.set({
      [CORRUPT_KEY]: cur.map((x) => (isObj(x) ? { ...x, seen: true } : x)),
    });
  };

  // Read and check the stored DB and its history. → { db (with .history),
  // needsWrite }. needsWrite: storage isn't in today's shape yet (damage set aside,
  // a migration, or history still inside the DB) and should be written back.
  async function readDB() {
    const raw = await chrome.storage.local.get([DB_KEY, HISTORY_KEY, 'hangar', 'scannedAt']);
    let db;
    let needsWrite = false;
    if (raw[DB_KEY] === undefined) {
      db = emptyDB();
      // Before the versioned DB: { hangar, scannedAt } at the top level.
      if (Array.isArray(raw.hangar)) {
        db.sources.hangar = {
          items: raw.hangar.filter(isObj),
          scannedAt: okTime(raw.scannedAt) ? raw.scannedAt : null,
        };
      }
    } else {
      const checked = OH.checkDB(raw[DB_KEY]);
      db = checked.db;
      if (checked.problems.length) {
        await setAside('db', raw[DB_KEY], checked.problems); // before anything can overwrite it
        needsWrite = true;
      }
      if (db.schemaVersion < DB_VERSION) {
        db = OH.migrateDB(db);
        needsWrite = true;
      }
    }
    let kept = [];
    const h = raw[HISTORY_KEY];
    if (Array.isArray(h)) {
      kept = h.filter((s) => isObj(s) && Number.isFinite(s.at) && Array.isArray(s.items));
      if (kept.length !== h.length) {
        await setAside('history', h, [`${h.length - kept.length} unreadable snapshot(s)`]);
        needsWrite = true;
      }
    } else if (h !== undefined) {
      await setAside('history', h, ['unreadable history']);
      needsWrite = true;
    }
    if (db.history) {
      db.history = OH.mergeHistory(kept, db.history);
      needsWrite = true;
    } else db.history = kept;
    return { db, needsWrite };
  }

  // Store a DB as loadDB returns it: the DB under `db`, its history under its own
  // key, in one storage write. `history: false` leaves the stored history alone
  // (it didn't change), so a buy-back save doesn't rewrite megabytes of history.
  async function writeDB(db, { history = true } = {}) {
    const { history: hist, ...rest } = db;
    const out = { [DB_KEY]: { ...rest, schemaVersion: DB_VERSION } };
    if (history) out[HISTORY_KEY] = Array.isArray(hist) ? hist : [];
    await chrome.storage.local.set(out);
  }

  // Load the whole DB (with .history). Always the expected shape.
  OH.loadDB = async function loadDB() {
    const { db, needsWrite } = await readDB();
    if (needsWrite) queueFixUp();
    return db;
  };
  // Write the checked/migrated DB back, in the save queue: it reads storage again
  // there, so a scan saved in between is never overwritten.
  let fixUpQueued = false;
  function queueFixUp() {
    if (fixUpQueued) return;
    fixUpQueued = true;
    exclusive(async () => {
      fixUpQueued = false;
      const { db, needsWrite } = await readDB();
      if (needsWrite) await writeDB(db);
    }).catch(() => {
      fixUpQueued = false;
    });
  }
  // Resolves once every queued save and fix-up has run (tests, Clear Data).
  OH.storageSettled = () => saveChain.then(() => {});

  OH.loadSource = async function loadSource(id) {
    const db = await OH.loadDB();
    return db.sources[id] || { items: [], scannedAt: null };
  };

  // Everything that writes the live DB (scan saves, fix-ups, Clear Data, restores,
  // account switches, imports) runs one at a time in this queue, and reads storage
  // right before it writes, so nothing can write back a stale copy over another.
  let saveChain = Promise.resolve();
  function exclusive(fn) {
    const run = saveChain.then(fn);
    saveChain = run.catch(() => {});
    return run;
  }
  // `account`: the RSI account the caller already looked up for this scan. Pass it
  // so a save never costs extra RSI requests; without it the save looks it up.
  function saveSource(id, items, { record = false, meta, account } = {}) {
    return exclusive(async () => {
      // Stamp which RSI account this data belongs to, so the UI can detect when a
      // different account signs in later and clear the stale data (multi-account
      // safety). Best-effort: if we can't read the account, leave owner untouched.
      let acct = account === undefined ? null : account;
      if (account === undefined) {
        try {
          acct = await OH.getAccount();
        } catch {
          /* owner stamp is optional */
        }
      }
      const { db, needsWrite } = await readDB();
      const scannedAt = Date.now();
      // Store Credit in dollars (RSI reports cents), for the value chart.
      const cents = acct && acct.loggedIn ? acct.credits?.store?.value : null;
      const credit = Number.isFinite(cents) ? cents / 100 : undefined;
      if (record) recordHistory(db, db.sources[id], items, scannedAt, credit);
      // Pledges the last complete scan of this same account had and this one
      // doesn't go to the pledge archive (see archiveGone).
      const prev = db.sources[id];
      const sameOwner =
        !db.owner ||
        !(acct && acct.loggedIn && acct.nickname) ||
        db.owner.nickname.toLowerCase() === String(acct.nickname).toLowerCase();
      const before =
        record && id === 'hangar' && sameOwner && prev && Array.isArray(prev.items)
          ? prev.items
          : null;
      db.sources[id] = meta ? { items, scannedAt, meta } : { items, scannedAt };
      if (acct && acct.loggedIn && acct.nickname) {
        db.owner = { nickname: acct.nickname, displayname: acct.displayname || null };
      }
      // History is only rewritten when it changed: a new snapshot, or it was just
      // moved out of the DB (needsWrite) and must not be lost with it.
      await writeDB(db, { history: record || needsWrite });
      if (before) {
        const now = new Set(items.map((p) => String(p && p.id)));
        const gone = before.filter((p) => isObj(p) && p.id != null && !now.has(String(p.id)));
        if (gone.length) {
          const cur = (await chrome.storage.local.get(ARCHIVE_KEY))[ARCHIVE_KEY];
          await chrome.storage.local.set({ [ARCHIVE_KEY]: OH.archiveGone(cur, gone, scannedAt) });
        }
      }
      await chrome.storage.local.remove(['hangar', 'scannedAt']); // drop legacy keys
      return scannedAt;
    });
  }

  // Recovery slot. When data is auto-cleared because a *different* RSI account
  // signs in, the previous DB is stashed here first, so an accidental account
  // switch (or a transiently mis-served account page) can't irreversibly destroy
  // a large scan. A manual "Clear Data" is an explicit, confirmed wipe and purges
  // this slot too.
  const RECOVERY_KEY = 'dbRecovery';

  // Wipe all scraped data (every source + the account cache + legacy keys),
  // leaving UI preferences (e.g. uiLayout) intact. Used when a different RSI
  // account is detected, or for a manual "clear data" action.
  //   { backup: true }  → snapshot the current DB to the recovery slot first
  //                       (the auto-clear path; recoverable via OH.recoverData).
  //   { backup: false } → full wipe, including any recovery snapshot (manual).
  OH.clearData = ({ backup = false } = {}) => exclusive(() => clearDataNow(backup));
  async function clearDataNow(backup) {
    if (backup) {
      const { db } = await readDB(); // history rides inside the recovery copy
      const hasData =
        db &&
        (db.owner ||
          Object.values(db.sources || {}).some(
            (s) => s && Array.isArray(s.items) && s.items.length,
          ));
      if (hasData) {
        // The pledge archive rides along too, like the history.
        const archive = await readArchive();
        const rec = { at: Date.now(), db };
        if (Object.keys(archive).length) rec.archive = archive;
        await chrome.storage.local.set({ [RECOVERY_KEY]: rec });
      }
      await chrome.storage.local.remove([
        DB_KEY,
        HISTORY_KEY,
        ARCHIVE_KEY,
        'hangar',
        'scannedAt',
        'account',
        'subStore',
      ]);
      return;
    }
    await chrome.storage.local.remove([
      DB_KEY,
      HISTORY_KEY,
      ARCHIVE_KEY,
      BB_REJECTS_KEY,
      CORRUPT_KEY,
      'hangar',
      'scannedAt',
      'account',
      'subStore',
      RECOVERY_KEY,
      LOG_KEY,
    ]);
  }

  // The most recent auto-cleared snapshot ({ at, db }), or null. Lets the UI
  // offer a one-click restore after a different-account auto-clear.
  OH.getRecovery = async function getRecovery() {
    const raw = await chrome.storage.local.get(RECOVERY_KEY);
    const rec = raw[RECOVERY_KEY];
    return rec && isObj(rec.db) && rec.db.schemaVersion ? rec : null;
  };

  // Restore a previously auto-cleared snapshot back into the live DB (history
  // included) and drop the recovery slot. Returns the restored DB, or null if
  // there was nothing to restore.
  OH.recoverData = () =>
    exclusive(async () => {
      const rec = await OH.getRecovery();
      if (!rec) return null;
      const db = fromStored(rec.db);
      await writeDB(db);
      await writeArchive(rec.archive);
      await chrome.storage.local.remove(RECOVERY_KEY);
      return db;
    });

  // --- Saved accounts (multi-account) ---------------------------------------
  // The live DB (DB_KEY) always belongs to the RSI account that's signed in.
  // Other accounts' DBs are parked under `profile:<nickname>` and swapped back
  // in when that account signs in again, so alts never wipe each other.
  const PROFILE_PREFIX = 'profile:';
  const profileKey = (nick) => PROFILE_PREFIX + String(nick).toLowerCase();
  const dbHasData = (db) =>
    !!db &&
    Object.values(db.sources || {}).some(
      (s) => s && s.items && (Array.isArray(s.items) ? s.items.length : true),
    );

  // The live account's pledge archive ({} when none), and writing one back (an
  // empty or missing one removes the key).
  async function readArchive() {
    const a = (await chrome.storage.local.get(ARCHIVE_KEY))[ARCHIVE_KEY];
    return isObj(a) ? a : {};
  }
  async function writeArchive(a) {
    if (isObj(a) && Object.keys(a).length) await chrome.storage.local.set({ [ARCHIVE_KEY]: a });
    else await chrome.storage.local.remove(ARCHIVE_KEY);
  }

  // Make `nickname` the live account: park the current DB under its owner, then
  // load the new account's parked DB (if any). A parked DB keeps its scan history
  // and pledge archive (`pledgeArchive`) inside it, so both travel with their
  // account. Returns { restored, parked }.
  OH.switchProfile = (nickname, displayname = null) =>
    exclusive(() => switchProfileNow(nickname, displayname));
  async function switchProfileNow(nickname, displayname) {
    const { db: cur } = await readDB(); // a save queued before this landed already
    let parked = null;
    if (cur.owner && cur.owner.nickname && dbHasData(cur)) {
      if (cur.owner.nickname.toLowerCase() === String(nickname).toLowerCase()) {
        return { restored: false, parked: null }; // already live
      }
      const archive = await readArchive();
      const park = Object.keys(archive).length ? { ...cur, pledgeArchive: archive } : cur;
      await chrome.storage.local.set({ [profileKey(cur.owner.nickname)]: park });
      parked = cur.owner.displayname || cur.owner.nickname;
    }
    const key = profileKey(nickname);
    const saved = (await chrome.storage.local.get(key))[key];
    const restored = isObj(saved) && !!saved.schemaVersion;
    const next = restored
      ? fromStored(saved)
      : { ...emptyDB(), owner: { nickname, displayname: displayname || null }, history: [] };
    await writeDB(next);
    await writeArchive(restored ? saved.pledgeArchive : null);
    await chrome.storage.local.remove([key, 'account']); // live now; account cache is stale
    return { restored, parked };
  }

  // Every account with data in this browser: the live one plus parked ones.
  //   [{ nickname, displayname, pledges, scannedAt, active }]
  OH.listProfiles = async function listProfiles() {
    const all = await chrome.storage.local.get(null);
    const row = (db, active) => ({
      nickname: db.owner && db.owner.nickname,
      displayname: (db.owner && db.owner.displayname) || null,
      pledges: (db.sources.hangar && (db.sources.hangar.items || []).length) || 0,
      scannedAt: (db.sources.hangar && db.sources.hangar.scannedAt) || null,
      active,
    });
    const out = [];
    // Checked first: a damaged copy shows as an account with no pledges, not a crash.
    const live = all[DB_KEY] === undefined ? null : OH.checkDB(all[DB_KEY]).db;
    if (live && live.owner && live.owner.nickname) out.push(row(live, true));
    for (const [k, v] of Object.entries(all)) {
      if (!k.startsWith(PROFILE_PREFIX) || !isObj(v) || !v.schemaVersion) continue;
      const db = OH.checkDB(v).db;
      if (db.owner) out.push(row(db, false));
    }
    return out;
  };

  // Forget a parked account's saved data.
  OH.deleteProfile = (nickname) => chrome.storage.local.remove(profileKey(nickname));

  // One-time: turn an old "Restore previous hangar" snapshot (from before saved
  // accounts existed) into a parked account, unless that account is live.
  OH.migrateRecovery = async function migrateRecovery() {
    const rec = await OH.getRecovery();
    const nick = rec && rec.db.owner && rec.db.owner.nickname;
    if (!nick) return false;
    const live = await OH.loadDB();
    const isLive =
      live.owner && live.owner.nickname && live.owner.nickname.toLowerCase() === nick.toLowerCase();
    const key = profileKey(nick);
    const existing = (await chrome.storage.local.get(key))[key];
    if (!isLive && !existing) {
      const park = isObj(rec.archive) ? { ...rec.db, pledgeArchive: rec.archive } : rec.db;
      await chrome.storage.local.set({ [key]: park });
    }
    await chrome.storage.local.remove(RECOVERY_KEY);
    return !isLive && !existing;
  };

  // Log the user out of RSI by clearing every robertsspaceindustries.com cookie —
  // including the HttpOnly session cookie that document.cookie / a /logout
  // navigation can't reliably drop. Works across both RSI frontends. Requires the
  // "cookies" permission. Returns { ok, removed?, error? }.
  OH.logout = async function logout() {
    if (!chrome.cookies) {
      return { ok: false, error: 'Logout needs the "cookies" permission (see manifest.json).' };
    }
    try {
      const cookies = await chrome.cookies.getAll({ domain: 'robertsspaceindustries.com' });
      await Promise.all(
        cookies.map((c) =>
          chrome.cookies.remove({
            url: `http${c.secure ? 's' : ''}://${c.domain.replace(/^\./, '')}${c.path}`,
            name: c.name,
          }),
        ),
      );
      await chrome.storage.local.remove('account'); // cached identity is now stale
      return { ok: true, removed: cookies.length };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  };

  // --- Export / import (the developer consumption contract) ----------------

  // Flatten the internal cached `account` (getAccount's shape) into a clean,
  // stable identity block for export — renamed/reordered so a backend reading the
  // file sees WHO the data belongs to before WHAT they own. `owner` (set on scan)
  // is the fallback for handle/displayName when the live account isn't cached or
  // the user is signed out. Returns null only when we know nothing about the user.
  // NOTE: balances.storeCredit.value is in CENTS (e.g. 1234 = $12.34); uec/rec are
  // whole-number game currencies. Values pass through exactly as RSI reports them.
  function shapeAccountForExport(account, owner) {
    const a = account && account.loggedIn ? account : null;
    const handle = a?.nickname || owner?.nickname || null;
    if (!a && !handle) return null; // nothing known about the user
    const credit = (c) =>
      c
        ? {
            value: c.value ?? null,
            currency: c.currency || null,
            symbol: c.symbol || null,
            label: c.label || null,
          }
        : null;
    const org = a?.org;
    return {
      handle,
      displayName: a?.displayname || owner?.displayname || null,
      avatar: a?.avatar || null,
      ueeRecord: a?.citizenRecord || null, // UEE Citizen Record number
      enlistedSince: a?.enlistedSince || null,
      country: a?.countryName || null,
      organization: org
        ? {
            name: org.name || null,
            sid: org.sid || null,
            rank: org.rank || null,
            logo: org.logo || null,
          }
        : null, // null = no main org, or the affiliation is private/redacted
      subscriber: a?.subscriber || null, // { type, frequency } | null
      concierge: a?.concierge || null, // { level, next, percent } | null
      balances: a
        ? {
            storeCredit: credit(a.credits?.store),
            uec: credit(a.credits?.uec),
            rec: credit(a.credits?.rec),
          }
        : null,
      // NOTE: the referral CODE/URL are deliberately NOT exported. They live in the
      // in-tool runtime (account cache + the referral source) but are stripped from
      // the export file — the code is a personal, shareable credential the user
      // chose to keep out of exports. Referral COUNTS and recruit/prospect lists
      // still export; only code/url are stripped (see exportDB).
      capturedAt: a?.fetchedAt || null, // when this identity snapshot was read
    };
  }

  // Export the whole database as a self-describing JSON object, ordered the way a
  // backend reads it: provenance → who (identity, org, rank, balances) → what they
  // own (sources). The identity block is flattened from the cached RSI account so
  // a consumer gets everything in one file. Reads the account from cache only (no
  // network), so export is deterministic and works offline. ALWAYS emits the
  // current schemaVersion (the format it actually wrote), regardless of the stored
  // DB's version.
  OH.exportDB = async function exportDB() {
    const db = await OH.loadDB();
    const { account } = await chrome.storage.local.get('account');
    let appVersion = null;
    try {
      appVersion = chrome.runtime.getManifest().version;
    } catch {
      /* non-extension context */
    }
    return {
      app: 'open-hangar',
      appVersion,
      exportedAt: new Date().toISOString(),
      schemaVersion: EXPORT_VERSION,
      account: shapeAccountForExport(account, db.owner),
      sources: sanitizeSourcesForExport(db.sources),
      // Scan history rides along so a backup file is a complete restore point.
      history: Array.isArray(db.history) ? db.history : [],
      // So does the pledge archive (#388), trimmed to what buy-back details read
      // (OH.leanArchive). Added within format v2: older versions ignore it.
      pledgeArchive: OH.leanArchive(await readArchive()),
    };
  };

  // Strip the referral CODE/URL from the exported referral source — the user's
  // personal referral credential is kept out of export files (counts + recruit/
  // prospect lists still export). Returns a shallow copy; never mutates the stored
  // DB. Other sources pass through untouched.
  function sanitizeSourcesForExport(sources) {
    if (!sources || typeof sources !== 'object') return sources;
    const ref = sources.referral;
    if (!ref || !ref.items || typeof ref.items !== 'object' || Array.isArray(ref.items))
      return sources;
    const { code, url, ...rest } = ref.items; // drop code + url (url embeds the code)
    return { ...sources, referral: { ...ref, items: rest } };
  }

  // --- Hangar Transfer Format (HTF) export ---------------------------------
  // The community interchange format read by FleetYards, HangarXPLOR & co.
  // (spec: docs.starcitizen.fans/hangar-transfer-format.yaml, v0.0.1 draft): a
  // bare JSON array with ONE ENTRY PER SHIP (a pledge with two ships → two
  // entries sharing the pledge_* fields). CCUs, paints, add-ons and buy-backs
  // have no HTF representation and are left out. Ship codes come from a bundled
  // snapshot of HangarXPLOR's MIT-licensed ship-codes.json (src/data/).
  const MFR_PREFIX =
    /^(?:Aegis|Anvil|Aopoa|Argo|Banu|CNOU|Consolidated Outland|Crusader|Drake|Esperia|Gatac|Greycat Industrial|Greycat|Kruger|MISC|Mirai|Origin|Roberts Space Industries|RSI|Tumbril|Vanduul|Xi'an)[^a-z0-9]+/i;

  // "Anvil Carrack" / "Carrack Warbond" → "Carrack".
  OH.htfShipName = function htfShipName(label) {
    return OH.normShipName(String(label || '').replace(MFR_PREFIX, '')).trim();
  };

  // Best entry in `list` whose name matches `q` (lowercase), or null. Loose
  // "contains" hits (<70) are too risky for an identifier, so they're ignored.
  function bestByName(list, q, nameOf) {
    let best = null;
    let bestScore = 0;
    for (const x of list) {
      const s = nameScore(String(nameOf(x) || '').toLowerCase(), q);
      if (s > bestScore) {
        bestScore = s;
        best = x;
      }
    }
    return bestScore >= 70 ? best : null;
  }

  // Ship identity for an HTF entry: the bundled HangarXPLOR table first; failing
  // that (ships newer than the snapshot), RSI's live ship-matrix, building the
  // code the same way HangarXPLOR does (MFR_Ship_Name). Returns null if neither
  // knows the ship.
  function shipIdentity(name, codes, matrix) {
    const q = name.toLowerCase();
    if (!q) return null;
    const c = bestByName(codes, q, (x) => x.ship_name);
    if (c) {
      return {
        name: c.ship_name,
        code: c.ship_code,
        mfr: c.manufacturer_code,
        mfrName: c.manufacturer_name,
      };
    }
    const m = bestByName(
      matrix.filter((x) => x.mfr),
      q,
      (x) => x.name,
    );
    if (m) {
      return {
        name: m.name,
        code: `${m.mfr}_${m.name}`.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_'),
        mfr: m.mfr,
        // Prefer the table's full manufacturer name for the same code (RSI's
        // matrix says just "MISC" where the table says "Musashi Industrial…").
        mfrName:
          (codes.find((x) => x.manufacturer_code === m.mfr) || {}).manufacturer_name || m.mfrName,
      };
    }
    return null;
  }

  // Pure: normalized hangar items + ship-code list (+ optional RSI ship-matrix
  // entries) → HTF array. `name` is the base ship (what importers match models
  // on, e.g. "Gladius"); `ship_name` keeps the full edition/variant name from the
  // hangar ("Gladius Dunlevy"), which FleetYards shows as the ship's own name.
  OH.buildHTF = function buildHTF(items, codes = [], matrix = []) {
    const out = [];
    for (const p of items || []) {
      const ships = (p.contents || []).filter((c) => /^ship$/i.test(c.kind || ''));
      for (const ship of ships) {
        const label = OH.htfShipName(ship.label);
        if (!label) continue;
        const id = shipIdentity(label, codes, matrix);
        const entry = { name: id ? id.name : label, entity_type: 'ship' };
        if (id) {
          entry.ship_code = id.code;
          entry.manufacturer_code = id.mfr;
          entry.manufacturer_name = id.mfrName;
        }
        entry.ship_name = label;
        if (p.id != null) entry.pledge_id = String(p.id);
        if (p.name) entry.pledge_name = p.name;
        if (p.date) entry.pledge_date = p.date; // ISO YYYY-MM-DD, per the spec
        if (Number.isFinite(p.value)) {
          entry.pledge_cost = `$${p.value.toFixed(2)} ${p.currency || 'USD'}`;
        }
        entry.lti = p.insurance === 'LTI';
        entry.warbond = /warbond/i.test(p.name || '');
        out.push(entry);
      }
    }
    return out;
  };

  let shipCodesCache = null;
  async function loadShipCodes() {
    if (shipCodesCache) return shipCodesCache;
    try {
      const res = await fetch(chrome.runtime.getURL('src/data/ship-codes.json'));
      shipCodesCache = res.ok ? await res.json() : [];
    } catch {
      shipCodesCache = [];
    }
    return shipCodesCache;
  }

  // Build an HTF export from the stored hangar. Returns { ships, unmatched }.
  OH.exportHTF = async function exportHTF() {
    const { items } = await OH.loadSource('hangar');
    const [codes, matrix] = await Promise.all([loadShipCodes(), getShipMatrix()]);
    const ships = OH.buildHTF(items, codes, matrix);
    return { ships, unmatched: ships.filter((s) => !s.ship_code).length };
  };

  // Validate + persist an imported database (the shape exportDB emits, or a bare
  // { schemaVersion, sources }). Replaces the stored DB — import is a restore,
  // not a merge. `owner` is intentionally NOT carried over: an import is the
  // user's explicit choice, so it shouldn't be auto-cleared by the different-
  // account safety check, nor misattributed to the current login.
  // The export's `account` block (identity, org, rank, balances) is a read-only
  // snapshot for external consumers; it is deliberately NOT restored here, because
  // the in-tool Citizen Card always reflects the *live* signed-in RSI session
  // (see the multi-account safety notes), never an imported identity.
  // The website's "Download Your Data" file is recognised too (importSiteNow):
  // there every hangar names its account, so each goes to that account's slot.
  // Returns { ok, db?, error?, site? }.
  OH.importDB = async function importDB(obj) {
    if (!obj || typeof obj !== 'object') return { ok: false, error: 'Not a JSON object.' };
    const site = obj.sources ? null : OH.siteExportAccounts(obj);
    if (site) {
      if (!site.length) {
        return {
          ok: false,
          error:
            'This website file has no synced hangar in it yet. Sync from the extension first, or import a backup file.',
        };
      }
      for (const a of site) {
        const bad = versionError(a.data);
        if (bad) return { ok: false, error: bad };
      }
      return exclusive(() => importSiteNow(site));
    }
    if (!obj.sources || typeof obj.sources !== 'object') {
      return { ok: false, error: 'Missing "sources" — this is not an Open Hangar export.' };
    }
    const bad = versionError(obj);
    if (bad) return { ok: false, error: bad };
    return exclusive(() => importNow(obj));
  };
  // A backup file says app: 'open-hangar' and carries the export version; a bare
  // stored DB carries the storage version. → an error message, or null.
  function versionError(obj) {
    const newest = obj.app === 'open-hangar' ? EXPORT_VERSION : DB_VERSION;
    if (obj.schemaVersion && obj.schemaVersion > newest) {
      return `This file is format v${obj.schemaVersion}; this version of Open Hangar reads up to v${newest}. Update the extension first.`;
    }
    return null;
  }
  // A file's sources as stored. Most sources store an array of items (hangar,
  // buybacks); the referral source stores a single object. Accept either so a full
  // restore round-trips. Rows must be objects (a hand-edited or damaged file could
  // hold nulls). Extras saved with a scan (e.g. buy-back tokens) survive too.
  function importSources(sources) {
    const out = {};
    for (const [id, src] of Object.entries(isObj(sources) ? sources : {})) {
      if (!src || !src.items || typeof src.items !== 'object') continue;
      let items;
      if (id === 'referral') items = OH.normalizeReferral(src.items);
      else if (Array.isArray(src.items)) items = src.items.filter(isObj);
      else continue;
      out[id] = { items, scannedAt: src.scannedAt || null };
      if (isObj(src.meta)) out[id].meta = src.meta;
    }
    return out;
  }
  async function importNow(obj) {
    const db = { schemaVersion: DB_VERSION, sources: importSources(obj.sources) };
    // History is merged, never replaced: restoring an old backup must not throw
    // away snapshots taken since, and vice versa.
    const { db: current } = await readDB();
    db.history = OH.mergeHistory(current.history, obj.history);
    await writeDB(db);
    // The pledge archive is merged too (#388): per pledge the newest goneAt wins.
    // A file without one (older backups) leaves this browser's archive as it is.
    if (isObj(obj.pledgeArchive)) {
      await writeArchive(OH.mergeArchive(await readArchive(), OH.leanArchive(obj.pledgeArchive)));
    }
    await chrome.storage.local.remove(['hangar', 'scannedAt']); // drop legacy keys
    return { ok: true, db };
  }

  // The website's "Download Your Data" file (the website app, Account → Your
  // Data): { export: { format, … }, account, …, rsi_accounts: [{ account: { handle,
  // … }, latest_sync: { synced_at, format_version, data } | null, … }] }. Each
  // `data` is this extension's backup file as it was last synced, without its
  // history. → [{ handle, displayName, syncedAt, data }] for the RSI accounts with a
  // synced hangar, or null when `obj` isn't that file. Pure.
  OH.siteExportAccounts = function siteExportAccounts(obj) {
    if (!isObj(obj) || !Array.isArray(obj.rsi_accounts)) return null;
    const out = [];
    for (const r of obj.rsi_accounts) {
      const sync = isObj(r) && isObj(r.latest_sync) ? r.latest_sync : null;
      const data = sync && isObj(sync.data) && isObj(sync.data.sources) ? sync.data : null;
      if (!data) continue;
      const who = isObj(data.account) ? data.account : {};
      const handle = String(who.handle || (isObj(r.account) && r.account.handle) || '').trim();
      if (!handle) continue; // the website keeps every hangar under a handle
      const syncedAt = Number(sync.synced_at);
      out.push({
        handle,
        displayName: who.displayName ? String(who.displayName) : null,
        syncedAt: Number.isFinite(syncedAt) ? syncedAt : 0,
        data,
      });
    }
    return out;
  };

  // Import the website's file. Unlike a backup file, every hangar in it says whose
  // it is, so each goes to that account's own place, the way saved accounts work
  // (OH.switchProfile): one becomes the live DB, owned by its handle; the others are
  // parked under `profile:<handle>`. The live one is the account this browser's
  // data already belongs to, else the signed-in one (cached, no request), else the
  // most recently synced. Data here for an account the file doesn't have is parked
  // first, never overwritten. The file has no history: each account keeps its own
  // here. Archives merge as in importNow. → { ok, db, site: { live, parked } }.
  async function importSiteNow(accounts) {
    const lc = (s) => String(s || '').toLowerCase();
    const find = (nick) => (nick ? accounts.find((a) => lc(a.handle) === lc(nick)) : null);
    const { db: cur } = await readDB();
    const { account: cached } = await chrome.storage.local.get('account');
    const curOwner = cur.owner && cur.owner.nickname;
    const live =
      find(curOwner) ||
      find(cached && cached.loggedIn && cached.nickname) ||
      accounts.slice().sort((a, b) => b.syncedAt - a.syncedAt)[0];
    const owner = (a) => ({ nickname: a.handle, displayname: a.displayName });
    const fileArchive = (a) => OH.leanArchive(a.data.pledgeArchive);

    // The live account: its history and archive are the live ones when this data is
    // already its own (or nobody's), else its parked ones (that copy goes live).
    let history = [];
    let archive = {};
    if (!curOwner || lc(curOwner) === lc(live.handle)) {
      history = cur.history;
      archive = await readArchive();
    } else if (dbHasData(cur)) {
      const here = await readArchive();
      const park = Object.keys(here).length ? { ...cur, pledgeArchive: here } : cur;
      await chrome.storage.local.set({ [profileKey(curOwner)]: park });
    }
    // A parked copy of the live account joins it (one place per account).
    const key = profileKey(live.handle);
    const saved = (await chrome.storage.local.get(key))[key];
    if (isObj(saved) && saved.schemaVersion) {
      history = OH.mergeHistory(history, fromStored(saved).history);
      archive = OH.mergeArchive(archive, saved.pledgeArchive);
    }
    await chrome.storage.local.remove(key);
    const db = {
      schemaVersion: DB_VERSION,
      sources: importSources(live.data.sources),
      owner: owner(live),
      history,
    };
    await writeDB(db);
    await writeArchive(OH.mergeArchive(archive, fileArchive(live)));

    // Every other account: parked, merged into what's parked for it already.
    const parked = [];
    for (const a of accounts) {
      if (a === live || lc(a.handle) === lc(live.handle)) continue;
      const key = profileKey(a.handle);
      const saved = (await chrome.storage.local.get(key))[key];
      const had = isObj(saved) && saved.schemaVersion ? saved : null;
      const park = {
        schemaVersion: DB_VERSION,
        sources: importSources(a.data.sources),
        owner: owner(a),
        history: had ? fromStored(had).history : [],
      };
      const arch = OH.mergeArchive(had && had.pledgeArchive, fileArchive(a));
      if (Object.keys(arch).length) park.pledgeArchive = arch;
      await chrome.storage.local.set({ [key]: park });
      parked.push(a.displayName || a.handle);
    }
    await chrome.storage.local.remove(['hangar', 'scannedAt']); // drop legacy keys
    return { ok: true, db, site: { live: live.displayName || live.handle, parked } };
  }

  // --- Scanning -------------------------------------------------------------

  // A logged-out fetch lands on a sign-in page (redirect to /connect, or HTML
  // with a password field) — distinguish that from a genuinely empty source.
  function looksLoggedOut(res, html) {
    if (res.redirected && /account\/(connect|sign-?in)|\/connect\b/i.test(res.url)) return true;
    return /name=["']password["']|id=["']?password|account\/connect/i.test(html);
  }

  // Fetch one page, retrying only *transient* failures (network error, 5xx, 429)
  // with a polite backoff. Auth failures and other 4xx return at once.
  // Returns { res } or { error, transient }.
  // Network errors and 5xx: up to 3 retries, quick exponential backoff.
  // RSI's "slow down" (429, #298): up to 5 retries, waiting 5 s, 10 s, 15 s, 20 s,
  // 25 s (or longer when RSI's Retry-After asks, up to 30 s), so a busy RSI gets
  // real breathing room instead of a scan that fails.
  const RETRIES = 3;
  const MAX_RETRY_WAIT_MS = 15000;
  const RATE_LIMIT_RETRIES = 5;
  const RATE_LIMIT_STEP_MS = 5000;
  const MAX_RATE_LIMIT_WAIT_MS = 30000;
  // opts.retryRateLimit: false = a 429 comes straight back as { rateLimited }, for
  // batches that should stop rather than push on (buy-back details).
  async function fetchPage(url, onRetry, { retryRateLimit = true } = {}) {
    let errors = 0;
    let slowDowns = 0;
    let retry = null; // { msg, wait, attempt, of } for the next try
    for (;;) {
      if (retry) {
        // Said before the wait, so a long pause reads as "retrying", not stuck.
        onRetry?.(retry.attempt, retry.of, retry.msg);
        await sleep(retry.wait);
      }
      let res;
      try {
        res = await fetch(url, { credentials: 'include', signal: AbortSignal.timeout(30000) });
      } catch (e) {
        const msg = `Couldn't reach RSI (${e.message})`;
        if (++errors > RETRIES) return { error: msg, transient: true };
        retry = { msg, wait: DELAY_MS * 2 ** errors, attempt: errors, of: RETRIES };
        continue;
      }
      const after = Number(res.headers.get('retry-after')) * 1000;
      if (res.status === 429) {
        if (!retryRateLimit) return { error: 'RSI asked us to slow down', rateLimited: true };
        const msg = 'RSI asked us to slow down';
        if (++slowDowns > RATE_LIMIT_RETRIES) return { error: msg, transient: true };
        retry = {
          msg,
          wait: Math.min(
            Math.max(after > 0 ? after : 0, RATE_LIMIT_STEP_MS * slowDowns),
            MAX_RATE_LIMIT_WAIT_MS,
          ),
          attempt: slowDowns,
          of: RATE_LIMIT_RETRIES,
        };
        continue;
      }
      if (res.status >= 500) {
        const msg = `RSI responded ${res.status}`;
        if (++errors > RETRIES) return { error: msg, transient: true };
        retry = {
          msg,
          wait: Math.min(after > 0 ? after : DELAY_MS * 2 ** errors, MAX_RETRY_WAIT_MS),
          attempt: errors,
          of: RETRIES,
        };
        continue;
      }
      return { res };
    }
  }

  // Paginated HTML source: fetch ?page=N&pagesize=…, parse, dedupe by id, stop
  // when a page yields no NEW ids (RSI clamps out-of-range pages to the last).
  // onProgress(page, count, retry?) — retry = { attempt, of } while retrying.
  // If RSI keeps failing mid-scan, returns what was gathered as { items, partial }.
  // `prev`: the saved scan, for sources that probe for changes first (#294). When
  // it's still current, returns { unchanged: true } after a few requests.
  // A complete result says `aligned` when every page brought only new items, so
  // item k sits on page floor(k / size) + 1 (what a later probe relies on).
  async function scanHtmlSource(src, onProgress, prev) {
    const seen = new Set();
    const all = [];
    const size = src.pageSize || PAGE_SIZE;
    let meta;
    let lastPage = 0;
    let lastAdded = 0;
    let aligned = true;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `${src.url}?page=${page}&pagesize=${size}`;
      const got = await fetchPage(url, (attempt, of, reason) => {
        OH.log('warn', src.id, `page ${page}: ${reason}, retry ${attempt}/${of}`);
        onProgress?.(page, all.length, { attempt, of });
      });
      if (got.error) {
        if (page === 1)
          return { error: `${got.error}. Felt like a 30k: check your connection and try again.` };
        return { items: all, meta, partial: { page, reason: got.error } };
      }
      const res = got.res;
      if (res.status === 401 || res.status === 403) {
        return {
          error: 'Keycard rejected by RSI: your session may have expired. Sign in to RSI again.',
        };
      }
      if (!res.ok) return { error: `RSI responded ${res.status} on page ${page}.` };

      const html = await res.text();
      const items = src.parse(html);
      if (page === 1 && src.meta) {
        try {
          meta = src.meta(html);
        } catch {
          /* optional extras */
        }
      }

      if (page === 1 && !items.length) {
        if (looksLoggedOut(res, html)) {
          return {
            error:
              'You’re not signed in to RSI. Log in at robertsspaceindustries.com, then scan again.',
          };
        }
        // A source can declare how an *intentionally* empty list reads.
        if (src.emptyMarker && src.emptyMarker.test(html)) break; // legitimately empty
        // Signed in but parsed nothing: if the page still carries the data markers,
        // the parser couldn't read them → RSI likely changed their markup.
        if (src.marker && src.marker.test(html)) {
          return {
            error: `Signed in, but couldn't read any ${src.label.toLowerCase()}. RSI may have changed their site. Send your flight log to #bug-reports and we'll patch it.`,
          };
        }
        // Sources that need server-rendered HTML but got none (e.g. a client-side
        // SPA shell) say so, rather than silently reporting "empty".
        if (src.requiresRender) {
          return {
            error: `Couldn't read ${src.label.toLowerCase()}: RSI sent back an empty page. Send your flight log to #bug-reports and we'll patch it.`,
          };
        }
        break; // logged in, source is genuinely empty
      }
      if (!items.length) break;

      let added = 0;
      fillIds(src, items, page);
      if (page === 1 && prev && (await unchangedSince(src, prev, items, size))) {
        onProgress?.(page, prev.items.length);
        return { unchanged: true };
      }
      for (const it of items) {
        const key = it.id;
        if (seen.has(key)) continue;
        seen.add(key);
        all.push(it);
        added++;
      }
      onProgress?.(page, all.length);
      lastPage = page;
      lastAdded = added;
      if (added === 0) break;
      if (added !== items.length) aligned = false;
      await sleep(DELAY_MS);
    }
    // Still finding new items on the last allowed page: the list goes on, so
    // report it as partial (saved without counting the rest as "removed").
    if (lastPage === MAX_PAGES && lastAdded > 0) {
      return { items: all, meta, partial: { page: MAX_PAGES + 1, reason: 'page limit reached' } };
    }
    return { items: all, meta, aligned };
  }

  // Rows without an id (e.g. a buy-back with no reclaim button) get one from
  // their position, so identical copies stay separate.
  function fillIds(src, items, page) {
    items.forEach((it, i) => {
      if (it.id == null || it.id === '') it.id = `${src.id}-p${page}-${i}`;
    });
    return items;
  }

  const appVersion = () => chrome.runtime?.getManifest?.().version || null;

  // Is the saved scan still what RSI shows (#294)? RSI lists pledges in a fixed
  // order, so anything bought, melted, gifted, reclaimed or upgraded away shifts
  // the first page or the last one. Same page 1 (already read by the caller),
  // same last page and, when that one is full, nothing after it: the hangar is
  // exactly as saved. Trusted only within a day of a complete scan by this same
  // version (so a parser fix or a change deep in the middle still gets read);
  // anything off, or any hiccup, means a normal full scan. At most 2 requests.
  async function unchangedSince(src, prev, first, size) {
    try {
      const probe = prev.meta?.probe;
      const saved = Array.isArray(prev.items) ? prev.items : [];
      const last = Math.ceil(saved.length / size);
      const age = Date.now() - (probe?.at || 0);
      if (
        !probe ||
        probe.n !== saved.length ||
        probe.v !== appVersion() ||
        !(age >= 0 && age < PROBE_MAX_AGE_MS) ||
        last < PROBE_MIN_PAGES
      )
        return false;
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      if (!same(first, saved.slice(0, size))) return false;
      const read = async (page) => {
        await sleep(DELAY_MS);
        const got = await fetchPage(`${src.url}?page=${page}&pagesize=${size}`);
        if (got.error || !got.res.ok) return null;
        return fillIds(src, src.parse(await got.res.text()), page);
      };
      const tail = saved.slice((last - 1) * size);
      if (!same(await read(last), tail)) return false;
      if (tail.length < size) return true; // a short last page is the end
      // A full last page: the page after it must be RSI clamping back to it.
      const after = await read(last + 1);
      return !!after && (!after.length || same(after, tail));
    } catch {
      return false;
    }
  }

  // How completely a hangar scan read RSI's page (#295, #296): the share of pledges
  // with a date, a value, an item list and a picture, and how many contained items
  // came without a type (and how many of those were placed by name). Kept with the
  // scan, shown in the error report, and compared scan to scan. Pure, so it's
  // tested directly.
  OH.scanShape = function scanShape(items) {
    const list = Array.isArray(items) ? items : [];
    const n = list.length;
    const share = (f) => (n ? Math.round((list.filter(f).length / n) * 100) / 100 : 0);
    const tiles = list.flatMap((p) => (Array.isArray(p?.contents) ? p.contents : []));
    return {
      n,
      date: share((p) => !!p?.date),
      value: share((p) => p?.value != null),
      contents: share((p) => Array.isArray(p?.contents) && p.contents.length > 0),
      image: share((p) => !!p?.image),
      tiles: tiles.length,
      untyped: tiles.filter((c) => !(c?.kind || '').trim() || c?.guessed).length,
      guessed: tiles.filter((c) => c?.guessed).length,
    };
  };
  const SHAPE_LABELS = {
    date: 'pledge dates',
    value: 'values',
    contents: 'item lists',
    image: 'pictures',
  };
  // What a scan suddenly stopped reading (#295): a field most pledges had last time
  // and none have now usually means RSI moved things around on the hangar page.
  // Only for hangars big enough to tell (5+ pledges).
  OH.shapeDrops = function shapeDrops(prev, next) {
    if (!prev || !next || next.n < 5) return [];
    return Object.keys(SHAPE_LABELS)
      .filter((k) => prev[k] >= 0.5 && next[k] === 0)
      .map((k) => ({ field: k, label: SHAPE_LABELS[k], was: prev[k] }));
  };

  // Scan one source by id and persist it. Returns { ok, items?, scannedAt?, error? }.
  // opts.account: the account already fetched for this scan (see saveSource).
  OH.scanSource = async function scanSource(sourceId, onProgress, { account } = {}) {
    const src = OH.getSource(sourceId);
    if (!src) return { ok: false, error: `Unknown source: ${sourceId}` };
    if (src.type === 'html' && !(window.OpenHangar && OpenHangar.parsePledges)) {
      return { ok: false, error: 'Parser not loaded on this page.' };
    }
    const paused = await OH.sourcePaused(src.id);
    if (paused) {
      OH.log('warn', src.id, 'scan paused by remote status');
      return { ok: false, paused: true, error: paused };
    }
    try {
      let result;
      const saved = src.probe ? await OH.loadSource(src.id) : null;
      if (src.type === 'html') result = await scanHtmlSource(src, onProgress, saved);
      else return { ok: false, error: `Source type '${src.type}' is not implemented yet.` };

      if (result.error) {
        OH.log('error', src.id, result.error);
        return { ok: false, error: result.error };
      }

      // Nothing changed since the last full scan (#294): keep the saved items and
      // their probe (so the next full read is still due a day after the last one),
      // and stamp the check in the history like any unchanged scan.
      if (result.unchanged) {
        const scannedAt = await saveSource(src.id, saved.items, {
          record: src.id === 'hangar',
          meta: saved.meta,
          account,
        });
        OH.log('info', src.id, `unchanged since the last scan, ${saved.items.length} items kept`);
        return { ok: true, items: saved.items, scannedAt, unchanged: true };
      }

      // A scan cut short by RSI never *shrinks* your data: if an earlier scan
      // holds more items, keep it and say so instead of saving the partial one.
      if (result.partial) {
        const { page, reason } = result.partial;
        OH.log(
          'warn',
          src.id,
          `scan stopped at page ${page} (${reason}), ${result.items.length} items read`,
        );
        const prev = await OH.loadSource(src.id);
        const prevCount = Array.isArray(prev.items) ? prev.items.length : 0;
        if (prevCount > result.items.length) {
          return {
            ok: false,
            error: `RSI stopped responding at page ${page} (${reason}), so we kept your previous scan of ${prevCount}. Try again in a minute.`,
          };
        }
        const scannedAt = await saveSource(src.id, result.items, { meta: result.meta, account });
        return {
          ok: true,
          items: result.items,
          scannedAt,
          partial: `stopped at page ${page} (${reason}); rescan to get the rest`,
        };
      }

      // A complete hangar scan records how completely it read the page, and warns
      // when that suddenly drops (#295) or when RSI left types off (#296).
      let meta = result.meta;
      if (src.id === 'hangar') {
        const shape = OH.scanShape(result.items);
        const prev = await OH.loadSource(src.id);
        for (const d of OH.shapeDrops(prev.meta?.shape, shape))
          OH.log(
            'warn',
            src.id,
            `read no ${d.label} this time (${Math.round(d.was * 100)}% last scan): RSI may have changed the hangar page`,
          );
        if (shape.untyped)
          OH.log(
            'info',
            src.id,
            `${shape.untyped} of ${shape.tiles} items came without a type from RSI, ${shape.guessed} placed by name`,
          );
        meta = { ...(meta || {}), shape };
      }
      // What the next scan checks against to skip an unchanged hangar (#294).
      if (src.probe && result.aligned) {
        meta = {
          ...(meta || {}),
          probe: { at: Date.now(), n: result.items.length, v: appVersion() },
        };
      }

      // Only complete hangar scans go into the history (a partial one would read
      // as pledges disappearing).
      const scannedAt = await saveSource(src.id, result.items, {
        record: src.id === 'hangar',
        meta,
        account,
      });
      OH.log('info', src.id, `scan ok, ${result.items.length} items`);
      // A complete buy-back list: drop cached details for ones since reclaimed.
      if (src.id === 'buybacks') await OH.pruneBuybackDetails(result.items.map((b) => b.id));
      queueStorageCheck();
      return { ok: true, items: result.items, scannedAt };
    } catch (err) {
      OH.log('error', src.id, `scan crashed: ${err?.stack || err?.message || err}`);
      return { ok: false, error: String(err?.message || err) };
    }
  };

  // Scan every registered source in sequence. Returns { [id]: result }.
  OH.scanAll = async function scanAll(onProgress) {
    const out = {};
    for (const src of OH.SOURCES) {
      out[src.id] = await OH.scanSource(src.id, (page, count) => onProgress?.(src.id, page, count));
    }
    return out;
  };

  // --- Backward-compatible facade (current UI targets the hangar source) ----
  OH.scanHangar = (onProgress) => OH.scanSource('hangar', onProgress);
  OH.loadHangar = () => OH.loadSource('hangar');

  // --- RSI account: identity + balances ------------------------------------
  // The server-rendered dashboard embeds an HTML-escaped JSON object with the
  // signed-in user's nickname, displayname, and creditsData — no GraphQL needed.
  const ACCOUNT_URL = 'https://robertsspaceindustries.com/en/account/dashboard';
  const ACCOUNT_TTL_MS = 10 * 60 * 1000;
  const ACCOUNT_CACHE_V = 6; // bump when the cached account shape changes (v6: + referral)

  // Brace-scan outward from a key match to extract the smallest enclosing {...}
  // JSON object, then parse it. Shared by extractAccount/extractReferral because
  // the dashboard embeds several separate HTML-escaped JSON blobs. `un` must be
  // already entity-unescaped. Returns the parsed object or null.
  function extractObjectAround(un, keyIdx) {
    if (keyIdx < 0) return null;
    let depth = 0,
      start = -1;
    for (let p = keyIdx; p >= 0; p--) {
      const c = un[p];
      if (c === '}') depth++;
      else if (c === '{') {
        if (depth === 0) {
          start = p;
          break;
        }
        depth--;
      }
    }
    let d = 0,
      end = -1;
    for (let p = start; p < un.length; p++) {
      const c = un[p];
      if (c === '{') d++;
      else if (c === '}') {
        d--;
        if (d === 0) {
          end = p;
          break;
        }
      }
    }
    if (start < 0 || end < 0) return null;
    try {
      return JSON.parse(un.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  const unescapeEntities = (html) =>
    html
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&#0?39;/g, "'");

  function extractAccount(html) {
    const un = unescapeEntities(html);
    return extractObjectAround(un, un.indexOf('"nickname"'));
  }

  // The dashboard HTML embeds a SEPARATE referral blob (not inside the nickname
  // object): { referralCode, referralUrl, referralUrlCopy, referrerReferralCode }.
  // referralUrlCopy is the clean (non-encoded) enlist URL. Verified May 2026.
  // Returns { code, url, referrerCode } or null when absent (e.g. signed out).
  function extractReferral(html) {
    const un = unescapeEntities(html);
    const m = /"referralCode"\s*:/.exec(un);
    const obj = m ? extractObjectAround(un, m.index) : null;
    if (!obj || !obj.referralCode) return null;
    return {
      code: obj.referralCode,
      url: obj.referralUrlCopy || obj.referralUrl || null,
      referrerCode: obj.referrerReferralCode || null,
    };
  }

  // → { loggedIn: true|false|null, nickname, displayname, credits } where credits
  // is keyed by variant: { store|uec|rec: { value, symbol, currency, label } }.
  // NOTE: store credit `value` is in CENTS. Cached; null loggedIn = couldn't tell.
  // Parse the member's MAIN organization from the citizen dossier DOM. The block
  // is `.main-org` with a logo (`.thumb img`) and `.info .entry` rows of
  // label/value pairs (Organization, Spectrum Identification (SID), Organization
  // rank). Returns { name, sid, rank, logo } or null when the member has no main
  // org or it's set to private (RSI redacts the values, marking the block
  // `visibility-R`). Verified against a live dossier (May 2026).
  function parseMainOrg(doc) {
    const block = doc.querySelector('.main-org');
    if (!block) return null;
    // Private/hidden affiliation: RSI flags the block visibility-R and blanks the
    // values. Skip rather than show "REDACTED".
    if (block.classList.contains('visibility-R')) return null;
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const info = block.querySelector('.info');
    if (!info) return null;
    // Within .main-org .info, entries are <p class="entry">. The ORG NAME entry
    // has NO label (it's an <a class="value">…</a>); SID and rank entries pair a
    // <span class="label"> with a <strong class="value">. So: name = the first
    // labelless value (prefer the <a>), and read sid/rank by their labels.
    let name = '',
      sid = null,
      rank = null;
    for (const entry of info.querySelectorAll('.entry')) {
      const label = clean(entry.querySelector('.label')?.textContent).toLowerCase();
      const value = clean(entry.querySelector('.value')?.textContent);
      if (!value) continue;
      if (!label) {
        if (!name) name = value;
      } // labelless ⇒ org name
      else if (label.includes('sid'))
        sid = value; // "Spectrum Identification (SID)"
      else if (label.includes('rank')) rank = value; // "Organization rank"
    }
    if (!name) name = clean(info.querySelector('a.value')?.textContent); // fallback
    if (!name || /^redacted$/i.test(name)) return null; // no org, or private
    // SID also lives in the org link href (/orgs/SID) — derive if not labelled.
    if (!sid) {
      const href = info.querySelector('a[href*="/orgs/"]')?.getAttribute('href') || '';
      const m = href.match(/\/orgs\/([^/?#]+)/);
      if (m) sid = m[1];
    }
    let logo = block.querySelector('.thumb img')?.getAttribute('src') || null;
    if (logo && !logo.startsWith('http')) logo = 'https://robertsspaceindustries.com' + logo;
    return { name, sid, rank, logo };
  }

  OH.getAccount = async function getAccount({ force = false } = {}) {
    const { account } = await chrome.storage.local.get('account');
    if (
      !force &&
      account?.fetchedAt &&
      account.v === ACCOUNT_CACHE_V &&
      Date.now() - account.fetchedAt < ACCOUNT_TTL_MS
    ) {
      return account;
    }
    try {
      const res = await fetch(ACCOUNT_URL, {
        credentials: 'include',
        signal: AbortSignal.timeout(20000),
      });
      const html = res.ok ? await res.text() : '';
      const obj = extractAccount(html);
      if (!obj) {
        // We reached the dashboard but found no account object. A genuinely
        // logged-in dashboard ALWAYS embeds the nickname JSON, so "fetched OK but
        // no account" means logged out — not merely "couldn't tell". Only a failed
        // fetch (network/!res.ok) is treated as unknown (null), so a transient
        // error doesn't wrongly flip a signed-in user to the logged-out wall.
        return {
          loggedIn: res.ok ? false : null,
          fetchedAt: Date.now(),
        };
      }
      const credits = {};
      for (const c of obj.creditsData || []) {
        credits[c.variant] = {
          value: c.value,
          symbol: c.symbol,
          label: c.label,
          currency: c.currency,
        };
      }
      const sub = obj.subscriberData;
      const con = obj.conciergeData;
      const avatar = obj.avatar
        ? obj.avatar.startsWith('http')
          ? obj.avatar
          : 'https://robertsspaceindustries.com' + obj.avatar
        : null;
      const out = {
        v: ACCOUNT_CACHE_V,
        loggedIn: true,
        nickname: obj.nickname || null,
        displayname: obj.displayname || null,
        avatar,
        enlistedSince: obj.enlistedSince || null,
        countryName: obj.countryName || null,
        credits,
        subscriber: sub && sub.type ? { type: sub.type, frequency: sub.frequency || null } : null,
        concierge:
          con && con.conciergeCurrentLevel
            ? {
                level: con.conciergeCurrentLevel,
                next: con.conciergeNextLevel || null,
                percent: con.conciergeNextLevelPercentage ?? null,
              }
            : null,
        citizenRecord: null,
        org: null, // { name, sid, rank, logo } from the public dossier, or null
        referral: extractReferral(html), // { code, url, referrerCode } | null — from the SAME fetch (free)
      };
      // UEE Citizen Record + main Organization live on the public dossier
      // (citizen profile) page — one fetch covers both.
      if (out.nickname) {
        try {
          const cres = await fetch(
            `https://robertsspaceindustries.com/en/citizens/${encodeURIComponent(out.nickname)}`,
            { credentials: 'omit', signal: AbortSignal.timeout(20000) },
          );
          if (cres.ok) {
            const cdoc = new DOMParser().parseFromString(await cres.text(), 'text/html');
            out.citizenRecord =
              cdoc.querySelector('.citizen-record .value')?.textContent?.trim() || null;
            out.org = parseMainOrg(cdoc);
          }
        } catch (e) {
          /* dossier is optional */
        }
      }
      out.fetchedAt = Date.now();
      await chrome.storage.local.set({ account: out });
      return out;
    } catch (e) {
      return account || { loggedIn: null, fetchedAt: 0 };
    }
  };

  // --- Referrals: recruits + prospects (GraphQL) ---------------------------
  // The referral pages (/en/referral, /en/referral-legacy) are JS-rendered, so we
  // hit their data API directly: POST /graphql, operation GetReferralRecruitsList,
  // with the session cookie (credentials:'include') — no CSRF token needed (same
  // trust model as the hangar fetch). Verified replayable against a live account
  // (May 2026). Two "campaigns": '2' = CURRENT program, '1' = LEGACY (pre-cutoff,
  // different rewards). The PROSPECT pool is shared across both; only RECRUIT
  // counts differ (legacy = all-time total, current = post-cutoff conversions).
  // Each row: { id, displayName, nickname, avatar, enlistedOn, convertedOn }.
  // `converted:true` filters to recruits; `false` returns the full prospect list.
  const GRAPHQL_URL = 'https://robertsspaceindustries.com/graphql';
  const REFERRAL_CAMPAIGNS = { current: '2', legacy: '1' };
  const REFERRAL_PAGE_SIZE = 50; // API accepts this; pages don't overlap (verified)
  const REFERRAL_MAX_PAGES = 200; // safety cap (10k rows)
  const REFERRAL_QUERY = `query GetReferralRecruitsList($campaignId: ID!, $converted: Boolean!, $display: ReferralRecruitsListDisplay, $limit: Int!, $page: Int!, $sortBy: ReferralRecruitsListSortBy) {
  referralRecruitsList(query: {campaignId: $campaignId, converted: $converted, display: $display, limit: $limit, page: $page, sortBy: $sortBy}) {
    recruitsCount
    prospectsCount
    data { id displayName nickname avatar enlistedOn convertedOn }
  }
}`;

  // One page of the recruits/prospects list for a campaign. Returns
  // { recruitsCount, prospectsCount, data: [...] } or { error }.
  async function fetchReferralPage(campaignId, converted, page) {
    let res;
    try {
      res = await fetch(GRAPHQL_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(20000),
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operationName: 'GetReferralRecruitsList',
          query: REFERRAL_QUERY,
          variables: {
            campaignId,
            converted,
            display: 'ALL_TIME',
            limit: REFERRAL_PAGE_SIZE,
            page,
            sortBy: 'NEWEST',
          },
        }),
      });
    } catch (e) {
      return { error: `Couldn't reach RSI (${e.message}).` };
    }
    if (res.status === 401 || res.status === 403)
      return { error: 'RSI rejected the request — sign in again.' };
    if (!res.ok) return { error: `RSI responded ${res.status}.` };
    let json;
    try {
      json = await res.json();
    } catch {
      return { error: 'RSI returned a non-JSON referral response.' };
    }
    if (json.errors && json.errors.length)
      return { error: json.errors.map((e) => e.message).join('; ') };
    const node = json?.data?.referralRecruitsList;
    if (!node)
      return { error: 'Referral data missing from response (RSI may have changed the API).' };
    return {
      recruitsCount: node.recruitsCount ?? null,
      prospectsCount: node.prospectsCount ?? null,
      data: Array.isArray(node.data) ? node.data : [],
    };
  }

  // Walk every page of one campaign+converted list, deduping by id (page 1/2 were
  // verified non-overlapping, but dedupe guards against RSI clamping out-of-range
  // pages like the hangar does). Returns { count, items } or { error }.
  async function fetchReferralList(campaignId, converted, onProgress) {
    const seen = new Set();
    const items = [];
    let count = null;
    for (let page = 1; page <= REFERRAL_MAX_PAGES; page++) {
      const res = await fetchReferralPage(campaignId, converted, page);
      // A later page failing leaves the list short: say so, so the caller can
      // keep the previous scan's list instead of saving a truncated one.
      if (res.error) return page === 1 ? { error: res.error } : { count, items, partial: true };
      count = converted ? res.recruitsCount : res.prospectsCount;
      let added = 0;
      for (const it of res.data) {
        const key = it.id ?? `${it.nickname}:${it.enlistedOn}`;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({
          id: it.id ?? null,
          handle: it.nickname || null,
          moniker: it.displayName || null,
          avatar: it.avatar || null,
          enlistedOn: it.enlistedOn || null,
          convertedOn: it.convertedOn || null,
        });
        added++;
      }
      onProgress?.(items.length, count);
      if (added === 0 || res.data.length < REFERRAL_PAGE_SIZE) break;
      await sleep(DELAY_MS);
    }
    return { count, items };
  }

  // Scrape the full referral picture and persist it as the 'referral' source.
  // Shape: { code, url, current:{recruits}, legacy:{recruits}, prospects,
  //          recruitsList:[...], prospectsList:[...] }. recruitsList carries a
  // `campaign` tag per row ('current'|'legacy') since legacy is a superset.
  // Returns { ok, referral?, scannedAt?, error? }. Never throws.
  OH.getReferral = async function getReferral(onProgress, { account } = {}) {
    const paused = await OH.sourcePaused('referrals');
    if (paused) {
      OH.log('warn', 'referrals', 'scan paused by remote status');
      return { ok: false, paused: true, error: paused };
    }
    try {
      // Code/url come free from the account fetch (already cached/fetched there).
      const acct = account === undefined ? await OH.getAccount() : account;
      if (acct && acct.loggedIn === false) return { ok: false, error: 'Not signed in to RSI.' };
      const code = acct?.referral?.code || null;
      const url = acct?.referral?.url || null;

      // Recruits: legacy is the all-time superset, current is the post-cutoff subset.
      // Pull both and tag each row; prospects are shared, so fetch once (current).
      onProgress?.('recruits (legacy)', 0, null);
      const legacyRecruits = await fetchReferralList(REFERRAL_CAMPAIGNS.legacy, true, (n, t) =>
        onProgress?.('recruits (legacy)', n, t),
      );
      if (legacyRecruits.error && !legacyRecruits.items?.length)
        return { ok: false, error: legacyRecruits.error };

      onProgress?.('recruits (current)', 0, null);
      const currentRecruits = await fetchReferralList(REFERRAL_CAMPAIGNS.current, true, (n, t) =>
        onProgress?.('recruits (current)', n, t),
      );

      onProgress?.('prospects', 0, null);
      const prospects = await fetchReferralList(REFERRAL_CAMPAIGNS.current, false, (n, t) =>
        onProgress?.('prospects', n, t),
      );

      // Any list that failed (or came back short) keeps the previous scan's
      // values, so one RSI hiccup can't wipe good data. `partial` names them.
      const prev = await OH.loadReferral();
      const bad = (l) => !!(l.error || l.partial);
      const partial = [];
      let legacyCount = legacyRecruits.count ?? null;
      let legacyItems = legacyRecruits.items || [];
      if (bad(legacyRecruits) && prev) {
        legacyCount = prev.legacy?.recruits ?? legacyCount;
        legacyItems = prev.recruitsList || legacyItems;
        partial.push('recruits');
      }
      let currentCount = currentRecruits.count ?? null;
      let currentIds = new Set((currentRecruits.items || []).map((r) => r.id));
      if (bad(currentRecruits)) {
        if (prev) {
          currentCount = prev.current?.recruits ?? null;
          currentIds = new Set(
            (prev.recruitsList || []).filter((r) => r.campaign === 'current').map((r) => r.id),
          );
        }
        partial.push('current recruits');
      }
      let prospectCount = prospects.count ?? null;
      let prospectItems = prospects.items || [];
      if (bad(prospects)) {
        if (prev) {
          prospectCount = prev.prospects ?? null;
          prospectItems = prev.prospectsList || [];
        }
        partial.push('prospects');
      }

      // Merge recruit lists: tag current ids, then mark legacy-only rows.
      const recruitsList = legacyItems.map((r) => ({
        ...r,
        campaign: currentIds.has(r.id) ? 'current' : 'legacy',
      }));

      const referral = {
        code,
        url,
        current: { recruits: currentCount },
        legacy: { recruits: legacyCount },
        prospects: prospectCount,
        recruitsList,
        prospectsList: prospectItems,
      };

      const scannedAt = await saveSource('referral', referral, { account: acct || undefined });
      return { ok: true, referral, scannedAt, partial: partial.length ? partial.join(', ') : null };
    } catch (err) {
      return { ok: false, error: String(err?.message || err) };
    }
  };

  // Load the persisted referral source (the object saved by getReferral), or null.
  OH.loadReferral = async function loadReferral() {
    const src = await OH.loadSource('referral');
    return src && src.items && !Array.isArray(src.items) ? src.items : null;
  };

  // --- Misc UI helpers ------------------------------------------------------

  OH.escapeHtml = function escapeHtml(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  };

  // Referral data can arrive from an imported file, and the UI interpolates its
  // counts straight into HTML as numbers — so coerce them to real numbers (and
  // the lists to arrays) before anything renders them.
  OH.normalizeReferral = function normalizeReferral(ref) {
    const num = (v) => (v == null ? v : Number.isFinite(+v) ? +v : 0);
    const count = (o) => (o && typeof o === 'object' ? { ...o, recruits: num(o.recruits) } : o);
    return {
      ...ref,
      current: count(ref.current),
      legacy: count(ref.legacy),
      prospects: num(ref.prospects),
      recruitsList: Array.isArray(ref.recruitsList) ? ref.recruitsList : [],
      prospectsList: Array.isArray(ref.prospectsList) ? ref.prospectsList : [],
    };
  };

  // Shared category metadata for labelling/colouring kinds across the app.
  OH.KINDS = [
    { key: 'ship', label: 'Ships' },
    { key: 'ccu', label: 'CCUs' },
    { key: 'paint', label: 'Paints' },
    { key: 'addon', label: 'Add-ons' },
    { key: 'coupon', label: 'Coupons' },
    { key: 'other', label: 'Other' },
  ];

  // Sum the numeric pledge values, skipping nulls.
  OH.totalValue = function totalValue(items) {
    return items.reduce((sum, p) => sum + (Number.isFinite(p.value) ? p.value : 0), 0);
  };

  // --- Star Citizen game version (openhangar.space's game-status feed) -----------
  // The top bar's Game Status pill (ui/lib/game-status.js) and the footer read the
  // same feed and the same cached copy (OH.getGameStatus), asked at most every 10
  // minutes. Feed contract v1: { v: 1, live: { version, released }, ptu, … }.
  OH.getGameStatus = ({ force = false, fetchFn } = {}) =>
    OH.siteFeed('api/game-status', { key: 'feedGameStatus', ttl: 10 * 60e3, force, fetchFn });

  // "4.8.0-LIVE.11875683" → "4.8.0-LIVE" (drop the trailing build number).
  OH.formatScVersion = (code) => (code ? code.replace(/\.\d+$/, '') : '');

  // Current LIVE game version as { code: "4.10.1-LIVE", released (ms) | null }, from
  // the game-status feed (cached), or { code: null } before it ever loaded. Never throws.
  OH.getScVersion = async function getScVersion({ force = false, fetchFn } = {}) {
    const feed = await OH.getGameStatus({ force, fetchFn });
    const live = feed && feed.data && feed.data.live;
    const version = live && typeof live.version === 'string' ? live.version.trim() : '';
    if (!/^\d+\.\d+(\.\d+)*$/.test(version)) return { code: null, released: null };
    const released = Date.parse(live.released || '') || null;
    return { code: `${version}-LIVE`, released };
  };

  // --- Ship images ----------------------------------------------------------
  // RSI ships some items (notably CCUs) with no art — a generic "DEFAULT IMAGE".
  // We resolve the real ship image from two public, read-only sources (NO
  // credentials/PII), matching RSI's loose names LOCALLY where we control the fuzz:
  //
  //   1. RSI ship-matrix (PRIMARY) — robertsspaceindustries.com/ship-matrix/index.
  //      One fetch returns ALL ships *with* images, including in-concept ships the
  //      wiki lacks (e.g. Vulcan, Genesis, Odin). We cache a slim {name → image}.
  //   2. openhangar.space's ships feed (FALLBACK) — for anything the ship-matrix
  //      misses: the picture it carries for the ship (OH.getShipsFeed, one request).
  //
  // Images don't change → hard-cached in storage; negatives cached too. Callers
  // MUST resolve lazily (only for shown cards) — see enhanceCardImages.
  const SHIP_MATRIX_URL = 'https://robertsspaceindustries.com/ship-matrix/index';
  const SHIP_IMG_TTL = 90 * 24 * 60 * 60 * 1000; // 90 days (images don't change)
  const CATALOG_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days (the RSI ship-matrix copy)
  const shipImgMem = new Map(); // normName -> url|null (per session)
  const shipImgInflight = new Map(); // normName -> Promise (dedupe concurrent)

  // Read-modify-write of one storage key, queued so concurrent callers (the
  // dashboard resolves several pictures at once) can't overwrite each other.
  let storeChain = Promise.resolve();
  function mutateStored(key, mutate) {
    const run = storeChain.then(async () => {
      const cur = (await chrome.storage.local.get(key))[key];
      const next = mutate(cur || undefined);
      await chrome.storage.local.set({ [key]: next });
      return next;
    });
    storeChain = run.catch(() => {});
    return run;
  }
  OH.mutateStored = mutateStored;
  // Drop cache entries ({ at, … }) older than ttlOf(entry). Returns a copy.
  function pruneTimed(obj, ttlOf) {
    const now = Date.now();
    const out = {};
    for (const [k, e] of Object.entries(obj || {})) {
      if (e && typeof e.at === 'number' && now - e.at < ttlOf(e)) out[k] = e;
    }
    return out;
  }
  // The newest `max` cache entries ({ at, … }) of `obj`. A time limit alone
  // doesn't bound a cache, so each one keyed by name or address also has a count.
  function capNewest(obj, max) {
    const ids = Object.keys(obj || {});
    if (ids.length <= max) return obj;
    ids.sort((a, b) => (obj[b].at || 0) - (obj[a].at || 0));
    return Object.fromEntries(ids.slice(0, max).map((k) => [k, obj[k]]));
  }
  OH.capNewest = capNewest;
  // Entry caps for the caches above and below (test/storage-budget.test.js).
  OH.CACHE_MAX = { shipImages: 2000 };
  let catalogMem = null; // [{ name, lname, slug, cls, msrp, img, … }] (bundled + ships feed)
  let catalogInflight = null;
  let matrixMem = null; // [{ lname, name, img, mfr, mfrName }]  (RSI ship-matrix)
  const MATRIX_CACHE_V = 2; // v2: + display name + manufacturer (for HTF ship codes)
  let matrixInflight = null;
  let matrixFailedAt = 0; // a failed download isn't retried for 10 minutes

  // Strip edition/marketing/year suffixes so "Starfarer Gemini Standard Edition"
  // → "Starfarer Gemini" before matching.
  OH.normShipName = function normShipName(name) {
    if (!name) return '';
    return String(name)
      .replace(/\s*[-–]\s*upgraded\b/i, '')
      .replace(
        /\b(standard|collector'?s|warbond|original|anniversary|invictus|iae|digital|starter|game\s*package|package|pack|edition|loaner|lti|vip|bis|best\s*in\s*show|\d{4})\b/gi,
        ' ',
      )
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  // RSI ship-matrix → slim [{ lname, name, img, mfr, mfrName }] for every ship,
  // fetched once and cached. The index is large (~5MB) but we keep only what the
  // image lookup and HTF ship codes need (~35KB).
  async function getShipMatrix() {
    if (matrixMem) return matrixMem;
    const cached = (await chrome.storage.local.get('shipMatrix')).shipMatrix;
    if (
      cached &&
      cached.v === MATRIX_CACHE_V &&
      cached.at &&
      Date.now() - cached.at < CATALOG_TTL &&
      Array.isArray(cached.list)
    ) {
      matrixMem = cached.list;
      return matrixMem;
    }
    if (matrixInflight) return matrixInflight;
    if (Date.now() - matrixFailedAt < 10 * 60e3) return [];
    matrixInflight = (async () => {
      const list = [];
      try {
        const res = await OH.guarded()(SHIP_MATRIX_URL, {
          credentials: 'omit',
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          const json = await res.json();
          const data = Array.isArray(json.data) ? json.data : [];
          for (const s of data) {
            if (!s || !s.name) continue;
            const im = s.media && s.media[0] && s.media[0].images;
            const url =
              im && (im.store_small || im.store_large || im.slideshow || im.product_thumb_large);
            list.push({
              lname: String(s.name).toLowerCase(),
              name: String(s.name).trim(),
              img: url || null,
              mfr: (s.manufacturer && s.manufacturer.code) || null,
              mfrName: (s.manufacturer && s.manufacturer.name) || null,
            });
          }
        }
      } catch {
        /* offline — fall through to the wiki source */
      }
      if (list.length) {
        matrixMem = list;
        try {
          await chrome.storage.local.set({
            shipMatrix: { v: MATRIX_CACHE_V, at: Date.now(), list },
          });
        } catch {}
      } else {
        matrixFailedAt = Date.now();
      }
      matrixInflight = null;
      return list;
    })();
    return matrixInflight;
  }

  // English text of a wiki translated field ({ en_EN: … }), or the plain string.
  function en(x) {
    if (!x) return null;
    if (typeof x === 'string') return x;
    return typeof x.en_EN === 'string' ? x.en_EN : null;
  }

  // The wiki's size, or null. Its API sends the word "undefined" (and translations
  // of it) when a vehicle has no size class, e.g. ground vehicles like the Storm.
  const cleanSize = (s) =>
    s && !/^(undefined|null|none|n\/a)$/i.test(String(s).trim()) ? String(s).trim() : null;

  // One wiki vehicle record → the slim entry we keep. Shared with
  // scripts/update-ship-catalog.mjs so the bundled snapshot has the same shape.
  OH.slimVehicle = function slimVehicle(v) {
    if (!v || !v.name || !v.slug) return null;
    return {
      name: String(v.name).trim(), // display name, original casing
      lname: String(v.name).toLowerCase(),
      slug: v.slug,
      cls: v.class_name ? String(v.class_name).toLowerCase() : null,
      msrp: Number(v.msrp) > 0 ? Number(v.msrp) : null, // USD store price
      // Fleet stats (Stats → Fleet): what the ship is for and how big.
      career: en(v.type) || v.career || null,
      // Every focus the wiki lists, not just the first: the Kraken is
      // "Multi-Role / Light Carrier", and only the second makes it a carrier.
      role:
        (Array.isArray(v.foci) ? v.foci.map(en).filter(Boolean) : []).join(' / ') || v.role || null,
      // Ground vehicles have no size class on the wiki; call them "Vehicle".
      size: cleanSize(en(v.size)) || (v.is_vehicle === true ? 'Vehicle' : null),
      status: en(v.production_status) || null, // flight-ready | in-concept | …
      crew: (v.crew && Number(v.crew.max)) || null,
      cargo: Number(v.cargo_capacity) || 0, // SCU
      mfr: (v.manufacturer && v.manufacturer.name) || null,
    };
  };

  // Fill missing sizes in place: a leftover "undefined" becomes null, and a special
  // edition ("F8C Lightning Wikelo War Special", "Corsair PYAM Exec") takes the size
  // of its base ship (the longest other name it starts with). Pure, returns list.
  OH.fillCatalogSizes = function fillCatalogSizes(list) {
    for (const v of list || []) v.size = cleanSize(v.size);
    const sized = (list || []).filter((v) => v.size && v.lname);
    for (const v of list || []) {
      if (v.size || !v.lname) continue;
      let base = null;
      for (const b of sized) {
        if (
          b !== v &&
          v.lname.startsWith(b.lname + ' ') &&
          (!base || b.lname.length > base.lname.length)
        )
          base = b;
      }
      if (base) v.size = base.size;
    }
    return list;
  };

  // Game-file list + ship-matrix list → one list. Pure.
  OH.mergeCatalogs = function mergeCatalogs(list, matrix) {
    const out = list.map((v) => ({ ...v }));
    const bySlug = new Map(out.map((v) => [v.slug, v]));
    const byName = new Map(out.map((v) => [v.lname, v]));
    for (const m of matrix || []) {
      const hit = bySlug.get(m.slug) || byName.get(m.lname);
      if (!hit) {
        // A flight-ready ship is always in the game-file list already, often
        // under a slightly different name ("… Mk I"); only concepts are new.
        if (m.status === 'flight-ready') continue;
        out.push({ ...m });
        bySlug.set(m.slug, out[out.length - 1]);
        byName.set(m.lname, out[out.length - 1]);
        continue;
      }
      for (const k of ['msrp', 'status', 'career', 'role', 'size', 'crew', 'cls', 'mfr']) {
        if (hit[k] == null && m[k] != null) hit[k] = m[k];
      }
      if (!hit.cargo && m.cargo) hit.cargo = m.cargo;
      if (!hit.name && m.name) hit.name = m.name;
    }
    return OH.fillCatalogSizes(out);
  };

  // Pictures we show from a feed: RSI's own or our copies on openhangar.space only.
  OH.feedImage = (url) =>
    typeof url === 'string' &&
    /^https:\/\/((media\.)?robertsspaceindustries\.com|([a-z0-9-]+\.)*openhangar\.space)\//i.test(
      url,
    )
      ? url
      : null;

  // openhangar.space/api/ships (v1): { ships: [{ name, cls, msrp, img }] }, the same
  // weekly ship list as the bundled one, cut to what prices and ship art need. Asked
  // at most once a day.
  const SHIPS_FEED_TTL = 24 * 3600e3;
  OH.getShipsFeed = ({ force = false, fetchFn } = {}) =>
    OH.siteFeed('api/ships', {
      key: 'feedShips',
      ttl: SHIPS_FEED_TTL,
      force,
      fetchFn,
      valid: (j) => isV1(j) && Array.isArray(j.ships),
    });

  // The bundled list (fleet stats: career, role, size, crew, cargo, status, maker)
  // with the ships feed on top: its store price, class name and picture, matched by
  // class name, then name. A ship only the feed knows is added without stats. Pure.
  OH.mergeShipsFeed = function mergeShipsFeed(bundled, ships) {
    const out = (bundled || []).map((v) => ({ ...v }));
    if (!Array.isArray(ships)) return out;
    const byCls = new Map(out.filter((v) => v.cls).map((v) => [v.cls, v]));
    const byName = new Map(out.map((v) => [v.lname, v]));
    for (const s of ships) {
      const name = s && typeof s.name === 'string' ? s.name.trim() : '';
      if (!name) continue;
      const lname = name.toLowerCase();
      const cls = typeof s.cls === 'string' && s.cls.trim() ? s.cls.trim().toLowerCase() : null;
      const msrp =
        typeof s.msrp === 'number' && Number.isFinite(s.msrp) && s.msrp > 0 ? s.msrp : null;
      const img = OH.feedImage(s.img);
      const hit = (cls && byCls.get(cls)) || byName.get(lname);
      if (hit) {
        if (msrp) hit.msrp = msrp;
        if (cls && !hit.cls) hit.cls = cls;
        if (img) hit.img = img;
        continue;
      }
      const v = {
        name,
        lname,
        slug: cls || lname.replace(/[^a-z0-9]+/g, '-'),
        cls,
        msrp,
        img,
        career: null,
        role: null,
        size: null,
        status: null,
        crew: null,
        cargo: 0,
        mfr: null,
      };
      out.push(v);
      byName.set(lname, v);
      if (cls) byCls.set(cls, v);
    }
    return OH.fillCatalogSizes(out);
  };

  // The ship list that ships inside the extension (src/data/ship-catalog.json,
  // refreshed weekly by a GitHub Action), or null.
  async function bundledCatalog() {
    try {
      const res = await fetch(chrome.runtime.getURL('src/data/ship-catalog.json'));
      const json = res.ok ? await res.json() : null;
      return json && Array.isArray(json.list) && json.list.length
        ? OH.fillCatalogSizes(json.list)
        : null;
    } catch {
      return null;
    }
  }

  // The ship list: bundled snapshot + the ships feed (OH.mergeShipsFeed). The
  // bundled list answers at once (prices show instantly, and offline) when the feed
  // is slow; the merged list replaces it as soon as the feed lands.
  async function getCatalog() {
    if (catalogMem) return catalogMem;
    if (catalogInflight) return catalogInflight;
    catalogInflight = (async () => {
      const bundled = (await bundledCatalog()) || [];
      const feedP = OH.getShipsFeed().catch(() => null);
      const merge = (feed) => OH.mergeShipsFeed(bundled, feed && feed.data && feed.data.ships);
      const quick = await Promise.race([
        feedP,
        new Promise((r) => setTimeout(() => r(false), 1500)),
      ]);
      if (quick === false) {
        feedP.then((feed) => {
          if (feed) catalogMem = merge(feed);
        });
        catalogMem = bundled.length ? bundled : null;
        return bundled;
      }
      const list = merge(quick);
      if (list.length) catalogMem = list;
      return list;
    })().finally(() => (catalogInflight = null));
    return catalogInflight;
  }

  // Score how well a catalog entry's (lowercased) name matches the query. 0 = no
  // match. Higher = better. Shared by both sources so fuzz rules stay consistent.
  function nameScore(n, q) {
    // RSI renamed the original Auroras "Aurora Mk I …" (the Mk II is a new ship), but
    // pledges and buy-backs still say "Aurora MR": also try the name without "Mk I".
    // "\bmk i\b" can't match "mk ii".
    const bare = n
      .replace(/\bmk i\b/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (bare !== n && !/\bmk i\b/.test(q)) return Math.max(rawScore(n, q), rawScore(bare, q) - 1);
    return rawScore(n, q);
  }
  function rawScore(n, q) {
    if (n === q) return 100; // exact
    if (n.startsWith(q + ' ')) return 80 - (n.length - q.length) * 0.1; // canonical extends query (Genesis → Genesis Starliner)
    if (q.startsWith(n + ' ')) return 70 + n.length * 0.1; // query extends canonical (PTV Buggy → PTV); prefer longer core
    if (n.includes(q) || q.includes(n)) return 40 + Math.min(n.length, q.length) * 0.1; // loose contains
    return 0;
  }

  // Best ship-matrix image for a raw RSI name, or null.
  function matchMatrixImage(matrix, rawName) {
    const q = OH.normShipName(rawName).toLowerCase();
    if (!q || !matrix.length) return null;
    let best = null,
      bestScore = 0;
    for (const v of matrix) {
      if (!v.img) continue;
      const s = nameScore(v.lname, q);
      if (s > bestScore) {
        bestScore = s;
        best = v.img;
      }
    }
    return best;
  }

  // Best picture from the ship list (the ships feed's art) for a raw RSI name, or null.
  function matchCatalogImage(catalog, rawName) {
    const q = OH.normShipName(rawName).toLowerCase();
    if (!q || !catalog || !catalog.length) return null;
    let best = null;
    let bestScore = 0;
    for (const v of catalog) {
      if (!v.img) continue;
      const sc = nameScore(v.lname, q);
      if (sc > bestScore) {
        bestScore = sc;
        best = v.img;
      }
    }
    return best;
  }

  // The original, full-size copy of a picture we show as a thumbnail (#299), or null
  // when there's no bigger one to ask for (unknown host, or already the original).
  // RSI keeps every upload under named sizes in the same file type, in two URL shapes:
  //   media.robertsspaceindustries.com/<id>/<size>.<ext>
  //   robertsspaceindustries.com/media/<id>/<size>/<file>
  // and the original is the "source" size. Wiki (MediaWiki) thumbnails live at
  //   …/thumb/<path>/<file>/<N>px-<file>, the original at …/<path>/<file>.
  // Only ever fetched when someone asks for the full-size view.
  OH.fullSizeImage = function fullSizeImage(url) {
    if (typeof url !== 'string' || !/^https:\/\//.test(url)) return null;
    const ORIGINAL = /^(source|wallpaper_\d+x\d+)$/;
    const dir = url.match(
      /^(https:\/\/robertsspaceindustries\.com\/media\/[^/]+\/)([^/]+)(\/[^/?#]+)(\?[^#]*)?$/,
    );
    if (dir) {
      const [, base, size, file, query = ''] = dir;
      return ORIGINAL.test(size) ? null : `${base}source${file}${query}`;
    }
    const flat = url.match(
      /^(https:\/\/media\.robertsspaceindustries\.com\/[^/]+\/)([^/.?#]+)\.(\w+)(\?[^#]*)?$/,
    );
    if (flat) {
      const [, base, size, ext, query = ''] = flat;
      return ORIGINAL.test(size) ? null : `${base}source.${ext}${query}`;
    }
    const wiki = url.match(/^(https:\/\/[^/]+\/(?:[^?#]*\/)?)thumb\/([^?#]+)\/\d+px-[^/?#]+$/);
    if (wiki) return `${wiki[1]}${wiki[2]}`;
    return null;
  };

  // Resolve a ship store-image URL by (raw) name. Returns a URL or null; never throws.
  OH.getShipImage = async function getShipImage(rawName) {
    const key = OH.normShipName(rawName).toLowerCase();
    if (!key) return null;
    if (shipImgMem.has(key)) return shipImgMem.get(key);

    const hit = ((await chrome.storage.local.get('shipImages')).shipImages || {})[key];
    // Found images keep for 90 days; "no image" answers only for a day, so a
    // network blip or a later-added ship doesn't leave a blank card for months.
    if (hit && Date.now() - hit.at < (hit.url ? SHIP_IMG_TTL : 24 * 3600e3)) {
      shipImgMem.set(key, hit.url);
      return hit.url;
    }
    if (shipImgInflight.has(key)) return shipImgInflight.get(key);

    const promise = (async () => {
      try {
        let url = null;
        // 1) RSI ship-matrix (one cached fetch, covers concept ships).
        url = matchMatrixImage(await getShipMatrix(), rawName);
        // 2) Fallback: the picture openhangar.space's ships feed has for it.
        if (!url) url = matchCatalogImage(await getCatalog(), rawName);
        shipImgMem.set(key, url);
        await mutateStored('shipImages', (cur = {}) => {
          const out = pruneTimed(cur, (e) => (e.url ? SHIP_IMG_TTL : 24 * 3600e3));
          out[key] = { url, at: Date.now() };
          return capNewest(out, OH.CACHE_MAX.shipImages);
        }).catch(() => {
          /* storage full / unavailable — memory cache still applies */
        });
        return url;
      } catch (e) {
        OH.log('warn', 'image', `ship art lookup failed: ${e?.message || e}`);
        return null; // callers treat null as "no picture"; retried next session
      } finally {
        shipImgInflight.delete(key);
      }
    })();
    shipImgInflight.set(key, promise);
    return promise;
  };

  // --- Ship prices + hangar value ------------------------------------------
  // The ship list (bundled, with openhangar.space's ships feed on top) carries each
  // ship's `msrp` (current USD store price), so pricing a whole hangar costs one
  // cached feed request, nothing per ship. Concept ships with no price stay
  // unpriced (the UI says how many).

  // Word-set match for names RSI and the wiki order differently: "Hercules
  // Starlifter C2" ↔ "C2 Hercules Starlifter", "Aurora MR" ↔ "Aurora Mk I MR".
  // Every query word must appear; fewer extra words scores higher.
  function tokenScore(n, q) {
    const nt = n.split(/\s+/);
    const qt = q.split(/\s+/);
    if (qt.length < 2 || !qt.every((w) => nt.includes(w))) return 0;
    return 60 - (nt.length - qt.length);
  }

  // Resolvers over a wiki catalog (and the bundled ship-code table, whose codes
  // mostly equal the wiki's class names):
  //   shipOf(label)  → the catalog entry for that ship, priced or not (fleet stats)
  //   priceOf(label) → { msrp, name } | null, falling back from an unpriced exact
  //                    hit (e.g. a special edition) to its priced base ship
  // Pure — exported for tests.
  OH.makeShipIndex = function makeShipIndex(catalog, codes = []) {
    const cat = (catalog || [])
      .filter((v) => v && v.lname && !/wikelo/i.test(v.lname)) // in-game reward variants
      .map((v) => ({ ...v, n: v.lname.replace(MFR_PREFIX, '') }));
    const byCls = new Map(cat.filter((v) => v.cls).map((v) => [v.cls, v]));

    // Best name match (≥55; loose "contains" hits are too risky). Ties — the wiki
    // lists some ships twice — go to the priced entry.
    function byName(names) {
      for (const name of names) {
        let best = null;
        let bestScore = 0;
        for (const v of cat) {
          const sc = Math.max(nameScore(v.n, name), tokenScore(v.n, name));
          if (sc < 55) continue;
          if (sc > bestScore || (sc === bestScore && !best.msrp && v.msrp)) {
            bestScore = sc;
            best = v;
          }
        }
        if (best) return best;
      }
      return null;
    }

    const mem = new Map(); // q -> { ship, price }
    function resolve(label) {
      const q = OH.htfShipName(label).toLowerCase();
      if (!q) return { ship: null, price: null };
      if (mem.has(q)) return mem.get(q);
      const id = shipIdentity(q, codes, []);
      const exact = id && byCls.get(String(id.code).toLowerCase());
      const names = [q];
      if (id && id.name.toLowerCase() !== q) names.push(id.name.toLowerCase());
      const named = exact && exact.msrp ? null : byName(names);
      const ship = exact || named;
      const priced = exact && exact.msrp ? exact : named && named.msrp ? named : null;
      const out = { ship, price: priced ? { msrp: priced.msrp, name: priced.lname } : null };
      mem.set(q, out);
      return out;
    }
    return {
      shipOf: (label) => resolve(label).ship,
      priceOf: (label) => resolve(label).price,
    };
  };

  // The slim ship list (for pickers and price tables), without in-game reward
  // variants and duplicates.
  OH.getShipCatalog = async function getShipCatalog() {
    const seen = new Set();
    return (await getCatalog()).filter((v) => {
      if (!v || !v.lname || /wikelo/i.test(v.lname) || seen.has(v.lname)) return false;
      seen.add(v.lname);
      return true;
    });
  };

  // Just the price resolver (label → { msrp, name } | null).
  OH.makePriceIndex = function makePriceIndex(catalog, codes = []) {
    return OH.makeShipIndex(catalog, codes).priceOf;
  };

  // Live resolvers backed by the ship list. Offline, they just return
  // null, so callers never need to special-case it.
  OH.getShipIndex = async function getShipIndex() {
    const [catalog, codes] = await Promise.all([getCatalog(), loadShipCodes()]);
    return OH.makeShipIndex(catalog, codes);
  };
  OH.getPriceIndex = async function getPriceIndex() {
    return (await OH.getShipIndex()).priceOf;
  };

  // Back-compat single-ship lookup on top of the index.
  OH.getShipPrice = async function getShipPrice(rawName) {
    const hit = (await OH.getPriceIndex())(rawName);
    return hit ? { msrp: hit.msrp, pledgeUrl: null } : null;
  };

  // Store value of a hangar. Only ships are priced (paints/gear/game access have
  // no reliable public price), so for packs this is the ships' part. Pure.
  //  pledges[id] = { store, ships: [{ label, msrp }], unpriced, paid, below }
  //  `below` = paid less than the ships' current store price (warbonds, sales,
  //  older cheaper pricing) — only for ship pledges that priced completely.
  OH.hangarValue = function hangarValue(items, priceOf) {
    const pledges = {};
    let store = 0;
    let paidPriced = 0;
    let ships = 0;
    let priced = 0;
    const unpricedNames = new Map();
    const ccu = { n: 0, priced: 0, store: 0, paid: 0 };
    for (const p of items || []) {
      // A CCU's standard price is the gap between its ships' store prices;
      // warbond CCUs sell for less, which is what `below` catches.
      if (p.isCCU && p.ccu) {
        const from = priceOf(p.ccu.from);
        const to = priceOf(p.ccu.to);
        const paid = Number.isFinite(p.value) ? p.value : null;
        const std = from && to && to.msrp > from.msrp ? to.msrp - from.msrp : null;
        ccu.n++;
        if (std != null) {
          ccu.priced++;
          ccu.store += std;
          if (paid != null) ccu.paid += paid;
        }
        pledges[p.id] = {
          ccu: true,
          store: std,
          from: from ? from.msrp : null,
          to: to ? to.msrp : null,
          ships: [],
          unpriced: std == null ? 1 : 0,
          paid,
          below: std != null && paid != null && paid > 0 && std - paid >= 1,
        };
        continue;
      }
      const list = (p.contents || []).filter((c) => /^ship$/i.test(c.kind || ''));
      if (!list.length) continue;
      const rows = list.map((c) => {
        const hit = priceOf(c.label);
        return { label: OH.htfShipName(c.label) || c.label, msrp: hit ? hit.msrp : null };
      });
      const unpriced = rows.filter((r) => r.msrp == null).length;
      const sum = rows.reduce((a, r) => a + (r.msrp || 0), 0);
      const paid = Number.isFinite(p.value) ? p.value : null;
      ships += rows.length;
      priced += rows.length - unpriced;
      for (const r of rows) {
        if (r.msrp == null) unpricedNames.set(r.label, (unpricedNames.get(r.label) || 0) + 1);
      }
      store += sum;
      if (!unpriced && paid != null) paidPriced += paid;
      pledges[p.id] = {
        store: sum || null,
        ships: rows,
        unpriced,
        paid,
        below: !unpriced && paid != null && paid > 0 && sum - paid >= 1,
      };
    }
    return {
      pledges,
      store,
      paidPriced, // what was paid for the fully-priced ship pledges
      storePriced: Object.values(pledges)
        .filter((x) => !x.ccu && !x.unpriced && x.paid != null)
        .reduce((a, x) => a + x.store, 0),
      ships,
      priced,
      unpriced: [...unpricedNames].map(([name, n]) => ({ name, n })),
      ccu,
    };
  };

  // Account value: everything you own, one number (owner, 2026-09-30). Pure.
  //  ships: pledges with ships, at today's store price (melt value when none of
  //         their ships has a public price)
  //  ccus:  CCUs at standard price, the gap between the two ships (melt value when
  //         either ship is unpriced)
  //  other: paints, gear, add-ons, hangars, game packages, at melt value
  //  credit: Store Credit, dollars
  // Buy-backs, UEC and REC don't count. `byId[id]` is each pledge's share, so a
  // history snapshot can be valued with exactly the same numbers.
  OH.accountValue = function accountValue(items, priceOf, credit, hv) {
    const v = hv || OH.hangarValue(items, priceOf);
    const out = { ships: 0, ccus: 0, other: 0, credit: 0, total: 0, byId: {} };
    for (const p of items || []) {
      const si = v.pledges[p.id];
      const melt = Number.isFinite(p.value) ? p.value : 0;
      let amt;
      let bucket;
      if (si && si.ccu) {
        amt = si.store != null ? si.store : melt;
        bucket = 'ccus';
      } else if (si) {
        amt = si.store != null ? si.store : melt;
        bucket = 'ships';
      } else {
        amt = melt;
        bucket = 'other';
      }
      out[bucket] += amt;
      out.byId[p.id] = amt;
    }
    out.credit = Number.isFinite(credit) && credit > 0 ? credit : 0;
    out.total = out.ships + out.ccus + out.other + out.credit;
    return out;
  };

  // Value of a history snapshot ({ items: [[id, name, melt]], credit? }) on the
  // same rules. Pledges still owned count exactly as in `acct.byId`; ones since
  // melted or gifted: a ship pledge is priced from its name ("Standalone Ship -
  // Cutlass Black" → Cutlass Black), anything else at the melt value it had.
  // Store Credit only when the snapshot recorded it (older ones didn't). Pure.
  OH.snapshotValue = function snapshotValue(snap, acct, priceOf) {
    let sum = 0;
    for (const [id, name, melt] of snap.items) {
      if (acct && id in acct.byId) {
        sum += acct.byId[id];
        continue;
      }
      const m = Number(melt) || 0;
      if (/\bupgrade\b|\bccu\b|\s→\s|\bpaint\b|\bskin\b|\blivery\b/i.test(name || '')) {
        sum += m;
        continue;
      }
      const bare = String(name || '').replace(/^\s*[^-–]+?\s*[-–]\s/, '');
      const base = bare.replace(
        /\s*[-–]\s*(lti|iae|ilw|warbond|standard edition|\d+\s*(months?|years?).*)$/i,
        '',
      );
      const hit = priceOf && (priceOf(base) || priceOf(bare));
      sum += hit && hit.msrp ? hit.msrp : m;
    }
    return sum + (Number.isFinite(snap.credit) ? snap.credit : 0);
  };

  // Fleet stats from the wiki's per-ship data: every ship in every pledge (a
  // pack with two ships counts two). Pure.
  OH.fleetStats = function fleetStats(items, shipOf) {
    const out = {
      ships: 0,
      known: 0,
      cargo: 0,
      crew: 0,
      byCareer: {},
      bySize: {},
      byStatus: {},
    };
    const bump = (map, k) => {
      map[k] = (map[k] || 0) + 1;
    };
    for (const p of items || []) {
      for (const c of p.contents || []) {
        if (!/^ship$/i.test(c.kind || '')) continue;
        out.ships++;
        const v = shipOf(c.label);
        if (!v) continue;
        out.known++;
        out.cargo += v.cargo || 0;
        out.crew += v.crew || 0;
        bump(out.byCareer, v.career || 'Other');
        bump(out.bySize, v.size || 'Other');
        bump(out.byStatus, v.status || 'unknown');
      }
    }
    return out;
  };

  // Stats → Collection: insurance mix, giftable/meltable split, and per
  // manufacturer how many of their ship models you own. Pure.
  //   → { insurance: {term: n}, giftable, notGiftable, meltable, notMeltable,
  //       makers: [{ name, own, total, models: [names owned] }] }
  OH.collectionStats = function collectionStats(items, shipOf, catalog) {
    const out = {
      insurance: {},
      giftable: 0,
      notGiftable: 0,
      meltable: 0,
      notMeltable: 0,
      makers: [],
    };
    const owned = new Map(); // maker → Set(model lname)
    for (const p of items || []) {
      if (p.insurance) out.insurance[p.insurance] = (out.insurance[p.insurance] || 0) + 1;
      if (p.giftable === true) out.giftable++;
      else if (p.giftable === false) out.notGiftable++;
      if (p.meltable === true) out.meltable++;
      else if (p.meltable === false) out.notMeltable++;
      for (const c of p.contents || []) {
        if (!/^ship$/i.test(c.kind || '')) continue;
        const v = shipOf(c.label);
        if (!v || !v.mfr) continue;
        if (!owned.has(v.mfr)) owned.set(v.mfr, new Map());
        owned.get(v.mfr).set(v.lname, v.name || v.lname);
      }
    }
    // Models a maker sells: priced ships in the list (skips ground-vehicle noise).
    const totals = new Map();
    for (const v of catalog || []) {
      if (!v.mfr || !v.msrp) continue;
      totals.set(v.mfr, (totals.get(v.mfr) || 0) + 1);
    }
    out.makers = [...owned]
      .map(([name, models]) => ({
        name,
        own: models.size,
        total: Math.max(totals.get(name) || 0, models.size),
        models: [...models.values()].sort(),
      }))
      .sort((a, b) => b.own - a.own || a.name.localeCompare(b.name));
    return out;
  };

  // --- Buy-back details -----------------------------------------------------------
  // Each buy-back's own page has its price, the ships in it and what else comes
  // with it (insurance!). A buy-back never changes, so a page is read once and
  // kept (storage key `bbDetails`, by pledge id). CCUs have no page of their own.
  const BBD_KEY = 'bbDetails';
  let bbdMem = null;
  OH.getBuybackDetails = async function getBuybackDetails() {
    if (!bbdMem) bbdMem = (await chrome.storage.local.get(BBD_KEY))[BBD_KEY] || {};
    return bbdMem;
  };
  // Saves are debounced, merged with what's stored (another tab may have added
  // some), and flushed if the page closes before the timer fires.
  let bbdSave = null;
  function flushBuybackDetails() {
    clearTimeout(bbdSave);
    bbdSave = null;
    if (!bbdMem) return Promise.resolve();
    const mine = bbdMem;
    return mutateStored(BBD_KEY, (cur = {}) => ({ ...cur, ...mine })).catch(() => {});
  }
  function saveBuybackDetails() {
    clearTimeout(bbdSave);
    bbdSave = setTimeout(flushBuybackDetails, 500);
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('pagehide', () => {
      if (bbdSave) flushBuybackDetails();
    });
  }
  // Forget details of buy-backs that are gone (reclaimed). `ids` = current list.
  // A buy-back's title without words that mean nothing once it's a buy-back (owner,
  // #176): the "Standalone Ship -" / "Package -" / "Subscriber Store -" label in front
  // (the type chip says it), and Warbond / Standard Edition (a warbond and a standard
  // buy-back cost the same to reclaim). For CCUs, run it on each ship name. The full
  // RSI name stays in tooltips, the details window and exports. Pure.
  // Retired ships (#306): RSI retired the Aurora Mk I (Sep 30, 2026) and the Hornet
  // Mk I (2024). RSI still sells their buy-backs back for now (owner put an Aurora
  // Mk I buy-back in the cart, 2026-10-05), so this only labels them: buy-backs of
  // the ships, packs holding them and upgrades to or from them; paints aren't marked. Old pledges
  // use the old names ("Aurora MR", "F7C Hornet"), so any Aurora that isn't a Mk II
  // and any Hornet that isn't a Mk II counts. Returns a short note, or null. Pure.
  const RETIRED_SHIPS = [
    {
      re: /\baurora\b(?!\s*mk\s*ii\b)/i,
      note: 'RSI retired the Aurora Mk I on Sep 30, 2026. Its buy-back is still open on RSI.',
    },
    {
      re: /\b(f7c[a-z-]*|hornet)\b(?![^,;|]*\bmk\s*ii\b)/i,
      note: 'RSI retired the Hornet Mk I. Its buy-back is still open on RSI.',
    },
  ];
  OH.retiredBuyback = function retiredBuyback(b) {
    if (!b || b.kind === 'paint') return null;
    const names = [b.name, b.ccu && b.ccu.from, b.ccu && b.ccu.to, b.contains]
      .filter(Boolean)
      .join(' | ');
    if (/\b(paint|livery|skin)\b/i.test(String(b.name || '')) && !b.ccu) return null;
    for (const r of RETIRED_SHIPS) if (r.re.test(names)) return r.note;
    return null;
  };

  // Can't Be Bought Back (#403, RSI's "Pledge Buy Back Tool" article): pledges RSI
  // never sells back once melted. Only what the scanned data proves: the game
  // Squadron 42 in it, a physical item in it, RSI's own "Add-On" store label, the
  // AMD package by name, a community giveaway by name. Discounted combos, one per
  // account limits and CCUs whose ships moved in value can't be told from the scan,
  // so they get no label. Works on a hangar pledge (`contents`) and a buy-back
  // (`contains`, plus its loaded page's `also` list in `detail`). → key or null. Pure.
  const SQ42_GAME_RE =
    /\bsquadron\s*42\b[^,;|]*?\b(digital|download|game|package)\b|(\+|&)\s*squadron\s*42\b|\bsquadron\s*42\s*(\+|&)/i;
  // Squadron 42 extras that aren't the game (a soundtrack, a poster, …).
  const SQ42_EXTRA_RE =
    /\b(soundtrack|ost|posters?|art\s*book|artbook|wallpapers?|novel|book|models?|coins?|patch|shirt|jacket|hat|mug|paints?|skins?|livery)\b/i;
  const BB_ADDON_RE = /^\s*add[\s-]?ons?\s*[-–]\s/i;
  OH.BUYBACK_BLOCK_REASONS = {
    sq42: 'Pledges with Squadron 42 in them are never sold back.',
    physical: 'Pledges with a physical item in them are never sold back.',
    addon: 'Add-on pledges are never sold back.',
    amd: 'The AMD package is never sold back.',
    giveaway: 'Community giveaway pledges are never sold back.',
  };
  OH.buybackBlock = function buybackBlock(p, detail) {
    if (!p) return null;
    const name = String(p.name || '');
    // An upgrade is its own thing: none of the rules below are about CCUs.
    if (p.isCCU || p.ccu) return null;
    const labels = [
      name,
      ...(Array.isArray(p.contents) ? p.contents.map((c) => (c && c.label) || '') : []),
      String(p.contains || ''),
      ...((detail && Array.isArray(detail.also) && detail.also) || []),
    ].filter(Boolean);
    const sq42 = (l) =>
      String(l)
        .split(/[,;|]/)
        .some((part) => SQ42_GAME_RE.test(part) && !SQ42_EXTRA_RE.test(part));
    if (labels.some(sq42)) return 'sq42';
    if (labels.some((l) => /\bphysical\b/i.test(l))) return 'physical';
    if (BB_ADDON_RE.test(name)) return 'addon';
    if (/\bAMD\b/.test(name)) return 'amd';
    if (/\bgiveaways?\b/i.test(name)) return 'giveaway';
    return null;
  };

  // What melting a hangar pledge means (#403), from what the scan shows. Never melts
  // anything: the window only links to the pledge on RSI. → { block, lines }, where
  // `block` is a buybackBlock key (or null) and `lines` are short sentences, the
  // important one first. Some early pledges come back differently; none is claimed.
  OH.meltFacts = function meltFacts(p) {
    const lines = [];
    if (!p) return { block: null, lines };
    const block = OH.buybackBlock(p);
    const name = String(p.name || '');
    // An upgraded pledge: RSI adds "- upgraded" to its name. The buy-back is the
    // pledge as first bought, so the upgrades on it are gone.
    if (/\s[-–]\s*upgraded\s*$/i.test(name)) {
      const before = name.replace(/\s[-–]\s*upgraded\s*$/i, '').trim();
      const cat = String(before.match(/^\s*(.+?)\s+[-–]\s/)?.[1] || '').toLowerCase();
      const short = OH.shortBuybackName(before);
      const noun = /\bpack(age)?s?$/i.test(short)
        ? ''
        : /^(packs?|packages?|game\s+packages?)$/.test(cat)
          ? ' pack'
          : ' pledge';
      const ships = (p.contents || []).filter(
        (c) => c && /^ship$/i.test(c.kind || '') && !c.guessed && c.label,
      );
      // The ship it holds now, named only when it's clearly not the original one.
      const now =
        ships.length === 1 && !before.toLowerCase().includes(ships[0].label.toLowerCase())
          ? `the ${ships[0].label}`
          : 'the upgraded ship';
      lines.push(
        `The buy-back is your original ${short}${noun}, not ${now}. The upgrades on it are lost.`,
      );
    }
    if (p.insurance) {
      const ins =
        p.insurance === 'LTI'
          ? 'LTI'
          : /^\d+M$/.test(p.insurance)
            ? `${p.insurance.slice(0, -1)} months of insurance`
            : `${p.insurance}`;
      lines.push(`It carries ${ins}. Melting it gives that up until you buy it back.`);
    }
    if (p.giftable) {
      lines.push("It's giftable now. Bought back with store credit, it can't be gifted.");
    }
    lines.push(
      "Buying it back costs full price: sale prices and subscriber coupons don't carry over. Store credit also needs a Buy-Back Token, and it's one buy-back per cart.",
    );
    return { block, lines };
  };

  OH.shortBuybackName = function shortBuybackName(name) {
    const full = String(name || '').trim();
    const short = full
      .replace(/^(?:standalone\s+ships?|packs?|package|subscriber\s+store)\s*[-–:]\s*/i, '')
      .replace(/\s*\(\s*(?:warbond|standard)(?:\s+edition)?\s*\)/gi, '')
      .replace(/\s*[-–]?\s*\b(?:warbond|standard)\s+edition\b/gi, '')
      .replace(/\s*[-–]?\s+warbond\s*$/i, '')
      .replace(/\s*[-–]\s*$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return short || full;
  };
  // A buy-back's title, the one helper for every list, window and export (#273).
  // Short (the default): no type label or Warbond / Standard Edition, "—" when it
  // has no name. Full: RSI's name as is, for the details window and the exports.
  // A CCU reads "from → to" either way.
  OH.buybackTitle = function buybackTitle(b, { short = true } = {}) {
    const s = short ? OH.shortBuybackName : (n) => n;
    if (b.ccu) return `${s(b.ccu.from)} → ${s(b.ccu.to)}`;
    return short ? s(b.name) || '—' : b.name || '';
  };
  OH.pruneBuybackDetails = async function pruneBuybackDetails(ids) {
    const keep = new Set(ids.map(String));
    const next = await mutateStored(BBD_KEY, (cur = {}) =>
      Object.fromEntries(Object.entries(cur).filter(([id]) => keep.has(id))),
    ).catch(() => null);
    if (next) bbdMem = next;
  };
  // Read one buy-back page (cached). → detail | { error }.
  OH.fetchBuybackDetail = async function fetchBuybackDetail(id) {
    const all = await OH.getBuybackDetails();
    if (all[id] && !all[id].partial) return all[id];
    if (!/^\d+$/.test(String(id))) return { error: 'No RSI page for this buy-back.' };
    const got = await fetchPage(`https://robertsspaceindustries.com/pledge/buyback/${id}`, null, {
      retryRateLimit: false,
    });
    if (got.rateLimited || got.res?.status === 403) {
      return { error: 'RSI asked us to slow down.', rateLimited: true };
    }
    if (got.error) return { error: got.error };
    if (!got.res.ok) return { error: `RSI responded ${got.res.status}.` };
    const html = await got.res.text();
    // A page the parser chokes on is skipped like an unreadable one, so one odd
    // buy-back can't stop the whole batch (#199).
    let d = null;
    try {
      d = window.OpenHangar.parseBuybackDetail(html);
    } catch (e) {
      OH.log('warn', 'buybacks', `buy-back page ${id} didn't parse: ${e?.message || e}`);
    }
    if (!d || d.price == null) {
      return looksLoggedOut(got.res, html)
        ? { error: 'Not signed in to RSI.' }
        : { error: "Couldn't read this buy-back's page." };
    }
    all[id] = { ...d, at: Date.now() };
    saveBuybackDetails();
    return all[id];
  };
  // Read many, politely: one at a time with a random pause between pages, and at
  // RSI's first "slow down" (429, or a 403 block) the whole batch stops and batches
  // are held off for BBD_COOLDOWN_MS, rather than pushing on page by page. What was
  // read is kept. onProgress(done, total); stop by returning false from shouldGo().
  // → { done, errors, total, rateLimited?, retryAt? }.
  const BBD_COOLDOWN_MS = 15 * 60e3;
  const BBD_SLOW_KEY = 'bbdSlowDownUntil';
  OH.fetchBuybackDetails = async function fetchBuybackDetails(
    ids,
    onProgress,
    shouldGo = () => true,
  ) {
    const all = await OH.getBuybackDetails();
    const todo = ids.filter((id) => (!all[id] || all[id].partial) && /^\d+$/.test(String(id)));
    const { [BBD_SLOW_KEY]: until = 0 } = await chrome.storage.local.get(BBD_SLOW_KEY);
    if (until > Date.now()) {
      return { done: 0, errors: 0, total: todo.length, rateLimited: true, retryAt: until };
    }
    let done = 0;
    let errors = 0;
    for (const id of todo) {
      if (!shouldGo()) break;
      const r = await OH.fetchBuybackDetail(id);
      if (r.rateLimited) {
        const retryAt = Date.now() + BBD_COOLDOWN_MS;
        await chrome.storage.local.set({ [BBD_SLOW_KEY]: retryAt });
        OH.log(
          'warn',
          'buybacks',
          `details stopped after ${done} pages: RSI asked us to slow down`,
        );
        return { done, errors, total: todo.length, rateLimited: true, retryAt };
      }
      if (r.error) {
        errors++;
        if (/signed in/i.test(r.error)) break;
      }
      done++;
      onProgress?.(done, todo.length);
      await sleep(DELAY_MS + Math.random() * DELAY_MS * 1.5); // 0.4 to 1 s, not a fixed beat
    }
    return { done, errors, total: todo.length };
  };

  // --- Buy-back details from your own history ------------------------------------
  // Most buy-backs were pledges in this hangar once, and keep their pledge id when
  // melted. So before reading any RSI page, details come from what this browser
  // already has: the pledge archive (everything the hangar showed: contents,
  // insurance, value), then the scan history (the value only). The ids are the
  // same kind of number, but that a buy-back keeps its exact id isn't proven by a
  // real melt yet, so the names must agree too; a disagreement is counted
  // (`bbHistoryRejects`, ids only) and the buy-back falls through to RSI.
  //
  // Pledge archive (storage key `pledgeArchive`): { [pledge id]: { ...pledge,
  // goneAt } } for pledges a complete hangar scan no longer has (melted, gifted,
  // applied as an upgrade), newest ARCHIVE_MAX kept. It belongs to the live
  // account like the scan history (parked with it, in the recovery copy, gone
  // with Clear Data).
  const ARCHIVE_MAX = 2000;
  OH.ARCHIVE_MAX = ARCHIVE_MAX;
  // `archive` plus the pledges in `gone`, stamped goneAt = at, newest kept. Pure.
  OH.archiveGone = function archiveGone(archive, gone, at) {
    const out = isObj(archive) ? { ...archive } : {};
    for (const p of gone || []) {
      if (!isObj(p) || p.id == null || p.id === '') continue;
      const { raw, ...keep } = p; // the raw RSI strings aren't needed again
      out[String(p.id)] = { ...keep, goneAt: at };
    }
    return capArchive(out);
  };
  // The newest ARCHIVE_MAX entries of an archive (by goneAt). Pure.
  function capArchive(out) {
    const ids = Object.keys(out);
    if (ids.length <= ARCHIVE_MAX) return out;
    ids.sort((a, b) => (out[b].goneAt || 0) - (out[a].goneAt || 0));
    return Object.fromEntries(ids.slice(0, ARCHIVE_MAX).map((id) => [id, out[id]]));
  }
  OH.getPledgeArchive = readArchive;

  // The archive as the backup file (and so sync) carries it (#388): only what
  // buy-back details read (name, value, currency, insurance, ccu, contents' kind
  // and label) plus the date, kind and goneAt. Left out: the flags (isCCU,
  // isAddOn, giftable…, worked out again from the kind and name) and every image
  // URL (the details window never shows them; the buy-back card has its own
  // picture). The images were about 40% of a big archive. Also cleans a
  // hand-edited file's entries on import. Pure.
  OH.leanArchive = function leanArchive(archive) {
    const out = {};
    if (!isObj(archive)) return out;
    for (const [key, p] of Object.entries(archive)) {
      if (!isObj(p) || !key) continue;
      const e = { id: key, name: String(p.name || '') };
      if (Number.isFinite(p.value)) e.value = p.value;
      if (p.currency) e.currency = String(p.currency);
      if (p.insurance) e.insurance = String(p.insurance);
      if (isObj(p.ccu)) e.ccu = { from: String(p.ccu.from || ''), to: String(p.ccu.to || '') };
      if (p.kind) e.kind = String(p.kind);
      if (p.date) e.date = String(p.date);
      const contents = (Array.isArray(p.contents) ? p.contents : []).filter(isObj).map((c) => {
        const x = {};
        if (c.kind) x.kind = String(c.kind);
        if (c.label) x.label = String(c.label);
        return x;
      });
      if (contents.length) e.contents = contents;
      if (Number.isFinite(p.goneAt)) e.goneAt = p.goneAt;
      out[key] = e;
    }
    return out;
  };

  // Two archives as one (a restored backup and this browser's): per pledge id the
  // entry with the newest goneAt (a tie keeps `a`'s, this browser's fuller copy),
  // newest ARCHIVE_MAX kept. Pure.
  OH.mergeArchive = function mergeArchive(a, b) {
    const out = {};
    for (const src of [a, b]) {
      if (!isObj(src)) continue;
      for (const [id, p] of Object.entries(src)) {
        if (!isObj(p) || !id) continue;
        const cur = out[id];
        if (!cur || (p.goneAt || 0) > (cur.goneAt || 0)) out[id] = p;
      }
    }
    return capArchive(out);
  };

  // A name as compared between a buy-back and a pledge: no case, curly quotes made
  // straight, one space, and without what OH.shortBuybackName drops (the store
  // label in front, Warbond, Standard Edition). Pure.
  OH.historyName = function historyName(name) {
    const plain = String(name || '')
      .replace(/[‘’‚‛′´`]/g, "'")
      .replace(/[“”„‟″]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/\s+/g, ' ');
    return OH.shortBuybackName(plain)
      .toLowerCase()
      .replace(/\s*-\s*/g, ' - ')
      .replace(/\s+/g, ' ')
      .trim();
  };
  const CCU_NAME_RE = /^\s*upgrade\s*-\s*(.+?)\s+to\s+(.+?)\s*$/i; // as parser.js
  const ccuOf = (name) => {
    const m = CCU_NAME_RE.exec(String(name || ''));
    return m ? { from: m[1].trim(), to: m[2].trim() } : null;
  };
  // Do a buy-back and a pledge name (and the pledge's { from, to } when known) name
  // the same thing? CCUs compare from and to. Pure.
  OH.historyNamesAgree = function historyNamesAgree(b, name, pledgeCcu) {
    const n = OH.historyName;
    const bc = (b && b.ccu) || (b && b.isCCU ? ccuOf(b.name) : null);
    const pc = pledgeCcu || ccuOf(name);
    if (bc || pc) {
      return !!(bc && pc && n(bc.from) && n(bc.from) === n(pc.from) && n(bc.to) === n(pc.to));
    }
    const a = n(b && b.name);
    return !!a && a === n(name);
  };

  // What one buy-back's details can be filled with from this browser's history:
  //   { detail }    from the archive (src 'history': contents, insurance, value)
  //                 or the scan history (src 'scan-history', partial: value only)
  //   { rejected }  an entry with its id exists but the names didn't agree
  //   null          nothing known
  // The value is what it was worth in the hangar (melt value). A Warbond's buy-back
  // costs the standard price, so for those it's kept as `melt` but not used as the
  // price. A pledge whose value changed while in the hangar had an upgrade
  // applied, and a melted upgraded pledge comes back as the original ship (RSI's
  // "- upgraded" buy-backs), so neither is filled from history. Pure.
  OH.buybackFromHistory = function buybackFromHistory(b, archive, history, now = Date.now()) {
    if (!b || b.id == null || b.id === '' || b.wasUpgraded) return null;
    const id = String(b.id);
    let last = null;
    const values = new Set();
    for (const snap of Array.isArray(history) ? history : []) {
      for (const row of (snap && snap.items) || []) {
        if (Array.isArray(row) && String(row[0]) === id) {
          last = row;
          values.add(Math.round(Number(row[2]) * 100));
        }
      }
    }
    if (values.size > 1) return null;
    const warbond = (name) => /\bwarbond\b/i.test(String(name || ''));
    let rejected = null;
    const a = isObj(archive) ? archive[id] : null;
    if (isObj(a)) {
      if (OH.historyNamesAgree(b, a.name, a.ccu)) {
        const contents = (Array.isArray(a.contents) ? a.contents : []).filter(isObj);
        const isShip = (c) => /^ship$/i.test(String(c.kind || '').trim());
        const melt = Number.isFinite(a.value) ? a.value : null;
        const ins =
          a.insurance ||
          (window.OpenHangar && window.OpenHangar.insuranceTerm
            ? window.OpenHangar.insuranceTerm(contents)
            : null);
        return {
          detail: {
            title: String(a.name || ''),
            price: warbond(a.name) || warbond(b.name) ? null : melt,
            melt,
            currency: a.currency || 'USD',
            ships: contents
              .filter((c) => isShip(c) && c.label)
              .map((c) => ({ name: c.label, manufacturer: '', focus: '', image: c.image || null })),
            also: contents
              .filter((c) => !isShip(c))
              .map((c) => c.label || c.kind || '')
              .filter(Boolean),
            insurance: ins || null,
            at: now,
            src: 'history',
          },
        };
      }
      rejected = 'archive';
    }
    if (last) {
      if (OH.historyNamesAgree(b, last[1])) {
        const melt = Number(last[2]);
        // 0 is also what a snapshot holds when RSI showed no value: say nothing.
        if (!(melt > 0) || warbond(last[1]) || warbond(b.name))
          return rejected ? { rejected } : null;
        return {
          detail: {
            title: String(last[1] || ''),
            price: melt,
            melt,
            currency: 'USD',
            ships: [],
            also: [],
            insurance: null,
            at: now,
            src: 'scan-history',
            partial: true, // contents still unknown: RSI's page can still be read
          },
        };
      }
      rejected = rejected || 'history';
    }
    return rejected ? { rejected } : null;
  };

  // Fill the details of these buy-backs from history where it can (above); RSI's
  // pages are then only read for the rest. No requests. → { history, scan,
  // rejected } counts for this run.
  const BB_REJECTS_KEY = 'bbHistoryRejects';
  const BB_REJECTS_MAX = 500;
  // `history`: the scan history when the caller already has it (saves a read).
  OH.fillBuybackDetailsFromHistory = async function fillBuybackDetailsFromHistory(
    buybacks,
    { history } = {},
  ) {
    const out = { history: 0, scan: 0, rejected: 0 };
    const all = await OH.getBuybackDetails();
    const todo = (buybacks || []).filter(
      (b) => b && b.id != null && (!all[String(b.id)] || all[String(b.id)].partial),
    );
    if (!todo.length) return out;
    const archive = await readArchive();
    const hist = Array.isArray(history) ? history : (await OH.loadDB()).history;
    const now = Date.now();
    const rejects = {};
    for (const b of todo) {
      const id = String(b.id);
      const r = OH.buybackFromHistory(b, archive, hist, now);
      if (!r) continue;
      if (r.rejected) {
        rejects[id] = { at: now, from: r.rejected };
        out.rejected++;
      } else if (r.detail.partial) {
        if (all[id]) continue; // already has its value
        all[id] = r.detail;
        out.scan++;
      } else {
        all[id] = r.detail;
        out.history++;
      }
    }
    if (out.history || out.scan) await flushBuybackDetails();
    if (out.rejected) {
      await mutateStored(BB_REJECTS_KEY, (cur = {}) => {
        const next = { ...(isObj(cur) ? cur : {}), ...rejects };
        const ids = Object.keys(next).sort((x, y) => (next[y].at || 0) - (next[x].at || 0));
        return Object.fromEntries(ids.slice(0, BB_REJECTS_MAX).map((k) => [k, next[k]]));
      }).catch(() => {});
    }
    if (out.history || out.scan || out.rejected)
      OH.log(
        'info',
        'buybacks',
        `details from history: ${out.history} from the pledge archive, ${out.scan} values from scan history, ${out.rejected} names didn't agree`,
      );
    return out;
  };

  // Where the saved buy-back details came from, for the error report: counts only.
  OH.buybackDetailStats = async function buybackDetailStats() {
    const all = await OH.getBuybackDetails();
    const out = { history: 0, scan: 0, rsi: 0, rejected: 0 };
    for (const d of Object.values(all)) {
      if (!isObj(d)) continue;
      if (d.src === 'history') out.history++;
      else if (d.src === 'scan-history') out.scan++;
      else out.rsi++;
    }
    const rej = (await chrome.storage.local.get(BB_REJECTS_KEY))[BB_REJECTS_KEY];
    out.rejected = isObj(rej) ? Object.keys(rej).length : 0;
    return out;
  };

  // @sync-start: the `sync` build flag's code, in every store build (src/flags.js, #187)
  // --- openhangar.space (optional sync) -------------------------------------------
  // Nothing leaves the browser unless the user connects. Once connected, every scan
  // syncs, and Sync Now sends right away.
  // Connecting uses a device code: the site confirms it while signed in, then
  // hands this extension a sync token (stored in `siteLink`).
  // A built-in site: every build with sync gets the production site here, and
  // `npm run build:staging` the staging one (scripts/pack.mjs), so sync is on without a
  // `siteUrl` override. Always empty in the repo; a store build only ever carries
  // production (scripts/check-store-build.mjs).
  const SITE_BUILT_IN = '';
  const SITE_DEFAULT = SITE_BUILT_IN || 'https://app.openhangar.space';
  // The versioned sync address: a later change to what sync sends gets /api/v2/sync on
  // the website, and this version keeps working here.
  const SYNC_PATH = '/api/v1/sync';
  OH.siteUrl = async function siteUrl() {
    const { siteUrl } = await chrome.storage.local.get('siteUrl'); // dev override
    return (siteUrl || SITE_DEFAULT).replace(/\/+$/, '');
  };
  // On in every build with a built-in site (the store builds, the beta, staging), or
  // when a developer sets `siteUrl` (local testing).
  OH.siteEnabled = async function siteEnabled() {
    const { siteUrl } = await chrome.storage.local.get('siteUrl');
    return Boolean(siteUrl || SITE_BUILT_IN);
  };
  OH.getSiteLink = async function getSiteLink() {
    return (await chrome.storage.local.get('siteLink')).siteLink || null;
  };
  async function siteFetch(path, init = {}) {
    if (!(await OH.siteEnabled())) throw new Error('Sync to openhangar.space is coming soon.');
    const base = await OH.siteUrl();
    return fetch(base + path, {
      ...init,
      credentials: 'omit',
      headers: { 'content-type': 'application/json', ...(init.headers || {}) },
    });
  }
  // → { device_code, user_code, verification_uri, expires_in, interval }
  OH.siteLinkStart = async function siteLinkStart() {
    const res = await siteFetch('/api/link/start', { method: 'POST', body: '{}' });
    if (!res.ok) throw new Error(`openhangar.space responded ${res.status}`);
    return res.json();
  };
  // Poll until approved (→ { name }), expired or stopped (→ null).
  OH.siteLinkWait = async function siteLinkWait(start, shouldGo = () => true) {
    const until = Date.now() + start.expires_in * 1000;
    const label = `Open Hangar on ${/Firefox\//.test(globalThis.navigator?.userAgent || '') ? 'Firefox' : 'Chrome'}`;
    while (Date.now() < until && shouldGo()) {
      await sleep((start.interval || 3) * 1000);
      const res = await siteFetch('/api/link/poll', {
        method: 'POST',
        body: JSON.stringify({ device_code: start.device_code, label }),
      }).catch(() => null);
      if (!res) continue;
      const j = await res.json().catch(() => ({}));
      if (j.status === 'approved' && j.token) {
        const link = {
          token: j.token,
          name: j.name || '',
          connectedAt: Date.now(),
          lastSync: null,
        };
        await chrome.storage.local.set({ siteLink: link });
        return link;
      }
      if (j.status === 'expired') return null;
    }
    return null;
  };
  // The sync request's JSON text: the backup file's payload, kept within
  // SYNC_BUDGET_BYTES (#388). The website takes up to 5 MB per sync
  // (MAX_SYNC_BYTES), so the budget keeps a megabyte spare. When a payload is
  // bigger, the oldest entries go first: pledge archive entries, then (only if
  // that wasn't enough) scan history snapshots, the newest one always kept. The
  // website only reads the history on an account's first sync, and a smaller one
  // beats a sync it refuses. The hangar and buy-backs always go whole. Pure.
  const SYNC_BUDGET_BYTES = 4e6;
  OH.SYNC_BUDGET_BYTES = SYNC_BUDGET_BYTES;
  OH.syncBody = function syncBody(payload, budget = SYNC_BUDGET_BYTES) {
    const enc = new TextEncoder();
    const bytes = (v) => enc.encode(JSON.stringify(v)).length;
    const text = JSON.stringify(payload);
    let over = enc.encode(text).length - budget;
    if (over <= 0 || !isObj(payload)) return text;
    const out = { ...payload };
    if (isObj(payload.pledgeArchive)) {
      const keep = { ...payload.pledgeArchive };
      const oldestFirst = Object.keys(keep).sort(
        (a, b) => ((keep[a] && keep[a].goneAt) || 0) - ((keep[b] && keep[b].goneAt) || 0),
      );
      for (const id of oldestFirst) {
        if (over <= 0) break;
        over -= bytes(id) + bytes(keep[id]) + 2; // the `:` and `,` around it
        delete keep[id];
      }
      out.pledgeArchive = keep;
    }
    if (over > 0 && Array.isArray(payload.history)) {
      const hist = payload.history.slice(); // oldest first, as stored
      while (over > 0 && hist.length > 1) over -= bytes(hist.shift()) + 1;
      out.history = hist;
    }
    return JSON.stringify(out);
  };

  // Upload the same payload as the JSON backup. → { synced_at } or throws.
  // The website says why it refused a sync as JSON { error, reason }; each reason
  // reads as plain advice here.
  const SYNC_NO_SCAN = 'Scan your hangar first, then press Sync Now.';
  const SYNC_OLDER_SCAN =
    'The website already has a newer scan from another browser. Scan here, then press Sync Now.';
  const SYNC_NOT_OPEN =
    'Sync opens November 10. Your hangar stays safe in your browser until then.';
  const SYNC_OLD_FORMAT =
    'This version of Open Hangar is too old to sync. Update it, then sync again.';
  const SYNC_NEWER_FORMAT =
    "openhangar.space hasn't caught up with this version yet. Try again soon.";
  const SYNC_TOO_BIG =
    "That's more cargo than openhangar.space can hold. Your hangar stays safe in your browser.";
  // A refusal's status, reason and the website's own words → the Error to throw. Sync
  // not open yet isn't something you did, so it's marked `calm`: the scan report shows
  // it as a note, not a problem (src/dashboard.js siteSyncReport). Its words are the
  // website's when it sends a short plain sentence: a store update takes days, so a new
  // opening date only has to change there.
  function syncRefusal(status, reason, said = '') {
    if (reason === 'not-open') {
      const own = said.length <= 200 && !/[<>]/.test(said) ? said : '';
      return Object.assign(new Error(own || SYNC_NOT_OPEN), { calm: true });
    }
    if (status === 409) return new Error(reason === 'older-scan' ? SYNC_OLDER_SCAN : SYNC_NO_SCAN);
    if (status === 426 || reason === 'old-format') return new Error(SYNC_OLD_FORMAT);
    if (reason === 'newer-format') return new Error(SYNC_NEWER_FORMAT);
    if (status === 413) return new Error(SYNC_TOO_BIG); // one sync, or the login's storage
    return new Error(`openhangar.space responded ${status}`);
  }
  OH.siteSync = async function siteSync() {
    const link = await OH.getSiteLink();
    if (!link) throw new Error('Not connected to openhangar.space.');
    const db = await OH.exportDB();
    // Nothing scanned in this browser yet: sending its empty hangar would replace
    // the one already on the website (the server refuses it too).
    if (!db?.sources?.hangar?.scannedAt) throw new Error(SYNC_NO_SCAN);
    const res = await siteFetch(SYNC_PATH, {
      method: 'POST',
      headers: { authorization: `Bearer ${link.token}` },
      body: OH.syncBody(db),
    });
    if (res.status === 401) {
      await chrome.storage.local.remove('siteLink');
      throw new Error('This extension was disconnected on the website. Connect again.');
    }
    if (!res.ok) {
      // Not always JSON (a proxy's error page, say): then there's no reason.
      const body = await res.json().catch(() => null);
      const text = (v) => (typeof v === 'string' ? v.trim() : '');
      throw syncRefusal(res.status, text(body?.reason), text(body?.error));
    }
    const j = await res.json();
    await chrome.storage.local.set({ siteLink: { ...link, lastSync: j.synced_at } });
    return j;
  };
  OH.siteDisconnect = async function siteDisconnect() {
    const link = await OH.getSiteLink();
    if (link) {
      await siteFetch(SYNC_PATH, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${link.token}` },
      }).catch(() => null);
    }
    await chrome.storage.local.remove('siteLink');
  };
  // @sync-end

  // --- Display currency -----------------------------------------------------------
  // RSI prices everything in USD. Users can view amounts in one of a few big
  // currencies, converted at the day's rate (before tax). Rates are the ECB's,
  // published by our own site as openhangar.space/rates.json (the same file for
  // everyone, built daily by scripts/update-rates.mjs), fetched at most once a day
  // and cached. Nothing about the user is sent.
  // Every one must be in the ECB set (no UAH / RUB there), and in WANT in
  // scripts/update-rates.mjs.
  OH.CURRENCIES = [
    'USD',
    'EUR',
    'GBP',
    'CAD',
    'AUD',
    'NZD',
    'CHF',
    'SEK',
    'PLN',
    'CZK',
    'BRL',
    'CNY',
    'JPY',
    'KRW',
  ];
  OH.ZERO_DECIMAL = ['JPY', 'KRW']; // shown without cents

  // --- Patch notes (RSI Spectrum, Patch Notes channel) --------------------------
  // Newest threads in RSI's Patch Notes forum: PTU waves, LIVE release notes,
  // hotfix threads. Same site as the hangar, so no new permission; no cookies sent.
  const PATCH_KEY = 'patchNotes';
  const PATCH_TTL = 60 * 60 * 1000;
  const PATCH_CHANNEL = '190048';
  // Spectrum's thread list → [{ title, label, version, url, at }], newest first.
  // `label` is the bracketed tag RSI puts in front ("Wave 3 PTU", "Evocati NDA").
  OH.parsePatchNotes = function parsePatchNotes(json) {
    const threads = (json && json.data && json.data.threads) || [];
    return threads
      .filter((t) => t && t.subject && t.slug && Number.isFinite(+t.time_created))
      .map((t) => {
        const subject = String(t.subject).trim();
        const label = (subject.match(/^\[([^\]]+)\]/) || [])[1] || '';
        return {
          title: subject.replace(/^\[[^\]]+\]\s*/, '').replace(/\s+\d{6,}$/, ''),
          label,
          version: (subject.match(/\b(\d+\.\d+(?:\.\d+)?)\b/) || [])[1] || '',
          url: `https://robertsspaceindustries.com/spectrum/community/SC/forum/${PATCH_CHANNEL}/thread/${t.slug}`,
          at: +t.time_created * 1000,
        };
      })
      .sort((a, b) => b.at - a.at);
  };
  // The wave for a test version ("4.10.2" → "Wave 3"), from its newest thread.
  OH.patchWave = function patchWave(notes, version) {
    const hit = (notes || []).find((n) => n.version === version && /wave/i.test(n.label));
    return hit ? (hit.label.match(/wave\s*\d+/i) || [''])[0].replace(/^w/, 'W') : '';
  };
  OH.getPatchNotes = async function getPatchNotes(fetchFn = fetch) {
    const { [PATCH_KEY]: cached } = await chrome.storage.local.get(PATCH_KEY);
    if (cached && Date.now() - cached.at < PATCH_TTL) return cached.items;
    try {
      const res = await OH.guarded(fetchFn)(
        'https://robertsspaceindustries.com/api/spectrum/forum/channel/threads',
        {
          method: 'POST',
          credentials: 'omit',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            channel_id: PATCH_CHANNEL,
            page: 1,
            sort: 'newest',
            label_id: null,
          }),
        },
      );
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const items = OH.parsePatchNotes(await res.json()).slice(0, 15);
      await chrome.storage.local.set({ [PATCH_KEY]: { at: Date.now(), items } });
      return items;
    } catch {
      return cached ? cached.items : [];
    }
  };

  // Buy-back tokens: RSI hands out one per quarter on these dates (its published
  // schedule). Add the next year's dates when RSI announces them. Past the list,
  // the next one is the first Monday of the next quarter, RSI's pattern so far
  // (every 2026 date was one): the line on Home no longer vanished after the last
  // listed date (2026-10-05).
  OH.BUYBACK_TOKEN_DATES = ['2026-01-05', '2026-04-06', '2026-07-06', '2026-10-05'];
  const firstMondayNoon = (y, m) => {
    const d = new Date(Date.UTC(y, m, 1, 12));
    d.setUTCDate(1 + ((8 - d.getUTCDay()) % 7));
    return d.getTime();
  };
  // The next token, but only once it's 30 days away or less (owner, 2026-10-05):
  // a three-month countdown is noise, and dates past the list are estimates.
  OH.TOKEN_SOON_DAYS = 30;
  OH.soonBuybackToken = function soonBuybackToken(now = Date.now()) {
    const t = OH.nextBuybackToken(now);
    return t != null && t - +now <= OH.TOKEN_SOON_DAYS * 864e5 ? t : null;
  };
  OH.nextBuybackToken = function nextBuybackToken(now = Date.now()) {
    const ms = +now; // a number or a Date
    if (!Number.isFinite(ms)) return null;
    const t = OH.BUYBACK_TOKEN_DATES.map((d) => Date.parse(d + 'T12:00:00Z')).find((x) => x > ms);
    if (Number.isFinite(t)) return t;
    const n = new Date(ms);
    // At most a quarter or two ahead; bounded so a bad date can never loop.
    for (let q = Math.floor(n.getUTCMonth() / 3), i = 0; i < 8; q++, i++) {
      const at = firstMondayNoon(n.getUTCFullYear() + Math.floor(q / 4), (q % 4) * 3);
      if (at > ms) return at;
    }
    return null;
  };

  // --- Referral bonus events (openhangar.space/api/referral-events) -------------------
  // v1: { events: [{ start, end, name, reward, image, img }], images: { "<wiki
  // file name>": picture URL } }. The site reads the community wiki's "Special
  // Incentive Events" table and copies the reward pictures (the referral tiers' and
  // the events'); the extension only reads this feed, at most once a day. A picture
  // the site hasn't copied yet is missing: no picture, never fetched elsewhere.
  const REF_FEED_TTL = 24 * 3600e3;
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  OH.getReferralFeed = ({ force = false, fetchFn } = {}) =>
    OH.siteFeed('api/referral-events', {
      key: 'feedReferral',
      ttl: REF_FEED_TTL,
      force,
      fetchFn,
      valid: (j) => isV1(j) && Array.isArray(j.events),
    });
  // The feed's events, checked: [{ start, end, name, reward, image, img }]. Pure.
  OH.shapeReferralEvents = function shapeReferralEvents(list) {
    const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    return (Array.isArray(list) ? list : [])
      .filter((e) => e && DAY_RE.test(e.start) && DAY_RE.test(e.end) && text(e.name, 200))
      .map((e) => ({
        start: e.start,
        end: e.end,
        name: text(e.name, 200),
        reward: text(e.reward, 500),
        image: text(e.image, 200),
        img: OH.feedImage(e.img),
      }))
      .filter((e) => e.reward);
  };
  // → the event list, or null when the feed never loaded (callers keep their list).
  OH.getReferralEvents = async function getReferralEvents(fetchFn) {
    const feed = await OH.getReferralFeed({ fetchFn });
    const events = OH.shapeReferralEvents(feed && feed.data.events);
    return events.length ? events : null;
  };
  // Wiki file names ("Referral Pulse.jpg", or "Referral_Pulse.jpg") → our copies of
  // the pictures, from the same feed. → { file: url } for the ones it has.
  const wikiTitle = (f) => {
    const t = String(f).replace(/_/g, ' ').trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  OH.wikiImageUrls = async function wikiImageUrls(files, fetchFn) {
    const feed = await OH.getReferralFeed({ fetchFn });
    const images = (feed && feed.data.images) || {};
    const out = {};
    for (const f of new Set((files || []).filter(Boolean))) {
      const url = OH.feedImage(images[f]) || OH.feedImage(images[wikiTitle(f)]);
      if (url) out[f] = url;
    }
    return out;
  };
  // --- Live store status (RSI's upgrade tool data) ----------------------------------
  // The public data behind RSI's CCU upgrade tool lists every ship with the
  // editions on sale right now ("skus": Standard, Warbond, …, each available or
  // not). No skus = not for sale. Prices come in cents.
  const STORE_URL = 'https://robertsspaceindustries.com/pledge-store/api/upgrade/graphql';
  const STORE_QUERY =
    'query initShipUpgrade { ships { id name flyableStatus msrp link skus { id title available price } } }';
  // Raw response → [{ id, name, lname, link, concept, editions: [{ title, price, warbond }], forSale, warbond, price }]. Pure.
  OH.parseStoreShips = function parseStoreShips(json) {
    const data = Array.isArray(json) ? json[0] : json;
    const ships = data && data.data && Array.isArray(data.data.ships) ? data.data.ships : [];
    return ships
      .filter((s) => s && s.name)
      .map((s) => {
        const editions = (s.skus || [])
          .filter((k) => k && k.available)
          .map((k) => ({
            id: Number.isInteger(k.id) ? k.id : null, // the SKU, for Add to RSI Cart
            title: String(k.title || '').trim(),
            price: Number(k.price) / 100,
            warbond: /warbond/i.test(k.title || ''),
          }));
        const prices = editions.map((e) => e.price).filter((p) => p > 0);
        return {
          id: s.id,
          name: String(s.name).trim(),
          lname: String(s.name).trim().toLowerCase(),
          link: s.link ? `https://robertsspaceindustries.com${s.link}` : null,
          concept: /concept/i.test(s.flyableStatus || ''),
          editions,
          forSale: editions.length > 0,
          warbond: editions.some((e) => e.warbond),
          price: prices.length ? Math.min(...prices) : null,
        };
      });
  };
  // --- Add to RSI Cart (#288) ----------------------------------------------------
  // Ship upgrades into the RSI cart, in your own RSI session, only on a click. The
  // requests live in src/rsi-cart.js (loaded before this file) so the background
  // worker can answer the website's store with the same code.
  //   OH.upgradeOptions(toShipId, toSkuId, { pledgeId? })
  //     → { ok, options: [{ id, name, image, eligible, price }] } | { ok: false, error }
  //   OH.upgradePrice(fromShipId, toSkuId, { pledgeId?, toShipId? }) → { ok, price } | …
  //   OH.addUpgradeToCart(fromShipId, toShipId, toSkuId, { pledgeId? }) → { ok } | …
  // error: 'signed-out' | 'refused' | 'busy' | 'network'. Never retried.
  const cart = () => window.OHCart;
  OH.upgradeOptions = (toShipId, toSkuId, opts) =>
    cart() ? cart().upgradeOptions(toShipId, toSkuId, opts) : { ok: false, error: 'network' };
  OH.upgradePrice = (fromShipId, toSkuId, opts) =>
    cart() ? cart().upgradePrice(fromShipId, toSkuId, opts) : { ok: false, error: 'network' };
  OH.addUpgradeToCart = (fromShipId, toShipId, toSkuId, opts) =>
    cart()
      ? cart().addUpgradeToCart(fromShipId, toShipId, toSkuId, opts)
      : { ok: false, error: 'network' };
  OH.RSI_CART_URL = 'https://robertsspaceindustries.com/en/store/pledge/cart';
  // The SKU an upgrade to this store ship goes to: its cheapest edition on offer.
  OH.upgradeSku = function upgradeSku(storeShip) {
    const eds = ((storeShip && storeShip.editions) || []).filter((e) => e && e.id);
    if (!storeShip || !storeShip.id || !eds.length) return null;
    const best = eds.reduce((a, b) => (b.price < a.price ? b : a));
    // Every edition, cheapest first: RSI may not sell an upgrade to the cheapest one.
    const skus = eds
      .slice()
      .sort((a, b) => a.price - b.price)
      .map((e) => e.id);
    return {
      toShipId: storeShip.id,
      toSkuId: best.id,
      skus,
      price: best.price,
      title: best.title,
    };
  };

  const STORE_KEY = 'storeShips';
  const STORE_TTL = 6 * 3600e3;
  // → { at, ships } (cached 6 hours), or the cached copy / null when RSI doesn't answer.
  OH.getStoreShips = async function getStoreShips(fetchFn = fetch, { force = false } = {}) {
    const { [STORE_KEY]: cached } = await chrome.storage.local.get(STORE_KEY);
    if (!force && cached && Date.now() - cached.at < STORE_TTL) return cached;
    try {
      const res = await OH.guarded(fetchFn)(STORE_URL, {
        method: 'POST',
        credentials: 'omit',
        headers: { 'content-type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify([
          { operationName: 'initShipUpgrade', variables: {}, query: STORE_QUERY },
        ]),
      });
      const ships = res.ok ? OH.parseStoreShips(await res.json()) : [];
      if (ships.length >= 50) {
        const fresh = { at: Date.now(), ships };
        await chrome.storage.local.set({ [STORE_KEY]: fresh });
        return fresh;
      }
    } catch (e) {
      OH.log('warn', 'store', `store status download failed: ${e?.message || e}`);
    }
    return cached || null;
  };

  // --- Your Subscriber Store (#418) ---------------------------------------------
  // The subscriber-only items RSI offers the signed-in account: the same /graphql
  // the referrals use, operation GetBrowseSkusByFilter with the store's
  // "extras-subscribers-store" facet, in your own RSI session (an anonymous
  // request gets 0 items). The list is exactly what RSI returns for the session,
  // so tier differences (Centurion, Imperator) take care of themselves: we never
  // guess which tier an item is for, only repeat what its tags or label say.
  // Only for a signed-in subscriber, at most once a day by itself (Store page or
  // after a scan, never inside the scan) plus the Refresh button. Pages one at a
  // time with a pause; a 429/403/5xx stops the read and keeps the last list.
  const SUB_STORE_KEY = 'subStore';
  const SUB_STORE_TTL = 24 * 3600e3;
  const SUB_STORE_PAGE = 100; // asked first; RSI's own page uses 20 (the fallback)
  const SUB_STORE_PAGE_MIN = 20;
  const SUB_STORE_MAX_PAGES = 20;
  OH.SUB_STORE_MAX = 2000; // items kept (storage budget)
  const SUB_STORE_QUERY = `query GetBrowseSkusByFilter($query: SearchQuery, $storeFront: String = "pledge") {
  store(browse: true, name: $storeFront) {
    listing: search(query: $query) {
      resources {
        id name title subtitle url type
        media { thumbnail { storeSmall slideshow } }
        nativePrice { amount discounted }
        price { amount discounted }
        stock { available unlimited show level }
        tags { name }
        ... on TySku { label isWarbond isPackage }
      }
      count
      totalCount
    }
  }
}`;
  const subStoreBody = (page, limit) =>
    JSON.stringify([
      {
        operationName: 'GetBrowseSkusByFilter',
        query: SUB_STORE_QUERY,
        variables: {
          storeFront: 'pledge',
          query: {
            page,
            limit,
            skus: {
              filtersFromTags: {
                tagIdentifiers: [],
                facetIdentifiers: ['extras-subscribers-store'],
              },
              products: [65],
            },
            sort: { field: 'weight', direction: 'desc' },
          },
        },
      },
    ]);
  const rsiAbs = (u) => {
    const s = String(u || '').trim();
    if (!s) return null;
    if (/^https:\/\//i.test(s)) return s;
    if (s.startsWith('//')) return 'https:' + s;
    if (s.startsWith('/')) return 'https://robertsspaceindustries.com' + s;
    return null; // anything else (http:, javascript:) isn't kept
  };
  // A price block ({ amount, discounted } in cents) → dollars, the sale price when
  // there is one (RSI's own rule: discounted counts when set and != amount).
  const subPrice = (p) => {
    if (!p || typeof p.amount !== 'number') return null;
    const sale = typeof p.discounted === 'number' && p.discounted !== p.amount;
    return {
      price: (sale ? p.discounted : p.amount) / 100,
      was: sale ? p.amount / 100 : null,
    };
  };
  // Shelf names for the filter chips. RSI's own tags/type first when they name
  // exactly one shelf; otherwise the item's name (plus label and subtitle), checked
  // in a fixed order so the more telling word wins: a paint is a paint, a display
  // or mug is Flair even when it says "Weapon" or "Set", armor stays Armor even as
  // an "Armor Set", and Kit/Set/Pack/Bundle/Collection wins over the loose words
  // after it. Other only when nothing matches. Pure.
  const SUB_TAG_KINDS = [
    ['Paints', /\b(paints?|liver(y|ies)|skins?)\b/i],
    ['Armor', /\b(armou?rs?|helmets?|undersuits?)\b/i],
    ['Weapons', /\b(weapons?|fps weapons?)\b/i],
    ['Clothing', /\b(clothing|clothes|apparel)\b/i],
    ['Flair', /\b(flair|decorations?|collectibles?|hangar decor)\b/i],
    ['Kits and Bundles', /\b(kits?|bundles?|packs?|packages?|collections?)\b/i],
    ['Ships', /\b(ships?|vehicles?|standalone ships?)\b/i],
  ];
  const SUB_NAME_KINDS = [
    ['Paints', /\b(paints?|liver(y|ies)|skins?)\b/i],
    [
      'Flair',
      /\b(mugs?|cups?|displays?|cases?|racks?|plush(ie)?s?|posters?|models?|trophy|trophies|statues?|figures?|figurines?|paintings?|flags?|banners?|dashbots?|bobbleheads?|coins?|decorations?|flair)\b/i,
    ],
    ['Armor', /\b(armou?rs?|helmets?|undersuits?|backpacks?)\b/i],
    ['Kits and Bundles', /\b(kits?|sets?|packs?|bundles?|collections?)\b/i],
    [
      'Weapons',
      /\b(weapons?|rifles?|pistols?|smgs?|shotguns?|snipers?|knife|knives|launchers?|lmgs?|railguns?)\b/i,
    ],
    [
      'Clothing',
      /\b(clothing|apparel|outfits?|balaclavas?|hats?|caps?|beanies?|jackets?|coats?|shirts?|t-shirts?|hoodies?|sweaters?|pants|trousers|shorts|boots|shoes|gloves|gowns?|suits?|uniforms?|glasses|sunglasses|goggles|masks?|bandanas?|scarf|scarves|vests?|ponchos?|robes?|dress(es)?)\b/i,
    ],
    ['Ships', /\b(ships?|vehicles?|standalone)\b/i],
  ];
  OH.subStoreKind = function subStoreKind({
    tags = [],
    type = '',
    name = '',
    label = '',
    sub = '',
  } = {}) {
    const tagText = [...tags, type].join(' ');
    const fromTags = SUB_TAG_KINDS.filter(([, re]) => re.test(tagText));
    if (fromTags.length === 1) return fromTags[0][0];
    const text = [name, label, sub].join(' ');
    const hit = SUB_NAME_KINDS.find(([, re]) => re.test(text));
    return hit ? hit[0] : 'Other';
  };
  // What RSI's tags or label say about the tier, as written; never inferred.
  const subTiers = (text) =>
    ['Imperator', 'Centurion'].filter((t) => new RegExp(`\\b${t}\\b`, 'i').test(text));
  // GraphQL answer → { items, count, totalCount } or null (not a listing). Pure.
  // items: [{ id, name, url, img, price, was, warbond, pack, available, kind, tiers, tags }]
  OH.parseSubStore = function parseSubStore(json) {
    const data = Array.isArray(json) ? json[0] : json;
    const listing = data && data.data && data.data.store && data.data.store.listing;
    if (!listing || !Array.isArray(listing.resources)) return null;
    const items = [];
    for (const r of listing.resources) {
      if (!r || r.id == null) continue;
      const name = String(r.title || r.name || '').trim();
      if (!name) continue;
      const tags = (Array.isArray(r.tags) ? r.tags : [])
        .map((t) => String((t && t.name) || '').trim())
        .filter(Boolean)
        .slice(0, 12);
      const label = String(r.label || '').trim();
      const p = subPrice(r.nativePrice) || subPrice(r.price);
      const st = r.stock || {};
      const img = r.media && r.media.thumbnail;
      items.push({
        id: String(r.id),
        name,
        sub: String(r.subtitle || '').trim() || null,
        url: rsiAbs(r.url),
        img: rsiAbs(img && (img.storeSmall || img.slideshow)),
        price: p ? p.price : null,
        was: p ? p.was : null,
        warbond: r.isWarbond === true,
        pack: r.isPackage === true,
        available: st.available === true || st.unlimited === true,
        type: String(r.type || ''),
        label,
        kind: OH.subStoreKind({ tags, type: r.type || '', name, label, sub: r.subtitle || '' }),
        tiers: subTiers([tags.join(' '), label].join(' ')),
        tags,
      });
    }
    return {
      items,
      count: Number.isFinite(listing.count) ? listing.count : items.length,
      totalCount: Number.isFinite(listing.totalCount) ? listing.totalCount : null,
    };
  };
  // Does this account get a Subscriber Store? (signed in and a subscriber)
  OH.isSubscriber = (acct) =>
    !!(acct && acct.loggedIn === true && acct.subscriber && acct.subscriber.type);
  // The cached list for this account ({ at, nickname, total, items, partial }) or null.
  OH.getSubStoreCached = async function getSubStoreCached(acct) {
    const { [SUB_STORE_KEY]: c } = await chrome.storage.local.get(SUB_STORE_KEY);
    if (!c || !Array.isArray(c.items)) return null;
    if (acct && acct.nickname && c.nickname && c.nickname !== acct.nickname) return null;
    // Sort with today's rules, so a saved list follows an update without a refresh.
    const items = c.items.map((it) => ({
      ...it,
      kind: OH.subStoreKind({
        tags: it.tags || [],
        type: it.type || '',
        name: it.name || '',
        label: it.label || '',
        sub: it.sub || '',
      }),
    }));
    return { ...c, items };
  };
  // Due for its once-a-day read? (never tried, or the last try a day ago)
  OH.subStoreDue = async function subStoreDue() {
    const { [SUB_STORE_KEY]: c } = await chrome.storage.local.get(SUB_STORE_KEY);
    const last = c ? Math.max(c.at || 0, c.triedAt || 0) : 0;
    return Date.now() - last >= SUB_STORE_TTL;
  };
  let subStoreInflight = null;
  // Read the whole list (or answer from the day's cache unless `force`).
  // → { ok: true, list } | { ok: false, error, list? (the last good one) }.
  // error: 'signed-out' | 'not-subscriber' | 'busy' | 'refused' | 'network'. Never throws.
  // `pause` is the wait between pages (tests skip it).
  OH.getSubStore = function getSubStore({
    force = false,
    account,
    fetchFn = fetch,
    onProgress,
    pause = () => sleep(DELAY_MS + Math.random() * 400),
  } = {}) {
    if (subStoreInflight) return subStoreInflight;
    subStoreInflight = readSubStore({ force, account, fetchFn, onProgress, pause }).finally(() => {
      subStoreInflight = null;
    });
    return subStoreInflight;
  };
  async function readSubStore({ force, account, fetchFn, onProgress, pause }) {
    const acct = account === undefined ? await OH.getAccount().catch(() => null) : account;
    if (!acct || acct.loggedIn !== true) return { ok: false, error: 'signed-out' };
    if (!OH.isSubscriber(acct)) return { ok: false, error: 'not-subscriber' };
    const cached = await OH.getSubStoreCached(acct);
    if (!force && cached && Date.now() - (cached.at || 0) < SUB_STORE_TTL)
      return { ok: true, list: cached };
    const markTried = () =>
      chrome.storage.local
        .set({
          [SUB_STORE_KEY]: {
            ...(cached || { items: [] }),
            nickname: acct.nickname || null,
            triedAt: Date.now(),
          },
        })
        .catch(() => {});
    const get = OH.guarded(fetchFn, { timeout: 20000 });
    const ask = async (page, limit) => {
      let res;
      try {
        res = await get(GRAPHQL_URL, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', Accept: 'application/json' },
          body: subStoreBody(page, limit),
        });
      } catch (e) {
        return { error: 'network', msg: e?.message || String(e) };
      }
      if (res.status === 401 || res.status === 403) return { error: 'refused', status: res.status };
      if (res.status === 429 || res.status >= 500) return { error: 'busy', status: res.status };
      if (!res.ok) return { error: 'bad', status: res.status };
      let json;
      try {
        json = await res.json();
      } catch {
        return { error: 'bad' };
      }
      const d = Array.isArray(json) ? json[0] : json;
      if (d && Array.isArray(d.errors) && d.errors.length)
        return { error: 'bad', msg: d.errors.map((e) => e && e.message).join('; ') };
      const parsed = OH.parseSubStore(json);
      return parsed || { error: 'bad', msg: 'no listing in the answer' };
    };
    const fail = async (r) => {
      await markTried();
      OH.log(
        'warn',
        'subStore',
        `subscriber store read stopped: ${r.error} ${r.status || ''} ${r.msg || ''}`.trim(),
      );
      return { ok: false, error: r.error === 'bad' ? 'network' : r.error, list: cached || null };
    };
    // Page 1 at 100; if RSI refuses that size, again at its own 20.
    let limit = SUB_STORE_PAGE;
    let first = await ask(1, limit);
    if (first.error === 'bad') {
      await pause();
      limit = SUB_STORE_PAGE_MIN;
      first = await ask(1, limit);
    }
    if (first.error) return fail(first);
    const total = first.totalCount;
    // RSI may hand back fewer than asked: page on at the size it actually uses.
    if (
      first.items.length &&
      first.items.length < limit &&
      total != null &&
      first.items.length < total
    )
      limit = first.items.length;
    const seen = new Set();
    const items = [];
    const add = (list) => {
      let n = 0;
      for (const it of list) {
        if (seen.has(it.id) || items.length >= OH.SUB_STORE_MAX) continue;
        seen.add(it.id);
        items.push(it);
        n++;
      }
      return n;
    };
    add(first.items);
    onProgress?.(items.length, total);
    let partial = false;
    for (let page = 2; page <= SUB_STORE_MAX_PAGES; page++) {
      if (total != null && items.length >= total) break;
      if (items.length >= OH.SUB_STORE_MAX) break;
      await pause();
      const r = await ask(page, limit);
      if (r.error) {
        partial = true; // keep what came in, say it's short
        OH.log(
          'warn',
          'subStore',
          `subscriber store page ${page}: ${r.error} ${r.status || ''}`.trim(),
        );
        break;
      }
      if (!r.items.length || add(r.items) === 0) break;
      onProgress?.(items.length, total);
    }
    // A short read never replaces a fuller list from earlier.
    if (partial && cached && cached.items.length > items.length) return fail({ error: 'busy' });
    const list = {
      at: Date.now(),
      nickname: acct.nickname || null,
      total: total ?? items.length,
      pageSize: limit,
      partial,
      items,
    };
    try {
      await chrome.storage.local.set({ [SUB_STORE_KEY]: list });
    } catch {
      /* storage full: this page view still has the list */
    }
    return { ok: true, list };
  }

  // --- The store catalog (openhangar.space/api/catalog) ------------------------------
  // Everything in RSI's pledge store right now, as the website's store watcher last
  // read it: one download (ETag'd, so usually a tiny "nothing new") instead of a
  // request per ship. The wishlist is matched against it here, on your machine:
  // nothing about it is ever sent. v1:
  //   { items: [{ id: "sku-<RSI SKU>" | "upgrade-<to ship id>", kind, name, img, url,
  //       price, wasPrice, warbond, standardPrice, savings, inStore, insurance,
  //       upgrade: { toShipId, to, skus } | null }],
  //     ships: [{ id, name, msrp, editions: [{ sku, price, warbond }] }] }
  // In `items` with inStore = on sale now; inStore false = listed but sold out; not
  // in `items` = not for sale. Asked at most every 30 minutes (Check Now and Scan →
  // Store ask again, still with the ETag).
  const CATALOG_FEED_TTL = 30 * 60e3;
  OH.getStoreCatalog = ({ force = false, fetchFn } = {}) =>
    OH.siteFeed('api/catalog', {
      key: 'feedCatalog',
      ttl: CATALOG_FEED_TTL,
      force,
      fetchFn,
      valid: (j) => isV1(j) && Array.isArray(j.items),
    });
  const CATALOG_KINDS = [
    'ship',
    'vehicle',
    'pack',
    'starter',
    'paint',
    'gear',
    'addon',
    'subscriber',
    'upgrade',
    'other',
  ];
  // Catalog kind → the Wishlist Watch kind (ui/lib/wish-watch.js).
  OH.CATALOG_WISH_KIND = {
    ship: 'ship',
    vehicle: 'ship',
    pack: 'pack',
    starter: 'pack',
    paint: 'paint',
    gear: 'gear',
    addon: 'addon',
    subscriber: 'addon',
    other: 'addon',
    upgrade: 'ccu',
  };
  const money = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
  const rsiLink = (v) =>
    typeof v === 'string' && /^https:\/\/robertsspaceindustries\.com\//.test(v) ? v : null;
  // The feed's JSON → { at, items, ships, byId }, every field checked. Pure.
  OH.shapeCatalog = function shapeCatalog(json) {
    const items = [];
    const seen = new Set();
    for (const i of json && Array.isArray(json.items) ? json.items : []) {
      if (!i || typeof i.id !== 'string' || !/^(sku|upgrade)-\d+$/.test(i.id)) continue;
      const name = typeof i.name === 'string' ? i.name.trim().slice(0, 200) : '';
      const price = money(i.price);
      if (!name || price == null || seen.has(i.id)) continue;
      const kind = CATALOG_KINDS.includes(i.kind) ? i.kind : 'other';
      const u = i.upgrade;
      const upgrade =
        u && Number.isInteger(u.toShipId)
          ? {
              toShipId: u.toShipId,
              to:
                (typeof u.to === 'string' && u.to.trim().slice(0, 200)) ||
                name.replace(/^Upgrade to\s+/i, ''),
              skus: (Array.isArray(u.skus) ? u.skus : []).filter(Number.isInteger),
            }
          : null;
      if (kind === 'upgrade' && !upgrade) continue;
      seen.add(i.id);
      items.push({
        id: i.id,
        kind,
        wishKind: OH.CATALOG_WISH_KIND[kind],
        name,
        img: OH.feedImage(i.img),
        url: rsiLink(i.url),
        price,
        wasPrice: money(i.wasPrice),
        warbond: !!i.warbond,
        standardPrice: money(i.standardPrice),
        savings: money(i.savings),
        inStore: i.inStore !== false,
        insurance: typeof i.insurance === 'string' ? i.insurance.trim().slice(0, 20) : null,
        upgrade: kind === 'upgrade' ? upgrade : null,
      });
    }
    const ships = (json && Array.isArray(json.ships) ? json.ships : [])
      .filter((s) => s && Number.isInteger(s.id) && typeof s.name === 'string' && s.name.trim())
      .map((s) => ({
        id: s.id,
        name: s.name.trim().slice(0, 200),
        msrp: money(s.msrp) || null,
        editions: (Array.isArray(s.editions) ? s.editions : [])
          .filter((e) => e && money(e.price))
          .map((e) => ({
            sku: Number.isInteger(e.sku) ? e.sku : null,
            price: e.price,
            warbond: !!e.warbond,
          }))
          .sort((a, b) => a.price - b.price),
      }));
    return {
      at: Date.parse((json && json.updatedAt) || '') || null,
      items,
      ships,
      byId: new Map(items.map((i) => [i.id, i])),
    };
  };

  const cheapest = (xs) => (xs.length ? Math.min(...xs) : null);
  const cents = (n) => Math.round(n * 100) / 100;
  // What upgrading from a ship worth `fromMsrp` (USD) costs with catalog upgrade
  // `item`: each edition's price minus fromMsrp (editions from `ships`, else the
  // item's own price). → { price, warbond } (warbond only when cheaper) or null when
  // no edition costs more than the ship you start from. Pure.
  OH.upgradeCost = function upgradeCost(cat, item, fromMsrp) {
    if (!item || !item.upgrade || !(fromMsrp > 0)) return null;
    const ship = ((cat && cat.ships) || []).find((s) => s.id === item.upgrade.toShipId);
    const eds =
      ship && ship.editions.length ? ship.editions : [{ price: item.price, warbond: item.warbond }];
    const up = eds.filter((e) => e.price > fromMsrp);
    const std = cheapest(up.filter((e) => !e.warbond).map((e) => cents(e.price - fromMsrp)));
    const wb = cheapest(up.filter((e) => e.warbond).map((e) => cents(e.price - fromMsrp)));
    if (std == null && wb == null) return null;
    return {
      price: std != null ? std : wb,
      warbond: std != null && wb != null && wb < std ? wb : null,
    };
  };

  // One wishlist entry against the catalog → { status, price, warbond, url, img }
  // for its Wishlist Watch row (status: 'in' | 'soldout' | 'out', or 'unknown' with
  // no catalog). An entry is a ship's name (a string), or a catalog item
  // { id, kind, name, from?, fromMsrp? } (a CCU starts from `from`).
  // `sameShip(a, b)` matches ship names; `msrpOf(name)` is a ship's standard price
  // (USD) or null. Runs locally; pure.
  OH.catalogWishStatus = function catalogWishStatus(cat, entry, { sameShip, msrpOf } = {}) {
    const same = sameShip || ((a, b) => String(a).toLowerCase() === String(b).toLowerCase());
    const msrp = (n) => (msrpOf && n ? msrpOf(n) : null) || null;
    if (typeof entry === 'string') {
      const usual = msrp(entry);
      if (!cat) return { status: 'unknown', price: usual, warbond: null, url: null, img: null };
      const hits = cat.items.filter(
        (i) => (i.kind === 'ship' || i.kind === 'vehicle') && same(i.name, entry),
      );
      const on = hits.filter((i) => i.inStore);
      if (!on.length) {
        const any = hits[0] || null;
        return {
          status: any ? 'soldout' : 'out',
          price: usual,
          warbond: null,
          url: any ? any.url : null,
          img: any ? any.img : null,
        };
      }
      const std = on.filter((i) => !i.warbond).sort((a, b) => a.price - b.price)[0] || null;
      const wb = on.filter((i) => i.warbond).sort((a, b) => a.price - b.price)[0] || null;
      const price = std ? std.price : (wb && wb.standardPrice) || usual || wb.price;
      const pick = std || wb;
      return {
        status: 'in',
        price,
        warbond: wb && wb.price < price ? wb.price : null,
        url: pick.url,
        img: pick.img,
      };
    }
    const e = entry || {};
    const last = money(e.price);
    if (!cat) return { status: 'unknown', price: last, warbond: null, url: null, img: null };
    const item = cat.byId.get(e.id) || null;
    if (!item) return { status: 'out', price: last, warbond: null, url: null, img: null };
    const base = { url: item.url, img: item.img };
    if (!item.inStore)
      return { status: 'soldout', price: last || item.price, warbond: null, ...base };
    if (item.upgrade) {
      const cost = OH.upgradeCost(cat, item, money(e.fromMsrp) || msrp(e.from));
      return cost
        ? { status: 'in', price: cost.price, warbond: cost.warbond, ...base }
        : { status: 'out', price: null, warbond: null, ...base };
    }
    if (item.warbond && item.standardPrice && item.standardPrice > item.price)
      return { status: 'in', price: item.standardPrice, warbond: item.price, ...base };
    return { status: 'in', price: item.price, warbond: null, ...base };
  };
  // --- Loaner ships (RSI support: "Loaner Ship Matrix") --------------------------
  // A public help-center article with one table row per not-yet-flyable ship:
  // "YOUR SHIP" → "OUR LOANER(S)". Row names use shorthand ("Hull D, E",
  // "Idris-M & P", "Pulse (+ LX)", "Cyclone Variants"), expanded into patterns.
  // One pass, so "&amp;quot;" stays the text "&quot;" instead of being decoded
  // twice (CodeQL js/double-escaping, #285). The result is plain text: every
  // caller escapes it again before showing it.
  const ENTITIES = {
    nbsp: ' ',
    amp: '&',
    '#39': "'",
    rsquo: "'",
    lsquo: "'",
    quot: '"',
    lt: '<',
    gt: '>',
  };
  const codePoint = (n) =>
    Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
  const decodeEntities = (s) =>
    String(s || '')
      .replace(/ /g, ' ')
      .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#39);/gi, (m, e) => {
        if (/^#x/i.test(e)) return codePoint(parseInt(e.slice(2), 16));
        if (/^#\d+$/.test(e) && e !== '#39') return codePoint(Number(e.slice(1)));
        const k = e.toLowerCase();
        return Object.prototype.hasOwnProperty.call(ENTITIES, k) ? ENTITIES[k] : m;
      });
  // Markup → text. Repeats until nothing changes, so a nested "<<b>x>" can't
  // leave a tag behind (CodeQL js/incomplete-multi-character-sanitization).
  const stripTags = (s, by = ' ') => {
    let out = String(s || '');
    for (let prev = ''; prev !== out;) {
      prev = out;
      out = out.replace(/<[^>]*>/g, by);
    }
    return out;
  };
  const cellText = (h) => decodeEntities(stripTags(h)).replace(/\s+/g, ' ').trim();
  // Row names compared the same way as the ships they're matched against.
  const normPattern = (n) =>
    OH.normShipName(
      String(n)
        .replace(/\*/g, '')
        .replace(/\s+frigate\b/i, ''),
    )
      .toLowerCase()
      .replace(/\s+/g, ' ');
  // "600i Explorer and Executive" → ["600i Explorer", "600i Executive"], etc.
  function loanerPatterns(cell) {
    let text = cell;
    const out = [];
    // "Pulse (+ LX)" / "X1 (+ Velocity, Force)": the base plus each variant.
    const plus = text.match(/^(.*?)\s*\(\+\s*([^)]*)\)\s*$/);
    let extra = [];
    if (plus) {
      text = plus[1];
      extra = plus[2].split(/\s*,\s*/).filter(Boolean);
    }
    const prefix = /\bvariants?\b/i.test(text);
    text = text.replace(/\s*\bvariants?\b/i, '').trim();
    const parts = text.split(/\s*(?:\/|,|&|\band\b)\s*/i).filter(Boolean);
    const first = parts[0] || '';
    const firstWords = first.split(' ');
    for (const part of parts) {
      let n = part;
      if (part !== first && !part.includes(' ')) {
        if (/^[A-Za-z]$/.test(part) && /-[A-Za-z]$/.test(first))
          n = first.replace(/[A-Za-z]$/, part); // Idris-M & P
        else if (firstWords.length > 1) n = [...firstWords.slice(0, -1), part].join(' '); // Hull D, E
      }
      out.push({ n: normPattern(n), prefix });
    }
    for (const v of extra) out.push({ n: normPattern(`${first} ${v}`), prefix: false });
    return out;
  }
  OH.parseLoanerMatrix = function parseLoanerMatrix(html) {
    const rows = [];
    for (const tr of String(html || '').match(/<tr[\s\S]*?<\/tr>/gi) || []) {
      const cells = (tr.match(/<td[\s\S]*?<\/td>/gi) || []).map(cellText);
      if (cells.length < 2 || !cells[0] || !cells[1]) continue;
      const loaners = cells[1].split(/\s*,\s*/).filter(Boolean);
      rows.push({ ship: cells[0], patterns: loanerPatterns(cells[0]), loaners });
    }
    return rows;
  };
  // The matrix row for a ship name, or null. The longest matching pattern wins,
  // so "Constellation Phoenix Emerald" beats "Constellation Phoenix". Pure.
  OH.loanersFor = function loanersFor(name, matrix) {
    const n = OH.normShipName(name).toLowerCase().replace(/\s+/g, ' ');
    if (!n) return null;
    let best = null;
    let bestLen = 0;
    for (const row of matrix || []) {
      for (const p of row.patterns) {
        const hit = n === p.n || (p.prefix && n.startsWith(p.n + ' '));
        if (hit && p.n.length > bestLen) {
          best = row;
          bestLen = p.n.length;
        }
      }
    }
    return best;
  };
  // Fetch one RSI help article's ship table (same two-column layout for the
  // loaner matrix and the included-vessels list), cached a week under `key`.
  // The cached copy (or null) when RSI's help center is down.
  const HELP_TTL = 7 * 24 * 3600e3;
  async function getHelpTable(id, key, minRows, fetchFn) {
    const { [key]: cached } = await chrome.storage.local.get(key);
    if (cached && Date.now() - cached.at < HELP_TTL) return cached.rows;
    try {
      const res = await OH.guarded(fetchFn)(
        `https://support.robertsspaceindustries.com/api/v2/help_center/en-us/articles/${id}.json`,
        { credentials: 'omit', headers: { Accept: 'application/json' } },
      );
      const json = res.ok ? await res.json() : null;
      const rows = OH.parseLoanerMatrix(json?.article?.body);
      if (rows.length >= minRows) {
        await chrome.storage.local.set({
          [key]: { at: Date.now(), updated: json.article.updated_at || null, rows },
        });
        return rows;
      }
    } catch (e) {
      OH.log('warn', 'loaners', `help article ${id} download failed: ${e?.message || e}`);
    }
    return cached ? cached.rows : null;
  }
  OH.getLoanerMatrix = (fetchFn = fetch) =>
    getHelpTable('360003093114', 'loanerMatrix', 10, fetchFn);
  // "Included Vessels": snubs and rovers that come with a ship for keeps
  // (Carrack → C8 Pisces + URSA). Same table shape; match with loanersFor.
  OH.getIncludedVessels = (fetchFn = fetch) =>
    getHelpTable('4408770370455', 'includedVessels', 5, fetchFn);

  // openhangar.space/versions.json: the version each store has live ({ stores:
  // { chrome, edge, firefox: { live, … } } }). Firefox's Check for Updates reads it;
  // asked only when that button is pressed.
  OH.getStoreVersions = ({ force = false, fetchFn } = {}) =>
    OH.siteFeed('versions.json', {
      key: 'feedVersions',
      ttl: 10 * 60e3,
      force,
      fetchFn,
      valid: (j) => !!j && typeof j === 'object' && !!j.stores && typeof j.stores === 'object',
    });

  const FX_KEY = 'fxRates';
  const FX_TTL = 24 * 3600e3;
  const RATES_URL = 'https://openhangar.space/rates.json';
  OH.getFxRates = async function getFxRates(fetchFn = fetch) {
    const want = OH.CURRENCIES.filter((c) => c !== 'USD').join(',');
    const { [FX_KEY]: cached } = await chrome.storage.local.get(FX_KEY);
    // A cache saved before a currency was added doesn't count (it lacks its rate).
    const fits = cached && (cached.want == null ? false : cached.want === want);
    if (fits && cached.rates && Date.now() - cached.at < FX_TTL) return cached;
    try {
      const res = await OH.guarded(fetchFn)(RATES_URL, {
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      });
      const json = res.ok ? await res.json() : null;
      const all = json && json.base === 'USD' && json.rates;
      // Only the currencies we offer, and only if every one of them is there.
      const picked = all ? OH.CURRENCIES.filter((c) => c !== 'USD').map((c) => [c, all[c]]) : [];
      if (picked.length && picked.every(([, r]) => typeof r === 'number' && r > 0)) {
        const fresh = {
          at: Date.now(),
          want,
          date: json.date || null,
          rates: { USD: 1, ...Object.fromEntries(picked) },
        };
        await chrome.storage.local.set({ [FX_KEY]: fresh });
        return fresh;
      }
    } catch (e) {
      OH.log('warn', 'fx', `exchange rates download failed: ${e?.message || e}`);
    }
    return cached && cached.rates ? cached : null; // stale beats nothing
  };

  // --- Updates -----------------------------------------------------------------
  // Compare dotted versions ("0.2.10" > "0.2.9"). → negative | 0 | positive. Pure.
  OH.compareVersions = function compareVersions(a, b) {
    const pa = String(a || '')
      .split('.')
      .map((n) => parseInt(n, 10) || 0);
    const pb = String(b || '')
      .split('.')
      .map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d) return d;
    }
    return 0;
  };

  // CHANGELOG.md → [{ title, version, date, intro: [text], items: [text] }],
  // newest first, skipping "Unreleased". Headings look like
  // "## 0.2.8 — 2026-09-28"; bullets may wrap onto indented lines. Text stays
  // markdown (see OH.inlineMarkdown). `version` is the heading's first version
  // number, so a range like "0.2.0 – 0.2.6" compares as 0.2.0. Pure.
  OH.parseChangelog = function parseChangelog(md) {
    const out = [];
    let cur = null;
    let para = null;
    for (const raw of String(md || '').split(/\r?\n/)) {
      const h = raw.match(/^## (.+?)\s+[—-]\s+(.+)$/) || raw.match(/^## (.+)$/);
      if (h) {
        const title = h[1].trim();
        cur = /unreleased/i.test(title)
          ? null
          : {
              title,
              version: (title.match(/\d+\.\d+(?:\.\d+)?/) || [title])[0],
              date: (h[2] || '').trim(),
              intro: [],
              items: [],
            };
        if (cur) out.push(cur);
        para = null;
        continue;
      }
      if (!cur) continue;
      const line = raw.trim();
      if (!line) {
        para = null;
        continue;
      }
      if (/^[-*] /.test(line)) {
        cur.items.push(line.slice(2));
        para = { list: cur.items, i: cur.items.length - 1 };
      } else if (para) {
        para.list[para.i] += ' ' + line;
      } else {
        cur.intro.push(line);
        para = { list: cur.intro, i: cur.intro.length - 1 };
      }
    }
    return out;
  };

  // A little markdown → safe HTML: escapes everything, then **bold**, `code`
  // and [links](https://…) (http/https only). Pure.
  OH.inlineMarkdown = function inlineMarkdown(text) {
    return OH.escapeHtml(String(text || ''))
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)"&]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener">$1</a>',
      );
  };

  // --- Org fleet ------------------------------------------------------------------
  // Members share a file; we keep only their ship list. Accepts an HTF export
  // (a bare array, ships only: the one to ask for) or a full Open Hangar backup
  // (ships are read from the hangar; nothing else is kept). Pure.
  //   → { name, ships: [{ name, lti }] } | { error }
  OH.shipsFromFile = function shipsFromFile(obj, fileName = '') {
    const fromName = (String(fileName).match(/open-hangar-htf-(.+?)-\d{4}-\d{2}-\d{2}/) || [])[1];
    if (Array.isArray(obj)) {
      const ships = obj
        .filter((e) => e && (e.name || e.ship_name) && (e.entity_type || 'ship') === 'ship')
        .map((e) => ({ name: String(e.name || e.ship_name), lti: e.lti === true }));
      if (!ships.length) return { error: 'No ships in that file.' };
      return { name: fromName || null, ships };
    }
    const items = obj && obj.sources && obj.sources.hangar && obj.sources.hangar.items;
    if (Array.isArray(items)) {
      const ships = [];
      for (const p of items) {
        for (const c of p.contents || []) {
          if (/^ship$/i.test(c.kind || '')) {
            ships.push({ name: OH.htfShipName(c.label) || c.label, lti: p.insurance === 'LTI' });
          }
        }
      }
      if (!ships.length) return { error: 'No ships in that backup.' };
      return { name: (obj.account && obj.account.handle) || fromName || null, ships };
    }
    return { error: "That isn't an Open Hangar HTF export or backup." };
  };

  // Combine members' ship lists into one fleet. shipOf/priceOf are the wiki
  // resolvers (OH.makeShipIndex). Ships group by their matched wiki name when
  // known, so "Carrack" and "Anvil Carrack" count together. Pure.
  // Jobs an org usually wants covered, matched against each ship's role (the
  // wiki's "foci", e.g. "Light Mining", "Heavy Refueling"). Order = display.
  OH.ORG_ROLES = [
    { key: 'cargo', label: 'Cargo', re: /freight|cargo/i },
    { key: 'mining', label: 'Mining', re: /mining/i },
    { key: 'salvage', label: 'Salvage', re: /salvage/i },
    { key: 'refining', label: 'Refining', re: /refinery|refining/i },
    { key: 'medical', label: 'Medical', re: /medical/i },
    { key: 'refuel', label: 'Refueling', re: /refuel/i },
    { key: 'repair', label: 'Repair', re: /repair/i },
    { key: 'explore', label: 'Exploration', re: /pathfinder|expedition/i },
    { key: 'science', label: 'Science / Data', re: /science|data/i },
    { key: 'dropship', label: 'Troop Transport', re: /dropship|boarding/i },
    { key: 'interdiction', label: 'Interdiction', re: /interdiction/i },
    { key: 'bomber', label: 'Bombers', re: /bomber/i },
    { key: 'capital', label: 'Capital Warships', re: /frigate|corvette|destroyer|battlecruiser/i },
    { key: 'carrier', label: 'Carriers', re: /carrier/i },
    { key: 'passenger', label: 'Passengers', re: /passenger|touring|transport/i },
    { key: 'construction', label: 'Construction', re: /construction/i },
    // Combat and everything else the wiki's roles ("foci") name, so every ship
    // lands somewhere. Labels follow the wiki's wording; nothing is invented.
    { key: 'fighter', label: 'Fighters', re: /fighter|interceptor/i },
    { key: 'gunship', label: 'Gunships', re: /gun ?ship/i },
    { key: 'minelayer', label: 'Minelaying', re: /minelayer/i },
    { key: 'ground', label: 'Ground Combat', re: /anti-air|anti-vehicle|tank|^combat$|military/i },
    { key: 'recovery', label: 'Recovery', re: /recovery/i },
    { key: 'reporting', label: 'Reporting', re: /reporting/i },
    { key: 'multirole', label: 'Multi-Role', re: /multi-role|generalist|modular/i },
    { key: 'starter', label: 'Starter', re: /starter/i },
    { key: 'racing', label: 'Racing', re: /racing/i },
  ];
  const SIZE_RANK = { capital: 5, large: 4, medium: 3, small: 2, snub: 1, vehicle: 0 };

  OH.orgFleet = function orgFleet(members, shipOf, priceOf) {
    const byShip = new Map();
    const tally = { shipCount: 0, store: 0, priced: 0, cargo: 0, crew: 0 };
    const byCareer = {};
    const bySize = {};
    const bump = (m, k) => (m[k] = (m[k] || 0) + 1);
    const byMember = [];
    for (const m of members || []) {
      const mine = { name: m.name, ships: 0, lti: 0, store: 0, priced: 0 };
      byMember.push(mine);
      for (const s of m.ships || []) {
        const v = shipOf(s.name);
        const price = priceOf(s.name);
        mine.ships++;
        if (s.lti) mine.lti++;
        if (price) {
          mine.store += price.msrp;
          mine.priced++;
        }
        const key = v ? v.lname : s.name.toLowerCase();
        let row = byShip.get(key);
        if (!row) {
          row = {
            name: v ? v.name || v.lname.replace(/\b\w/g, (c) => c.toUpperCase()) : s.name,
            count: 0,
            lti: 0,
            owners: new Map(),
            msrp: price ? price.msrp : null,
            career: (v && v.career) || null,
            role: (v && v.role) || null,
            size: (v && v.size) || null,
            status: (v && v.status) || null, // flight-ready | in-concept | …
          };
          byShip.set(key, row);
        }
        row.count++;
        if (s.lti) row.lti++;
        row.owners.set(m.name, (row.owners.get(m.name) || 0) + 1);
        tally.shipCount++;
        if (price) {
          tally.store += price.msrp;
          tally.priced++;
        }
        if (v) {
          tally.cargo += v.cargo || 0;
          tally.crew += v.crew || 0;
          bump(byCareer, v.career || 'Other');
          bump(bySize, v.size || 'Other');
        }
      }
    }
    const ships = [...byShip.values()]
      .map((r) => ({ ...r, owners: [...r.owners].map(([name, n]) => ({ name, n })) }))
      .sort((a, b) => b.count - a.count || (b.msrp || 0) - (a.msrp || 0));
    // Which jobs the fleet can do, and with what (missing ones have count 0).
    // `ready` counts only flight-ready ships: a role held only by concept ships
    // (e.g. a Pioneer for Construction) is covered, just not flyable yet.
    const roles = OH.ORG_ROLES.map((r) => {
      const hits = ships.filter((sh) => sh.role && r.re.test(sh.role));
      return {
        key: r.key,
        label: r.label,
        count: hits.reduce((n, sh) => n + sh.count, 0),
        ready: hits.filter((sh) => sh.status === 'flight-ready').reduce((n, sh) => n + sh.count, 0),
        ships: hits.map((sh) => sh.name),
      };
    });
    // Biggest hulls first (by size class, then price).
    const rank = (sh) => SIZE_RANK[String(sh.size || '').toLowerCase()] ?? -1;
    const biggest = ships
      .filter((sh) => rank(sh) >= 3)
      .sort((a, b) => rank(b) - rank(a) || (b.msrp || 0) - (a.msrp || 0))
      .slice(0, 8);
    byMember.sort((a, b) => b.store - a.store || b.ships - a.ships);
    return {
      ships,
      members: (members || []).length,
      ...tally,
      byCareer,
      bySize,
      roles,
      biggest,
      byMember,
    };
  };

  // --- Scan history --------------------------------------------------------------
  // Each full hangar scan that changed something is kept as a compact snapshot
  // ({ at, items: [[id, name, value]] }) in the DB, so the UI can say what changed
  // since last time and chart account value over time. Stays in this browser; it is
  // included in the user's own JSON export (their backup file).
  const HISTORY_MAX = 100;
  const HISTORY_MAX_BYTES = 3e6; // about 3 MB: big hangars keep fewer snapshots
  // Newest snapshots that fit both caps (count and rough JSON size). Pure.
  OH.trimHistory = function trimHistory(hist) {
    const out = hist.slice(-HISTORY_MAX);
    let bytes = out.reduce((n, sn) => n + JSON.stringify(sn).length, 0);
    while (out.length > 2 && bytes > HISTORY_MAX_BYTES) bytes -= JSON.stringify(out.shift()).length;
    return out;
  };
  // `credit` (Store Credit in dollars) is kept when known, so the value chart can
  // count it; snapshots from before 0.2.13 don't have it.
  OH.snapshotOf = function snapshotOf(items, at, credit) {
    const snap = {
      at,
      items: (items || []).map((p) => [
        String(p.id ?? ''),
        p.name || '',
        Number.isFinite(p.value) ? p.value : 0,
      ]),
    };
    if (Number.isFinite(credit)) snap.credit = credit;
    return snap;
  };
  // Same pledges and the same Store Credit (credit unknown on either side counts
  // as the same, so old snapshots don't all look changed).
  const sameSnapshot = (a, b, d) =>
    !d.added.length &&
    !d.removed.length &&
    !d.changed.length &&
    (!Number.isFinite(a.credit) ||
      !Number.isFinite(b.credit) ||
      Math.abs(a.credit - b.credit) < 0.01);
  const meltOf = (snap) => snap.items.reduce((a, x) => a + (x[2] || 0), 0);
  OH.snapshotMelt = meltOf;

  // What changed from snapshot a to b: added / removed pledges, and ones whose
  // name or value changed (an applied CCU keeps its pledge id). Pure.
  OH.diffSnapshots = function diffSnapshots(a, b) {
    const before = new Map(a.items.map((x) => [x[0], x]));
    const after = new Map(b.items.map((x) => [x[0], x]));
    const row = (x) => ({ id: x[0], name: x[1], value: x[2] });
    const added = b.items.filter((x) => !before.has(x[0])).map(row);
    const removed = a.items.filter((x) => !after.has(x[0])).map(row);
    const changed = [];
    for (const x of b.items) {
      const y = before.get(x[0]);
      if (y && (y[1] !== x[1] || Math.abs(y[2] - x[2]) >= 0.01)) {
        changed.push({ id: x[0], from: y[1], to: x[1], fromValue: y[2], toValue: x[2] });
      }
    }
    return { added, removed, changed, melt: meltOf(b) - meltOf(a) };
  };

  // Append a snapshot to db.history unless nothing changed (then just note when
  // it was last confirmed). Seeds the history from the previous scan first, so
  // the very first scan after this feature shipped already has a "before".
  function recordHistory(db, prevHangar, items, at, credit) {
    const hist = Array.isArray(db.history) ? db.history : [];
    if (!hist.length && prevHangar && Array.isArray(prevHangar.items) && prevHangar.items.length) {
      hist.push(OH.snapshotOf(prevHangar.items, prevHangar.scannedAt || at - 1));
    }
    const snap = OH.snapshotOf(items, at, credit);
    const last = hist[hist.length - 1];
    const d = last && OH.diffSnapshots(last, snap);
    if (d && sameSnapshot(last, snap, d)) {
      last.checkedAt = at;
      // First scan that knows the credit: fill it in rather than add a snapshot.
      if (!Number.isFinite(last.credit) && Number.isFinite(credit)) last.credit = credit;
    } else hist.push(snap);
    db.history = OH.trimHistory(hist);
  }

  // Keep only well-formed snapshots ({ at, items: [[id, name, value]] }).
  function cleanSnapshot(x) {
    if (!x || !Number.isFinite(x.at) || !Array.isArray(x.items)) return null;
    const items = x.items
      .filter((r) => Array.isArray(r) && r.length >= 3)
      .map((r) => [String(r[0]), String(r[1]), Number(r[2]) || 0]);
    const out = { at: x.at, items };
    if (Number.isFinite(x.credit)) out.credit = x.credit;
    if (Number.isFinite(x.checkedAt)) out.checkedAt = x.checkedAt;
    return out;
  }

  // Union of two histories (e.g. this browser's + a backup file's): by time,
  // one snapshot per timestamp, consecutive identical snapshots collapsed,
  // newest HISTORY_MAX kept. Pure.
  OH.mergeHistory = function mergeHistory(a, b) {
    const byAt = new Map();
    for (const x of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
      const c = cleanSnapshot(x);
      if (c && !byAt.has(c.at)) byAt.set(c.at, c);
    }
    const out = [];
    for (const snap of [...byAt.values()].sort((x, y) => x.at - y.at)) {
      const last = out[out.length - 1];
      const d = last && OH.diffSnapshots(last, snap);
      if (d && sameSnapshot(last, snap, d)) {
        last.checkedAt = Math.max(last.checkedAt || last.at, snap.checkedAt || snap.at);
      } else out.push(snap);
    }
    return OH.trimHistory(out);
  };

  OH.getHistory = async function getHistory() {
    const db = await OH.loadDB();
    return Array.isArray(db.history) ? db.history : [];
  };
})();
