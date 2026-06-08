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
 *     sources: { hangar, buybacks } }
 * See OH.exportDB. Schema v2 added the `account` block (v1 had sources only).
 */

(function () {
  const OH = (window.OH = window.OH || {});

  const PAGE_SIZE = 10;
  const DELAY_MS = 400; // politeness throttle between pages
  const MAX_PAGES = 200; // safety cap
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
    },
    // { id: 'store', label: 'Store', type: 'api', … }  ← see ROADMAP.md
  ];

  OH.getSource = (id) => OH.SOURCES.find((s) => s.id === id) || null;

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

  async function saveSource(id, items) {
    const db = await OH.loadDB();
    const scannedAt = Date.now();
    db.sources[id] = { items, scannedAt };
    // Stamp which RSI account this data belongs to, so the UI can detect when a
    // different account signs in later and clear the stale data (multi-account
    // safety). Best-effort: if we can't read the account, leave owner untouched.
    try {
      const acct = await OH.getAccount();
      if (acct && acct.loggedIn && acct.nickname) {
        db.owner = { nickname: acct.nickname, displayname: acct.displayname || null };
      }
    } catch {
      /* owner stamp is optional */
    }
    await chrome.storage.local.set({ [DB_KEY]: db });
    await chrome.storage.local.remove(['hangar', 'scannedAt']); // drop legacy keys
    return scannedAt;
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
    await chrome.storage.local.remove([DB_KEY, 'hangar', 'scannedAt', 'account', RECOVERY_KEY]);
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
    for (const [id, src] of Object.entries(obj.sources)) {
      // Most sources store an array of items (hangar, buybacks); the referral
      // source stores a single object. Accept either so a full restore round-trips.
      if (src && (Array.isArray(src.items) || (src.items && typeof src.items === 'object'))) {
        db.sources[id] = { items: src.items, scannedAt: src.scannedAt || null };
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

  // Paginated HTML source: fetch ?page=N&pagesize=…, parse, dedupe by id, stop
  // when a page yields no NEW ids (RSI clamps out-of-range pages to the last).
  async function scanHtmlSource(src, onProgress) {
    const seen = new Set();
    const all = [];
    const size = src.pageSize || PAGE_SIZE;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `${src.url}?page=${page}&pagesize=${size}`;
      let res;
      try {
        res = await fetch(url, { credentials: 'include' });
      } catch (e) {
        return { error: `Couldn't reach RSI (${e.message}). Check your connection.` };
      }
      if (res.status === 401 || res.status === 403) {
        return {
          error: 'RSI rejected the request — your session may have expired. Sign in again.',
        };
      }
      if (!res.ok) return { error: `RSI responded ${res.status} on page ${page}.` };

      const html = await res.text();
      const items = src.parse(html);

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
      for (const it of items) {
        const key = it.id ?? `${it.name}:${it.value}`;
        if (seen.has(key)) continue;
        seen.add(key);
        all.push(it);
        added++;
      }
      onProgress?.(page, all.length);
      if (added === 0) break;
      await sleep(DELAY_MS);
    }
    return { items: all };
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

      if (result.error) return { ok: false, error: result.error };
      const scannedAt = await saveSource(src.id, result.items);
      return { ok: true, items: result.items, scannedAt };
    } catch (err) {
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
      if (res.error) return page === 1 ? { error: res.error } : { count, items }; // keep partial after page 1
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

      // Merge recruit lists: tag current ids, then mark legacy-only rows.
      const currentIds = new Set((currentRecruits.items || []).map((r) => r.id));
      const recruitsList = (legacyRecruits.items || []).map((r) => ({
        ...r,
        campaign: currentIds.has(r.id) ? 'current' : 'legacy',
      }));

      const referral = {
        code,
        url,
        current: { recruits: currentRecruits.count ?? null },
        legacy: { recruits: legacyRecruits.count ?? null },
        prospects: prospects.count ?? null,
        recruitsList,
        prospectsList: prospects.items || [],
      };

      const scannedAt = await saveSource('referral', referral);
      return { ok: true, referral, scannedAt };
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
  let catalogMem = null; // [{ lname, slug }]  (wiki)
  let catalogInflight = null;
  let matrixMem = null; // [{ lname, img }]  (RSI ship-matrix)
  let matrixInflight = null;

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

  // RSI ship-matrix → slim [{ lname, img }] for every ship, fetched once and
  // cached. The index is large (~5MB) but we keep only name+image (~25KB).
  async function getShipMatrix() {
    if (matrixMem) return matrixMem;
    const cached = (await chrome.storage.local.get('shipMatrix')).shipMatrix;
    if (cached && cached.at && Date.now() - cached.at < CATALOG_TTL && Array.isArray(cached.list)) {
      matrixMem = cached.list;
      return matrixMem;
    }
    if (matrixInflight) return matrixInflight;
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
            if (url) list.push({ lname: String(s.name).toLowerCase(), img: url });
          }
        }
      } catch {
        /* offline — fall through to the wiki source */
      }
      if (list.length) {
        matrixMem = list;
        try {
          await chrome.storage.local.set({ shipMatrix: { at: Date.now(), list } });
        } catch {}
      }
      matrixInflight = null;
      return list;
    })();
    return matrixInflight;
  }

  // The full wiki vehicle catalog (name + slug), fetched once and cached slim.
  async function getCatalog() {
    if (catalogMem) return catalogMem;
    const cached = (await chrome.storage.local.get('shipCatalog')).shipCatalog;
    if (cached && cached.at && Date.now() - cached.at < CATALOG_TTL && Array.isArray(cached.list)) {
      catalogMem = cached.list;
      return catalogMem;
    }
    if (catalogInflight) return catalogInflight;
    catalogInflight = (async () => {
      const list = [];
      try {
        // The API caps page size at 200, so walk every page (≈288 vehicles → 2).
        for (let page = 1; page <= 5; page++) {
          const res = await fetch(
            `${SC_API}/vehicles?page%5Bsize%5D=200&page%5Bnumber%5D=${page}`,
            { credentials: 'omit', headers: { Accept: 'application/json' } },
          );
          if (!res.ok) break;
          const json = await res.json();
          const data = Array.isArray(json.data) ? json.data : [];
          for (const v of data) {
            if (v && v.name && v.slug)
              list.push({ lname: String(v.name).toLowerCase(), slug: v.slug });
          }
          const last =
            (json.meta && json.meta.last_page) || (json.links && json.links.next ? page + 1 : page);
          if (!data.length || page >= last) break;
        }
      } catch {
        /* offline — leave catalog empty; getShipImage just returns null */
      }
      if (list.length) {
        catalogMem = list;
        try {
          await chrome.storage.local.set({ shipCatalog: { at: Date.now(), list } });
        } catch {}
      }
      catalogInflight = null;
      return list;
    })();
    return catalogInflight;
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
    if (hit && Date.now() - hit.at < SHIP_IMG_TTL) {
      shipImgMem.set(key, hit.url);
      return hit.url;
    }
    if (shipImgInflight.has(key)) return shipImgInflight.get(key);

    const promise = (async () => {
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
      try {
        const cur = (await chrome.storage.local.get('shipImages')).shipImages || {};
        cur[key] = { url, at: Date.now() };
        await chrome.storage.local.set({ shipImages: cur });
      } catch {
        /* storage full / unavailable — memory cache still applies */
      }
      shipImgInflight.delete(key);
      return url;
    })();
    shipImgInflight.set(key, promise);
    return promise;
  };

  // --- Ship price (DEFERRED FOUNDATION — see ROADMAP "Store Data") -----------
  // The star-citizen.wiki per-vehicle record also carries `msrp` (USD pledge
  // price) and `pledge_url`. We expose a name→price resolver now (same lazy,
  // cached, locally-matched approach as images) so the future Store Data /
  // pricing features can build on it. The RSI ship-matrix has NO prices, so this
  // uses the wiki only. NOT yet surfaced in the UI.
  const shipPriceMem = new Map(); // key -> { msrp, pledgeUrl } | null

  // Resolve { msrp, pledgeUrl } for a raw RSI ship name, or null. Never throws.
  OH.getShipPrice = async function getShipPrice(rawName) {
    const key = OH.normShipName(rawName).toLowerCase();
    if (!key) return null;
    if (shipPriceMem.has(key)) return shipPriceMem.get(key);

    const hit = ((await chrome.storage.local.get('shipPrices')).shipPrices || {})[key];
    if (hit && Date.now() - hit.at < CATALOG_TTL) {
      shipPriceMem.set(key, hit.price);
      return hit.price;
    }

    let price = null;
    try {
      const catalog = await getCatalog();
      for (const slug of matchSlugs(catalog, rawName)) {
        const res = await fetch(`${SC_API}/vehicles/${encodeURIComponent(slug)}`, {
          credentials: 'omit',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) continue;
        const json = await res.json();
        const v = Array.isArray(json.data) ? json.data[0] : json.data;
        const msrp = v && Number(v.msrp);
        if (msrp) {
          price = { msrp, pledgeUrl: v.pledge_url || null };
          break;
        }
      }
    } catch {
      /* leave price null */
    }
    shipPriceMem.set(key, price);
    try {
      const cur = (await chrome.storage.local.get('shipPrices')).shipPrices || {};
      cur[key] = { price, at: Date.now() };
      await chrome.storage.local.set({ shipPrices: cur });
    } catch {
      /* storage unavailable — memory cache still applies */
    }
    return price;
  };
})();
