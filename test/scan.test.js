'use strict';

/*
 * Scan-resilience tests for src/lib.js (OH.scanSource): transient RSI failures
 * are retried, auth failures are not, and a scan cut short mid-way keeps what
 * it gathered — but never overwrites a bigger earlier scan. Run: `npm test`.
 *
 * lib.js is a browser script, so we give it a minimal fake window/chrome and a
 * scripted fetch. Retry backoff sleeps are skipped (setTimeout runs at once).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// --- fake browser ----------------------------------------------------------
global.window = globalThis;
const store = {};
global.chrome = {
  storage: {
    local: {
      get: async (k) => {
        const keys = k == null ? Object.keys(store) : [].concat(k);
        return Object.fromEntries(keys.filter((x) => x in store).map((x) => [x, store[x]]));
      },
      set: async (o) => Object.assign(store, JSON.parse(JSON.stringify(o))),
      remove: async (k) => [].concat(k).forEach((x) => delete store[x]),
    },
  },
};
// Pages are served as JSON arrays; "parse" just reads them back.
global.OpenHangar = { parsePledges: (html) => JSON.parse(html || '[]') };
// Backoff sleeps run at once; their lengths are kept in `waits` to check them.
let waits = [];
global.setTimeout = (fn, ms) => (waits.push(ms), queueMicrotask(fn), 0);

const PLEDGES = /\/account\/pledges\?page=(\d+)/;
let script; // (page, callNo) => { status, body } | 'network'
let calls;
let other = []; // every non-pledge request (account lookups etc.)
// Other pages of RSI's, for a test that needs them: (url, init) → a Response, or
// undefined for the usual answers.
let extra = null;
global.fetch = async (url, init) => {
  const own = extra && (await extra(String(url), init));
  if (own) return own;
  const m = String(url).match(PLEDGES);
  if (!m) {
    other.push(String(url));
    return new Response('', { status: 404 });
  }
  const page = Number(m[1]);
  calls[page] = (calls[page] || 0) + 1;
  const r = script(page, calls[page]);
  if (r === 'network') throw new TypeError('Failed to fetch');
  return new Response(r.body ?? '[]', { status: r.status ?? 200, headers: r.headers });
};

require('../src/lib.js');
const OH = globalThis.OH;

const items = (page, n = 10) =>
  JSON.stringify(Array.from({ length: n }, (_, i) => ({ id: `p${page}-${i}`, name: `Ship ${i}` })));
// 3 full pages, then RSI clamps to the last page (no new ids → stop).
const healthy = (page) => ({ body: items(Math.min(page, 3)) });

async function reset(prevItems) {
  for (const k of Object.keys(store)) delete store[k];
  calls = {};
  other = [];
  waits = [];
  extra = null;
  if (prevItems) {
    store.db = { schemaVersion: 2, sources: { hangar: { items: prevItems, scannedAt: 1 } } };
  }
}

test('healthy scan collects every page', async () => {
  await reset();
  script = healthy;
  const r = await OH.scanSource('hangar');
  assert.equal(r.ok, true);
  assert.equal(r.items.length, 30);
  assert.equal(r.partial, undefined);
});

test('transient 503 and network errors are retried, then the scan completes', async () => {
  await reset();
  script = (page, n) => {
    if (page === 2 && n === 1) return { status: 503 };
    if (page === 2 && n === 2) return 'network';
    return healthy(page);
  };
  const retries = [];
  const r = await OH.scanSource('hangar', (page, c, retry) => retry && retries.push(retry));
  assert.equal(r.ok, true);
  assert.equal(r.items.length, 30);
  assert.equal(calls[2], 3); // 1 try + 2 retries
  assert.deepEqual(retries, [
    { attempt: 1, of: 3 },
    { attempt: 2, of: 3 },
  ]);
});

test('401 fails fast without retrying', async () => {
  await reset();
  script = (page) => (page === 1 ? { status: 401 } : healthy(page));
  const r = await OH.scanSource('hangar');
  assert.equal(r.ok, false);
  assert.match(r.error, /session may have expired/);
  assert.equal(calls[1], 1);
});

test('persistent failure on page 1 is an error (nothing gathered)', async () => {
  await reset();
  script = () => ({ status: 500 });
  const r = await OH.scanSource('hangar');
  assert.equal(r.ok, false);
  assert.match(r.error, /RSI responded 500/);
  assert.equal(calls[1], 4); // 1 try + 3 retries
});

test('mid-scan failure keeps the partial result when there is no bigger earlier scan', async () => {
  await reset();
  script = (page) => (page === 3 ? { status: 502 } : healthy(page));
  const r = await OH.scanSource('hangar');
  assert.equal(r.ok, true);
  assert.equal(r.items.length, 20);
  assert.match(r.partial, /stopped at page 3/);
  assert.equal(store.db.sources.hangar.items.length, 20);
});

test('mid-scan failure never overwrites a bigger earlier scan', async () => {
  const previous = JSON.parse(items(9, 25));
  await reset(previous);
  script = (page) => (page === 2 ? 'network' : healthy(page));
  const r = await OH.scanSource('hangar');
  assert.equal(r.ok, false);
  assert.match(r.error, /kept your previous scan of 25/);
  assert.equal(store.db.sources.hangar.items.length, 25); // untouched
});

test('429 is retried (rate limit)', async () => {
  await reset();
  script = (page, n) => (page === 1 && n === 1 ? { status: 429 } : healthy(page));
  const r = await OH.scanSource('hangar');
  assert.equal(r.ok, true);
  assert.equal(calls[1], 2);
});

test('a scan given the account makes no account requests and stamps the owner', async () => {
  await reset();
  script = healthy;
  const account = { loggedIn: true, nickname: 'DemoCitizen', displayname: 'Demo Citizen' };
  const r = await OH.scanSource('hangar', null, { account });
  assert.equal(r.ok, true);
  assert.deepEqual(
    other.filter((u) => /\/account\/dashboard|\/citizens\//.test(u)),
    [],
  );
  assert.deepEqual(store.db.owner, { nickname: 'DemoCitizen', displayname: 'Demo Citizen' });
});

test('without the account, the save still looks it up itself', async () => {
  await reset();
  script = healthy;
  await OH.scanSource('hangar');
  assert.ok(other.some((u) => /\/account\/dashboard/.test(u)));
});

test('429: RSI gets 5 s, 10 s, 15 s... of breathing room, then the scan completes (#298)', async () => {
  await reset();
  script = (page, n) => (page === 1 && n <= 4 ? { status: 429 } : healthy(page));
  const r = await OH.scanSource('hangar');
  assert.equal(r.ok, true);
  assert.equal(calls[1], 5);
  assert.deepEqual(
    waits.filter((ms) => ms >= 5000),
    [5000, 10000, 15000, 20000],
  );
});

test('429: a longer Retry-After from RSI is honoured, up to 30 s (#298)', async () => {
  await reset();
  script = (page, n) =>
    page === 1 && n === 1 ? { status: 429, headers: { 'retry-after': '20' } } : healthy(page);
  await OH.scanSource('hangar');
  assert.ok(waits.includes(20000));
});

test('a 5xx with a Retry-After is still retried in a scan (only buy-back details stop)', async () => {
  await reset();
  script = (page, n) =>
    page === 1 && n === 1 ? { status: 503, headers: { 'retry-after': '10' } } : healthy(page);
  const r = await OH.scanSource('hangar');
  assert.equal(r.ok, true);
  assert.equal(calls[1], 2);
  assert.ok(waits.includes(10000));
});

test('429: after 5 tries the scan gives up instead of pushing on (#298)', async () => {
  await reset();
  script = (page) => (page === 1 ? { status: 429 } : healthy(page));
  const r = await OH.scanSource('hangar');
  assert.equal(r.ok, false);
  assert.match(r.error, /slow down/);
  assert.equal(calls[1], 6);
});

test('scanShape: how completely a scan read the page, and untyped items (#295, #296)', () => {
  const s = OH.scanShape([
    { date: '2020-01-01', value: 10, image: 'x', contents: [{ kind: 'Ship' }, { kind: '' }] },
    { date: null, value: 0, image: null, contents: [{ kind: 'Ship', guessed: true }] },
  ]);
  assert.deepEqual(s, {
    n: 2,
    date: 0.5,
    value: 1,
    contents: 1,
    image: 0.5,
    tiles: 3,
    untyped: 2,
    guessed: 1,
  });
});

test('an Upgrade item or one with no kind is counted, never a reason to call a scan short', () => {
  const s = OH.scanShape([
    {
      date: '2024-03-03',
      value: 35,
      image: 'x',
      contents: [{ kind: 'Upgrade', label: 'Pulse to C8R Pisces' }],
    },
    {
      date: '2024-03-03',
      value: 90,
      image: 'x',
      contents: [
        { kind: 'Ship' },
        { kind: '', label: 'Star Citizen Digital Download' },
        { kind: '' },
      ],
    },
  ]);
  assert.equal(s.contents, 1);
  assert.equal(s.tiles, 4);
  assert.equal(s.untyped, 2); // the two with no kind; Upgrade is a kind
  assert.deepEqual(OH.shapeDrops({ ...s, untyped: 0 }, s), []);
});

test('shapeDrops: flags a field that went from most pledges to none (#295)', () => {
  const prev = { n: 40, date: 0.98, value: 1, contents: 0.9, image: 0.95 };
  assert.deepEqual(OH.shapeDrops(prev, { ...prev, date: 0 }), [
    { field: 'date', label: 'pledge dates', was: 0.98 },
  ]);
  assert.deepEqual(OH.shapeDrops(prev, { ...prev, date: 0.4 }), [], 'a dip is not a drop');
  assert.deepEqual(OH.shapeDrops(prev, { ...prev, n: 3, date: 0 }), [], 'too small to tell');
  assert.deepEqual(OH.shapeDrops(null, { ...prev, date: 0 }), [], 'first scan');
});

test('a hangar scan keeps its shape and warns when RSI stops giving dates (#295)', async () => {
  await reset(Array.from({ length: 25 }, (_, i) => ({ id: `old${i}`, name: 'Old' })));
  store.db.sources.hangar.meta = { shape: { n: 25, date: 0.96, value: 1, contents: 1, image: 1 } };
  script = healthy;
  const r = await OH.scanSource('hangar');
  assert.equal(r.ok, true);
  assert.equal(store.db.sources.hangar.meta.shape.n, 30);
  const log = await OH.getLog();
  assert.ok(log.some((l) => /read no pledge dates/.test(l.msg || l.message || JSON.stringify(l))));
});

// --- Skipping an unchanged hangar (#294) -----------------------------------
// A hangar served from a list, 10 per page, clamping past the end like RSI does.
const pledges = (n, from = 0) =>
  Array.from({ length: n }, (_, i) => ({ id: `h${from + i}`, name: `Pledge ${from + i}` }));
const serve = (list) => (page) => {
  const last = Math.max(1, Math.ceil(list.length / 10));
  const p = Math.min(page, last);
  return { body: JSON.stringify(list.slice((p - 1) * 10, p * 10)) };
};
// A first full scan, then a fresh request count for the rescan.
async function scannedOnce(list) {
  await reset();
  script = serve(list);
  const first = await OH.scanSource('hangar');
  assert.equal(first.ok, true);
  calls = {};
}

test('an unchanged hangar is checked with 3 requests, not every page (#294)', async () => {
  const list = pledges(50);
  await scannedOnce(list);
  assert.equal(store.db.sources.hangar.meta.probe.n, 50);
  const snaps = store.dbHistory.length;
  const r = await OH.scanSource('hangar');
  assert.equal(r.ok, true);
  assert.equal(r.unchanged, true);
  assert.deepEqual(r.items, list);
  assert.deepEqual(calls, { 1: 1, 5: 1, 6: 1 }); // first, last, and RSI clamping after it
  assert.equal(store.dbHistory.length, snaps); // same snapshot, just re-checked
  assert.ok(store.dbHistory.at(-1).checkedAt);
});

test('a short last page needs no clamp check (#294)', async () => {
  await scannedOnce(pledges(45));
  const r = await OH.scanSource('hangar');
  assert.equal(r.unchanged, true);
  assert.deepEqual(calls, { 1: 1, 5: 1 });
});

test('a new pledge on top means a full scan (#294)', async () => {
  const list = pledges(50);
  await scannedOnce(list);
  script = serve([{ id: 'new', name: 'Fresh Pledge' }, ...list]);
  const r = await OH.scanSource('hangar');
  assert.equal(r.unchanged, undefined);
  assert.equal(r.items.length, 51);
  assert.equal(calls[2], 1);
});

test('a pledge melted deep in the hangar means a full scan (#294)', async () => {
  const list = pledges(50);
  await scannedOnce(list);
  script = serve(list.filter((p) => p.id !== 'h23'));
  const r = await OH.scanSource('hangar');
  assert.equal(r.unchanged, undefined);
  assert.equal(r.items.length, 49);
  assert.ok(!r.items.some((p) => p.id === 'h23'));
});

test('a pledge added after a full last page means a full scan (#294)', async () => {
  const list = pledges(50);
  await scannedOnce(list);
  script = serve([...list, { id: 'old', name: 'Reclaimed Oldie' }]);
  const r = await OH.scanSource('hangar');
  assert.equal(r.unchanged, undefined);
  assert.equal(r.items.length, 51);
});

test('a changed pledge on the last page means a full scan (#294)', async () => {
  const list = pledges(45);
  await scannedOnce(list);
  script = serve(list.map((p) => (p.id === 'h44' ? { ...p, name: 'Upgraded' } : p)));
  const r = await OH.scanSource('hangar');
  assert.equal(r.unchanged, undefined);
  assert.equal(r.items.at(-1).name, 'Upgraded');
});

test('a day after the last full scan, the hangar is read in full again (#294)', async () => {
  await scannedOnce(pledges(50));
  store.db.sources.hangar.meta.probe.at -= 25 * 3600e3;
  const r = await OH.scanSource('hangar');
  assert.equal(r.unchanged, undefined);
  assert.equal(calls[2], 1);
  // That full scan starts a fresh day: the next rescan can skip again.
  calls = {};
  assert.equal((await OH.scanSource('hangar')).unchanged, true);
});

test('saved data the probe does not vouch for gets a full scan (#294)', async () => {
  // Made by another version (maybe an older parser).
  await scannedOnce(pledges(50));
  store.db.sources.hangar.meta.probe.v = '0.0.1';
  assert.equal((await OH.scanSource('hangar')).unchanged, undefined);
  // Saved items swapped out (say, a backup restored) since that scan.
  await scannedOnce(pledges(50));
  store.db.sources.hangar.items[3].name = 'Edited';
  assert.equal((await OH.scanSource('hangar')).unchanged, undefined);
  // An earlier version's scan, with no probe at all.
  await scannedOnce(pledges(50));
  delete store.db.sources.hangar.meta.probe;
  assert.equal((await OH.scanSource('hangar')).unchanged, undefined);
});

test('small hangars always get the full scan, it is just as quick (#294)', async () => {
  await scannedOnce(pledges(20));
  const r = await OH.scanSource('hangar');
  assert.equal(r.unchanged, undefined);
  assert.equal(calls[2], 1);
});

test('a hiccup while checking falls back to the full scan (#294)', async () => {
  const list = pledges(50);
  await scannedOnce(list);
  script = (page, n) => (page === 5 && n === 1 ? { status: 403 } : serve(list)(page));
  const r = await OH.scanSource('hangar');
  assert.equal(r.ok, true);
  assert.equal(r.unchanged, undefined);
  assert.equal(r.items.length, 50);
});

test('a partial scan leaves nothing for the next one to skip on (#294)', async () => {
  const list = pledges(50);
  await reset();
  script = (page) => (page === 4 ? { status: 502 } : serve(list)(page));
  const r = await OH.scanSource('hangar');
  assert.ok(r.partial);
  assert.equal(store.db.sources.hangar.meta?.probe, undefined);
});

// --- Auto Scan Daily's reads (#666) -------------------------------------------
// Its quick check (OH.peekSource), who is signed in (OH.whoIsSignedIn), the account read
// that names the handle it expects (OH.getAccount({ expect })), and a part read in auto
// mode: never saved unless read whole, and only when the keep gate says yes.
// Buy-back pages are served as { items, tokens } (their own stand-in parser).
global.OpenHangar.parseBuybacks = (html) => JSON.parse(html || '{}').items || [];
global.OpenHangar.parseBuybackTokens = (html) => JSON.parse(html || '{}').tokens ?? null;
const BUYBACKS = /\/account\/buy-back-pledges\?page=(\d+)/;
const DASHBOARD = /\/account\/dashboard$/;
const dashboard = (nickname) =>
  new Response(
    `<div data-account="${JSON.stringify({ nickname, displayname: `${nickname} D` }).replace(/"/g, '&quot;')}"></div>`,
  );
const snapshot = () => JSON.parse(JSON.stringify(store));
// A page that's RSI's sign-in form: no pledges on it.
const signInPage = { body: '[]<input name="password">' };
const withSignIn = async (fn) => {
  global.OpenHangar.parsePledges = (html) => JSON.parse(String(html).split('<')[0] || '[]');
  try {
    await fn();
  } finally {
    global.OpenHangar.parsePledges = (html) => JSON.parse(html || '[]');
  }
};

test('peekSource: one page, nothing written, the same as saved or not', async () => {
  const list = pledges(25);
  await scannedOnce(list);
  const before = snapshot();
  assert.deepEqual(await OH.peekSource('hangar'), { same: true });
  assert.deepEqual(calls, { 1: 1 }, 'only the newest page');
  assert.deepEqual(snapshot(), before, 'nothing saved, nothing written');
  // Something new on top: different.
  calls = {};
  script = serve([{ id: 'new', name: 'Fresh' }, ...list]);
  assert.deepEqual(await OH.peekSource('hangar'), { same: false });
  assert.deepEqual(calls, { 1: 1 });
  assert.deepEqual(snapshot(), before);
  // Never scanned: different, without asking RSI.
  await reset();
  assert.deepEqual(await OH.peekSource('hangar'), { same: false });
  assert.deepEqual(calls, {});
  // Not a part it peeks at.
  assert.ok((await OH.peekSource('referral')).error);
});

test('peekSource: a 429 comes back at once, with its Retry-After; a sign-in page is signed out', async () => {
  await scannedOnce(pledges(25));
  const date = 'Wed, 21 Oct 2026 07:28:00 GMT';
  script = () => ({ status: 429, headers: { 'retry-after': date } });
  const r = await OH.peekSource('hangar');
  assert.equal(r.rsiDown, true);
  assert.equal(r.retryAfter, date);
  assert.equal(calls[1], 1, 'never retried');
  await withSignIn(async () => {
    script = () => signInPage;
    assert.deepEqual(await OH.peekSource('hangar'), { signedOut: true });
  });
  script = () => ({ status: 403 });
  assert.deepEqual(await OH.peekSource('hangar'), { signedOut: true });
  script = () => ({ status: 404 });
  assert.equal((await OH.peekSource('hangar')).rsiDown, false, 'an answer, not RSI down');
});

test('peekSource: buy-backs compare their token count too', async () => {
  await reset();
  const page = { items: [{ id: 'b1', name: 'Cutlass' }], tokens: 2 };
  store.db = {
    schemaVersion: 3, // as stored today (an older one is written back once)
    sources: { buybacks: { items: page.items, scannedAt: 1, meta: { tokens: 2 } } },
  };
  // status.json as the pages cached it (its cache is the one thing a check may refresh).
  store.remoteStatus = { at: Date.now(), data: null };
  let body = page;
  extra = (url) => (BUYBACKS.test(url) ? new Response(JSON.stringify(body)) : undefined);
  const before = snapshot();
  assert.deepEqual(await OH.peekSource('buybacks'), { same: true });
  body = { ...page, tokens: 3 };
  assert.deepEqual(await OH.peekSource('buybacks'), { same: false }, 'a token spent');
  assert.deepEqual(snapshot(), before);
});

test('whoIsSignedIn: one request, nothing stored, never the cached account', async () => {
  await reset();
  store.account = { v: 7, loggedIn: true, nickname: 'Cached', fetchedAt: Date.now() };
  const asked = [];
  let answer = () => dashboard('Test_Pilot');
  extra = async (url) => (asked.push(url), answer());
  assert.deepEqual(await OH.whoIsSignedIn(), {
    state: 'in',
    nickname: 'Test_Pilot',
    displayname: 'Test_Pilot D',
  });
  assert.equal(asked.length, 1);
  assert.match(asked[0], DASHBOARD);
  assert.equal(store.account.nickname, 'Cached', 'the cache untouched');
  // A dashboard with no account on it: signed out.
  answer = () => new Response('<html>Sign in</html>');
  assert.deepEqual(await OH.whoIsSignedIn(), { state: 'out' });
  // No answer: unknown, never the cache.
  answer = () => {
    throw new TypeError('Failed to fetch');
  };
  assert.equal((await OH.whoIsSignedIn()).state, 'unknown');
  answer = () => new Response('', { status: 429, headers: { 'retry-after': '600' } });
  asked.length = 0;
  assert.deepEqual(await OH.whoIsSignedIn(), { state: 'unknown', retryAfter: '600' });
  assert.equal(asked.length, 1, 'a 429 is never retried');
  assert.equal(store.account.nickname, 'Cached');
});

test('getAccount({ expect }): another handle reads no dossier and caches nothing', async () => {
  await reset();
  store.account = { v: 7, loggedIn: true, nickname: 'Test_Pilot', fetchedAt: 1 };
  const asked = [];
  let who = 'Other_Pilot';
  let down = false;
  extra = async (url) => {
    asked.push(url);
    if (down) throw new TypeError('Failed to fetch');
    return DASHBOARD.test(url) ? dashboard(who) : new Response('', { status: 404 });
  };
  const a = await OH.getAccount({ force: true, expect: 'test_pilot' });
  assert.equal(a.other, true);
  assert.equal(a.nickname, 'Other_Pilot');
  assert.deepEqual(
    asked.filter((u) => /\/citizens\//.test(u)),
    [],
    'no dossier',
  );
  assert.equal(store.account.fetchedAt, 1, 'the cache untouched');
  // The handle it expects (any case): read and cached as before.
  who = 'Test_Pilot';
  const b = await OH.getAccount({ force: true, expect: ' TEST_PILOT ' });
  assert.equal(b.other, undefined);
  assert.equal(b.loggedIn, true);
  assert.ok(store.account.fetchedAt > 1);
  // No answer: couldn't tell, never the cached account.
  down = true;
  assert.deepEqual(await OH.getAccount({ force: true, expect: 'Test_Pilot' }), {
    loggedIn: null,
    fetchedAt: 0,
  });
  assert.equal(
    (await OH.getAccount({ force: true })).nickname,
    'Test_Pilot',
    'without it, the cache',
  );
});

test('scanSource in auto mode: a part cut short is never saved, however big', async () => {
  await reset(pledges(5));
  const before = snapshot();
  script = (page) =>
    page === 3 ? { status: 429, headers: { 'retry-after': '120' } } : healthy(page);
  const r = await OH.scanSource('hangar', null, { auto: true });
  assert.equal(r.ok, false);
  assert.equal(r.unfinished, true);
  assert.equal(r.rsiDown, true);
  assert.equal(r.retryAfter, '120');
  assert.equal(calls[3], 1, 'a 429 comes back at once');
  assert.deepEqual(snapshot().db, before.db, 'the 20 it read are not kept over 5');
  // A scan you pressed keeps going, as before.
  const manual = await OH.scanSource('hangar');
  assert.equal(manual.ok, true);
});

test('scanSource in auto mode: a sign-in page partway is unfinished, not the end of the list', async () => {
  await reset(pledges(5));
  await withSignIn(async () => {
    script = (page) => (page === 2 ? signInPage : healthy(page));
    const r = await OH.scanSource('hangar', null, { auto: true });
    assert.equal(r.unfinished, true);
    assert.match(r.error, /signed out/);
    assert.equal(store.db.sources.hangar.items.length, 5);
    // Pressed Scan: the shorter list, as before.
    const manual = await OH.scanSource('hangar');
    assert.equal(manual.ok, true);
    assert.equal(store.db.sources.hangar.items.length, 10);
  });
});

test('scanSource in auto mode: no change probe, and the keep gate decides', async () => {
  const list = pledges(50);
  await scannedOnce(list);
  const at = store.db.sources.hangar.scannedAt;
  // Auto never takes the #294 shortcut: every page is read.
  const seen = [];
  const r = await OH.scanSource('hangar', null, {
    auto: true,
    keep: async (got) => (seen.push(got.items.length), false),
  });
  assert.deepEqual(r, { ok: false, refused: true });
  assert.deepEqual(seen, [50]);
  assert.equal(calls[2], 1, 'no probe');
  assert.equal(store.db.sources.hangar.scannedAt, at, 'refused: nothing saved');
  // Yes: saved as Scan saves it.
  script = serve([{ id: 'new', name: 'Fresh' }, ...list]);
  const yes = await OH.scanSource('hangar', null, { auto: true, keep: async () => true });
  assert.equal(yes.ok, true);
  assert.equal(store.db.sources.hangar.items.length, 51);
  assert.equal(yes.scannedAt, store.db.sources.hangar.scannedAt);
});

test("syncStamp: the three parts' scan times, one string", () => {
  assert.equal(
    OH.syncStamp({ sources: { hangar: { scannedAt: 5 }, referral: { scannedAt: 7 } } }),
    '5||7',
  );
  assert.equal(OH.syncStamp(null), '||');
});
