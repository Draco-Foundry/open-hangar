'use strict';
// Buy-back details (OH.fetchBuybackDetails): one page per buy-back, so the batch
// must stop at RSI's first "slow down" instead of pushing on, keep what it read,
// and hold off for a while before trying again. Between pages it pauses 1 to 2 s,
// longer after failures, and it honors RSI's Retry-After.
const test = require('node:test');
const assert = require('node:assert/strict');

const store = {};
global.window = globalThis;
global.chrome = {
  storage: {
    local: {
      get: async (k) => {
        const keys = [].concat(k);
        return Object.fromEntries(keys.filter((x) => x in store).map((x) => [x, store[x]]));
      },
      set: async (o) => Object.assign(store, JSON.parse(JSON.stringify(o))),
      remove: async (k) => [].concat(k).forEach((x) => delete store[x]),
    },
  },
};
global.OpenHangar = { parseBuybackDetail: () => ({ price: 10, ships: [] }) };
// No real pauses, but each one asked for is noted (the details save's 500 ms
// debounce isn't a pause between pages).
let waits = [];
global.setTimeout = (fn, ms) => {
  if (fn.name !== 'flushBuybackDetails') waits.push(ms);
  queueMicrotask(fn);
  return 0;
};

let answer; // id → status
let body = () => '<html>buy-back</html>'; // id → page HTML
let retryAfter = () => null; // id → Retry-After header, or null for none
let offline = () => false; // id → true when RSI can't be reached at all
let hits;
global.fetch = async (url) => {
  const m = String(url).match(/\/pledge\/buyback\/(\d+)/);
  if (!m) return new Response('', { status: 404 });
  hits.push(m[1]);
  if (offline(m[1])) throw new TypeError('Failed to fetch');
  const after = retryAfter(m[1]);
  return new Response(body(m[1]), {
    status: answer(m[1]),
    headers: after == null ? {} : { 'retry-after': String(after) },
  });
};
require('../src/lib.js');
const OH = globalThis.OH;

const ids = ['1', '2', '3', '4', '5'];
const parseOk = () => ({ price: 10, ships: [] });
async function reset() {
  for (const k of Object.keys(store)) delete store[k];
  await OH.pruneBuybackDetails([]); // forget details from the last test
  hits = [];
  waits = [];
  body = () => '<html>buy-back</html>';
  retryAfter = () => null;
  offline = () => false;
  OpenHangar.parseBuybackDetail = parseOk;
}
// `ms` within a few seconds of `want` (the test's own clock moves too).
const near = (ms, want) => assert.ok(Math.abs(ms - want) < 5000, `${ms} ms, wanted ${want}`);
const MIN = 60e3;
// Math.random fixed for one call, so the pauses are exact.
async function withRandom(value, fn) {
  const keep = Math.random;
  Math.random = () => value;
  try {
    return await fn();
  } finally {
    Math.random = keep;
  }
}

test('reads every page when RSI is happy', async () => {
  await reset();
  answer = () => 200;
  const r = await OH.fetchBuybackDetails(ids);
  assert.deepEqual(r, { done: 5, errors: 0, total: 5 });
  assert.deepEqual(hits, ids);
});

for (const status of [429, 403]) {
  test(`stops the whole batch at the first ${status}, without retrying it`, async () => {
    await reset();
    answer = (id) => (id === '3' ? status : 200);
    const r = await OH.fetchBuybackDetails(ids);
    assert.equal(r.rateLimited, true);
    assert.equal(r.done, 2);
    assert.deepEqual(hits, ['1', '2', '3']); // page 3 asked once, 4 and 5 never
    const kept = await OH.getBuybackDetails();
    assert.ok(kept['1'] && kept['2'] && !kept['3']); // what was read is kept
    assert.ok(store.bbdSlowDownUntil > Date.now());
  });
}

test('during the cooldown a batch asks RSI nothing; after it, it resumes', async () => {
  await reset();
  answer = (id) => (id === '2' ? 429 : 200);
  await OH.fetchBuybackDetails(ids);
  hits = [];
  answer = () => 200;
  const held = await OH.fetchBuybackDetails(ids);
  assert.equal(held.rateLimited, true);
  assert.equal(held.done, 0);
  assert.deepEqual(hits, []);
  store.bbdSlowDownUntil = Date.now() - 1; // fifteen minutes later
  const r = await OH.fetchBuybackDetails(ids);
  assert.equal(r.rateLimited, undefined);
  assert.deepEqual(hits, ['2', '3', '4', '5']); // only the ones still missing
});

