'use strict';
// The code of the player who recruited you (RSI's referrerReferralCode) isn't kept: the
// account read (OH.getAccount, src/lib.js) leaves it out, the update clears a copy an
// older version cached (src/background.js), and it's in none of the backup file, the
// sync body or the hangar view. The player's own referral code and link stay as they
// were. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { account, states } = require('./stored-data.js');
const { loadBackground } = require('./bridge-env.js');

const NOW = Date.UTC(2026, 9, 10, 12, 0, 0);
const RECRUITER = 'STAR-RCRT-0001'; // the recruiter's code in test/stored-data.js too
const CODE = 'STAR-TEST-0000';
const LINK = `https://robertsspaceindustries.com/enlist?referral=${CODE}`;
const DASHBOARD = 'https://robertsspaceindustries.com/en/account/dashboard';

let mem = {};
let fetched = [];
global.window = globalThis;
global.chrome = {
  storage: {
    local: {
      get: async (keys) => {
        if (keys == null) return structuredClone(mem);
        const out = {};
        for (const k of [].concat(keys)) if (k in mem) out[k] = structuredClone(mem[k]);
        return out;
      },
      set: async (obj) => Object.assign(mem, structuredClone(obj)),
      remove: async (keys) => [].concat(keys).forEach((k) => delete mem[k]),
    },
  },
  runtime: { getManifest: () => ({ version: '0.3.0' }) },
};

// RSI's dashboard as it embeds the account: HTML-escaped JSON blobs, the referral one
// separate from the nickname one, with the recruiter's code next to the player's own.
const blob = (o) => JSON.stringify(o).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const DASHBOARD_HTML = `<html><body>
<div data-account="${blob({ nickname: 'TestPilot', displayname: 'TestPilot Prime', creditsData: [] })}"></div>
<div data-referral="${blob({
  referralCode: CODE,
  referralUrl: encodeURIComponent(LINK),
  referralUrlCopy: LINK,
  referrerReferralCode: RECRUITER,
})}"></div>
</body></html>`;
global.fetch = async (url) => {
  fetched.push(String(url));
  if (String(url) === DASHBOARD) return new Response(DASHBOARD_HTML, { status: 200 });
  return new Response('', { status: 404 }); // the dossier, and anything else
};
require('../src/lib.js');
const OH = globalThis.OH;
const SHAPE = globalThis.OHShape;

test('the account read keeps your own code and link, never the recruiter code', async () => {
  mem = {};
  fetched = [];
  const acct = await OH.getAccount({ force: true });
  assert.equal(fetched[0], DASHBOARD);
  assert.equal(acct.loggedIn, true);
  assert.equal(acct.nickname, 'TestPilot');
  assert.deepEqual(acct.referral, { code: CODE, url: LINK });
  assert.deepEqual(mem.account.referral, { code: CODE, url: LINK });
  assert.ok(!JSON.stringify(mem).includes(RECRUITER), 'not in storage');
  assert.ok(!/referrer/i.test(JSON.stringify(mem)), 'no recruiter key either');
});

test('an older cached account is not served as current: it is read again, without it', async () => {
  mem = { account: { ...account(), fetchedAt: Date.now() } }; // fresh, but cache v6
  fetched = [];
  const acct = await OH.getAccount();
  assert.equal(fetched[0], DASHBOARD);
  assert.deepEqual(acct.referral, { code: CODE, url: LINK });
  assert.ok(!JSON.stringify(mem.account).includes(RECRUITER));
});

// The background worker as the store builds it (test/bridge-env.js), with its install
// listener caught: bridge-env's stand-in browser lets that one go. → the update.
function worker(local) {
  const installed = [];
  const { chrome } = loadBackground({ local });
  const runtime = { ...chrome.runtime, onInstalled: { addListener: (f) => installed.push(f) } };
  const quiet = { ...console, debug() {} }; // its "installed: update" line
  loadBackground({ globals: { chrome: { ...chrome, runtime }, console: quiet } });
  assert.equal(installed.length, 1, 'one install listener');
  return (details) => Promise.all(installed.map((f) => f(details)));
}

test('the update clears the recruiter code from a cached account, and nothing else', async () => {
  const local = { account: account() };
  await worker(local)({ reason: 'update', previousVersion: '0.3.1' });
  const want = account();
  delete want.referral.referrerCode;
  assert.deepEqual(local.account, want, 'your own code and link stay');
  assert.ok(!JSON.stringify(local).includes(RECRUITER));
});

test('the update leaves an account without it as it is, and writes none', async () => {
  for (const acct of [
    { loggedIn: false, fetchedAt: 1 },
    { ...account(), referral: null },
    { ...account(), referral: { code: CODE, url: LINK } },
  ]) {
    const local = { account: structuredClone(acct) };
    await worker(local)({ reason: 'update', previousVersion: '0.3.1' });
    assert.deepEqual(local.account, acct);
  }
  const none = {};
  await worker(none)({ reason: 'update', previousVersion: '0.3.1' });
  assert.equal('account' in none, false);
  // Installed fresh: there's nothing older to clear.
  const fresh = { account: account() };
  await worker(fresh)({ reason: 'install' });
  assert.deepEqual(fresh.account, account());
});

test('the recruiter code is in none of the backup, the sync body or the hangar view', async () => {
  const all = states();
  assert.ok(
    all.some((s) => JSON.stringify(s.mem).includes(RECRUITER)),
    'stored data that has it',
  );
  const get = (keys) => chrome.storage.local.get(keys);
  for (const { name, mem: stored } of all) {
    mem = structuredClone(stored);
    const file = await OH.exportDB();
    await OH.storageSettled();
    const view = await SHAPE.readHangarView(get, { appVersion: '0.3.0', now: NOW });
    const out = {
      backup: JSON.stringify(file),
      sync: OH.syncBody(OH.syncPayload(file)),
      small: OH.syncBody(OH.syncPayload(file), 3000),
      view: JSON.stringify(view),
    };
    for (const [what, text] of Object.entries(out)) {
      assert.ok(!text.includes(RECRUITER), `${name}: ${what}`);
      assert.ok(!/referrer/i.test(text), `${name}: ${what} has no recruiter key`);
    }
  }
});

test('a parked account and the recovery copy hold the database, never the cached account', async () => {
  mem = structuredClone(states()[1].mem);
  await OH.switchProfile('Wingmate');
  assert.ok(mem['profile:testpilot'], 'TestPilot parked');
  assert.equal('account' in mem['profile:testpilot'], false);
  assert.ok(!JSON.stringify(mem['profile:testpilot']).includes(RECRUITER));
  mem = structuredClone(states()[1].mem);
  await OH.clearData({ backup: true });
  assert.ok(mem.dbRecovery, 'a recovery copy');
  assert.ok(!JSON.stringify(mem.dbRecovery).includes(RECRUITER));
});
