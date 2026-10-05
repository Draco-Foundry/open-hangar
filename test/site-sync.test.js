'use strict';
// Sync Now (src/lib.js, OH.siteSync): a browser that hasn't scanned never sends its
// empty hangar, which would replace the one already on the website (found in the
// 2026-10-04 sync test), and the server's refusals read as plain advice.
// Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');

let mem = {};
let sent = []; // bodies POSTed to /api/sync
let answer = () => new Response(JSON.stringify({ ok: true, synced_at: 123 }), { status: 200 });
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
  runtime: { getManifest: () => ({ version: '0.0.0' }) },
};
global.fetch = async (url, init) => {
  if (String(url).endsWith('/api/sync') && init?.method === 'POST') {
    sent.push(JSON.parse(init.body));
    return answer();
  }
  return new Response('', { status: 404 });
};
require('../src/lib.js');
const OH = globalThis.OH;

const linked = (db) => {
  mem = {
    siteUrl: 'https://staging.example',
    siteLink: { token: 't', name: 'pilot' },
    ...(db ? { db } : {}),
  };
  sent = [];
};
const scanned = (at) => ({
  schemaVersion: 2,
  sources: { hangar: { scannedAt: at, items: [{ id: 'p1', name: 'Gladius', value: 90 }] } },
});

test('nothing scanned: Sync Now sends nothing and says to scan first', async () => {
  linked();
  await assert.rejects(OH.siteSync(), /Scan your hangar first/);
  assert.equal(sent.length, 0);
});

test('a scanned hangar syncs and remembers when', async () => {
  linked(scanned(Date.now() - 60_000));
  const j = await OH.siteSync();
  assert.equal(j.synced_at, 123);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].sources.hangar.items.length, 1);
  assert.equal(mem.siteLink.lastSync, 123);
});

test("the server's refusals read as advice, not a status code", async () => {
  linked(scanned(Date.now() - 60_000));
  answer = () => new Response(JSON.stringify({ reason: 'older-scan' }), { status: 409 });
  await assert.rejects(OH.siteSync(), /newer scan from another browser/);
  answer = () => new Response(JSON.stringify({ reason: 'no-scan' }), { status: 409 });
  await assert.rejects(OH.siteSync(), /Scan your hangar first/);
});
