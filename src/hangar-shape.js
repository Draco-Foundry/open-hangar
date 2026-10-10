/*
 * hangar-shape.js — the backup file, the sync payload and the stored hangar, shaped
 * in one place (#441).
 * ---------------------------------------------------------------------------
 * Pure code, no requests and no writes, so every part of the extension that hands
 * out the account's data uses the same shaping:
 *   - the dashboard (loaded before lib.js, whose OH.exportDB, OH.syncPayload,
 *     OH.leanArchive and OH.checkDB are these), for the backup file and sync;
 *   - the background worker (importScripts) and Firefox's event page (its manifest's
 *     background.scripts, scripts/pack.mjs), which can't load lib.js (it needs a
 *     page), for the hangar view our own hangar page reads;
 *   - node tests (require).
 * Exposes self.OHShape.
 *
 * The backup file (exportPayload, format EXPORT_VERSION):
 *   { app, appVersion, exportedAt, schemaVersion, account, sources, history, pledgeArchive }
 * The sync payload: the same without the referral prospects list (withoutProspects).
 * The hangar view (hangarView): the "stored shape", what the website keeps for a
 * synced hangar: the sync payload without history, with no referral code anywhere
 * and the pledge archive capped at ARCHIVE_MAX. schema/sync-payload.schema.json
 * describes all three (src/schema-check.js checks them).
 */
