'use strict';

/*
 * setHTML() in src/safe-html.js: the allowlist sanitizer, the one way markup
 * reaches a page. Run in jsdom. Run: `npm test`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const src = fs.readFileSync(path.join(__dirname, '../src/safe-html.js'), 'utf8');

const dom = new JSDOM(
  '<!doctype html><body><div id="d"></div><table><tbody id="tb"></tbody></table>' +
    '<svg id="ic" viewBox="0 0 24 24"></svg></body>',
  {
    runScripts: 'outside-only',
  },
);
const w = dom.window;
const dropped = [];
w.console.warn = (m) => dropped.push(m);
w.eval(`${src}; window.setHTML = self.OHSafeHTML.setHTML;`);
const d = w.document.getElementById('d');

test('keeps the markup the dashboard uses', () => {
  w.setHTML(
    d,
    '<div class="card" data-id="7"><a href="https://robertsspaceindustries.com/x" target="_blank">x</a><img src="img/a.png" alt=""></div>',
  );
  assert.equal(d.querySelector('.card').dataset.id, '7');
  assert.equal(d.querySelector('a').getAttribute('href'), 'https://robertsspaceindustries.com/x');
  assert.equal(d.querySelector('img').getAttribute('src'), 'img/a.png');
});

test('strips anything that could run code or load things', () => {
  w.setHTML(
    d,
    '<img src="javascript:alert(1)" onerror="alert(2)"><script>alert(3)</script>' +
      '<iframe src="https://evil.example"></iframe><a href="javascript:alert(4)">l</a>' +
      '<b style="background:url(https://evil.example/t.png)">t</b><svg onload="alert(5)"></svg>',
  );
  const html = d.innerHTML;
  assert.doesNotMatch(html, /script|iframe|onerror|onload|javascript:|url\(/i);
  assert.equal(d.querySelector('img').hasAttribute('src'), false);
  assert.equal(d.querySelector('a').hasAttribute('href'), false);
  assert.equal(d.querySelector('b').hasAttribute('style'), false);
});

test('table rows survive when rendering into a tbody', () => {
  const tb = w.document.getElementById('tb');
  w.setHTML(tb, '<tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr>');
  assert.equal(tb.querySelectorAll('tr').length, 2);
  assert.equal(tb.querySelectorAll('td').length, 4);
});

test('empty input clears the element', () => {
  w.setHTML(d, '<p>x</p>');
  w.setHTML(d, '');
  assert.equal(d.childNodes.length, 0);
});

test('markup for an <svg> parses as SVG', () => {
  const ic = w.document.getElementById('ic');
  w.setHTML(
    ic,
    '<path d="M3 20V9"/><circle cx="9" cy="8" r="3.5"/><foreignObject><b>x</b></foreignObject>',
  );
  assert.deepEqual(
    [...ic.children].map((n) => [n.localName, n.namespaceURI]),
    [
      ['path', 'http://www.w3.org/2000/svg'],
      ['circle', 'http://www.w3.org/2000/svg'],
    ],
  );
});

// The Svelte pages' icons go through use:safeHTML (ui/lib/safe-html.js): every one
// must come through whole, or the UI smoke test fails on the "[setHTML] dropped" log.
test('every icon the Svelte pages draw passes the sanitizer untouched', async () => {
  const { QL_ICONS } = await import('../ui/lib/quick-links.js');
  const svelteIcons = (file) => {
    const text = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    return [...text.matchAll(/'(<(?:path|circle|rect)[^']*)'/g)].map((m) => m[1]);
  };
  const icons = [
    ...Object.values(QL_ICONS),
    ...svelteIcons('ui/topbar/MoreMenu.svelte'),
    ...svelteIcons('ui/topbar/ScanSplit.svelte'),
  ];
  assert.ok(icons.length > 10, `found ${icons.length} icons`);
  const ic = w.document.getElementById('ic');
  dropped.length = 0;
  for (const markup of icons) {
    w.setHTML(ic, markup);
    assert.ok(ic.children.length > 0, markup);
  }
  assert.deepEqual(dropped, []);
});
