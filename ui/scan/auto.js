// Auto Scan Daily's rules (#666), for the scan runner (./runner.js autoScan). Pure, so
// each one is tested on its own (test/auto-scan.test.js). What they decide:
//   fullDue    whether today's run reads everything (else a quick check comes first)
//   owedSync   whether a saved scan's sync never went out (it goes with the next run)
//   bigDrop    whether a hangar lost too much to keep without buy-backs to explain it
//   retryAtOf  when the next run may ask RSI again, after a run that didn't finish
//   lineOf     the run's line in the popup (ui/popup/data.js autoLine has the words)

// The parts, as the stored DB names them (db.sources), in the order they're read. The
// status file (site/status.json) pauses referrals as 'referrals'.
export const PARTS = ['hangar', 'buybacks', 'referral'];
export const PAUSE_ID = { hangar: 'hangar', buybacks: 'buybacks', referral: 'referrals' };
export const DAY = 24 * 3600e3;
export const WEEK = 7 * DAY;
// A sudden drop: at least this many pledges gone, and this share of the hangar
// (owner's default, 2026-10-14), or an empty hangar where there was one.
export const DROP_MIN = 5;
export const DROP_SHARE = 0.1;
// The longest backoff after runs that didn't finish.
export const BACKOFF_MAX = 4 * DAY;
// The run's lines (local autoScan.line).
export const LINES = [
  'quick',
  'full',
  'signed-out',
  'other',
  'paused',
  'bad',
  'out-partway',
  'partway',
];
// The lines that ask for a scan (ui/popup/data.js autoAsk), and a day skipped.
export const ASKS = ['bad', 'out-partway', 'partway'];
const SKIPS = ['signed-out', 'other', 'paused'];

const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const lc = (s) =>
  String(s ?? '')
    .trim()
    .toLowerCase();
export const sameHandle = (a, b) => !!lc(a) && lc(a) === lc(b);

// Does a part's last complete read still stand? Its stamp (local scanFull[part], the
// scan time of the last read that was whole) is the part's saved scan time: any save
// since (a scan stopped short, an import, another account's hangar, Clear Data) makes it
// a different time, so the stamp stops counting by itself.
const trusted = (scanFull, db, p) =>
  isObj(scanFull) && typeof scanFull[p] === 'number' && scanFull[p] === db?.sources?.[p]?.scannedAt;

// A full read today: a part (not paused) whose last complete read doesn't stand, or the
// oldest one a week old (or in the future: the clock went back). `paused`: the parts
// the status file pauses (a Set of PARTS ids). `owed`: a sync that never went out (the
// policy's "nothing new stops there and sends nothing": a quick check never sends one,
// so a run that owes one reads in full and sends it at its end).
export function fullDue(scanFull, db, paused = new Set(), now = Date.now(), { owed = false } = {}) {
  if (owed) return true;
  const parts = PARTS.filter((p) => !paused.has(p));
  if (!parts.length) return false;
  if (parts.some((p) => !trusted(scanFull, db, p))) return true;
  const oldest = Math.min(...parts.map((p) => scanFull[p]));
  return now - oldest >= WEEK || now < oldest;
}

// A sync owed: what's saved (OH.syncStamp) isn't what the last sync that went through
// sent (siteLink.syncedScan), nor what the website already refused (the record's
// syncTried: not sent again until the scan changes). Nothing scanned: nothing to owe.
// A link from before 0.4.0 has no syncedScan: owed only if it never synced.
export function owedSync({ stamp, link, rec } = {}) {
  if (typeof stamp !== 'string' || stamp.startsWith('|') || !link) return false;
  if (link.syncedScan === undefined) return !link.lastSync;
  return stamp !== link.syncedScan && stamp !== rec?.syncTried;
}

// The record's syncTried after an auto sync: cleared once one went through, the stamp
// tried when the website refused it with a status (an older scan, too big, the wrong
// shape, not open: sent again only once the scan changes), else as it was (held, too
// soon, no network, Firefox's no, a question: tried again next run).
export function syncTriedAfter(result, stamp, was = null) {
  if (result?.state === 'sent') return null;
  if (Number.isInteger(result?.status) && result.status !== 429) return stamp;
  return was ?? null;
}

// Pledges saved that the new list doesn't have (by id).
export function goneCount(saved, next) {
  const now = new Set((Array.isArray(next) ? next : []).map((p) => String(p?.id)));
  return (Array.isArray(saved) ? saved : []).filter(
    (p) => isObj(p) && p.id != null && !now.has(String(p.id)),
  ).length;
}