test('a 500 is still retried, not treated as "slow down"', async () => {
  await reset();
  let n = 0;
  answer = (id) => (id === '1' && n++ === 0 ? 503 : 200);
  const r = await OH.fetchBuybackDetails(['1']);
  assert.deepEqual(r, { done: 1, errors: 0, total: 1 });
  assert.deepEqual(hits, ['1', '1']);
});

test('pages that do not parse are skipped, not saved, and the batch goes on (#199)', async () => {
  await reset();
  answer = () => 200;
  OpenHangar.parseBuybackDetail = (html) => {
    if (html.includes('odd')) throw new Error('unexpected layout');
    if (html.includes('empty')) return null;
    return parseOk();
  };
  body = (id) =>
    id === '2' ? '<html>odd</html>' : id === '4' ? '<html>empty</html>' : '<html>ok</html>';
  const r = await OH.fetchBuybackDetails(ids);
  assert.deepEqual(r, { done: 5, errors: 2, total: 5 });
  const saved = await OH.getBuybackDetails();
  assert.deepEqual(Object.keys(saved).sort(), ['1', '3', '5']);
  // The two that failed are tried again next time; the rest aren't re-read.
  hits = [];
  OpenHangar.parseBuybackDetail = parseOk;
  assert.deepEqual(await OH.fetchBuybackDetails(ids), { done: 2, errors: 0, total: 2 });
  assert.deepEqual(hits, ['2', '4']);
});

test('signed out of RSI mid-batch: stop, and save nothing for that page (#199)', async () => {
  await reset();
  answer = () => 200;
  OpenHangar.parseBuybackDetail = (html) => (html.includes('password') ? null : parseOk());
  body = (id) => (id === '2' ? '<form><input name="password"></form>' : '<html>ok</html>');
  const r = await OH.fetchBuybackDetails(ids);
  assert.deepEqual(r, { done: 1, errors: 1, total: 5 });
  assert.deepEqual(hits, ['1', '2']);
  assert.deepEqual(Object.keys(await OH.getBuybackDetails()), ['1']);
});

// --- Pacing (OH-021): gentle between pages, slower after failures ---------------

test('the pause: 1 to 2 s at random, doubled for each failed page in a row', () => {
  assert.equal(
    OH.bbdPause(0, () => 0),
    1000,
  );
  assert.equal(
    OH.bbdPause(0, () => 0.5),
    1500,
  );
  assert.ok(OH.bbdPause(0, () => 0.9999) < 2000);
  assert.equal(
    OH.bbdPause(1, () => 0.5),
    3000,
  );
  assert.equal(
    OH.bbdPause(2, () => 0.5),
    6000,
  );
  assert.ok(OH.bbdPause(2, () => 0.9999) < 8000); // the longest: a third failure stops
});

test('a batch pauses 1 to 2 s between pages, never on a fixed beat', async () => {
  await reset();
  answer = () => 200;
  await OH.fetchBuybackDetails(ids);
  assert.equal(waits.length, ids.length - 1); // none after the last page
  for (const ms of waits) assert.ok(ms >= 1000 && ms < 2000, `paused ${ms} ms`);
  assert.ok(new Set(waits).size > 1, 'the pauses vary');
});

test('failed pages (5xx) double the next pause, and three in a row stop the batch', async () => {
  await reset();
  answer = (id) => (id === '5' ? 200 : 503);
  const r = await withRandom(0.5, () => OH.fetchBuybackDetails(ids));
  assert.deepEqual(r, { done: 3, errors: 3, total: 5 });
  // Each page: fetchPage's own three retries (0.8, 1.6, 3.2 s), then the pause.
  assert.deepEqual(waits, [800, 1600, 3200, 3000, 800, 1600, 3200, 6000, 800, 1600, 3200]);
  assert.deepEqual(hits, ['1', '1', '1', '1', '2', '2', '2', '2', '3', '3', '3', '3']);
  assert.equal(store.bbdSlowDownUntil, undefined); // no hold: the next scan tries again
});

test('a page read fine brings the pause back to 1 to 2 s', async () => {
  await reset();
  answer = (id) => (id === '1' || id === '3' ? 503 : 200);
  const r = await withRandom(0.5, () => OH.fetchBuybackDetails(['1', '2', '3']));
  assert.deepEqual(r, { done: 3, errors: 2, total: 3 });
  assert.deepEqual(
    waits.filter((ms) => ![800, 1600, 3200].includes(ms)),
    [3000, 1500], // and none after page 3, the last
  );
});

test('Stop: no pause after the page it lands on', async () => {
  await reset();
  answer = () => 200;
  let stop = false;
  const r = await OH.fetchBuybackDetails(
    ids,
    () => (stop = true),
    () => !stop,
  );
  assert.deepEqual(r, { done: 1, errors: 0, total: 5 });
  assert.deepEqual(waits, []);
  assert.deepEqual(hits, ['1']);
});

