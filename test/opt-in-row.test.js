'use strict';
// One switch row (ui/lib/OptInRow.svelte): every opt-in switch is drawn by it, on the
// popup's Settings tab and in the first-run setup, so a switch never looks one way in
// one place and another way elsewhere (owner's One Display rule). A second drawing of
// a switch fails here. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
function files(dir, out = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files(p, out);
    else if (/\.(svelte|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

// The Wishlist's per-item Remind Me (pp-wsw) and the dashboard's Customize are other
// controls with their own look, not opt-in settings; they're left to a follow-up.
test('only OptInRow draws the settings switch', () => {
  const own = [path.join('lib', 'OptInRow.svelte'), path.join('lib', 'opt-in-row.css')];
  const others = files('ui').filter((f) => !own.some((o) => f.endsWith(o)));
  const bad = others.filter((f) => {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    return /\bpp-sw\b/.test(s);
  });
  assert.deepEqual(bad, [], 'a switch drawn outside ui/lib/OptInRow.svelte');
});

test("Settings' opt-ins all go through OptInRow", () => {
  const s = fs.readFileSync(path.join(ROOT, 'ui/popup/Settings.svelte'), 'utf8');
  for (const id of ['pp-daily', 'pp-auto', 'pp-nt', 'pp-logs', 'pp-orders'])
    assert.match(s, new RegExp(`<OptInRow\\s+id="${id}"`), id);
});

test('its look is imported into each page that shows it, never left in ui/shared.css', () => {
  const row = fs.readFileSync(path.join(ROOT, 'ui/lib/OptInRow.svelte'), 'utf8');
  assert.doesNotMatch(
    row,
    /<style>/,
    'a component style lands in ui/shared.css, which the popup never loads',
  );
  const popup = fs.readFileSync(path.join(ROOT, 'ui/popup/popup.css'), 'utf8');
  assert.ok(popup.includes("@import '../lib/opt-in-row.css';"), 'popup.css imports the look');
  const basic = fs.readFileSync(path.join(ROOT, 'ui/basic/basic.css'), 'utf8');
  assert.ok(basic.includes("@import '../lib/opt-in-row.css';"), 'basic.css imports the look');
});
