// The scan's progress weighted by time (the owner, 2026-11-02): each part's share of the
// bar is how many requests it makes times how long one of its requests takes, so a part
// with few but slow pages (Buy-Back Details) gets the share its time needs. The time per
// request comes from the last scan (its report's `pace`, ui/scan/runner.js), first-scan
// guesses until there is one. The scan runner works it out and writes it into
// scanProgress; the popup's bar and the toolbar badge only show it, so they always agree.

// The parts in the order a scan reads them.
export const PACE_PARTS = [
  'account',
  'hangar',
  'buybacks',
  'referrals',
  'packs',
  'pledgeLog',
  'creditLog',
  'sync',
];
// Before any scan has been timed: ms per request and requests per scan.
const GUESS = {
  account: { ms: 800, n: 1 },
  hangar: { ms: 1500, n: 6 },
  buybacks: { ms: 1200, n: 2 },
  referrals: { ms: 800, n: 3 },
  packs: { ms: 4000, n: 10 },
  pledgeLog: { ms: 1000, n: 0 },
  creditLog: { ms: 1000, n: 0 },
  sync: { ms: 1500, n: 1 },
};
// A scan expected to take less than this shows no fill: it's over before a bar means much.
export const QUICK_MS = 5000;
// The pace of this scan against the last one counts for the time left only after this
// long, and never below half or above three times.
const SETTLE_MS = 5000;
const RATIO = [0.5, 3];
// Parts that make one request and say nothing about pages.
const SINGLE = new Set(['account', 'sync']);

const count = (x) => Number.isFinite(x) && x >= 0;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// A report's `pace` as stored, cleaned: → { part: { ms, n } }, known parts only.
export function cleanPace(pace) {
  const out = {};
  if (!pace || typeof pace !== 'object') return out;
  for (const part of PACE_PARTS) {
    const p = pace[part];
    if (p && count(p.ms) && p.ms > 0 && count(p.n))
      out[part] = { ms: clamp(Math.round(p.ms), 50, 60e3), n: Math.round(p.n) };
  }
  return out;
}

// What of a part is read and how much there is, from scanProgress `p`: { read, of }.
// `expect` stands in for how many there are until the part says (RSI's pager, the
// packs to read, a log's pagecount).
export function unitsOf(p, expect) {
  if (SINGLE.has(p.part)) return { read: 0, of: 1 };
  const page = count(p.page) ? p.page : 0;
  const read = p.retry ? Math.max(0, page - 1) : page;
  if (p.part === 'packs') return { read, of: Math.max(read, count(p.count) ? p.count : expect) };
  if (Number.isInteger(p.pages) && p.pages > 0) return { read, of: Math.max(p.pages, read) };
  return { read, of: Math.max(expect, read + 1) };
}

// One scan's tracker. `prev`: the last report's pace; `start`: when the scan began.
// step(p, t) → { f, next, left, quick } for scanProgress; result(t) → this scan's pace.
export function createPace(prev, start) {
  const known = cleanPace(prev);
  const pace = Object.fromEntries(PACE_PARTS.map((id) => [id, { ...GUESS[id], ...known[id] }]));
  const seen = {}; // part → { at, end, read, of }
  let cur = null;
  let peak = 0;
  let quick = null;

  function close(t) {
    if (!cur) return;
    const s = seen[cur];
    s.end = t;
    if (SINGLE.has(cur)) s.read = s.of = 1;
  }

  // Where the scan stands, in expected ms: done so far, the current part's end, and all.
  function weigh() {
    const at = cur ? PACE_PARTS.indexOf(cur) : -1;
    let done = 0;
    let total = 0;
    let curEnd = 0;
    PACE_PARTS.forEach((id, i) => {
      const { ms, n } = pace[id];
      const s = seen[id];
      if (s && id !== cur) {
        done += s.read * ms;
        total += s.read * ms;
      } else if (id === cur) {
        done += s.read * ms;
        total += s.of * ms;
        curEnd = total;
      } else if (i > at) total += n * ms; // still to come; a part passed by was skipped
    });
    return { done, total: Math.max(total, 1), curEnd };
  }

  function step(p, t) {
    if (!p || !PACE_PARTS.includes(p.part))
      return { f: peak, next: peak, left: null, quick: !!quick };
    if (p.part !== cur) {
      close(t);
      cur = p.part;
      seen[cur] ??= { at: t, end: null, read: 0, of: 0 };
    }
    const u = unitsOf(p, pace[cur].n);
    seen[cur].read = u.read;
    seen[cur].of = u.of;
    const { done, total, curEnd } = weigh();
    quick ??= total < QUICK_MS;
    const elapsed = t - start;
    if (quick && elapsed >= QUICK_MS) quick = false;
    peak = Math.max(peak, Math.min(1, done / total));
    const f = Math.round(peak * 1000) / 1000;
    const after = Math.min(curEnd, done + pace[cur].ms);
    const next = Math.round(Math.max(f, Math.min(1, after / total)) * 1000) / 1000;
    const ratio = elapsed >= SETTLE_MS && done > 0 ? clamp(elapsed / done, ...RATIO) : 1;
    const left = Math.max(0, Math.round((total - done) * ratio));
    return { f, next, left, quick };
  }

  // This scan's pace for its report: each part's ms per request, an even mix with the last
  // scan's, and how many requests it made (a part not read made none).
  function result(t) {
    close(t);
    cur = null;
    const out = {};
    for (const id of PACE_PARTS) {
      const s = seen[id];
      const was = known[id];
      if (s && s.read > 0 && s.end > s.at) {
        const ms = (s.end - s.at) / s.read;
        out[id] = { ms: Math.round(was ? (was.ms + ms) / 2 : ms), n: s.read };
      } else out[id] = { ms: was ? was.ms : GUESS[id].ms, n: 0 };
    }
    return cleanPace(out);
  }

  return { step, result };
}