test('no network three pages in a row stops the batch, with no hold', async () => {
  await reset();
  offline = () => true;
  const r = await withRandom(0.5, () => OH.fetchBuybackDetails(ids));
  assert.deepEqual(r, { done: 3, errors: 3, total: 5 });
  assert.equal(hits.length, 12); // three pages, each tried 4 times
  assert.deepEqual(
    waits.filter((ms) => ![800, 1600, 3200].includes(ms)),
    [3000, 6000],
  );
  assert.equal(store.bbdSlowDownUntil, undefined);
});

test('a batch that reads nothing keeps the slow-down count', async () => {
  await reset();
  store.bbdSlowDowns = 2;
  answer = () => 503;
  const r = await OH.fetchBuybackDetails(ids);
  assert.equal(r.done, 3);
  assert.equal(store.bbdSlowDowns, 2); // the next slow-down still holds 1 hour
});

for (const status of [429, 403]) {
  test(`a ${status} with a longer Retry-After holds batches off that long`, async () => {
    await reset();
    answer = (id) => (id === '2' ? status : 200);
    retryAfter = (id) => (id === '2' ? '7200' : null); // two hours, in seconds
    let t = Date.now();
    const r = await OH.fetchBuybackDetails(ids);
    assert.equal(r.rateLimited, true);
    near(r.retryAt - t, 120 * MIN);
    assert.deepEqual(hits, ['1', '2']);

    await reset();
    answer = (id) => (id === '1' ? status : 200);
    retryAfter = () => new Date(Date.now() + 180 * MIN).toUTCString(); // as a date
    t = Date.now();
    near((await OH.fetchBuybackDetails(ids)).retryAt - t, 180 * MIN);

    await reset();
    retryAfter = () => '60'; // shorter than the cooldown: the cooldown wins
    t = Date.now();
    near((await OH.fetchBuybackDetails(ids)).retryAt - t, 15 * MIN);
  });
}

test('slow-downs in a row double the hold (up to 6 h); a batch that reads fine starts over', async () => {
  await reset();
  answer = (id) => (id === '1' ? 429 : 200);
  const holds = [];
  for (let i = 0; i < 6; i++) {
    const t = Date.now();
    const r = await OH.fetchBuybackDetails(ids);
    holds.push(Math.round((r.retryAt - t) / MIN));
    store.bbdSlowDownUntil = Date.now() - 1; // that hold is over
  }
  assert.deepEqual(holds, [15, 30, 60, 120, 240, 360]);
  assert.equal(store.bbdSlowDowns, 6);

  answer = () => 200;
  await OH.fetchBuybackDetails(['1']);
  assert.equal(store.bbdSlowDowns, undefined);
  answer = (id) => (id === '2' ? 429 : 200);
  const t = Date.now();
  near((await OH.fetchBuybackDetails(ids)).retryAt - t, 15 * MIN);
});

test('a 5xx with a Retry-After stops the batch at once, until then', async () => {
  await reset();
  answer = (id) => (id === '2' ? 503 : 200);
  retryAfter = (id) => (id === '2' ? '600' : null); // ten minutes
  let t = Date.now();
  const r = await OH.fetchBuybackDetails(ids);
  assert.equal(r.rateLimited, true);
  assert.equal(r.busy, true); // RSI failing, not asking us to slow down
  assert.equal(r.done, 1);
  near(r.retryAt - t, 10 * MIN);
  assert.deepEqual(hits, ['1', '2']); // no retry sooner than asked, and 3 to 5 never asked
  assert.ok(!store.bbdSlowDowns); // not a slow-down: the next one still waits 15 min

  // Held off: the next batch asks RSI nothing and says so.
  hits = [];
  const held = await OH.fetchBuybackDetails(ids);
  assert.equal(held.held, true);
  assert.deepEqual(hits, []);

  await reset();
  answer = (id) => (id === '2' ? 503 : 200);
  retryAfter = (id) => (id === '2' ? new Date(Date.now() + 30 * MIN).toUTCString() : null);
  t = Date.now();
  near((await OH.fetchBuybackDetails(ids)).retryAt - t, 30 * MIN); // as a date
  assert.deepEqual(hits, ['1', '2']);
});

test('a slow-down is neither busy nor held', async () => {
  await reset();
  answer = (id) => (id === '1' ? 429 : 200);
  const r = await OH.fetchBuybackDetails(ids);
  assert.equal(r.busy, undefined);
  assert.equal(r.held, undefined);
});
