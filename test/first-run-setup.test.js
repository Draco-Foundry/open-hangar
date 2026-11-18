'use strict';
// First-run setup (the firstRun flag; ui/basic/Setup.svelte, src/background.js): opened
// once on a fresh install, never on an update; every switch off until the pilot turns it
// on, drawn by the popup's own row with the popup's words; Before You Connect on every
// browser before anything is sent, as I Agree or Decline (no Skip: mockup v4). Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { STORE_FLAGS } = require('./bridge-env.js');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('background: the setup tab opens on a fresh install only, with the flag on', () => {
  const bg = read('src/background.js');
  const at = bg.indexOf("details.reason === 'install'");
  assert.ok(at > 0, 'reads the install reason');
  const line = bg.slice(at, bg.indexOf('\n', at));
  assert.match(line, /self\.OH\.flags\.firstRun/, 'only with the firstRun flag');
  assert.match(line, /!details\.temporary/, "not for Firefox's temporary add-on");
  assert.match(bg.slice(at, at + 300), /basic\.html#setup/);
  assert.ok(at < bg.indexOf("if (details.reason !== 'update') return;"), 'before the update work');
  assert.equal(STORE_FLAGS.firstRun, false, 'off in the store build');
});

test("setup: the popup's switch row and words, I Agree or Decline, no Skip, one ⓘ", () => {
  const s = read('ui/basic/Setup.svelte');
  for (const key of [
    'popup.auto-scan',
    'popup.notifications',
    'popup.account-logs',
    'popup.order-history',
  ])
    assert.ok(s.includes(`pt('${key}')`), key);
  assert.equal((s.match(/<OptInRow\b/g) || []).length, 4, 'four switches, all OptInRow');
  assert.match(s, /id="bp-setup-agree" onclick=\{agree\}/);
  assert.match(s, /id="bp-setup-decline" onclick=\{decline\}/);
  assert.doesNotMatch(s, /setup-skip|setup.skip/, 'no Skip: the pilot answers');
  // I Agree is the click that agrees, before Connect; Decline sends nothing.
  const agree = s.slice(s.indexOf('async function agree()'), s.indexOf('function decline()'));
  assert.ok(agree.indexOf('setupAgree()') < agree.indexOf('connect()'), 'agree, then connect');
  const decline = s.slice(s.indexOf('function decline()'), s.indexOf('function scanNow'));
  assert.doesNotMatch(decline, /setupAgree|connect\(/);
  // Every ⓘ is the shared one; the Decline and Firefox pop-ups are Before You Connect's
  // own approved lines.
  assert.doesNotMatch(s, /class="oh-tip/, 'no ⓘ drawn by hand');
  assert.match(s, /text=\{t\('consent\.if-no'\)\}/);
  assert.match(s, /note=\{t\('consent\.change'\)\}/);
  assert.match(s, /text=\{t\('consent\.why-firefox'\)\}/);
  const card = read('ui/basic/FirefoxCard.svelte');
  for (const key of ['consent.if-no', 'consent.change', 'consent.why-firefox'])
    assert.ok(card.includes(`t('${key}')`), `the card shows ${key}`);
  // Nothing turned on for the pilot: the switches start from what's stored (off when
  // missing), never set on load.
  const mount = s.slice(s.indexOf('onMount('), s.indexOf('// Setup is done'));
  assert.doesNotMatch(mount, /storage\.local\.set|setOrderHistory|wantAccountLogs/);
});

test('setup words: unapproved lines are marked placeholders', () => {
  const c = read('ui/basic/copy.js');
  const block = c.slice(c.indexOf('--- First-run setup'));
  // Approved ones sit outside the placeholder blocks.
  for (const key of ['setup.settings', 'setup.not-connected']) {
    const at = block.indexOf(`'${key}'`);
    assert.ok(at > 0, key);
    const before = block.slice(0, at);
    assert.ok(
      before.lastIndexOf('// Approved') > before.lastIndexOf('PLACEHOLDER'),
      `${key} approved`,
    );
  }
  for (const key of [
    'setup.sends-h',
    'setup.sends',
    'setup.never-h',
    'setup.never',
    'setup.agree',
    'setup.decline',
    'setup.tip-auto',
    'setup.tip-logs',
    'setup.tip-orders',
    'setup.tip-notify',
  ]) {
    const at = block.indexOf(`'${key}'`);
    assert.ok(at > 0, key);
    assert.match(block.slice(0, at), /PLACEHOLDER: Needs Words, not approved/);
  }
});