(function (root) {
  // Two version numbers (they were one, 2, until storage v3):
  //   DB_VERSION is how the database is stored in this browser. Changing that
  //   shape needs a MIGRATIONS step (src/lib.js, the Storage section).
  //     v1 → v2: unchanged (only the export gained `account`)
  //     v2 → v3: scan history moved out of `db` into its own key
  //   EXPORT_VERSION is the backup-file format (OH.exportDB / OH.importDB).
  //     v2 added the `account` block (identity, org/rank, balances); v1 had
  //     sources only. Keeping it at 2 lets older versions import new backups.
  const DB_VERSION = 3;
  const EXPORT_VERSION = 2;
  // Pledges kept in the pledge archive (src/lib.js archiveGone), and in the hangar
  // view's copy of it.
  const ARCHIVE_MAX = 2000;
  const DB_KEY = 'db';
  const ARCHIVE_KEY = 'pledgeArchive';

  const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  const okTime = (t) =>
    Number.isFinite(t) || (typeof t === 'string' && t !== '' && !isNaN(Date.parse(t)));
  const emptyDB = () => ({ schemaVersion: DB_VERSION, sources: {} });

  // Raw stored DB → { db, problems }. `db` always has the shape the rest of the
  // extension relies on; `problems` says what had to be dropped (empty = it was
  // fine). History embedded in the DB (before v3, or written by an older version
  // after a rollback) comes back as db.history. Pure.
  function checkDB(raw) {
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

  // Flatten the internal cached `account` (getAccount's shape) into a clean,
  // stable identity block for export — renamed/reordered so a backend reading the
  // file sees WHO the data belongs to before WHAT they own. `owner` (set on scan)
  // is the fallback for handle/displayName when the live account isn't cached or
  // the user is signed out. Returns null only when we know nothing about the user.
  // NOTE: balances.storeCredit.value is in CENTS (e.g. 1234 = $12.34); uec/rec are
  // whole-number game currencies. Values pass through exactly as RSI reports them.
  function shapeAccount(account, owner) {
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
      // still export; only code/url are stripped (see sanitizeSources).
      capturedAt: a?.fetchedAt || null, // when this identity snapshot was read
    };
  }

  // Strip the referral CODE/URL from the exported referral source — the user's
  // personal referral credential is kept out of export files (counts + recruit/
  // prospect lists still export). Returns a shallow copy; never mutates the stored
  // DB. Other sources pass through untouched.
  function sanitizeSources(sources) {
    if (!sources || typeof sources !== 'object') return sources;
    const ref = sources.referral;
    if (!ref || !ref.items || typeof ref.items !== 'object' || Array.isArray(ref.items))
      return sources;
    const { code, url, ...rest } = ref.items; // drop code + url (url embeds the code)
    return { ...sources, referral: { ...ref, items: rest } };
  }

  // What sync sends: the backup file's payload without the referral prospects list.
  // Prospects are other players (handles, monikers, enlist dates) who used your code but
  // aren't recruits yet, so they stay in this browser; the backup file keeps them, and
  // the prospects count still goes. Returns a copy, never changes `payload`. Pure.
  function withoutProspects(payload) {
    const ref = payload?.sources?.referral;
    if (!isObj(ref) || !isObj(ref.items) || !('prospectsList' in ref.items)) return payload;
    const { prospectsList, ...items } = ref.items;
    return { ...payload, sources: { ...payload.sources, referral: { ...ref, items } } };
  }

  // The archive as the backup file (and so sync) carries it (#388): only what
  // buy-back details read (name, value, currency, insurance, ccu, contents' kind
  // and label) plus the date, kind and goneAt. Left out: the flags (isCCU,
  // isAddOn, giftable…, worked out again from the kind and name) and every image
  // URL (the details window never shows them; the buy-back card has its own
  // picture). The images were about 40% of a big archive. Also cleans a
  // hand-edited file's entries on import. Pure.
  function leanArchive(archive) {
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
  }

  // The whole database as a self-describing JSON object (the backup file), ordered
  // the way a backend reads it: provenance → who (identity, org, rank, balances) →
  // what they own (sources). `db` as lib.js's loadDB (or checkDB) returns it,
  // `account` the cached RSI account (cache only, so this works offline), `archive`
  // the stored pledge archive. ALWAYS the current format (EXPORT_VERSION),
  // whatever the stored DB's version. Pure.
  function exportPayload({ db, account = null, archive = null, appVersion = null, now } = {}) {
    return {
      app: 'open-hangar',
      appVersion,
      exportedAt: new Date(now === undefined ? Date.now() : now).toISOString(),
      schemaVersion: EXPORT_VERSION,
      account: shapeAccount(account, db.owner),
      sources: sanitizeSources(db.sources),
      // Scan history rides along so a backup file is a complete restore point.
      history: Array.isArray(db.history) ? db.history : [],
      // So does the pledge archive (#388), trimmed to what buy-back details read
      // (leanArchive). Added within format v2: older versions ignore it.
      pledgeArchive: leanArchive(archive),
    };
  }

  // --- The hangar view (the stored shape) ---------------------------------------
  // The referral code under the names RSI and the extension use: in the referral
  // source (code and url, whose link holds the code) and on an account block. The
  // website drops the same keys before it keeps a sync.
  const REFERRAL_ITEM_KEYS = [
    'code',
    'url',
    'referralCode',
    'referralUrl',
    'referralUrlCopy',
    'referrerCode',
    'referrerReferralCode',
  ];
  const REFERRAL_ACCOUNT_KEYS = [
    'referral',
    'referralCode',
    'referralUrl',
    'referralUrlCopy',
    'referrerCode',
    'referrerReferralCode',
  ];
  // Never anywhere in what leaves the extension: the sync link and its token, the
  // sync site's address, Connect's state, the prospects list, the referral code, and
  // what this browser keeps next to the hangar for itself: the wishlist and its
  // alerts, the buy-back details cache, settings, cookies and the other accounts
  // parked here (stored as profile:<handle>, PROFILE_PREFIX).
  const NEVER = new Set([
    'siteLink',
    'siteUrl',
    'siteConnect',
    'prospectsList',
    ...REFERRAL_ITEM_KEYS.slice(2),
    'wishlist',
    'wishWatch',
    'bbDetails',
    'settings',
    'cookies',
    'cookie',
    'profiles',
  ]);
  const PROFILE_PREFIX = 'profile:';

  const omit = (o, keys) =>
    Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));

  // The newest ARCHIVE_MAX entries by goneAt (a missing or odd one counts as 0),
  // anything that isn't an object dropped; with ARCHIVE_MAX or fewer, in their order.
  // undefined for no archive at all.
  function capArchive(archive) {
    if (!isObj(archive)) return undefined;
    const gone = (v) => {
      const at = isObj(v) ? v.goneAt : null;
      return typeof at === 'number' && Number.isFinite(at) ? at : 0;
    };
    const ids = Object.keys(archive).filter((id) => isObj(archive[id]));
    if (ids.length > ARCHIVE_MAX) ids.sort((a, b) => gone(archive[b]) - gone(archive[a]));
    return Object.fromEntries(ids.slice(0, ARCHIVE_MAX).map((id) => [id, archive[id]]));
  }

  // A backup file (exportPayload) → the hangar as the website stores a synced one:
  //   { app, appVersion, exportedAt, schemaVersion, account, sources, pledgeArchive }
  // without history, the referral code (in the referral source and on the account
  // block) and the prospects list, and the pledge archive capped (pledgeArchive left
  // out when there's none). Returns a copy, never changes `payload`. Pure.
  function hangarView(payload) {
    const { history, ...out } = payload;
    const ref = out.sources?.referral;
    if (isObj(ref) && isObj(ref.items))
      out.sources = {
        ...out.sources,
        referral: { ...ref, items: omit(ref.items, [...REFERRAL_ITEM_KEYS, 'prospectsList']) },
      };
    if (isObj(out.account)) out.account = omit(out.account, REFERRAL_ACCOUNT_KEYS);
    if ('pledgeArchive' in out) {
      const capped = capArchive(out.pledgeArchive);
      if (capped) out.pledgeArchive = capped;
      else delete out.pledgeArchive;
    }
    return out;
  }

  // --- Checks before anything leaves -------------------------------------------
  // The schema (src/sync-schema.js, checked by src/schema-check.js), loaded before
  // this file in the extension; node tests load them here.
  function schema() {
    if (!root.OHSchema && typeof require === 'function') require('./schema-check.js');
    if (!root.OHSyncSchema && typeof require === 'function') require('./sync-schema.js');
    if (!root.OHSchema || !root.OHSyncSchema) throw new Error('The sync schema is not loaded.');
    return root.OHSchema;
  }

  // A key that must not be there, anywhere in `value` → { path, reason }, else null.
  // The schema already refuses unknown keys where the extension builds the object
  // (the account block, the sources, what a scan keeps with them); this walk also
  // covers the rows RSI's pages fill (pledges, buy-backs, recruits).
  function forbiddenKey(value) {
    const path = [];
    const at = (k) => schema().pointer([...path, k]);
    const walk = (v) => {
      if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) {
          path.push(i);
          const bad = walk(v[i]);
          if (bad) return bad;
          path.pop();
        }
      } else if (isObj(v)) {
        const here = path.join('/');
        for (const k of Object.keys(v)) {
          if (
            NEVER.has(k) ||
            k.startsWith(PROFILE_PREFIX) ||
            (here === 'sources/referral/items' && REFERRAL_ITEM_KEYS.includes(k)) ||
            (here === 'account' && REFERRAL_ACCOUNT_KEYS.includes(k))
          )
            return { path: at(k), reason: 'never sent' };
          path.push(k);
          const bad = walk(v[k]);
          if (bad) return bad;
          path.pop();
        }
      }
      return null;
    };
    return walk(value);
  }

  // A sync payload (with or without history) → null, or the first problem:
  // { path, reason } (a JSON Pointer into the payload). Checked on the request's own
  // text, parsed back, so it's what really goes.
  function checkPayload(payload) {
    return schema().validate(root.OHSyncSchema, payload) || forbiddenKey(payload);
  }

  // The same for a hangar view, which never carries history.
  function checkHangarView(view) {
    if (isObj(view) && 'history' in view) return { path: '/history', reason: 'never sent' };
    return checkPayload(view);
  }

  // --- The hangar view, read from storage ----------------------------------------
  // Is the cached RSI login (`account`, getAccount's shape) another pilot than the
  // one the stored hangar belongs to (`owner`)? Someone signed in to RSI as another
  // account and no extension page has switched hangars yet (src/dashboard.js
  // reconcileAccount). The same rule as lib.js siteSync, which never sends one
  // pilot's hangar under the other's handle: handles compared trimmed, in any case.
  function otherLogin(account, owner) {
    const lc = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');
    const login = isObj(account) && account.loggedIn ? lc(account.nickname) : '';
    const own = lc(owner?.nickname);
    return !!login && !!own && login !== own;
  }

  // For the background worker, which can't load lib.js: `get` is
  // chrome.storage.local.get (or a stand-in), `appVersion` the manifest's version.
  // → { ok: true, hangar } or { ok: false, error } where error is
  //   'no-scan'        nothing scanned in this browser yet
  //   'needs-upgrade'  storage isn't in this version's shape yet (older, damaged or
  //                    from before the versioned database), or the RSI login is
  //                    another pilot than the hangar's (otherLogin); opening an
  //                    extension page fixes both (lib.js loadDB, reconcileAccount)
  //   'schema'         the view fails its checks (+ path); nothing is handed out
  // Reads only the database, the cached account and the pledge archive.
  async function readHangarView(get, { appVersion = null, now } = {}) {
    const raw = (await get([DB_KEY, 'hangar', 'account', ARCHIVE_KEY])) || {};
    if (raw[DB_KEY] === undefined)
      return { ok: false, error: Array.isArray(raw.hangar) ? 'needs-upgrade' : 'no-scan' };
    const { db, problems } = checkDB(raw[DB_KEY]);
    if (problems.length || db.schemaVersion < DB_VERSION)
      return { ok: false, error: 'needs-upgrade' };
    if (otherLogin(raw.account, db.owner)) return { ok: false, error: 'needs-upgrade' };
    if (!db.sources.hangar?.scannedAt) return { ok: false, error: 'no-scan' };
    const hangar = hangarView(
      exportPayload({
        db,
        account: raw.account || null,
        archive: raw[ARCHIVE_KEY],
        appVersion,
        now,
      }),
    );
    const bad = checkHangarView(hangar);
    return bad ? { ok: false, error: 'schema', path: bad.path } : { ok: true, hangar };
  }

  const api = {
    DB_VERSION,
    EXPORT_VERSION,
    ARCHIVE_MAX,
    checkDB,
    cleanSnapshot,
    shapeAccount,
    sanitizeSources,
    withoutProspects,
    leanArchive,
    exportPayload,
    capArchive,
    hangarView,
    checkPayload,
    checkHangarView,
    readHangarView,
  };
  root.OHShape = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
