'use strict';
// Referral bonus events and reward pictures: openhangar.space's referral-events
// feed (OH.getReferralEvents, OH.wikiImageUrls), never the wiki itself.
const test = require('node:test');
const assert = require('node:assert/strict');

let store = {};
global.window = globalThis;
global.chrome = {
  storage: {
    local: {
      get: async (k) => (k in store ? { [k]: structuredClone(store[k]) } : {}),
      set: async (o) => Object.assign(store, structuredClone(o)),
    },
  },
};
require('../src/lib.js');
const OH = globalThis.OH;
test.beforeEach(() => (store = {}));

const FEED = {
  v: 1,
  updatedAt: '2026-10-06T08:22:37.010Z',
  credit: 'Referral events: starcitizen.tools (Referral program), CC BY-SA 4.0',
  events: [
    {
      start: '2019-10-28',
      end: '2019-11-05',
      name: 'Alpha 3.7.0 Free Fly',
      reward: 'Kruger Intergalactic P-52 Merlin',
      image: 'P-52 in space - Isometric.jpg',
      img: 'https://media.openhangar.space/p52.jpg',
    },
    {
      start: '2026-07-29',
      end: '2026-08-12',
      name: 'Foundation Festival 2026',
      reward: 'Argo ATLS',
      image: 'ATLS.jpg',
      img: null,
    },
    { start: 'soon', end: '2026-08-12', name: 'Junk', reward: 'x', image: '', img: null },
  ],
  images: {
    'Referral Pulse.jpg': 'https://media.openhangar.space/pulse.jpg',
    'Referral Gladius Statue.jpg': 'https://media.starcitizen.tools/elsewhere.jpg',
  },
};

test('getReferralEvents reads the feed, drops junk rows, keeps only our pictures', async () => {
  const ev = await OH.getReferralEvents(async () => Response.json(FEED));
  assert.equal(ev.length, 2);
  assert.deepEqual(ev[0], FEED.events[0]);
  assert.equal(ev[1].img, null);
});

test('getReferralEvents asks at most once a day and survives a failed fetch', async () => {
  let calls = 0;
  const ok = async () => {
    calls++;
    return Response.json(FEED, { headers: { etag: 'W/"abc"' } });
  };
  assert.equal((await OH.getReferralEvents(ok)).length, 2);
  assert.equal((await OH.getReferralEvents(ok)).length, 2);
  assert.equal(calls, 1);
  store.feedReferral.at = 0; // a day later
  const down = async () => {
    throw new Error('offline');
  };
  assert.equal((await OH.getReferralEvents(down)).length, 2); // the cached copy
  // Never loaded and the site is down: null, callers keep the built-in list.
  store = {};
  assert.equal(await OH.getReferralEvents(down), null);
});

test('wikiImageUrls answers from the feed: our copies only, file names with spaces or underscores', async () => {
  let calls = 0;
  const fetchFn = async () => {
    calls++;
    return Response.json(FEED);
  };
  const r = await OH.wikiImageUrls(
    ['Referral_Pulse.jpg', 'Referral Gladius Statue.jpg', 'nope.jpg', 'Referral_Pulse.jpg'],
    fetchFn,
  );
  assert.deepEqual(r, { 'Referral_Pulse.jpg': 'https://media.openhangar.space/pulse.jpg' });
  await OH.wikiImageUrls(['Referral Pulse.jpg'], fetchFn);
  assert.equal(calls, 1); // one feed for every picture, cached
});
