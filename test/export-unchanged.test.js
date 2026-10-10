'use strict';
// Backup files and sync bodies stay byte for byte the same (#441): the export shaping
// moved from src/lib.js into src/hangar-shape.js, and for the same stored data the
// backup file (OH.exportDB), the sync payload (OH.syncPayload, OH.syncBody) and the
// body Sync Now really sends are the text they were before the move. The hashes below
// were taken from lib.js as it was before it (this test passes on that commit too).
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
    backup: 'd51aa6b71154d201a3019927e27b17b865e56a2c6c25edfea1fec974b77bcbd3',
    sync: '1be5e9be7ece68d5af1bf1d774617bafb69cbc494822fa335678ce3057545eec',
    small: 'ffb7d5cadd475d77c4a34cc306bb25d43d21d165a4de9e5fcb9b48837e4bb482',
  },
  'signed out of RSI: the account block comes from the owner': {
    backup: '0b83239e99cb9128664f73df193e040431561e7776076e9b752c2f2fbcb87705',
    sync: '882439afc6e31516a0e79bfbc8817390988c9c57e05484b18fb40f7c4965b6a1',
    small: '19f8bc5c90277c180a5a2279f559077d8c887634b6ed6767d5351da014078484',
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
    backup: 'dadb7cc95a4304eab294d4e9dfe5c096d01d3b079b4c93b0f3acc51cd8042a8e',
    sync: '1300780c5be92508768005077ceaeff26f3e756d843e2abf18d8345e78d295aa',
    small: '1300780c5be92508768005077ceaeff26f3e756d843e2abf18d8345e78d295aa',
  },
  'damaged rows and a bad scan time': {
    backup: 'fdaaf0e75b4157411eca8a0742daa50f41f6ccde54c9be30eba40c1c84f15498',
    sync: 'd9c69a6e63dac2c20fb6c56726a28d00d0b9333e5029e5d6e7fe1597866bbd87',
    small: 'd9c69a6e63dac2c20fb6c56726a28d00d0b9333e5029e5d6e7fe1597866bbd87',
  },
  'a big account: 2,105 archived pledges and 300 in the hangar': {
    backup: '5991e39217a8199f565c83448b1b8074a3ecb43f9f35457649da9fd26b012d53',
    sync: 'bce5faf4f4637ce14d76397e847bc1505a929ab45c4181a9e5bf76bd82df8b29',
    small: '8672a1d4de2a79137da164c25e4ec3cc0be4eee0e93d8bbd18abe7d5b878eb56',
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
  assert.equal(sha(posted[0]), '1be5e9be7ece68d5af1bf1d774617bafb69cbc494822fa335678ce3057545eec');
});
