'use strict';
// After an update, an opt-in that release added shows once (ui/lib/opt-ins.js newOptIns,
// ui/popup/NewOptIn.svelte; the firstRun flag): newer than the version updated from, on in
// this build, not answered, not already on; never on a fresh install. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const optIns = () => import('../ui/lib/opt-ins.js');
// OH.compareVersions, as src/lib.js has it.
const cmp = (a, b) => {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
};
const ALL = { autoScanRun: true, alerts: true, accountLogs: true, orderHistory: true };

test('an update from 0.5.10 to 0.5.12 asks about Order History only', async () => {
  const { newOptIns } = await optIns();
  assert.deepEqual(newOptIns({ from: '0.5.10', to: '0.5.12', flags: ALL, cmp }), ['orderHistory']);
});

test('from before 0.5.8: Auto Scan Daily, Account History and Order History, in order', async () => {
  const { newOptIns } = await optIns();
  assert.deepEqual(newOptIns({ from: '0.5.7', to: '0.5.12', flags: ALL, cmp }), [
    'autoDaily',
    'accountLogs',
    'orderHistory',
  ]);
});

test('answered, already on, off in the build, or a fresh install: not asked', async () => {
  const { newOptIns } = await optIns();
  const base = { from: '0.5.7', to: '0.5.12', cmp };
  assert.deepEqual(newOptIns({ ...base, flags: ALL, seen: ['autoDaily', 'accountLogs'] }), [
    'orderHistory',
  ]);
  assert.deepEqual(newOptIns({ ...base, flags: ALL, on: ['orderHistory'], seen: ['autoDaily'] }), [
    'accountLogs',
  ]);
  assert.deepEqual(
    newOptIns({ ...base, flags: { ...ALL, accountLogs: false, autoScanRun: false } }),
    ['orderHistory'],
  );
  assert.deepEqual(newOptIns({ from: null, to: '0.5.12', flags: ALL, cmp }), []);
  assert.deepEqual(newOptIns({ from: '0.5.12', to: '0.5.12', flags: ALL, cmp }), []);
});

test("every opt-in's words exist: the popup's name, the setup's tip", async () => {
  const { OPT_INS } = await optIns();
  const popup = fs.readFileSync(path.join(__dirname, '../ui/popup/copy.js'), 'utf8');
  const basic = fs.readFileSync(path.join(__dirname, '../ui/basic/copy.js'), 'utf8');
  for (const o of OPT_INS) {
    assert.ok(popup.includes(`'${o.label}':`), o.label);
    assert.ok(basic.includes(`'${o.tip}':`), o.tip);
  }
});

test('the popup shows the card and the setup button only with the firstRun flag', () => {
  const p = fs.readFileSync(path.join(__dirname, '../ui/popup/Popup.svelte'), 'utf8');
  assert.match(p, /const SETUP = flag\('firstRun'\);/);
  assert.match(p, /\{#if SETUP && ready && setupLeft\}/);
  assert.match(p, /\{:else if SETUP && ready && newOpt\}/);
});
