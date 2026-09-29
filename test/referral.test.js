'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = globalThis;
global.chrome = { storage: { local: { get: async () => ({}), set: async () => {} } } };
require('../src/lib.js');
const OH = globalThis.OH;

const wikitext = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'referral-events.wikitext'),
  'utf8',
);

test('parseReferralEvents reads every row of the wiki table', () => {
  const ev = OH.parseReferralEvents(wikitext);
  assert.equal(ev.length, 25);
  assert.deepEqual(ev[0], {
    start: '2019-10-28',
    end: '2019-11-05',
    name: 'Alpha 3.7.0 Free Fly',
    reward: 'Kruger Intergalactic P-52 Merlin',
    image: 'P-52 in space - Isometric.jpg',
  });
  for (const e of ev) {
    assert.match(e.start, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(e.end >= e.start, e.name);
    assert.doesNotMatch(e.reward, /<ref|\[\[|\{\{/, e.name); // no wiki markup left
  }
});

test('parseReferralEvents keeps only the referrer ("You") reward', () => {
  const ff = OH.parseReferralEvents(wikitext).find((e) => e.name === 'Foundation Festival 2026');
  assert.equal(ff.reward, 'Argo ATLS');
  assert.equal(ff.start, '2026-07-29');
});

test('parseReferralEvents ignores junk', () => {
  assert.deepEqual(OH.parseReferralEvents(''), []);
  assert.deepEqual(OH.parseReferralEvents('{| class="wikitable"\n|-\n|not a date\n|x\n|}'), []);
});

test('getReferralEvents caches for a week and survives a failed fetch', async () => {
  const store = {};
  global.chrome.storage.local.get = async (k) => ({ [k]: store[k] });
  global.chrome.storage.local.set = async (o) => Object.assign(store, o);
  let calls = 0;
  const ok = async () => {
    calls++;
    return { ok: true, json: async () => ({ parse: { wikitext: { '*': wikitext } } }) };
  };
  assert.equal((await OH.getReferralEvents(ok)).length, 25);
  assert.equal((await OH.getReferralEvents(ok)).length, 25);
  assert.equal(calls, 1);
  store.referralEvents.at = 0; // expired
  const down = async () => {
    throw new Error('offline');
  };
  assert.equal((await OH.getReferralEvents(down)).length, 25); // falls back to the cache
});

test('wikiImageUrls resolves file names in one request and caches them', async () => {
  const store = {};
  global.chrome.storage.local.get = async (k) => ({ [k]: store[k] });
  global.chrome.storage.local.set = async (o) => Object.assign(store, o);
  const urls = [];
  const fetchFn = async (url) => {
    urls.push(url);
    return {
      ok: true,
      json: async () => ({
        query: {
          pages: {
            1: {
              title: 'File:Referral Pulse.jpg',
              imageinfo: [{ thumburl: 'https://m/pulse.webp' }],
            },
            '-1': { title: 'File:Nope.jpg', missing: '' },
          },
        },
      }),
    };
  };
  const r = await OH.wikiImageUrls(
    ['Referral_Pulse.jpg', 'nope.jpg', 'Referral_Pulse.jpg'],
    fetchFn,
  );
  assert.deepEqual(r, { 'Referral_Pulse.jpg': 'https://m/pulse.webp' });
  assert.equal(urls.length, 1);
  assert.match(decodeURIComponent(urls[0]), /titles=File:Referral Pulse\.jpg\|File:Nope\.jpg/);
  await OH.wikiImageUrls(['Referral_Pulse.jpg', 'nope.jpg'], fetchFn);
  assert.equal(urls.length, 1); // both answers (found and missing) are cached
});
