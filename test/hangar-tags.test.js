'use strict';

/*
 * RSI's October 2026 hangar (OH-055): the green ATTRIBUTED tag beside UPGRADED, the
 * Game Library's primary Game Access pledge (never meltable or giftable) and pledges
 * marked as a gift at purchase. The parser reads none of the tags, so a tagged card
 * reads exactly as it did, giftable and meltable still come from the rendered Gift and
 * Exchange actions, and a hangar scan over these pages is complete, not partial.
 * Run: `npm test`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

// The browser globals parser.js and lib.js expect, then both, the way a page loads them.
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
// The pause between pages runs at once.
global.setTimeout = (fn) => (queueMicrotask(fn), 0);

require('../src/scraper/parser.js');
require('../src/lib.js');
const P = globalThis.OpenHangar;
const OH = globalThis.OH;

const fixture = (f) => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8');
const TAGS = fixture('pledge-tags.html');
const LIBRARY = fixture('game-library.html');
const byId = (list, id) => list.find((p) => p.id === id);
// Every word the parser kept from a pledge, to check no tag got in.
const words = (p) =>
  JSON.stringify([p.name, p.contents, p.kind, p.insurance, p.date, p.raw]).toLowerCase();

test('ATTRIBUTED and UPGRADED tags leave the pledge as it reads without them', () => {
  const pledges = P.parsePledges(TAGS);
  assert.equal(pledges.length, 3);
  for (const p of pledges) {
    assert.doesNotMatch(words(p), /attributed|upgraded/, `pledge ${p.id}`);
  }

  const ship = byId(pledges, '601');
  assert.equal(ship.name, 'Standalone Ships - Avenger Titan');
  assert.equal(ship.kind, 'ship');
  assert.deepEqual(
    ship.contents.map((c) => c.kind),
    ['Ship', 'Insurance'],
  );
  assert.equal(ship.insurance, '120M');
  assert.equal(ship.giftable, true);
  assert.equal(ship.meltable, true);
  assert.equal(ship.date, '2023-04-12');

  const ccu = byId(pledges, '602');
  assert.equal(ccu.kind, 'ccu');
  assert.deepEqual(ccu.ccu, { from: 'Aurora MR', to: 'Avenger Titan' });
  assert.deepEqual(ccu.contents, []);
  assert.equal(ccu.giftable, false);
  assert.equal(ccu.meltable, true);
});

test('tags after the date in the date column still leave the date readable', () => {
  const paint = byId(P.parsePledges(TAGS), '603');
  assert.equal(paint.date, '2026-10-05');
  assert.equal(paint.kind, 'paint');
  assert.equal(paint.giftable, true);
  assert.equal(paint.meltable, false);
});

test('the primary Game Access pledge reads as neither giftable nor meltable', () => {
  const p = byId(P.parsePledges(LIBRARY), '701');
  assert.equal(p.giftable, false);
  assert.equal(p.meltable, false);
  assert.equal(p.kind, 'ship');
  assert.equal(p.insurance, 'LTI');
  assert.deepEqual(
    p.contents.map((c) => c.label),
    [
      'Aurora MR',
      'Lifetime Insurance',
      'Star Citizen Digital Download',
      'Squadron 42 Digital Download',
    ],
  );
  assert.doesNotMatch(words(p), /game access/);
});

test('gift-marked and older pledges keep the gifting RSI renders for them', () => {
  const pledges = P.parsePledges(LIBRARY);
  assert.equal(pledges.length, 4);
  const flags = (id) => {
    const p = byId(pledges, id);
    return { giftable: p.giftable, meltable: p.meltable };
  };
  // A second game package from before October: both, as before.
  assert.deepEqual(flags('702'), { giftable: true, meltable: true });
  // Marked as a gift at purchase in October: the Gift action, no Exchange.
  assert.deepEqual(flags('703'), { giftable: true, meltable: false });
  assert.doesNotMatch(words(byId(pledges, '703')), /"gift"/);
  // Bought before October and never giftable: still not giftable.
  assert.deepEqual(flags('704'), { giftable: false, meltable: true });
});

// A hangar scan over the tagged pages: page 1 is the tags, page 2 the Game Library,
// then RSI repeats the last page (no new ids, so the scan ends).
test('a hangar scan over tagged and Game Library pages is complete, not partial', async () => {
  global.fetch = async (url) => {
    const m = String(url).match(/\/account\/pledges\?page=(\d+)/);
    if (!m) return new Response('', { status: 404 });
    return new Response(Number(m[1]) === 1 ? TAGS : LIBRARY, { status: 200 });
  };
  const r = await OH.scanSource('hangar');
  assert.equal(r.ok, true);
  assert.equal(r.partial, undefined);
  assert.equal(r.items.length, 7);
  assert.deepEqual(r.items.map((p) => p.id).sort(), [
    '601',
    '602',
    '603',
    '701',
    '702',
    '703',
    '704',
  ]);
});

// The same over real hangar pages (test/fixtures/corpus/, scrubbed), where RSI puts
// "Attributed" in a span.availability in each card's title column.
const CORPUS = path.join(__dirname, 'fixtures', 'corpus');
const REAL = fs
  .readdirSync(CORPUS)
  .filter((f) => /^hangar-page-\d+\.html$/.test(f))
  .sort()
  .map((f) => ({ file: f, html: fs.readFileSync(path.join(CORPUS, f), 'utf8') }));
const cardsOf = (html) => [...new JSDOM(html).window.document.querySelectorAll('.list-items > li')];
const cardFor = (cards, id) => cards.find((c) => c.querySelector('.js-pledge-id')?.value === id);

test('every pledge on the real hangar pages carries one Attributed tag in its title column', () => {
  assert.ok(REAL.length >= 1, 'a hangar page in test/fixtures/corpus/');
  for (const { file, html } of REAL) {
    const cards = cardsOf(html);
    assert.equal(P.parsePledges(html).length, cards.length, file);
    for (const card of cards) {
      const tags = [...card.querySelectorAll('.availability')];
      assert.deepEqual(
        tags.map((t) => t.textContent.trim()),
        ['Attributed'],
        file,
      );
      assert.ok(tags[0].closest('.title-col'), `${file}: tag in the title column`);
    }
  }
});

test('the real pages read the same with every Attributed tag taken out', () => {
  for (const { file, html } of REAL) {
    const untagged = html.replace(/<span class="availability\s*">Attributed<\/span>/g, '');
    assert.notEqual(untagged, html, file);
    assert.deepEqual(P.parsePledges(html), P.parsePledges(untagged), file);
    for (const p of P.parsePledges(html)) {
      assert.doesNotMatch(words(p), /attributed/, `${file}: pledge ${p.id}`);
    }
  }
});

test('on the real pages giftable and meltable are the Gift and Exchange actions RSI renders', () => {
  const seen = new Set();
  for (const { file, html } of REAL) {
    const cards = cardsOf(html);
    for (const p of P.parsePledges(html)) {
      const card = cardFor(cards, p.id);
      assert.ok(card, `${file}: card for ${p.id}`);
      assert.equal(p.giftable, !!card.querySelector('.js-gift'), `${file}: ${p.id} giftable`);
      assert.equal(p.meltable, !!card.querySelector('.js-reclaim'), `${file}: ${p.id} meltable`);
      seen.add(`${p.giftable}/${p.meltable}`);
    }
  }
  // The pages hold giftable and bound pledges, and meltable and non-meltable ones, so
  // the check above sees both answers for each flag.
  assert.ok(seen.has('true/true') && seen.has('false/true'), [...seen].join(' '));
  assert.ok(
    [...seen].some((s) => s.endsWith('/false')),
    [...seen].join(' '),
  );
});

// RSI clamps a page past the last to the last one, which ends the scan. The scrub
// numbers each page's ids from the same start, so each page gets its own prefix here.
test('a hangar scan over the real tagged pages is complete, not partial', async () => {
  const byPage = Object.fromEntries(
    REAL.map(({ file, html }) => {
      const n = Number(file.match(/\d+/)[0]);
      return [n, html.replace(/(class="js-pledge-id" value=")/g, `$1${n}`)];
    }),
  );
  const last = Math.max(...Object.keys(byPage).map(Number));
  global.fetch = async (url) => {
    const m = String(url).match(/\/account\/pledges\?page=(\d+)/);
    if (!m) return new Response('', { status: 404 });
    return new Response(byPage[Math.min(Number(m[1]), last)], { status: 200 });
  };
  const r = await OH.scanSource('hangar');
  assert.equal(r.ok, true);
  assert.equal(r.partial, undefined);
  const expected = REAL.reduce((n, { html }) => n + P.parsePledges(html).length, 0);
  assert.equal(r.items.length, expected);
});
