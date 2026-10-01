'use strict';
// OH.guarded: outside requests give up after a time limit, and a site that just
// failed is left alone for 10 minutes instead of being asked again on every load.
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
    },
  },
};
require('../src/lib.js');
const OH = globalThis.OH;
test.beforeEach(() => delete store.netDown);

const A = 'https://api.example.test/x';
const B = 'https://other.example.test/y';
const answer = (status) => async () => new Response('', { status });

test('a hung request is cut off at the time limit', async () => {
  const hang = (url, init) =>
    new Promise((_, reject) =>
      init.signal.addEventListener('abort', () => reject(init.signal.reason)),
    );
  const t0 = Date.now();
  await assert.rejects(OH.guarded(hang, { timeout: 50 })(A), { name: 'TimeoutError' });
  assert.ok(Date.now() - t0 < 2000);
  assert.ok(store.netDown['api.example.test']); // remembered as down
});

test('5xx and 429 mark the site down; then calls fail at once without a request', async () => {
  for (const status of [503, 429]) {
    delete store.netDown;
    await OH.guarded(answer(status))(A);
    let calls = 0;
    const spy = async () => (calls++, new Response('ok'));
    await assert.rejects(OH.guarded(spy)(A), /didn't answer recently/);
    assert.equal(calls, 0);
  }
});

test('404 and other answers are not outages', async () => {
  for (const status of [200, 404, 403]) await OH.guarded(answer(status))(A);
  assert.equal(store.netDown, undefined);
  assert.equal((await OH.guarded(answer(200))(A)).status, 200);
});

test('the memory is per site and lasts 10 minutes', async () => {
  await assert.rejects(OH.guarded(async () => Promise.reject(new TypeError('Failed to fetch')))(A));
  assert.equal((await OH.guarded(answer(200))(B)).status, 200); // other site unaffected
  store.netDown['api.example.test'] -= 10 * 60e3 + 1; // ten minutes pass
  assert.equal((await OH.guarded(answer(200))(A)).status, 200);
});

test('a caller-supplied signal is kept', async () => {
  let seen;
  const ctl = new AbortController();
  await OH.guarded(async (url, init) => ((seen = init.signal), new Response('')))(A, {
    signal: ctl.signal,
  });
  assert.equal(seen, ctl.signal);
});
