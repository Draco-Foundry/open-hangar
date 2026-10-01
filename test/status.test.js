'use strict';

/*
 * Kill switch (src/lib.js OH.evalStatus / getRemoteStatus / sourcePaused): a
 * status file on openhangar.space can pause a broken scan or require a fixed
 * version, and anything wrong with that file means "scan as normal".
 */

const test = require('node:test');
const assert = require('node:assert/strict');

global.window = globalThis;
const store = {};
let version = '0.2.12';
global.chrome = {
  runtime: { getManifest: () => ({ version }) },
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
global.OpenHangar = { parsePledges: () => [] };
let site; // () => Response | throws
let hits = 0;
global.fetch = async (url) => {
  if (String(url) === 'https://openhangar.space/status.json') {
    hits++;
    return site();
  }
  throw new Error('unexpected fetch ' + url); // a paused scan never reaches RSI
};
require('../src/lib.js');
const OH = globalThis.OH;

const json = (o) => () => new Response(JSON.stringify(o), { status: 200 });
const reset = () => {
  for (const k of Object.keys(store)) delete store[k];
  hits = 0;
  version = '0.2.12';
};

test('evalStatus: nothing, junk or an empty file pauses nothing', () => {
  for (const data of [null, undefined, 'x', 42, [], {}, { sources: 'x' }, { sources: { a: 1 } }]) {
    assert.deepEqual(OH.evalStatus(data, '0.2.12'), { paused: {}, banner: null });
  }
});

test('evalStatus: enabled:false pauses that source only, with a default message', () => {
  const s = OH.evalStatus({ sources: { hangar: { enabled: false } } }, '0.2.12');
  assert.deepEqual(Object.keys(s.paused), ['hangar']);
  assert.match(s.paused.hangar, /paused/);
  assert.match(s.paused.hangar, /saved data is safe/);
});

test('evalStatus: minVersion pauses older versions and names the fix', () => {
  const data = { sources: { buybacks: { minVersion: '0.2.13' } } };
  assert.match(OH.evalStatus(data, '0.2.12').paused.buybacks, /0\.2\.13/);
  assert.deepEqual(OH.evalStatus(data, '0.2.13').paused, {});
  assert.deepEqual(OH.evalStatus(data, '0.3.0').paused, {});
});

test('evalStatus: custom messages are trimmed and capped', () => {
  const long = 'x'.repeat(1000);
  const s = OH.evalStatus({ sources: { hangar: { enabled: false, message: `  ${long} ` } } });
  assert.equal(s.paused.hangar.length, 300);
});

test('evalStatus: banner shows until its end date, warn unless info', () => {
  const now = Date.parse('2026-10-05T00:00:00Z');
  const b = (banner) => OH.evalStatus({ banner }, '0.2.12', now).banner;
  assert.deepEqual(b({ message: 'Hi' }), { message: 'Hi', level: 'warn' });
  assert.deepEqual(b({ message: 'Hi', level: 'info' }), { message: 'Hi', level: 'info' });
  assert.equal(b({ message: 'Hi', until: '2026-10-04' }), null);
  assert.ok(b({ message: 'Hi', until: '2026-10-08' }));
  assert.equal(b({ message: '   ' }), null);
});

test('getRemoteStatus: caches the file between calls', async () => {
  reset();
  site = json({ sources: { hangar: { enabled: false } } });
  assert.ok((await OH.getRemoteStatus()).paused.hangar);
  assert.ok((await OH.getRemoteStatus()).paused.hangar);
  assert.equal(hits, 1);
});

test('getRemoteStatus: no file (404) means nothing paused', async () => {
  reset();
  site = () => new Response('Not found', { status: 404 });
  assert.deepEqual((await OH.getRemoteStatus()).paused, {});
});

test('getRemoteStatus: offline or a broken file keeps the last good copy', async () => {
  reset();
  site = json({ sources: { hangar: { enabled: false } } });
  await OH.getRemoteStatus();
  site = () => {
    throw new TypeError('Failed to fetch');
  };
  assert.ok((await OH.getRemoteStatus(fetch, { force: true })).paused.hangar);
  site = () => new Response('{not json', { status: 200 });
  assert.ok((await OH.getRemoteStatus(fetch, { force: true })).paused.hangar);
});

test('getRemoteStatus: offline with nothing cached scans as normal', async () => {
  reset();
  site = () => {
    throw new TypeError('Failed to fetch');
  };
  assert.deepEqual((await OH.getRemoteStatus()).paused, {});
});

test('scanSource: a paused source returns the message without touching RSI', async () => {
  reset();
  site = json({ sources: { hangar: { enabled: false, message: 'RSI broke it.' } } });
  const r = await OH.scanSource('hangar');
  assert.deepEqual(r, { ok: false, paused: true, error: 'RSI broke it.' });
});

test('getReferral: paused the same way', async () => {
  reset();
  site = json({ sources: { referrals: { minVersion: '9.0.0' } } });
  const r = await OH.getReferral();
  assert.equal(r.paused, true);
  assert.match(r.error, /9\.0\.0/);
});
