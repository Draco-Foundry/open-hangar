'use strict';
// Every page bundle that imports its own CSS (./x.css) gets a ui/<page>.css from Vite
// (CSS shared by several pages lands in ui/shared.css instead), and
// dashboard.html has to link it by hand: a page stylesheet that is built but never
// linked silently does nothing. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (page) => fs.readFileSync(path.join(ROOT, 'src', page), 'utf8');
// Pages with an HTML file of their own (the connector's popup and basic page); the rest are mounted
// into dashboard.html.
const OWN_PAGE = { popup: 'popup.html', basic: 'basic.html' };
const config = fs.readFileSync(path.join(ROOT, 'vite.config.mjs'), 'utf8');

test('every page entry that imports CSS has its stylesheet linked in its page', () => {
  const entries = [...config.matchAll(/^\s*(\w+): '(ui\/[\w-]+\/main\.js)'/gm)];
  assert.ok(entries.length > 5, 'found the Vite entries');
  for (const [, name, file] of entries) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    if (!/^import '\.\/[^']+\.css';/m.test(src)) continue;
    const page = OWN_PAGE[name] || 'dashboard.html';
    assert.ok(
      read(page).includes(`<link rel="stylesheet" href="ui/${name}.css" />`),
      `${file} imports CSS, so ${page} needs <link rel="stylesheet" href="ui/${name}.css" />`,
    );
  }
});

test("the connector's pages link the Clean Pro look (ui/tokens.css) before their own", () => {
  assert.match(config, /tokens: 'ui\/tokens\.css'/, 'built on its own');
  for (const [name, page] of Object.entries(OWN_PAGE)) {
    const html = read(page);
    const at = html.indexOf('<link rel="stylesheet" href="ui/tokens.css" />');
    assert.ok(at >= 0 && at < html.indexOf(`href="ui/${name}.css"`), page);
  }
});
