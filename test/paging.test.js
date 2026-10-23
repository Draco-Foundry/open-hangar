'use strict';

/*
 * Paging at any page size (src/lib.js scanHtmlSource, src/scraper/parser.js
 * parsePager). RSI's buy-back list has a page-size picker (10, 25, 50 or 100 per
 * page); it is a link (?page=1&pagesize=N) and the pager's links carry the size, the
 * same markup as a saved real page. The scan asks for 100, but whatever size RSI
 * serves, every buy-back must come back exactly once. Pages here are built in RSI's
 * markup and read by the real parser. Run: `npm test`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('');
global.window = globalThis;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
const store = {};
global.chrome = {
  storage: {
    local: {
      get: async (k) => {
        const keys = k == null ? Object.keys(store) : [].concat(k);
        return Object.fromEntries(keys.filter((x) => x in store).map((x) => [x, store[x]]));
      },
      set: async (o) => Object.assign(store, JSON.parse(JSON.stringify(o))),
      remove: async (k) => [].concat(k).forEach((x) => delete store[x]),
    },
  },
};
// The scan's pauses between pages run at once.
global.setTimeout = (fn) => (queueMicrotask(fn), 0);

require('../src/scraper/parser.js');
require('../src/lib.js');
const OH = globalThis.OH;
const P = globalThis.OpenHangar;

// --- RSI's buy-back list, as it renders it -----------------------------------
const PATH = '/account/buy-back-pledges';
const card = (b) => `<article class="pledge">
<h1>${b.name}</h1>
<dl><dt>Last Modified</dt><dd>October 1, 2026</dd><dt>Contained</dt><dd>${b.name}</dd></dl>
<a class="holosmallbtn" href="/pledge/buyback/${b.id ?? 'x'}"${b.id ? ` data-pledgeid="${b.id}"` : ''}>Exchange</a>
</article>`;
// The pager as on a saved real page: the size picker, numbered links around the
// page shown, then next (gt) and last (raquo) while there is a page after it.
function pager(page, last, size) {
  const at = (n) => `?page=${n}&amp;pagesize=${size}`;
  const sizes = [10, 25, 50, 100]
    .map(
      (s) =>
        `<li class="js-option option ${s === size ? 'selected' : ''}" rel="${PATH}?page=1&amp;pagesize=${s}">${s} per page</li>`,
    )
    .join('');
  const near = [];
  for (let n = Math.max(1, page - 2); n <= Math.min(last, page + 2); n++)
    near.push(
      `<a class="trans-02s trans-color ${n === page ? 'active' : ''}" href="${at(n)}">${n}</a>`,
    );
  const back = page > 1 ? `<a class="lt btn" href="${at(page - 1)}"><span></span></a>` : '';
  const ahead =
    page < last
      ? `<span class="spacer"></span><a class="gt btn" href="${at(page + 1)}"><span></span></a><a class="raquo btn" href="${at(last)}"><span></span></a>`
      : '';
  return `<div class="pager clearfix  js-pager-ajax ">
<div class="left"><a class="js-selectlist selectlist " href="#"><span>${size} per page</span><ul class="body">${sizes}</ul></a></div>
<div class="right">${back}${near.join('')}${ahead}</div>
</div>`;
}
const page = (items, n, last, size) =>
  `<html><body><div class="list-items">${items.map(card).join('')}</div>${pager(n, last, size)}</body></html>`;
const EMPTY = '<html><body><p>You have no pledges available for buy-back.</p></body></html>';

const buybacks = (n, { ids = true } = {}) =>
  Array.from({ length: n }, (_, i) => ({ id: ids ? `bb${i}` : null, name: `Buy-Back ${i}` }));

// RSI serving `list` at `size` per page, whatever size was asked for (`honour`: the
// asked-for size instead). Past the end it serves the last page again (`past:
// 'clamp'`, what the hangar does) or an empty one (`past: 'empty'`).
let served;
function serve(list, size, { honour = false, past = 'clamp' } = {}) {
  served = [];
  global.fetch = async (url) => {
    const u = new URL(String(url));
    if (!u.pathname.endsWith(PATH)) return new Response('', { status: 404 });
    const asked = Number(u.searchParams.get('page'));
    const per = honour ? Number(u.searchParams.get('pagesize')) : size;
    served.push({ page: asked, pagesize: u.searchParams.get('pagesize') });
    if (!list.length) return new Response(EMPTY);
    const last = Math.ceil(list.length / per);
    if (asked > last && past === 'empty') return new Response(page([], asked, last, per));
    const n = Math.min(asked, last);
    return new Response(page(list.slice((n - 1) * per, n * per), n, last, per));
  };
}

async function scan() {
  for (const k of Object.keys(store)) delete store[k];
  return OH.scanSource('buybacks');
}
// Every buy-back exactly once, in RSI's order.
function exactlyOnce(r, list) {
  assert.equal(r.ok, true, r.error);
  assert.equal(r.partial, undefined);
  assert.equal(r.items.length, list.length);
  assert.deepEqual(
    r.items.map((b) => b.name),
    list.map((b) => b.name),
  );
}

// --- The pager ------------------------------------------------------------------
test('parsePager reads the page shown and the highest page linked', () => {
  assert.deepEqual(P.parsePager(page(buybacks(1), 1, 11, 100)), { current: 1, max: 11 });
  assert.deepEqual(P.parsePager(page(buybacks(1), 5, 11, 25)), { current: 5, max: 11 });
  // The last page has no next or last arrow: nothing after it.
  assert.deepEqual(P.parsePager(page(buybacks(1), 11, 11, 10)), { current: 11, max: 11 });
  // The size picker's links (?page=1&pagesize=N) aren't pages.
  assert.equal(P.parsePager(page(buybacks(1), 4, 4, 50)).max, 4);
  assert.equal(P.parsePager('<html><body><article></article></body></html>'), null);
});

test("parsePager reads the hangar's pager, which has no page size in its links", () => {
  const html = `<div class="pager clearfix"><div class="right">
<a class="trans-02s trans-color active" href="?page=1">1</a>
<a class="trans-02s trans-color " href="?page=2">2</a>
<a class="trans-02s trans-color " href="?page=3">3</a>
<span class="spacer"></span>
<a class="gt btn" href="?page=2"><span></span></a>
<a class="raquo btn" href="?page=23"><span></span></a>
</div></div>`;
  assert.deepEqual(P.parsePager(html), { current: 1, max: 23 });
});

// --- Every size, every shape --------------------------------------------------------
for (const size of [10, 25, 50, 100]) {
  const shapes = [
    ['no buy-backs', 0],
    ['one short page', size - 3],
    ['exactly one full page', size],
    ['one full page plus 1', size + 1],
    ['two full pages', size * 2],
    ['three pages ending on a short one', size * 2 + 1],
    ['several pages ending on a full one', size * 3],
  ];
  for (const [what, n] of shapes) {
    for (const past of ['clamp', 'empty']) {
      test(`${size} per page, ${what}, past the end RSI ${past === 'clamp' ? 'repeats the last page' : 'is empty'}`, async () => {
        const list = buybacks(n);
        serve(list, size, { past });
        exactlyOnce(await scan(), list);
        // Stopped on the pager: never asked past the last page.
        assert.equal(served.at(-1).page, Math.max(1, Math.ceil(n / size)));
      });
    }
  }
}

test('the scan asks RSI for 100 per page, and gets them when RSI honours it', async () => {
  const list = buybacks(250);
  serve(list, 10, { honour: true });
  exactlyOnce(await scan(), list);
  assert.deepEqual(
    served.map((s) => s.pagesize),
    ['100', '100', '100'],
  );
});

test('buy-backs without an id are read once, not again from a repeated page', async () => {
  // fillIds names them by position, so a repeated last page would look new.
  const list = buybacks(12, { ids: false });
  serve(list, 10);
  exactlyOnce(await scan(), list);
  assert.equal(served.length, 2);
});

test("progress says how many pages RSI's pager shows (the popup's scan bar)", async () => {
  const list = buybacks(25);
  serve(list, 10);
  for (const k of Object.keys(store)) delete store[k];
  const said = [];
  const r = await OH.scanSource('buybacks', (...a) => said.push(a));
  exactlyOnce(r, list);
  assert.deepEqual(said, [
    [1, 10, null, 3],
    [2, 20, null, 3],
    [3, 25, null, 3],
  ]);
});

test('without a pager, the scan still ends when a page brings nothing new', async () => {
  const list = buybacks(15);
  served = [];
  global.fetch = async (url) => {
    const u = new URL(String(url));
    if (!u.pathname.endsWith(PATH)) return new Response('', { status: 404 });
    const asked = Number(u.searchParams.get('page'));
    served.push({ page: asked });
    const n = Math.min(asked, 2);
    const items = list
      .slice((n - 1) * 10, n * 10)
      .map(card)
      .join('');
    return new Response(`<html><body>${items}</body></html>`);
  };
  for (const k of Object.keys(store)) delete store[k];
  const said = [];
  exactlyOnce(await OH.scanSource('buybacks', (...a) => said.push(a)), list);
  assert.deepEqual(
    served.map((s) => s.page),
    [1, 2, 3],
  );
  assert.ok(
    said.every((a) => a[3] === null),
    'no page count without a pager',
  );
});

// --- Saved real pages (test/fixtures/corpus, scrubbed) ------------------------------
// The same stops on RSI's own markup: the hangar (10 pledges a page, no size picker)
// and the buy-back list (its picker offers 10, 25, 50 and 100). A list of N pages is
// the saved pages 1 to N with every pager link past N taken out, which is what RSI
// shows on a list that ends there.
const fs = require('node:fs');
const path = require('node:path');
const saved = (name) =>
  fs.readFileSync(path.join(__dirname, 'fixtures', 'corpus', `${name}.html`), 'utf8');
const endAt = (html, last) =>
  html.replace(/<a [^>]*href="[^"]*[?&]page=(\d+)[^"]*"[^>]*>[\s\S]*?<\/a>/g, (a, n) =>
    Number(n) > last ? '' : a,
  );

test('the saved pages read as RSI showed them', () => {
  for (const n of [1, 2, 3])
    assert.deepEqual(P.parsePager(saved(`hangar-page-${n}`)), { current: n, max: 23 });
  assert.deepEqual(P.parsePager(saved('buybacks-page-1')), { current: 1, max: 11 });
  assert.deepEqual(P.parsePager(endAt(saved('hangar-page-3'), 3)), { current: 3, max: 3 });
});

for (const last of [1, 2, 3]) {
  test(`a saved hangar of ${last} page${last > 1 ? 's' : ''}: every pledge once, stops on page ${last}`, async () => {
    // The scrub numbers each page's pledges from 9000001, so a page's own number goes in
    // front to keep them apart, as on RSI.
    const pages = [1, 2, 3]
      .slice(0, last)
      .map((n) =>
        endAt(saved(`hangar-page-${n}`), last).replace(
          /js-pledge-id" value="(\d+)"/g,
          `js-pledge-id" value="${n}$1"`,
        ),
      );
    const asked = [];
    global.fetch = async (url) => {
      const u = new URL(String(url));
      if (!u.pathname.endsWith('/account/pledges')) return new Response('', { status: 404 });
      const n = Number(u.searchParams.get('page'));
      asked.push(n);
      return new Response(pages[Math.min(n, last) - 1]); // past the end: the last page again
    };
    for (const k of Object.keys(store)) delete store[k];
    const r = await OH.scanSource('hangar');
    assert.equal(r.ok, true, r.error);
    const want = pages.flatMap((h) => P.parsePledges(h).map((x) => x.id));
    assert.equal(want.length, last * 10); // RSI's hangar shows 10 a page
    assert.equal(new Set(want).size, want.length, 'the saved pages share no pledge');
    assert.deepEqual(
      r.items.map((x) => x.id),
      want,
    );
    assert.deepEqual(
      asked,
      Array.from({ length: last }, (_, i) => i + 1),
    );
  });
}

test('a saved buy-back page that is the only one: 100 buy-backs, one request', async () => {
  const html = endAt(saved('buybacks-page-1'), 1);
  const asked = [];
  global.fetch = async (url) => {
    const u = new URL(String(url));
    if (!u.pathname.endsWith(PATH)) return new Response('', { status: 404 });
    asked.push(Number(u.searchParams.get('page')));
    return new Response(html);
  };
  const r = await scan();
  assert.equal(r.ok, true, r.error);
  assert.equal(r.items.length, P.parseBuybacks(html).length);
  assert.equal(r.items.length, 100);
  assert.deepEqual(asked, [1]);
});

// #729: after a full read, the count must fit the pager's last page: (last - 1) × size <
// count ≤ last × size. Otherwise pages were missed (or read twice) and it's a partial read.
function serveParts(parts, last, size) {
  global.fetch = async (url) => {
    const u = new URL(String(url));
    if (!u.pathname.endsWith(PATH)) return new Response('', { status: 404 });
    const n = Math.min(Number(u.searchParams.get('page')), parts.length);
    return new Response(page(parts[n - 1], n, last, size));
  };
}
test("a count that fits the pager's last page is a whole read", async () => {
  const list = buybacks(25);
  // The pager's page 3 holds items 21 to 25: 20 < 25 ≤ 30.
  serveParts([list.slice(0, 10), list.slice(10, 20), list.slice(20)], 3, 10);
  exactlyOnce(await scan(), list);
});

test("a count the pager's last page can't hold keeps the previous scan, and is partial otherwise", async () => {
  const list = buybacks(14);
  // Pages of 10, 2 and 2: three pages can't hold 14.
  serveParts([list.slice(0, 10), list.slice(10, 12), list.slice(12)], 3, 10);
  const r = await scan();
  assert.equal(r.ok, true, 'nothing earlier to keep: saved, but said to be partial');
  assert.match(r.partial, /don't fit 3 pages/);
  // With an earlier, bigger scan: kept, and the error says why.
  const before = buybacks(40);
  store.db = { sources: { buybacks: { scannedAt: 1, items: before } } };
  const again = await OH.scanSource('buybacks');
  assert.equal(again.ok, false);
  assert.match(again.error, /don't fit RSI's page count.*previous scan of 40/);
  assert.equal(store.db.sources.buybacks.items.length, 40);
  // Auto Scan Daily never saves it.
  const auto = await OH.scanSource('buybacks', null, { auto: true });
  assert.equal(auto.unfinished, true);
  assert.equal(store.db.sources.buybacks.items.length, 40);
});
