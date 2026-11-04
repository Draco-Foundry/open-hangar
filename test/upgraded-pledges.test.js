'use strict';

/*
 * Upgraded pledges across a paged hangar (src/lib.js scanHtmlSource, src/scraper/parser.js
 * parsePledgesFromDOM). An upgraded pledge's item list holds a breakdown: the ship it is
 * now, each applied upgrade, the original insurance and extras. Served on page 1, on a
 * late page of a 10+ page hangar, two upgrades in a row, and beside a ship sold with only
 * its paint (#908): the scan reads every page, counts every pledge once, keeps the
 * breakdown inside its pledge and shows the ship the pledge is now. The cards are
 * test/fixtures/upgraded-pledges.html, read by the real parser. Run: `npm test`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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

// --- The cards, as RSI renders them ---------------------------------------------------
const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'upgraded-pledges.html'), 'utf8');
const CARDS = Object.fromEntries(
  [...new JSDOM(FIXTURE).window.document.querySelectorAll('ul.list-items > li')].map((li) => [
    li.querySelector('.js-pledge-id').value,
    li.outerHTML,
  ]),
);
const UPGRADED = '801';
const TWICE = '802';
const PAINTED = '803';
// A plain ship with its own id, for the rest of the hangar.
const plain = (id) => CARDS['800'].replace('value="800"', `value="${id}"`);

// The hangar's pager, as on a saved real page (test/fixtures/corpus): numbered links
// around the page shown, then next (gt) and last (raquo) while there is a page after it.
function pager(page, last) {
  const near = [];
  for (let n = Math.max(1, page - 2); n <= Math.min(last, page + 2); n++)
    near.push(
      `<a class="trans-02s trans-color ${n === page ? 'active' : ''}" href="?page=${n}">${n}</a>`,
    );
  const back = page > 1 ? `<a class="lt btn" href="?page=${page - 1}"><span></span></a>` : '';
  const ahead =
    page < last
      ? `<span class="spacer"></span><a class="gt btn" href="?page=${page + 1}"><span></span></a><a class="raquo btn" href="?page=${last}"><span></span></a>`
      : '';
  return `<div class="pager clearfix"><div class="right">${back}${near.join('')}${ahead}</div></div>`;
}

// A hangar of `total` pledges, 10 a page as RSI serves it, with `special` cards at
// their 0-based places: the list of ids in RSI's order.
function hangar(total, special) {
  const ids = Array.from({ length: total }, (_, i) => String(9000 + i));
  for (const [at, id] of Object.entries(special)) ids[Number(at)] = id;
  return ids;
}

// RSI serving `ids` 10 a page; past the end it serves the last page again.
const SIZE = 10;
let served;
function serve(ids) {
  served = [];
  global.fetch = async (url) => {
    const u = new URL(String(url));
    if (!u.pathname.endsWith('/account/pledges')) return new Response('', { status: 404 });
    const asked = Number(u.searchParams.get('page'));
    served.push(asked);
    const last = Math.ceil(ids.length / SIZE);
    const n = Math.min(asked, last);
    const cards = ids
      .slice((n - 1) * SIZE, n * SIZE)
      .map((id) => CARDS[id] || plain(id))
      .join('');
    return new Response(
      `<html><body><ul class="list-items">${cards}</ul>${pager(n, last)}</body></html>`,
    );
  };
}

async function scan(ids) {
  for (const k of Object.keys(store)) delete store[k];
  serve(ids);
  return OH.scanSource('hangar');
}

// The four checks every case makes.
function reachesLastPage(r, ids) {
  assert.equal(r.ok, true, r.error);
  assert.equal(r.partial, undefined);
  const last = Math.ceil(ids.length / SIZE);
  assert.deepEqual(
    served,
    Array.from({ length: last }, (_, i) => i + 1),
  );
}
function countsEveryPledgeOnce(r, ids) {
  assert.equal(r.items.length, ids.length);
  assert.deepEqual(
    r.items.map((p) => p.id),
    ids,
  );
}
function keepsBreakdown(r, id, labels) {
  const p = r.items.find((x) => x.id === id);
  assert.deepEqual(
    p.contents.map((c) => c.label),
    labels,
  );
  // No breakdown entry became a pledge of its own.
  for (const label of labels)
    assert.ok(!r.items.some((x) => x.id !== id && x.name.includes(label)), label);
}
function showsShipItIsNow(r, id, ship) {
  const p = r.items.find((x) => x.id === id);
  assert.deepEqual(
    p.contents.filter((c) => c.kind === 'Ship').map((c) => c.label),
    [ship],
  );
  assert.equal(p.kind, 'ship');
  assert.equal(p.isCCU, false);
  assert.equal(p.containsShip, true);
  assert.equal(OH.packKind(p), null);
}

const ONCE = [
  'Cutlass Black',
  'Avenger Titan to Cutlass Black',
  '120 Months Insurance',
  '6 Months Insurance',
  'Cutlass Black Model',
];
const TWO = [
  'Cutlass Black',
  'Aurora MR to Avenger Titan',
  'Avenger Titan to Cutlass Black',
  'Lifetime Insurance',
  '6 Months Insurance',
];

test('the fixture cards read as RSI shows them, and nothing on them is unrecognized', () => {
  const pledges = P.parsePledges(FIXTURE);
  assert.deepEqual(
    pledges.map((p) => p.id),
    ['801', '802', '803', '800'],
  );
  const up = pledges[0];
  assert.equal(up.name, 'Standalone Ships - Avenger Titan');
  assert.equal(up.image, 'https://robertsspaceindustries.com/media/cutlass-black.jpg');
  assert.equal(up.insurance, '120M');
  assert.equal(pledges[1].insurance, 'LTI');
  assert.deepEqual(P.pageChanged(FIXTURE, 'hangar'), []);
  assert.deepEqual(P.unrecognized(FIXTURE, 'hangar'), {
    pledges: [],
    items: [],
    tags: [],
    labels: [],
    hooks: [],
  });
});

test('an upgraded pledge on page 1', async () => {
  const ids = hangar(25, { 3: UPGRADED });
  const r = await scan(ids);
  reachesLastPage(r, ids);
  countsEveryPledgeOnce(r, ids);
  keepsBreakdown(r, UPGRADED, ONCE);
  showsShipItIsNow(r, UPGRADED, 'Cutlass Black');
});

for (const [where, total, at] of [
  ['page 9 of 11', 105, 84],
  ['page 10 of 10, the last', 100, 97],
  ['the last, short page 11 of 11', 101, 100],
]) {
  test(`an upgraded pledge on ${where}`, async () => {
    const ids = hangar(total, { [at]: UPGRADED });
    const r = await scan(ids);
    reachesLastPage(r, ids);
    countsEveryPledgeOnce(r, ids);
    keepsBreakdown(r, UPGRADED, ONCE);
    showsShipItIsNow(r, UPGRADED, 'Cutlass Black');
  });
}

test('a pledge with two upgrades applied in a row, on page 10 of 12', async () => {
  const ids = hangar(115, { 95: TWICE });
  const r = await scan(ids);
  reachesLastPage(r, ids);
  countsEveryPledgeOnce(r, ids);
  keepsBreakdown(r, TWICE, TWO);
  showsShipItIsNow(r, TWICE, 'Cutlass Black');
});

test('a ship with only its paint next to an upgraded pledge, on page 9', async () => {
  // Side by side on page 9, and the two-upgrade pledge last on it, before the page break.
  const ids = hangar(104, { 84: PAINTED, 85: UPGRADED, 89: TWICE });
  const r = await scan(ids);
  reachesLastPage(r, ids);
  countsEveryPledgeOnce(r, ids);
  keepsBreakdown(r, UPGRADED, ONCE);
  keepsBreakdown(r, TWICE, TWO);
  keepsBreakdown(r, PAINTED, [
    'Mustang Alpha',
    'Lifetime Insurance',
    'Mustang Alpha Vindicator Paint',
  ]);
  showsShipItIsNow(r, UPGRADED, 'Cutlass Black');
  showsShipItIsNow(r, TWICE, 'Cutlass Black');
  showsShipItIsNow(r, PAINTED, 'Mustang Alpha');
});
