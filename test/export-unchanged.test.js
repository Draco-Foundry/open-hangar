'use strict';
// Backup files and sync bodies stay byte for byte the same (#441): the export shaping
// moved from src/lib.js into src/hangar-shape.js, and for the same stored data the
// backup file (OH.exportDB), the sync payload (OH.syncPayload, OH.syncBody) and the
// body Sync Now really sends are the text they were before the move. The hashes below
// were taken from lib.js as it was before it (this test passes on that commit too).
// Changed on purpose since: 2026-10-24, recruit and prospect rows keep only their dates
// (test/stored-data.js holds them that way; storage v4, src/lib.js MIGRATIONS).
// Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { AT, account, states } = require('./stored-data.js');

// The export says when it was made: one fixed moment, so its text is fixed too.
const NOW = Date.UTC(2026, 9, 10, 12, 0, 0);
const RealDate = Date;
global.Date = class extends RealDate {
  constructor(...a) {
    super(...(a.length ? a : [NOW]));
  }
  static now() {
    return NOW;
  }
};

let mem = {};
let posted = []; // request bodies Sync Now sent, as text
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
  runtime: { getManifest: () => ({ version: '0.2.19' }) },
};
global.fetch = async (url, init) => {
  if (String(url).endsWith('/api/v1/sync') && init?.method === 'POST') {
    posted.push(init.body);
    return new Response(JSON.stringify({ ok: true, synced_at: NOW }), { status: 200 });
  }
  return new Response('', { status: 404 });
};
require('../src/lib.js');
const OH = globalThis.OH;

const sha = (text) => createHash('sha256').update(text).digest('hex');

// Per state: the backup file's text, the sync body at the normal budget and at a small
// one (so the trimming runs too).
const GOLDEN = {
  'a fresh browser': {
    backup: '6ca24be8dc10aac70aefb46dbcdfb39dc001f83cca5f803d1774919abce333a3',
    sync: '00f88770dde31675dba9d58bfe42cadca64a86a121c22beb23bf1a7a7d9b2b98',
    small: '00f88770dde31675dba9d58bfe42cadca64a86a121c22beb23bf1a7a7d9b2b98',
  },
  'everything, signed in, with settings around it': {
    backup: 'b020635f6ad917423f1a4e7cc4fdf2a4962c034fc26f747f34ea36b8419f5554',
    sync: '316d0cc2e778cbb9d2b8bf22ce60d33d0bd589642a0b2edd692192a8b2a3e039',
    small: '9ae145663e3ebf248e3ebd3677c8971bc2fb91c5fbcd2a9e92dd9b8258604473',
  },
  'signed out of RSI: the account block comes from the owner': {
    backup: 'de8e40dffd5450cf3f56efb32816dde4e6ce51cff5fc528f77d88a16a095aa8a',
    sync: 'e8d80b28d3a303ffd210e88173e6e4317d13c6f5a31fa97ef03b05ac06d2f1b4',
    small: 'fecdac234261f927b03d31416aac0eba2d070120ec9fec6d538a7d24f4abed8b',
  },
  'no account known at all': {
    backup: '0409beafb556b57bea1ba60b592869de8f275ca312a02d3c9c8d71c9968f4514',
    sync: '762d7d0e93a215f65bb8b82de909e6b32c6e99709531a2066037fc428f8b6979',
    small: '762d7d0e93a215f65bb8b82de909e6b32c6e99709531a2066037fc428f8b6979',
  },
  'a referral block without its code (an imported backup)': {
    backup: '38bf0a3df8a357dd6aa319fbd5d64ec41f138fed5d0bba5b29dc569d9fcbec9f',
    sync: '2dd62d094632bf02c153b59112acd6578fe392d10ad708a6d213b6a3891dd566',
    small: 'a0dcad413703b991b67237a7faf6b451249fb09a12843bfa0feea191e1286a97',
  },
  'before the versioned database (hangar and scannedAt at the top)': {
    backup: 'ca661d5cf51edbbfcd9d7b48a005fc96c6486788baee0a4ae1677aedd0d161f7',
    sync: '0da5e134a4d9b575a02ee707da551c7975b7d796ab5ec00c5cbbaf58d81545a9',
    small: '0da5e134a4d9b575a02ee707da551c7975b7d796ab5ec00c5cbbaf58d81545a9',
  },
  'a v2 database with its history inside': {
    backup: '7a3c821a8f23da4ed202c8afb0deab3294dddf68193e9e58511767def7804efc',
    sync: '262c00668a10ac4bd27f01c4ffed1f8328e26f21542deb8006090af11539b309',
    small: '262c00668a10ac4bd27f01c4ffed1f8328e26f21542deb8006090af11539b309',
  },
  'damaged rows and a bad scan time': {
    backup: 'fdaaf0e75b4157411eca8a0742daa50f41f6ccde54c9be30eba40c1c84f15498',
    sync: 'd9c69a6e63dac2c20fb6c56726a28d00d0b9333e5029e5d6e7fe1597866bbd87',
    small: 'd9c69a6e63dac2c20fb6c56726a28d00d0b9333e5029e5d6e7fe1597866bbd87',
  },
  'a big account: 2,105 archived pledges and 300 in the hangar': {
    backup: 'e2fc23928f2183896534304b74fdd77db42af5b60342e9e2087ed7edef58e5e8',
    sync: '0a3a32ebc29154f31190b8f8359bdf8062312f3b7deed95c4654c825d54cbba8',
    small: 'b22352ef7ee664a8db710115dc8d339b903039d5fbfa8cc306da59ef01283987',
  },
};
const SMALL_BUDGET = 3000;

for (const { name, mem: stored } of states()) {
  test(`unchanged: ${name}`, async () => {
    mem = structuredClone(stored);
    const file = await OH.exportDB();
    await OH.storageSettled();
    const got = {
      backup: sha(JSON.stringify(file, null, 2)),
      sync: sha(OH.syncBody(OH.syncPayload(file))),
      small: sha(OH.syncBody(OH.syncPayload(file), SMALL_BUDGET)),
    };
    assert.deepEqual(got, GOLDEN[name]);
  });
}

// The body Sync Now sends, read off the request itself.
test('unchanged: the body Sync Now sends', async () => {
  const full = states().find((s) => s.name.startsWith('everything')).mem;
  mem = structuredClone(full);
  delete mem['profile:wingmate']; // one account here: its first sync isn't asked
  mem.siteLink = { token: 't', name: 'TestPilot', connectedAt: AT, lastSync: null };
  mem.account = account();
  posted = [];
  await OH.siteSync();
  await OH.storageSettled();
  assert.equal(posted.length, 1);
  assert.equal(sha(posted[0]), '316d0cc2e778cbb9d2b8bf22ce60d33d0bd589642a0b2edd692192a8b2a3e039');
});
