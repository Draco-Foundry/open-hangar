'use strict';
// The scan's progress weighted by time (ui/lib/scan-pace.js): each part's share is its
// requests times its time per request, from the last scan's pace. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');

const pace = () => import('../ui/lib/scan-pace.js');
const S = 1000;

// A last scan like the owner's (2026-11-02): 8 hangar pages, 3 buy-back pages, then 30
// buy-back details at 4.5 s each, most of the scan's time.
const LAST = {
  account: { ms: 800, n: 1 },
  hangar: { ms: 1200, n: 8 },
  buybacks: { ms: 1000, n: 3 },
  referrals: { ms: 700, n: 3 },
  packs: { ms: 4500, n: 30 },
  sync: { ms: 1500, n: 1 },
};

// Runs a scan through `steps` ([t, progress]) and gives each step's estimate.
async function run(prev, steps) {
  const { createPace } = await pace();
  const p = createPace(prev, 0);
  return { out: steps.map(([t, s]) => p.step(s, t)), p };
}

test('scan pace: Buy-Back Details at 13 of 30 is under half full, not 92%', async () => {
  const { out } = await run(LAST, [
    [0, { part: 'account' }],
    [1 * S, { part: 'hangar', page: 8, pages: 8 }],
    [11 * S, { part: 'buybacks', page: 3, pages: 3 }],
    [14 * S, { part: 'referrals', page: 3, pages: 3 }],
    [16 * S, { part: 'packs', page: 0, count: 30 }],
    [75 * S, { part: 'packs', page: 13, count: 30 }],
  ]);
  const at = out.at(-1);
  assert.ok(at.f > 0.35 && at.f < 0.55, `fill ${at.f}`);
  // The next detail moves it on by about one detail's share, never past the part's end.
  assert.ok(at.next > at.f && at.next - at.f < 0.05);
  // 17 details at about 4.5 s, then the sync: over a minute left.
  assert.ok(at.left > 60 * S && at.left < 120 * S, `left ${at.left}`);
  assert.equal(at.quick, false);
});

test('scan pace: the fill only moves forward and stays within 0 to 1', async () => {
  const { out } = await run(LAST, [
    [0, { part: 'start' }],
    [0, { part: 'account' }],
    [1 * S, { part: 'hangar', page: 1, pages: null }],
    [2 * S, { part: 'hangar', page: 4, pages: 12 }], // RSI's pager shows more than last time
    [9 * S, { part: 'hangar', page: 12, pages: 12 }],
    [20 * S, { part: 'buybacks', page: 1, pages: 3 }],
    [24 * S, { part: 'packs', page: 0, count: 2 }], // fewer details than last time
    [30 * S, { part: 'packs', page: 2, count: 2 }],
    [31 * S, { part: 'sync' }],
  ]);
  for (let i = 1; i < out.length; i++) assert.ok(out[i].f >= out[i - 1].f, `step ${i}`);
  assert.ok(out.every((o) => o.f >= 0 && o.f <= 1 && o.next >= o.f && o.next <= 1));
  // Skipped referrals and a short packs part: the sync is near the end.
  assert.ok(out.at(-1).f > 0.8, `sync at ${out.at(-1).f}`);
});

test('scan pace: a page being retried is not read yet', async () => {
  const { createPace } = await pace();
  const a = createPace(LAST, 0);
  const b = createPace(LAST, 0);
  a.step({ part: 'account' }, 0);
  b.step({ part: 'account' }, 0);
  const retry = a.step({ part: 'hangar', page: 3, pages: 8, retry: { attempt: 1, of: 3 } }, S);
  const two = b.step({ part: 'hangar', page: 2, pages: 8 }, S);
  assert.equal(retry.f, two.f);
});

test('scan pace: a quick repeat scan says so, and stops saying so after 5 s', async () => {
  // A last scan that found nothing new: one page each, no details, no logs.
  const { createPace } = await pace();
  const last = createPace(null, 0);
  last.step({ part: 'account' }, 0);
  last.step({ part: 'hangar', page: 1, pages: 1 }, 500);
  last.step({ part: 'buybacks', page: 1, pages: 1 }, 1300);
  last.step({ part: 'referrals', page: 3, pages: 3 }, 2100);
  const quick = last.result(3000);
  assert.equal(quick.packs.n, 0);
  const { out } = await run(quick, [
    [0, { part: 'account' }],
    [1 * S, { part: 'hangar', page: 1, pages: 1 }],
    [6 * S, { part: 'buybacks', page: 0, pages: null }],
  ]);
  assert.equal(out[0].quick, true);
  assert.equal(out[1].quick, true);
  assert.equal(out[2].quick, false);
  // A first scan (no pace yet) is never quick: the guesses expect a full one.
  const first = await run(null, [[0, { part: 'account' }]]);
  assert.equal(first.out[0].quick, false);
});

test('scan pace: time left follows this scan when it runs slower than the last', async () => {
  const steps = (k) => [
    [0, { part: 'account' }],
    [k * 1 * S, { part: 'hangar', page: 8, pages: 8 }],
    [k * 11 * S, { part: 'buybacks', page: 3, pages: 3 }],
  ];
  const same = (await run(LAST, steps(1))).out.at(-1);
  const slow = (await run(LAST, steps(2))).out.at(-1);
  assert.equal(slow.f, same.f);
  assert.ok(slow.left > same.left * 1.5, `${slow.left} vs ${same.left}`);
});

test('scan pace: the report keeps each part timed, mixed evenly with the last scan', async () => {
  const { p } = await run(LAST, [
    [0, { part: 'account' }],
    [1 * S, { part: 'hangar', page: 4, pages: 4 }],
    [9 * S, { part: 'buybacks', page: 2, pages: 2 }], // hangar: 8 s for 4 pages = 2000
    [11 * S, { part: 'packs', page: 10, count: 10 }], // buy-backs: 2 s for 2 pages = 1000
  ]);
  const got = p.result(61 * S); // packs: 50 s for 10 = 5000
  assert.deepEqual(got.hangar, { ms: (1200 + 2000) / 2, n: 4 });
  assert.deepEqual(got.buybacks, { ms: 1000, n: 2 });
  assert.deepEqual(got.packs, { ms: (4500 + 5000) / 2, n: 10 });
  // Not read this time: the last time per request kept, no requests.
  assert.deepEqual(got.referrals, { ms: 700, n: 0 });
  assert.deepEqual(got.sync, { ms: 1500, n: 0 });
});

test('scan pace: a stored pace is cleaned before use', async () => {
  const { cleanPace } = await pace();
  assert.deepEqual(cleanPace(null), {});
  assert.deepEqual(cleanPace('x'), {});
  assert.deepEqual(
    cleanPace({ hangar: { ms: 1e9, n: 2.4 }, packs: { ms: -1, n: 1 }, made: { ms: 1, n: 1 } }),
    { hangar: { ms: 60000, n: 2 } },
  );
});
