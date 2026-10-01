'use strict';
// Buy-back details (OH.fetchBuybackDetails): one page per buy-back, so the batch
// must stop at RSI's first "slow down" instead of pushing on, keep what it read,
// and hold off for a while before trying again.
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
global.setTimeout = (fn) => (queueMicrotask(fn), 0); // no real pauses

let answer; // id → status
let hits;
global.fetch = async (url) => {
  const m = String(url).match(/\/pledge\/buyback\/(\d+)/);
  if (!m) return new Response('', { status: 404 });
  hits.push(m[1]);
  return new Response('<html>buy-back</html>', { status: answer(m[1]) });
};
require('../src/lib.js');
const OH = globalThis.OH;

const ids = ['1', '2', '3', '4', '5'];
async function reset() {
  for (const k of Object.keys(store)) delete store[k];
  await OH.pruneBuybackDetails([]); // forget details from the last test
  hits = [];
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