// Buy-backs new since the last buy-back scan (by id; one that has no id of its own,
// buybacks-p<page>-<n>, can't be told apart, so it doesn't count). None when buy-backs
// were never scanned (`saved` null): nothing to compare with.
const FALLBACK_ID = /^buybacks-p\d+-\d+$/;
export function newBuybackIds(saved, next) {
  if (!Array.isArray(saved)) return 0;
  const had = new Set(saved.map((b) => String(b?.id)));
  return (Array.isArray(next) ? next : []).filter(
    (b) => isObj(b) && b.id != null && !FALLBACK_ID.test(String(b.id)) && !had.has(String(b.id)),
  ).length;
}

// A sudden drop: an empty hangar where there was one, or at least DROP_MIN pledges gone
// and at least DROP_SHARE of the hangar. saved: pledges before; gone: pledges gone (less
// what new buy-backs explain); next: pledges now.
export function bigDrop({ saved, gone, next }) {
  return (saved > 0 && next === 0) || (gone >= DROP_MIN && gone >= DROP_SHARE * saved);
}

// Retry-After (seconds or an HTTP date) → ms to wait from `now`, or 0 without one. Not
// capped at a day as OH.retryAfterMs is: retryAtOf caps the wait at BACKOFF_MAX.
export function retryAfterMs(value, now = Date.now()) {
  const v = String(value ?? '').trim();
  if (!v) return 0;
  const ms = /^\d+$/.test(v) ? Number(v) * 1000 : Date.parse(v) - now;
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

// When the next run may ask RSI again: `fails` runs in a row that didn't finish (RSI
// didn't answer, or a part stopped partway) double the wait from a day, up to
// BACKOFF_MAX, and never sooner than its Retry-After (`parse`: retryAfterMs, above).
// → ms, or null when the run finished (fails 0).
export function retryAtOf({ at, fails, retryAfter = null }, parse = retryAfterMs) {
  if (!(fails > 0) || !Number.isFinite(at)) return null;
  const after = parse(retryAfter, at) || 0;
  return at + Math.min(BACKOFF_MAX, Math.max(after, DAY * 2 ** (fails - 1)));
}

// The run's line, most serious first: 'bad' (a part read from another account, or a
// hangar dropped with nothing to explain it), 'out-partway' (signed out of RSI midway),
// 'partway' (a part that didn't finish: RSI stopped answering, a page it couldn't read,
// a save that failed), else 'full' when a saved part changed ("hangar updated"), or 'quick' ("no
// changes": the quick check found nothing new, or a full read found nothing
// different).
export function lineOf({ bad = false, out = false, partway = false, changed = false } = {}) {
  if (bad) return 'bad';
  if (out) return 'out-partway';
  if (partway) return 'partway';
  return changed ? 'full' : 'quick';
}

// A handle this link syncs (the connected pilot): one it synced before, or its first
// when this browser keeps no other account. `answer`: OH.sitePilotAnswer(link, { handle
// }); `profiles`: OH.listProfiles().
export function connectedPilot(handle, answer, profiles = []) {
  if (!lc(handle)) return false;
  if (answer === 'yes') return true;
  if (answer !== 'first') return false;
  return !(Array.isArray(profiles) ? profiles : []).some(
    (p) => lc(p?.nickname) && lc(p.nickname) !== lc(handle),
  );
}

// The record a run leaves (local autoScan, replaced whole): { v, at, ended, line, run,
// startedAt, fails, retryAt, syncTried }. A run with no line of its own (RSI didn't
// answer, say) keeps the last one's line and its time. So does a day skipped (signed
// out, another account, paused) after a run that asks for a scan, until a scan saves
// since that run (`savedAt`: the hangar's saved scan time now, as ui/popup/data.js
// autoAsk compares it with `ended`).
export function record(
  was,
  { at, ended, line = null, run = null, startedAt = null, fails, retryAt, syncTried, savedAt },
) {
  const prev = isObj(was) && was.v === 1 ? was : null;
  const asks = ASKS.includes(prev?.line) && !(savedAt > prev.ended);
  const keep = !line || (asks && SKIPS.includes(line));
  return {
    v: 1,
    at: keep ? (prev?.at ?? null) : at,
    ended,
    line: keep ? prev?.line || null : line,
    run,
    startedAt,
    fails,
    retryAt,
    syncTried: syncTried === undefined ? (prev?.syncTried ?? null) : syncTried,
  };
}
