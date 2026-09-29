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
 * entry (+ a parser). The whole account is stored as one versioned database:
 *   { schemaVersion, sources: { hangar: { items, scannedAt }, … }, owner }
 * Exposed on window.OH.
 *
 * EXPORT shape (what a backend/consumer sees) is that same DB plus provenance
 * and a flattened identity block, ordered identity-first → holdings:
 *   { app, appVersion, exportedAt, schemaVersion,
 *     account: { handle, displayName, …, organization:{name,sid,rank,logo},
 *                balances:{storeCredit,uec,rec} },
 *     sources: { hangar, buybacks },
 *     history: [ { at, items: [[id, name, value]] } ] }   // scan snapshots
 * See OH.exportDB. Schema v2 added the `account` block (v1 had sources only).
 */

(function () {
  const OH = (window.OH = window.OH || {});

  const PAGE_SIZE = 10;
  const DELAY_MS = 400; // politeness throttle between pages
  const MAX_PAGES = 1000; // safety cap: 10,000 pledges at RSI's 10 per page
  const DB_KEY = 'db';
  // v2 added the exported `account` block (identity + org/rank + balances).
  // The stored `sources` items shape is unchanged from v1, so a v1 DB in storage
  // loads as-is with no migration; only consumers that key on the export's
  // schemaVersion need to know v2 carries account data.
  const SCHEMA_VERSION = 2;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

  // A copy-paste report for bug posts: version, browser, data counts, cache
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
    const lines = [
      '```',
      'Open Hangar error report',
      `Version:   ${manifest.version || '?'} (${manifest.browser_specific_settings ? 'Firefox' : 'Chrome'} build)`,
      `Browser:   ${browserLabel((globalThis.navigator && globalThis.navigator.userAgent) || '')}`,
      `Hangar:    ${count(src('hangar'))} items, scanned ${ago(src('hangar').scannedAt)}`,
      `Buy-backs: ${count(src('buybacks'))} items, scanned ${ago(src('buybacks').scannedAt)}`,
      `History:   ${Array.isArray(db.history) ? db.history.length : 0} snapshots`,
      `Catalog:   ${Array.isArray(cat.list) ? cat.list.length : 0} ships (v${cat.v || '?'}, ${ago(cat.at)}) · ship matrix ${Array.isArray(mat.list) ? mat.list.length : 0}`,
      `Log:       ${log.length ? `last ${Math.min(maxLines, log.length)} of ${log.length}` : 'empty'}`,
      ...log.slice(-maxLines).map(OH.formatLogLine),
      '```',
    ];
    return lines.join('\n');
  };

  // --- Storage (versioned multi-source DB) ----------------------------------

  const emptyDB = () => ({ schemaVersion: SCHEMA_VERSION, sources: {} });

  // Load the whole DB, migrating the legacy { hangar, scannedAt } shape.
  OH.loadDB = async function loadDB() {
    const raw = await chrome.storage.local.get([DB_KEY, 'hangar', 'scannedAt']);
    if (raw[DB_KEY] && raw[DB_KEY].schemaVersion) return raw[DB_KEY];
    const db = emptyDB();
    if (Array.isArray(raw.hangar)) {
      db.sources.hangar = { items: raw.hangar, scannedAt: raw.scannedAt || null };
    }
    return db;
  };

  OH.loadSource = async function loadSource(id) {
    const db = await OH.loadDB();
    return db.sources[id] || { items: [], scannedAt: null };
  };

  // Saves are queued, and the DB is read right before it's written (the account
  // lookup happens first), so a save can't write back a stale copy over another
  // save or an account switch that happened while it was waiting.
  let saveChain = Promise.resolve();
  function saveSource(id, items, { record = false, meta } = {}) {
    const run = saveChain.then(async () => {
      // Stamp which RSI account this data belongs to, so the UI can detect when a
      // different account signs in later and clear the stale data (multi-account
      // safety). Best-effort: if we can't read the account, leave owner untouched.
      let acct = null;
      try {
        acct = await OH.getAccount();
      } catch {
        /* owner stamp is optional */
      }
      const db = await OH.loadDB();
      const scannedAt = Date.now();
      if (record) recordHistory(db, db.sources[id], items, scannedAt);
      db.sources[id] = meta ? { items, scannedAt, meta } : { items, scannedAt };
      if (acct && acct.loggedIn && acct.nickname) {
        db.owner = { nickname: acct.nickname, displayname: acct.displayname || null };
      }
      await chrome.storage.local.set({ [DB_KEY]: db });
      await chrome.storage.local.remove(['hangar', 'scannedAt']); // drop legacy keys
      return scannedAt;
    });
    saveChain = run.catch(() => {});
    return run;
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
  OH.clearData = async function clearData({ backup = false } = {}) {
    if (backup) {
      const db = await OH.loadDB();
      const hasData =
        db &&
        (db.owner ||
          Object.values(db.sources || {}).some(
            (s) => s && Array.isArray(s.items) && s.items.length,
          ));
      if (hasData) await chrome.storage.local.set({ [RECOVERY_KEY]: { at: Date.now(), db } });
      await chrome.storage.local.remove([DB_KEY, 'hangar', 'scannedAt', 'account']);
      return;
    }
    await chrome.storage.local.remove([
      DB_KEY,
      'hangar',
      'scannedAt',
      'account',
      RECOVERY_KEY,
      LOG_KEY,
    ]);
  };

  // The most recent auto-cleared snapshot ({ at, db }), or null. Lets the UI
  // offer a one-click restore after a different-account auto-clear.
  OH.getRecovery = async function getRecovery() {
    const raw = await chrome.storage.local.get(RECOVERY_KEY);
    const rec = raw[RECOVERY_KEY];
    return rec && rec.db && rec.db.schemaVersion ? rec : null;
  };

  // Restore a previously auto-cleared snapshot back into the live DB and drop the
  // recovery slot. Returns the restored DB, or null if there was nothing to restore.
  OH.recoverData = async function recoverData() {
    const rec = await OH.getRecovery();
    if (!rec) return null;
    await chrome.storage.local.set({ [DB_KEY]: rec.db });
    await chrome.storage.local.remove(RECOVERY_KEY);
    return rec.db;
  };

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

  // Make `nickname` the live account: park the current DB under its owner, then
  // load the new account's parked DB (if any). Returns { restored, parked }.
  OH.switchProfile = async function switchProfile(nickname, displayname = null) {
    const cur = await OH.loadDB();
    let parked = null;
    if (cur.owner && cur.owner.nickname && dbHasData(cur)) {
      if (cur.owner.nickname.toLowerCase() === String(nickname).toLowerCase()) {
        return { restored: false, parked: null }; // already live
      }
      await chrome.storage.local.set({ [profileKey(cur.owner.nickname)]: cur });
      parked = cur.owner.displayname || cur.owner.nickname;
    }
    const key = profileKey(nickname);
    const saved = (await chrome.storage.local.get(key))[key];
    const next =
      saved && saved.schemaVersion
        ? saved
        : { ...emptyDB(), owner: { nickname, displayname: displayname || null } };
    await chrome.storage.local.set({ [DB_KEY]: next });
    await chrome.storage.local.remove([key, 'account']); // live now; account cache is stale
    return { restored: !!(saved && saved.schemaVersion), parked };
  };

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
    const live = all[DB_KEY];
    if (live && live.owner && live.owner.nickname) out.push(row(live, true));
    for (const [k, v] of Object.entries(all)) {
      if (k.startsWith(PROFILE_PREFIX) && v && v.schemaVersion && v.owner) out.push(row(v, false));
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
    if (!isLive && !existing) await chrome.storage.local.set({ [key]: rec.db });
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
      schemaVersion: SCHEMA_VERSION,
      account: shapeAccountForExport(account, db.owner),
      sources: sanitizeSourcesForExport(db.sources),
      // Scan history rides along so a backup file is a complete restore point.
      history: Array.isArray(db.history) ? db.history : [],
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
  // Returns { ok, db?, error? }.
  OH.importDB = async function importDB(obj) {
    if (!obj || typeof obj !== 'object') return { ok: false, error: 'Not a JSON object.' };
    if (!obj.sources || typeof obj.sources !== 'object') {
      return { ok: false, error: 'Missing "sources" — this is not an Open Hangar export.' };
    }
    if (obj.schemaVersion && obj.schemaVersion > SCHEMA_VERSION) {
      return {
        ok: false,
        error: `Export is schema v${obj.schemaVersion}; this extension supports v${SCHEMA_VERSION}. Update the extension first.`,
      };
    }
    const db = { schemaVersion: SCHEMA_VERSION, sources: {} };
    // History is merged, never replaced: restoring an old backup must not throw
    // away snapshots taken since, and vice versa.
    const current = await OH.loadDB();
    db.history = OH.mergeHistory(current.history, obj.history);
    for (const [id, src] of Object.entries(obj.sources)) {
      // Most sources store an array of items (hangar, buybacks); the referral
      // source stores a single object. Accept either so a full restore round-trips.
      if (src && (Array.isArray(src.items) || (src.items && typeof src.items === 'object'))) {
        // Rows must be objects (a hand-edited or damaged file could hold nulls).
        const items =
          id === 'referral'
            ? OH.normalizeReferral(src.items)
            : src.items.filter((x) => x && typeof x === 'object');
        db.sources[id] = { items, scannedAt: src.scannedAt || null };
        // Extras saved with a scan (e.g. buy-back tokens) survive the round trip.
        if (src.meta && typeof src.meta === 'object' && !Array.isArray(src.meta))
          db.sources[id].meta = src.meta;
      }
    }
    await chrome.storage.local.set({ [DB_KEY]: db });
    await chrome.storage.local.remove(['hangar', 'scannedAt']); // drop legacy keys
    return { ok: true, db };
  };

  // --- Scanning -------------------------------------------------------------

  // A logged-out fetch lands on a sign-in page (redirect to /connect, or HTML
  // with a password field) — distinguish that from a genuinely empty source.
  function looksLoggedOut(res, html) {
    if (res.redirected && /account\/(connect|sign-?in)|\/connect\b/i.test(res.url)) return true;
    return /name=["']password["']|id=["']?password|account\/connect/i.test(html);
  }

  // Fetch one page, retrying only *transient* failures (network error, 5xx, 429)
  // with a small, polite backoff. Auth failures and other 4xx return at once.
  // Returns { res } or { error, transient }.
  const RETRIES = 3;
  const MAX_RETRY_WAIT_MS = 15000;
  async function fetchPage(url, onRetry) {
    let lastError = null;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      if (attempt > 0) {
        await sleep(lastError.wait);
        onRetry?.(attempt, RETRIES, lastError.msg);
      }
      let res;
      try {
        res = await fetch(url, { credentials: 'include' });
      } catch (e) {
        lastError = {
          msg: `Couldn't reach RSI (${e.message})`,
          wait: DELAY_MS * 2 ** (attempt + 1),
        };
        continue;
      }
      if (res.status === 429 || res.status >= 500) {
        const after = Number(res.headers.get('retry-after')) * 1000;
        lastError = {
          msg: `RSI responded ${res.status}`,
          wait: Math.min(after > 0 ? after : DELAY_MS * 2 ** (attempt + 1), MAX_RETRY_WAIT_MS),
        };
        continue;
      }
      return { res };
    }
    return { error: lastError.msg, transient: true };
  }

  // Paginated HTML source: fetch ?page=N&pagesize=…, parse, dedupe by id, stop
  // when a page yields no NEW ids (RSI clamps out-of-range pages to the last).
  // onProgress(page, count, retry?) — retry = { attempt, of } while retrying.
  // If RSI keeps failing mid-scan, returns what was gathered as { items, partial }.
  async function scanHtmlSource(src, onProgress) {
    const seen = new Set();
    const all = [];
    const size = src.pageSize || PAGE_SIZE;
    let meta;
    let lastPage = 0;
    let lastAdded = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `${src.url}?page=${page}&pagesize=${size}`;
      const got = await fetchPage(url, (attempt, of, reason) => {
        OH.log('warn', src.id, `page ${page}: ${reason}, retry ${attempt}/${of}`);
        onProgress?.(page, all.length, { attempt, of });
      });
      if (got.error) {
        if (page === 1) return { error: `${got.error}. Check your connection and try again.` };
        return { items: all, meta, partial: { page, reason: got.error } };
      }
      const res = got.res;
      if (res.status === 401 || res.status === 403) {
        return {
          error: 'RSI rejected the request — your session may have expired. Sign in again.',
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
              'Not signed in to RSI. Open robertsspaceindustries.com, log in, then scan again.',
          };
        }
        // A source can declare how an *intentionally* empty list reads.
        if (src.emptyMarker && src.emptyMarker.test(html)) break; // legitimately empty
        // Signed in but parsed nothing: if the page still carries the data markers,
        // the parser couldn't read them → RSI likely changed their markup.
        if (src.marker && src.marker.test(html)) {
          return {
            error: `Signed in, but couldn't read any ${src.label.toLowerCase()} — RSI may have changed their page markup. See CONTRIBUTING.md ("Rediscovering the data source").`,
          };
        }
        // Sources that need server-rendered HTML but got none (e.g. a client-side
        // SPA shell) say so, rather than silently reporting "empty".
        if (src.requiresRender) {
          return {
            error: `Couldn't read ${src.label.toLowerCase()} — RSI returned no server-rendered content (this page may load via JavaScript). See TODO.md.`,
          };
        }
        break; // logged in, source is genuinely empty
      }
      if (!items.length) break;

      let added = 0;
      items.forEach((it, i) => {
        // Rows without an id (e.g. a buy-back with no reclaim button) get one
        // from their position, so identical copies stay separate.
        if (it.id == null || it.id === '') it.id = `${src.id}-p${page}-${i}`;
      });
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
      await sleep(DELAY_MS);
    }
    // Still finding new items on the last allowed page: the list goes on, so
    // report it as partial (saved without counting the rest as "removed").
    if (lastPage === MAX_PAGES && lastAdded > 0) {
      return { items: all, meta, partial: { page: MAX_PAGES + 1, reason: 'page limit reached' } };
    }
    return { items: all, meta };
  }

  // Scan one source by id and persist it. Returns { ok, items?, scannedAt?, error? }.
  OH.scanSource = async function scanSource(sourceId, onProgress) {
    const src = OH.getSource(sourceId);
    if (!src) return { ok: false, error: `Unknown source: ${sourceId}` };
    if (src.type === 'html' && !(window.OpenHangar && OpenHangar.parsePledges)) {
      return { ok: false, error: 'Parser not loaded on this page.' };
    }
    try {
      let result;
      if (src.type === 'html') result = await scanHtmlSource(src, onProgress);
      else return { ok: false, error: `Source type '${src.type}' is not implemented yet.` };

      if (result.error) {
        OH.log('error', src.id, result.error);
        return { ok: false, error: result.error };
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
            error: `RSI stopped responding at page ${page} (${reason}) — kept your previous scan of ${prevCount}. Try again in a minute.`,
          };
        }
        const scannedAt = await saveSource(src.id, result.items, { meta: result.meta });
        return {
          ok: true,
          items: result.items,
          scannedAt,
          partial: `stopped at page ${page} (${reason}) — rescan to get the rest`,
        };
      }

      // Only complete hangar scans go into the history (a partial one would read
      // as pledges disappearing).
      const scannedAt = await saveSource(src.id, result.items, {
        record: src.id === 'hangar',
        meta: result.meta,
      });
      OH.log('info', src.id, `scan ok, ${result.items.length} items`);
      // A complete buy-back list: drop cached details for ones since reclaimed.
      if (src.id === 'buybacks') await OH.pruneBuybackDetails(result.items.map((b) => b.id));
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
      const res = await fetch(ACCOUNT_URL, { credentials: 'include' });
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
            { credentials: 'omit' },
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
  OH.getReferral = async function getReferral(onProgress) {
    try {
      // Code/url come free from the account fetch (already cached/fetched there).
      const acct = await OH.getAccount();
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

      const scannedAt = await saveSource('referral', referral);
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

  // --- Star Citizen game version (public star-citizen.wiki API) -------------
  // Public, read-only endpoint; we send NO credentials and no personal data.
  const SC_VERSIONS_URL = 'https://api.star-citizen.wiki/api/v2/game-versions';
  const SC_TTL_MS = 12 * 60 * 60 * 1000; // refresh at most twice a day

  // "4.8.0-LIVE.11875683" → "4.8.0-LIVE" (drop the trailing build number).
  OH.formatScVersion = (code) => (code ? code.replace(/\.\d+$/, '') : '');

  // Current default (LIVE) game version as { code, fetchedAt }. Cached in storage;
  // returns the cached value (or { code: null }) on any failure. Never throws.
  OH.getScVersion = async function getScVersion({ force = false } = {}) {
    const { scVersion } = await chrome.storage.local.get('scVersion');
    if (!force && scVersion?.code && Date.now() - scVersion.fetchedAt < SC_TTL_MS) return scVersion;
    try {
      const res = await fetch(SC_VERSIONS_URL, {
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const list = Array.isArray(json.data) ? json.data : [];
      const current = list.find((v) => v.is_default) || list[0];
      const code = current?.code || null;
      if (!code) throw new Error('no version in response');
      const v = { code, fetchedAt: Date.now() };
      await chrome.storage.local.set({ scVersion: v });
      return v;
    } catch (e) {
      return scVersion || { code: null, fetchedAt: 0, error: String(e?.message || e) };
    }
  };

  // --- Ship images ----------------------------------------------------------
  // RSI ships some items (notably CCUs) with no art — a generic "DEFAULT IMAGE".
  // We resolve the real ship image from two public, read-only sources (NO
  // credentials/PII), matching RSI's loose names LOCALLY where we control the fuzz:
  //
  //   1. RSI ship-matrix (PRIMARY) — robertsspaceindustries.com/ship-matrix/index.
  //      One fetch returns ALL ships *with* images, including in-concept ships the
  //      wiki lacks (e.g. Vulcan, Genesis, Odin). We cache a slim {name → image}.
  //   2. star-citizen.wiki (FALLBACK) — for anything the ship-matrix misses; needs
  //      a catalog fetch + a per-slug image fetch.
  //
  // Images don't change → hard-cached in storage; negatives cached too. Callers
  // MUST resolve lazily (only for shown cards) — see enhanceCardImages.
  const SC_API = 'https://api.star-citizen.wiki/api/v2';
  const SHIP_MATRIX_URL = 'https://robertsspaceindustries.com/ship-matrix/index';
  const SHIP_IMG_TTL = 90 * 24 * 60 * 60 * 1000; // 90 days (images don't change)
  const CATALOG_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
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
  let catalogMem = null; // [{ lname, slug, cls, msrp }]  (wiki)
  const CATALOG_CACHE_V = 6; // v2: class + msrp, all pages · v3: fleet fields · v4: display name · v5: + ship matrix (concept ships) · v6: manufacturer
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
        const res = await fetch(SHIP_MATRIX_URL, {
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
      role: en(v.foci && v.foci[0]) || v.role || null,
      size: en(v.size) || null,
      status: en(v.production_status) || null, // flight-ready | in-concept | …
      crew: (v.crew && Number(v.crew.max)) || null,
      cargo: Number(v.cargo_capacity) || 0, // SCU
      mfr: (v.manufacturer && v.manufacturer.name) || null,
    };
  };

  // Walk one paged wiki endpoint and return every record's slim entry. The
  // API serves 50 per page whatever we ask for, so walk until last_page.
  async function fetchAllPages(path, fetchFn) {
    const list = [];
    for (let page = 1; page <= 12; page++) {
      const res = await fetchFn(`${SC_API}/${path}?page%5Bsize%5D=200&page%5Bnumber%5D=${page}`, {
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      });
      // A failed page means an incomplete list: throw, so nobody caches it
      // (getCatalog keeps the previous or bundled list instead).
      if (!res.ok) throw new Error(`${path} page ${page}: HTTP ${res.status}`);
      const json = await res.json();
      const data = Array.isArray(json.data) ? json.data : [];
      for (const v of data) {
        const slim = OH.slimVehicle(v);
        if (slim) list.push(slim);
      }
      const last =
        (json.meta && json.meta.last_page) || (json.links && json.links.next ? page + 1 : page);
      if (!data.length || page >= last) break;
    }
    return list;
  }

  // The whole ship list, slimmed. `vehicles` is what's in the game files
  // (flight-ready ships, ground vehicles); `shipmatrix` is RSI's ship matrix,
  // which adds concept ships (Pioneer, Odyssey, …) and fills prices/status the
  // first list lacks. Merged by slug, then name; the game-file entry wins,
  // and only not-yet-flyable ships are added from the matrix.
  OH.fetchShipCatalog = async function fetchShipCatalog(fetchFn = fetch) {
    // Both halves or nothing: without the matrix, concept ships and many prices
    // would be missing from a list that's then cached for 30 days.
    const list = await fetchAllPages('vehicles', fetchFn);
    const matrix = await fetchAllPages('shipmatrix/vehicles', fetchFn);
    return OH.mergeCatalogs(list, matrix);
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
    return out;
  };

  // The ship list that ships inside the extension (src/data/ship-catalog.json,
  // refreshed weekly by a GitHub Action), or null.
  async function bundledCatalog() {
    try {
      const res = await fetch(chrome.runtime.getURL('src/data/ship-catalog.json'));
      const json = res.ok ? await res.json() : null;
      return json && Array.isArray(json.list) && json.list.length ? json.list : null;
    } catch {
      return null;
    }
  }

  // The full wiki vehicle catalog, cached slim for CATALOG_TTL. On a cold cache
  // the bundled snapshot answers straight away (prices show instantly, and
  // offline) while the live list downloads in the background for next time.
  async function getCatalog() {
    if (catalogMem) return catalogMem;
    const cached = (await chrome.storage.local.get('shipCatalog')).shipCatalog;
    if (
      cached &&
      cached.v === CATALOG_CACHE_V &&
      cached.at &&
      Date.now() - cached.at < CATALOG_TTL &&
      Array.isArray(cached.list)
    ) {
      catalogMem = cached.list;
      return catalogMem;
    }
    if (catalogInflight) return catalogInflight;
    const refresh = (async () => {
      let list = [];
      try {
        list = await OH.fetchShipCatalog();
      } catch (e) {
        /* offline: fall back to the bundled snapshot (below) */
        OH.log('warn', 'catalog', `ship catalog download failed: ${e?.message || e}`);
      }
      if (list.length) {
        catalogMem = list;
        try {
          await chrome.storage.local.set({
            shipCatalog: { v: CATALOG_CACHE_V, at: Date.now(), list },
          });
        } catch {}
      }
      catalogInflight = null;
      return list.length ? list : catalogMem || [];
    })();
    catalogInflight = refresh;
    const bundled = await bundledCatalog();
    if (catalogMem) return catalogMem; // the live list already landed
    if (bundled) {
      catalogMem = bundled; // answer now; `refresh` replaces it when it lands
      return bundled;
    }
    return refresh;
  }

  // Score how well a catalog entry's (lowercased) name matches the query. 0 = no
  // match. Higher = better. Shared by both sources so fuzz rules stay consistent.
  function nameScore(n, q) {
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

  // Rank wiki catalog entries against a raw RSI name; return up to 3 slugs.
  function matchSlugs(catalog, rawName) {
    const q = OH.normShipName(rawName).toLowerCase();
    if (!q || !catalog.length) return [];
    const scored = [];
    for (const v of catalog) {
      const s = nameScore(v.lname, q);
      if (s) scored.push({ slug: v.slug, score: s });
    }
    scored.sort((a, b) => b.score - a.score);
    const out = [];
    const seen = new Set();
    for (const s of scored) {
      if (seen.has(s.slug)) continue;
      seen.add(s.slug);
      out.push(s.slug);
      if (out.length >= 3) break;
    }
    return out;
  }

  // Fetch a single vehicle's store image by slug (exact, reliable). ~600px webp.
  async function fetchVehicleImage(slug) {
    try {
      const res = await fetch(`${SC_API}/vehicles/${encodeURIComponent(slug)}?include=images`, {
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return null;
      const json = await res.json();
      const v = Array.isArray(json.data) ? json.data[0] : json.data;
      const imgs = v && v.images;
      if (Array.isArray(imgs) && imgs.length)
        return imgs[0].thumbnail_url || imgs[0].original_url || null;
    } catch {
      /* ignore — caller caches a negative */
    }
    return null;
  }

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
        // 2) Fallback: star-citizen.wiki (catalog match → per-slug image fetch).
        if (!url) {
          const catalog = await getCatalog();
          for (const slug of matchSlugs(catalog, rawName)) {
            url = await fetchVehicleImage(slug);
            if (url) break; // first candidate with art wins
          }
        }
        shipImgMem.set(key, url);
        await mutateStored('shipImages', (cur = {}) => {
          const out = pruneTimed(cur, (e) => (e.url ? SHIP_IMG_TTL : 24 * 3600e3));
          out[key] = { url, at: Date.now() };
          return out;
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
  // The star-citizen.wiki vehicle list carries each ship's `msrp` (current USD
  // store price), so pricing a whole hangar costs the same ~6 cached catalog
  // requests as the image lookup — nothing per ship. Concept ships the wiki has
  // no price for stay unpriced (the UI says how many).

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

  // Live resolvers backed by the cached wiki catalog. Offline, they just return
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

  // Melt candidates: pledges you could melt and buy back for the same store
  // credit — meltable, no LTI, nothing but ships inside (no paints, gear or game
  // access to lose), and paid at or above the ships' current store price. RSI
  // doesn't say whether a ship is on sale right now, so the UI says to check.
  // `info` is the pledge's OH.hangarValue entry. Pure.
  const GAME_RE = /\b(star citizen|squadron 42)\b.*\b(digital|download|game|package)\b/i;
  OH.isMeltCandidate = function isMeltCandidate(p, info) {
    if (!p || p.meltable !== true || p.insurance === 'LTI' || p.isCCU) return false;
    if (!info || info.ccu || info.unpriced || !info.store || !(info.paid > 0)) return false;
    if (/^package\b/i.test(p.name || '') || /warbond/i.test(p.name || '')) return false;
    const extras = (p.contents || []).filter(
      (c) => !/^(ship|insurance)$/i.test((c.kind || '').trim()) || GAME_RE.test(c.label || ''),
    );
    return !extras.length && info.paid >= info.store - 0.5;
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
    if (all[id]) return all[id];
    if (!/^\d+$/.test(String(id))) return { error: 'No RSI page for this buy-back.' };
    const got = await fetchPage(`https://robertsspaceindustries.com/pledge/buyback/${id}`);
    if (got.error) return { error: got.error };
    if (!got.res.ok) return { error: `RSI responded ${got.res.status}.` };
    const html = await got.res.text();
    const d = window.OpenHangar.parseBuybackDetail(html);
    if (!d || d.price == null) {
      return looksLoggedOut(got.res, html)
        ? { error: 'Not signed in to RSI.' }
        : { error: "Couldn't read this buy-back's page." };
    }
    all[id] = { ...d, at: Date.now() };
    saveBuybackDetails();
    return all[id];
  };
  // Read many, politely (one at a time, RSI's usual delay between). onProgress
  // (done, total); stop by returning false from shouldGo(). → { done, errors }.
  OH.fetchBuybackDetails = async function fetchBuybackDetails(
    ids,
    onProgress,
    shouldGo = () => true,
  ) {
    const all = await OH.getBuybackDetails();
    const todo = ids.filter((id) => !all[id] && /^\d+$/.test(String(id)));
    let done = 0;
    let errors = 0;
    for (const id of todo) {
      if (!shouldGo()) break;
      const r = await OH.fetchBuybackDetail(id);
      if (r.error) {
        errors++;
        if (/signed in/i.test(r.error)) break;
      }
      done++;
      onProgress?.(done, todo.length);
      await sleep(DELAY_MS);
    }
    return { done, errors, total: todo.length };
  };

  // --- openhangar.space (optional sync) -------------------------------------------
  // Nothing leaves the browser unless the user connects AND presses Sync now.
  // Connecting uses a device code: the site confirms it while signed in, then
  // hands this extension a sync token (stored in `siteLink`).
  const SITE_DEFAULT = 'https://app.openhangar.space';
  OH.siteUrl = async function siteUrl() {
    const { siteUrl } = await chrome.storage.local.get('siteUrl'); // dev override
    return (siteUrl || SITE_DEFAULT).replace(/\/+$/, '');
  };
  // Off for everyone until app.openhangar.space launches; on only when a
  // developer sets `siteUrl` (local testing).
  OH.siteEnabled = async function siteEnabled() {
    const { siteUrl } = await chrome.storage.local.get('siteUrl');
    return Boolean(siteUrl);
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
  // Upload the same payload as the JSON backup. → { synced_at } or throws.
  OH.siteSync = async function siteSync() {
    const link = await OH.getSiteLink();
    if (!link) throw new Error('Not connected to openhangar.space.');
    const res = await siteFetch('/api/sync', {
      method: 'POST',
      headers: { authorization: `Bearer ${link.token}` },
      body: JSON.stringify(await OH.exportDB()),
    });
    if (res.status === 401) {
      await chrome.storage.local.remove('siteLink');
      throw new Error('This extension was disconnected on the website. Connect again.');
    }
    if (!res.ok) throw new Error(`openhangar.space responded ${res.status}`);
    const j = await res.json();
    await chrome.storage.local.set({ siteLink: { ...link, lastSync: j.synced_at } });
    return j;
  };
  OH.siteDisconnect = async function siteDisconnect() {
    const link = await OH.getSiteLink();
    if (link) {
      await siteFetch('/api/sync', {
        method: 'DELETE',
        headers: { authorization: `Bearer ${link.token}` },
      }).catch(() => null);
    }
    await chrome.storage.local.remove('siteLink');
  };

  // --- Display currency -----------------------------------------------------------
  // RSI prices everything in USD. Users can view amounts in one of a few big
  // currencies, converted at the day's rate (before tax). Rates are the ECB's,
  // via Frankfurter (api.frankfurter.dev: public, no key, CORS open), fetched
  // at most once a day and cached. Nothing about the user is sent.
  // Every one must be in the ECB set Frankfurter serves (no UAH / RUB there).
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

  // --- Referral bonus events (starcitizen.tools) ---------------------------------
  // The wiki's "Special Incentive Events" table: one row per event with start,
  // end, name and the rewards. Returns [{ start, end, name, reward }] where
  // `reward` is what the referrer ("You") gets, as plain text.
  function wikiPlain(s) {
    return String(s || '')
      .replace(/<ref[^>]*\/>/gi, '')
      .replace(/<ref[\s\S]*?<\/ref>/gi, '')
      .replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '')
      .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
      .replace(/\[\[([^\]]*)\]\]/g, '$1')
      .replace(/\{\{[\s\S]*?\}\}/g, '')
      .replace(/'{2,}/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/�/g, '"')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }
  OH.parseReferralEvents = function parseReferralEvents(wikitext) {
    const out = [];
    for (const row of String(wikitext || '').split(/\n\|-[^\n]*\n/)) {
      const cells = ('\n' + row)
        .split(/\n\|(?![-}+])/)
        .slice(1)
        .map((c) => c.replace(/\n\|\}[\s\S]*$/, ''));
      if (cells.length < 6) continue;
      const [start, end, name] = cells.map((c) => wikiPlain(c));
      const file = (cells[4].match(/\[\[(?:File|Image):([^|\]]+)/i) || [])[1];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) continue;
      let reward = wikiPlain(cells.slice(5).join('\n'));
      // Newer rows list "You:" and "Referral:" rewards; keep what the referrer gets.
      const you = reward.match(/You:?\s*([\s\S]*?)(?:\n\s*Referral\b|$)/i);
      if (you) reward = you[1];
      reward = reward
        .split('\n')
        .map((l) => l.replace(/^\s*\*\s*/, '').trim())
        .filter(Boolean)
        .join(', ')
        .replace(/^(The|A|An)\s+/i, '')
        .replace(/\.$/, '');
      if (name && reward) out.push({ start, end, name, reward, image: file ? file.trim() : '' });
    }
    return out;
  };
  // Wiki file names ("Referral Pulse.jpg") → 400px image URLs on
  // media.starcitizen.tools, 50 per request, cached a month. → { file: url }.
  const WIKI_FILES_KEY = 'wikiFiles';
  const WIKI_FILES_TTL = 30 * 24 * 3600e3;
  const wikiTitle = (f) => {
    const t = String(f).replace(/_/g, ' ').trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  OH.wikiImageUrls = async function wikiImageUrls(files, fetchFn = fetch) {
    const want = [...new Set(files.filter(Boolean))];
    const { [WIKI_FILES_KEY]: cache = {} } = await chrome.storage.local.get(WIKI_FILES_KEY);
    // Found pictures keep a month; "no such file" answers only a day.
    const ttl = (e) => (e.url ? WIKI_FILES_TTL : 24 * 3600e3);
    const out = {};
    const missing = [];
    for (const f of want) {
      const hit = cache[f];
      if (hit && Date.now() - hit.at < ttl(hit)) {
        if (hit.url) out[f] = hit.url;
      } else missing.push(f);
    }
    const fresh = {};
    for (let i = 0; i < missing.length; i += 50) {
      const batch = missing.slice(i, i + 50);
      try {
        const titles = batch.map((f) => 'File:' + wikiTitle(f)).join('|');
        const res = await fetchFn(
          `https://starcitizen.tools/api.php?action=query&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*&titles=${encodeURIComponent(titles)}`,
          { credentials: 'omit', headers: { Accept: 'application/json' } },
        );
        const json = res.ok ? await res.json() : null;
        const pages = json && json.query && json.query.pages;
        if (!pages) continue; // a failed request caches nothing; retried next time
        const byTitle = {};
        for (const pg of Object.values(pages)) {
          const info = pg.imageinfo && pg.imageinfo[0];
          if (info) byTitle[pg.title] = info.thumburl || info.url;
        }
        for (const f of batch) {
          const url = byTitle['File:' + wikiTitle(f)] || null;
          fresh[f] = { url, at: Date.now() };
          if (url) out[f] = url;
        }
      } catch (e) {
        OH.log('warn', 'referral', `wiki images failed: ${e?.message || e}`);
      }
    }
    if (Object.keys(fresh).length) {
      await mutateStored(WIKI_FILES_KEY, (cur = {}) => ({
        ...pruneTimed(cur, ttl),
        ...fresh,
      })).catch(() => {
        /* storage full: this session still has the URLs */
      });
    }
    return out;
  };

  const REF_EVENTS_KEY = 'referralEvents';
  const REF_EVENTS_TTL = 7 * 24 * 3600e3;
  // Cached for a week; null when it can't be fetched (callers keep their list).
  OH.getReferralEvents = async function getReferralEvents(fetchFn = fetch) {
    const { [REF_EVENTS_KEY]: cached } = await chrome.storage.local.get(REF_EVENTS_KEY);
    if (cached && Date.now() - cached.at < REF_EVENTS_TTL) return cached.events;
    try {
      const res = await fetchFn(
        'https://starcitizen.tools/api.php?action=parse&page=Referral_program&prop=wikitext&section=5&format=json&origin=*',
        { credentials: 'omit', headers: { Accept: 'application/json' } },
      );
      const json = res.ok ? await res.json() : null;
      const events = OH.parseReferralEvents(json?.parse?.wikitext?.['*']);
      if (events.length) {
        await chrome.storage.local.set({ [REF_EVENTS_KEY]: { at: Date.now(), events } });
        return events;
      }
    } catch (e) {
      OH.log('warn', 'referral', `event list download failed: ${e?.message || e}`);
    }
    return cached ? cached.events : null;
  };

  const FX_KEY = 'fxRates';
  const FX_TTL = 24 * 3600e3;
  OH.getFxRates = async function getFxRates(fetchFn = fetch) {
    const want = OH.CURRENCIES.filter((c) => c !== 'USD').join(',');
    const { [FX_KEY]: cached } = await chrome.storage.local.get(FX_KEY);
    // A cache saved before a currency was added doesn't count (it lacks its rate).
    const fits = cached && (cached.want == null ? false : cached.want === want);
    if (fits && cached.rates && Date.now() - cached.at < FX_TTL) return cached;
    try {
      const res = await fetchFn(`https://api.frankfurter.dev/v1/latest?base=USD&symbols=${want}`, {
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      });
      const json = res.ok ? await res.json() : null;
      if (json && json.rates) {
        const fresh = {
          at: Date.now(),
          want,
          date: json.date || null,
          rates: { USD: 1, ...json.rates },
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
    { key: 'refining', label: 'Refining', re: /refinery/i },
    { key: 'medical', label: 'Medical', re: /medical/i },
    { key: 'refuel', label: 'Refueling', re: /refuel/i },
    { key: 'repair', label: 'Repair', re: /repair/i },
    { key: 'explore', label: 'Exploration', re: /pathfinder|expedition/i },
    { key: 'science', label: 'Science / data', re: /science|data/i },
    { key: 'dropship', label: 'Troop transport', re: /dropship|boarding/i },
    { key: 'interdiction', label: 'Interdiction', re: /interdiction/i },
    { key: 'bomber', label: 'Bombers', re: /bomber/i },
    { key: 'capital', label: 'Capital warships', re: /frigate|corvette|destroyer|battlecruiser/i },
    { key: 'carrier', label: 'Carriers', re: /carrier/i },
    { key: 'passenger', label: 'Passengers', re: /passenger|touring/i },
    { key: 'construction', label: 'Construction', re: /construction/i },
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
    const roles = OH.ORG_ROLES.map((r) => {
      const hits = ships.filter((sh) => sh.role && r.re.test(sh.role));
      return {
        key: r.key,
        label: r.label,
        count: hits.reduce((n, sh) => n + sh.count, 0),
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
  // since last time and chart melt value over time. Stays in this browser; it is
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
  OH.snapshotOf = function snapshotOf(items, at) {
    return {
      at,
      items: (items || []).map((p) => [
        String(p.id ?? ''),
        p.name || '',
        Number.isFinite(p.value) ? p.value : 0,
      ]),
    };
  };
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
  function recordHistory(db, prevHangar, items, at) {
    const hist = Array.isArray(db.history) ? db.history : [];
    if (!hist.length && prevHangar && Array.isArray(prevHangar.items) && prevHangar.items.length) {
      hist.push(OH.snapshotOf(prevHangar.items, prevHangar.scannedAt || at - 1));
    }
    const snap = OH.snapshotOf(items, at);
    const last = hist[hist.length - 1];
    const d = last && OH.diffSnapshots(last, snap);
    if (d && !d.added.length && !d.removed.length && !d.changed.length) last.checkedAt = at;
    else hist.push(snap);
    db.history = OH.trimHistory(hist);
  }

  // Keep only well-formed snapshots ({ at, items: [[id, name, value]] }).
  function cleanSnapshot(x) {
    if (!x || !Number.isFinite(x.at) || !Array.isArray(x.items)) return null;
    const items = x.items
      .filter((r) => Array.isArray(r) && r.length >= 3)
      .map((r) => [String(r[0]), String(r[1]), Number(r[2]) || 0]);
    const out = { at: x.at, items };
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
      if (d && !d.added.length && !d.removed.length && !d.changed.length) {
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
