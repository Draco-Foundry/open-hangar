'use strict';

/*
 * setHTML() in src/dashboard.js: the allowlist sanitizer every piece of
 * dynamic markup goes through. Pulled out of the file and run in jsdom.
 * Run: `npm test`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const src = fs.readFileSync(path.join(__dirname, '../src/dashboard.js'), 'utf8');
const start = src.indexOf('const htmlParser = new DOMParser();');
const end = src.indexOf('function setStatus(');
assert.ok(start > 0 && end > start, 'setHTML block not found');

const dom = new JSDOM(
  '<!doctype html><body><div id="d"></div><table><tbody id="tb"></tbody></table></body>',
  {
    runScripts: 'outside-only',
  },
);
const w = dom.window;
w.console.warn = () => {};
w.eval(`${src.slice(start, end)}; window.setHTML = setHTML;`);
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
