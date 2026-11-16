'use strict';
// First-run setup (the firstRun flag; ui/basic/Setup.svelte, src/background.js): opened
// once on a fresh install, never on an update; every switch off until the pilot turns it
// on, drawn by the popup's own row with the popup's words; Before You Connect on every
// browser before anything is sent. Run: `npm test`.
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

test("setup: the popup's switch row and words, Before You Connect, Skip on every step", () => {
  const s = read('ui/basic/Setup.svelte');
  for (const key of [
    'popup.auto-scan',
    'popup.notifications',
    'popup.account-logs',
    'popup.order-history',
  ])
    assert.ok(s.includes(`pt('${key}')`), key);
  assert.equal((s.match(/<OptInRow\b/g) || []).length, 4, 'four switches, all OptInRow');
  assert.match(s, /<FirefoxCard firefox=\{FIREFOX\} onContinue=\{agree\} onClose=\{notNow\}/);
  assert.match(s, /id="bp-setup-skip"/);
  // Nothing turned on for the pilot: the switches start from what's stored (off when
  // missing), never set on load.
  const mount = s.slice(s.indexOf('onMount('), s.indexOf('// Setup is done'));
  assert.doesNotMatch(mount, /storage\.local\.set|setOrderHistory|wantAccountLogs/);
});

test('setup words: unapproved lines are marked placeholders', () => {
  const c = read('ui/basic/copy.js');
  const block = c.slice(c.indexOf('--- First-run setup'));
  for (const key of ['setup.about', 'setup.connect', 'setup.scan', 'setup.tip-auto']) {
    const at = block.indexOf(`'${key}'`);
    assert.ok(at > 0, key);
    assert.match(block.slice(0, at), /PLACEHOLDER: Needs Words, not approved/);
  }
});
