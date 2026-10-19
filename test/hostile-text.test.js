'use strict';

/*
 * Pledge and item names come from RSI's pages, so a hostile name must come through
 * the parser (src/scraper/parser.js) as plain text and reach the page as text: as
 * textContent, or escaped (OH.escapeHtml in src/lib.js) inside markup that goes
 * through setHTML (src/safe-html.js). Nothing in it may run. jsdom runs scripts here
 * (runScripts: 'dangerously') and alert() is counted, so anything that ran would
 * show. Run: `npm test`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><body><div id="d"></div></body>', {
  runScripts: 'dangerously',
});
const w = dom.window;
let alerts = 0;
w.alert = () => alerts++;
w.console.warn = () => {};
global.window = w;
global.document = w.document;
global.DOMParser = w.DOMParser;

require('../src/scraper/parser.js');
const OpenHangar = globalThis.OpenHangar;
w.eval(fs.readFileSync(path.join(__dirname, '../src/safe-html.js'), 'utf8'));
const { setHTML } = w.OHSafeHTML;

// OH.escapeHtml, pulled out of src/lib.js (it hangs on window.OH, which needs the
// whole extension around it).
const lib = fs.readFileSync(path.join(__dirname, '../src/lib.js'), 'utf8');
const escStart = lib.indexOf('OH.escapeHtml = function escapeHtml(s) {');
const escEnd = lib.indexOf('};', escStart) + 2;
assert.ok(escStart > 0, 'OH.escapeHtml not found');
const OH = {};
new Function('OH', lib.slice(escStart, escEnd))(OH);

const HOSTILE = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '"><svg onload=alert(1)>',
  "' onmouseover='alert(1)",
  '<a href="javascript:alert(1)">Claim</a>',
  'javascript:alert(1)',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '</span><b onclick=alert(1)>Aurora</b>',
  '&lt;b&gt;already escaped&lt;/b&gt;',
  '{@html x} ${alert(1)}',
  'Origin 300i <style>*{display:none}</style>',
  'A'.repeat(200000) + '<script>alert(1)</script>',
];

// Every event a planted handler could hang on, fired at every element.
function poke(root) {
  for (const el of [root, ...root.querySelectorAll('*')])
    for (const type of ['load', 'error', 'click', 'mouseover', 'focus'])
      el.dispatchEvent(new w.Event(type));
}

// The value as RSI's page carries it: escaped once, like any server-rendered text.
const esc = OH.escapeHtml;
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'pledges.sample.html'), 'utf8');

for (const [i, name] of HOSTILE.entries()) {
  const label = `hostile name #${i + 1} (${name.length > 60 ? name.slice(0, 40) + '…' : name})`;

  test(`${label}: the parser reads it as plain text`, () => {
    const page = fixture
      .replace('value="Origin 300i"', `value="${esc(name)}"`)
      .replace('<span class="title">300i</span>', `<span class="title">${esc(name)}</span>`);
    const p = OpenHangar.parsePledges(page).find((x) => x.id === '111');
    assert.equal(p.name, name);
    assert.equal(p.contents[0].label, name);
  });

  test(`${label}: shows as text through textContent and setHTML, and runs nothing`, () => {
    const d = w.document.getElementById('d');
    d.textContent = name;
    assert.equal(d.children.length, 0);
    assert.equal(d.textContent, name);
    setHTML(d, `<span class="pledge-name">${esc(name)}</span>`);
    assert.equal(d.children.length, 1);
    assert.equal(d.firstElementChild.children.length, 0);
    assert.equal(d.textContent, name);
    poke(d);
    assert.equal(alerts, 0);
  });
}

test('without escaping, setHTML still strips what could run', () => {
  const d = w.document.getElementById('d');
  setHTML(d, HOSTILE.slice(0, 8).join(''));
  const els = [...d.querySelectorAll('*')];
  assert.equal(d.querySelectorAll('script, iframe, style').length, 0);
  for (const el of els)
    for (const a of el.attributes) {
      assert.doesNotMatch(a.name, /^on/i, `${a.name}= on <${el.localName}>`);
      assert.doesNotMatch(a.value, /javascript:/i, `${a.name}= on <${el.localName}>`);
    }
  poke(d);
  assert.equal(alerts, 0);
});
