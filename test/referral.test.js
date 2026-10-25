'use strict';
// Referral bonus events and reward pictures: openhangar.space's referral-events
// feed (OH.getReferralEvents, OH.wikiImageUrls), never the wiki itself. And the referral
// part of a scan (OH.getReferral) in Auto Scan Daily's mode (#666).
const test = require('node:test');
const assert = require('node:assert/strict');

let store = {};
global.window = globalThis;
global.chrome = {
  storage: {
    local: {
      get: async (k) =>
        Object.fromEntries(
          [].concat(k).flatMap((x) => (x in store ? [[x, structuredClone(store[x])]] : [])),
        ),
      set: async (o) => Object.assign(store, structuredClone(o)),
      remove: async (k) => [].concat(k).forEach((x) => delete store[x]),
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

// --- The referral part in Auto Scan Daily's mode (#666) ----------------------------------
// RSI's referral lists (GraphQL): the legacy recruits over two pages, the current ones
// and the prospects on one each. `fail(campaign, converted, page)` → a Response to
// answer instead, or nothing.
const ACCOUNT = {
  loggedIn: true,
  nickname: 'Test_Pilot',
  referral: { code: 'STAR-ABCD-1234', url: null },
};
const rows = (n, from = 0) =>
  Array.from({ length: n }, (_, i) => ({
    id: `r${from + i}`,
    nickname: `Recruit${from + i}`,
    displayName: `Recruit ${from + i}`,
    avatar: 'https://robertsspaceindustries.com/media/x/avatar.png',
    enlistedOn: '2025-02-03',
    convertedOn: from < 100 ? '2025-03-04' : null,
  }));
function referralRsi(fail = () => null) {
  const asked = [];
  global.fetch = async (url, init) => {
    const v = JSON.parse(init.body).variables;
    asked.push(`${v.campaignId}/${v.converted}/${v.page}`);
    const bad = fail(v.campaignId, v.converted, v.page);
    if (bad) return bad;
    const list = v.campaignId === '1' ? rows(60) : v.converted ? rows(3) : rows(2, 100).slice(0, 2);
    const data = list.slice((v.page - 1) * 50, v.page * 50);
    return Response.json({
      data: { referralRecruitsList: { recruitsCount: 60, prospectsCount: 2, data } },
    });
  };
  return asked;
}
async function withReferrals(fn) {
  const was = { fetch: global.fetch, pause: OH.autoPause };
  OH.autoPause = async () => {};
  store = { remoteStatus: { at: Date.now(), data: null } }; // status.json as cached
  try {
    await fn();
  } finally {
    global.fetch = was.fetch;
    OH.autoPause = was.pause;
  }
}

test('getReferral in auto mode: a list that fails or comes back short saves nothing', async () => {
  await withReferrals(async () => {
    // The legacy recruits' second page fails (RSI down, Retry-After).
    referralRsi((c, conv, page) =>
      c === '1' && page === 2
        ? new Response('', { status: 503, headers: { 'retry-after': '300' } })
        : null,
    );
    const r = await OH.getReferral(null, { account: ACCOUNT, auto: true });
    assert.equal(r.ok, false);
    assert.equal(r.unfinished, true);
    assert.equal(r.rsiDown, true);
    assert.equal(r.retryAfter, '300');
    assert.equal(store.db, undefined, 'nothing saved');
    // A 429 on the prospects' first page: the same, nothing merged.
    referralRsi((c, conv) =>
      c === '2' && !conv
        ? new Response('', { status: 429, headers: { 'retry-after': '60' } })
        : null,
    );
    const p = await OH.getReferral(null, { account: ACCOUNT, auto: true });
    assert.equal(p.unfinished, true);
    assert.equal(p.retryAfter, '60');
    assert.equal(store.db, undefined);
  });
});

test('getReferral: the keep gate decides in auto mode; a pressed Scan still merges', async () => {
  await withReferrals(async () => {
    const asked = referralRsi();
    const seen = [];
    const no = await OH.getReferral(null, {
      account: ACCOUNT,
      auto: true,
      keep: async ({ referral }) => (seen.push(referral.recruitsList.length), false),
    });
    assert.deepEqual(no, { ok: false, refused: true });
    assert.deepEqual(seen, [60]);
    assert.equal(store.db, undefined, 'refused: nothing saved');
    assert.deepEqual(asked, ['1/true/1', '1/true/2', '2/true/1', '2/false/1']);
    const yes = await OH.getReferral(null, {
      account: ACCOUNT,
      auto: true,
      keep: async () => true,
    });
    assert.equal(yes.ok, true);
    assert.equal(store.db.sources.referral.items.recruitsList.length, 60);
    // Pressed Scan, the prospects failing: the saved list stands in for them, as before.
    referralRsi((c, conv) => (c === '2' && !conv ? new Response('', { status: 500 }) : null));
    const manual = await OH.getReferral(null, { account: ACCOUNT });
    assert.equal(manual.ok, true);
    assert.equal(manual.partial, 'prospects');
    assert.equal(store.db.sources.referral.items.prospectsList.length, 2, 'the last good list');
  });
});

// Who a recruit or prospect is (RSI id, handle, moniker, avatar) is never kept: only the
// dates, and each recruit's campaign, worked out from the ids while the scan runs.
test('getReferral keeps dates and campaigns only, never who', async () => {
  await withReferrals(async () => {
    referralRsi();
    const r = await OH.getReferral(null, { account: ACCOUNT });
    assert.equal(r.ok, true);
    const items = store.db.sources.referral.items;
    assert.equal(items.recruitsList.length, 60);
    // The current campaign's three (r0 to r2) are tagged so; the rest are legacy.
    assert.deepEqual(
      items.recruitsList.slice(0, 4).map((x) => x.campaign),
      ['current', 'current', 'current', 'legacy'],
    );
    for (const row of items.recruitsList)
      assert.deepEqual(Object.keys(row), ['enlistedOn', 'convertedOn', 'campaign']);
    assert.deepEqual(items.prospectsList, [
      { enlistedOn: '2025-02-03', convertedOn: null },
      { enlistedOn: '2025-02-03', convertedOn: null },
    ]);
    assert.doesNotMatch(JSON.stringify(store.db), /Recruit|avatar\.png|"r\d+"/);
    // The current recruits failing: the last scan's tagged list stands in whole.
    referralRsi((c, conv) => (c === '2' && conv ? new Response('', { status: 500 }) : null));
    const again = await OH.getReferral(null, { account: ACCOUNT });
    assert.equal(again.partial, 'current recruits');
    assert.deepEqual(store.db.sources.referral.items.recruitsList, items.recruitsList);
  });
});
