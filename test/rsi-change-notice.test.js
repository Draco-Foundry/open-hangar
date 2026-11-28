'use strict';

/*
 * RSI changed a page (src/flags.js rsiChangeNotice): a scan counts what its hangar and
 * buy-back pages hold that the parser doesn't recognize (src/scraper/parser.js
 * unknownShapes, the parser report's checks), a complete scan keeps what's worth saying
 * in local rsiChange (src/lib.js recordRsiChange), and the popup shows one line about it
 * (ui/popup/data.js rsiNotice) until a clean scan, or until Got It, which holds for the
 * same kinds of change and not for a new one. Read from RSI's real page,
 * test/fixtures/corpus/hangar-upgraded-page-1.html (November 2026, scrubbed), changed
 * here the way RSI might. Run: `npm test`.
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
global.setTimeout = (fn) => (queueMicrotask(fn), 0); // the scan's pauses run at once

const ROOT = path.join(__dirname, '..');
require('../src/flags.js');
require('../src/scraper/parser.js');
require('../src/lib.js');
const OH = globalThis.OH;
const P = globalThis.OpenHangar;
const STORE_FLAGS = { ...OH.flags };

const CLEAN = fs.readFileSync(
  path.join(__dirname, 'fixtures/corpus/hangar-upgraded-page-1.html'),
  'utf8',
);
// RSI renames a card label on every card: a detail the parser no longer finds.
const RENAMED = CLEAN.replaceAll('<label>Contains:</label>', '<label>Holds:</label>');
// And a second kind of change on top: a new js-* hook and a new label on two cards.
const MORE = RENAMED.replaceAll(
  'class="label js-label trans-02s">Gift<',
  'class="label js-label js-share trans-02s">Share<',
);

let served = CLEAN;
global.fetch = async (url) => {
  if (/\/account\/pledges\?/.test(String(url))) return new Response(served, { status: 200 });
  return new Response('', { status: 404 });
};

async function scanWith(html, flags = { rsiChangeNotice: true }) {
  served = html;
  OH.flags = { ...STORE_FLAGS, ...flags };
  try {
    return await OH.scanSource('hangar');
  } finally {
    OH.flags = STORE_FLAGS;
  }
}
async function reset() {
  for (const k of Object.keys(store)) delete store[k];
}
const popupData = () => import('../ui/popup/data.js');

test('the flag is off in the store build and the beta', () => {
  assert.equal(OH.flagRegistry.rsiChangeNotice.default, false);
  assert.equal(OH.flagRegistry.rsiChangeNotice.beta, undefined);
  assert.equal(STORE_FLAGS.rsiChangeNotice, false);
});

test('one stray thing on one card is not a change; the same on two cards is', () => {
  const doc = new JSDOM(CLEAN).window.document;
  const first = doc.querySelector('label');
  assert.equal(first.textContent, 'Created:');
  const contains = [...doc.querySelectorAll('label')].filter((l) => l.textContent === 'Contains:');
  contains[0].textContent = 'Holds:';
  const one = P.unknownShapes(doc.documentElement.outerHTML, 'hangar');
  assert.equal(one.cards, 10);
  assert.deepEqual(one.shapes, { 'label "Holds:"': 1 });
  assert.deepEqual(P.rsiChangeShapes(one), [], 'one card: the parser report, not the player');
  contains[1].textContent = 'Holds:';
  const two = P.unknownShapes(doc.documentElement.outerHTML, 'hangar');
  assert.deepEqual(P.rsiChangeShapes(two), ['label "Holds:"']);
  // A list with only one card: that card is all there is.
  assert.deepEqual(P.rsiChangeShapes({ cards: 1, shapes: { 'tag "New"': 1 } }), ['tag "New"']);
});

test("RSI's js-* hooks never count, and a shape names no pledge", () => {
  const hooks = CLEAN.replaceAll('js-label', 'js-label js-new-thing');
  const got = P.unknownShapes(hooks, 'hangar');
  assert.ok(P.unrecognized(hooks, 'hangar').hooks.includes('hook js-new-thing'));
  assert.deepEqual(got.shapes, {}, 'hooks are left out of the tally');
  assert.deepEqual(P.rsiChangeShapes({ cards: 10, shapes: { 'hook js-x': 10 } }), []);
  // The parser report still names the pledge; the notice's shapes never do.
  const doc = new JSDOM(CLEAN).window.document;
  for (const k of doc.querySelectorAll('.kind')) k.textContent = 'Starship Part';
  const html = doc.documentElement.outerHTML;
  assert.ok(P.unrecognized(html, 'hangar').items.some((l) => /^pledge \d+: item kind/.test(l)));
  const shapes = P.rsiChangeShapes(P.unknownShapes(html, 'hangar'));
  assert.deepEqual(shapes, ['item kind "Starship Part"']);
  for (const s of shapes) assert.doesNotMatch(s, /\d{4,}/);
});

test('the report is unchanged: unrecognized lists the same as before', () => {
  assert.deepEqual(P.unrecognized(CLEAN, 'hangar'), {
    pledges: [],
    items: [],
    tags: [],
    labels: [],
    hooks: [],
  });
  assert.deepEqual(P.unrecognized(RENAMED, 'hangar').labels, ['label "Holds:"']);
});

test('a clean scan shows no notice', async () => {
  await reset();
  const r = await scanWith(CLEAN);
  assert.equal(r.ok, true);
  assert.equal(store.rsiChange, undefined);
  const { rsiNotice } = await popupData();
  assert.equal(rsiNotice(store.rsiChange, store.rsiChangeSeen), null);
});

test('a scan with unknown markup shows it, and the next clean scan clears it', async () => {
  await reset();
  const r = await scanWith(RENAMED);
  assert.equal(r.ok, true, 'the scan still reads and saves the hangar');
  assert.equal(r.items.length, 10);
  assert.deepEqual(store.rsiChange.hangar.shapes, ['label "Holds:"']);
  assert.ok(Number.isFinite(store.rsiChange.hangar.at));
  const { rsiNotice } = await popupData();
  assert.deepEqual(rsiNotice(store.rsiChange, store.rsiChangeSeen), {
    shapes: ['label "Holds:"'],
  });
  await scanWith(CLEAN);
  assert.equal(store.rsiChange, undefined, 'a clean scan takes it away');
  assert.equal(rsiNotice(store.rsiChange, store.rsiChangeSeen), null);
});

test('a clean hangar scan leaves the buy-backs part as it was', async () => {
  await reset();
  store.rsiChange = { buybacks: { at: 1, shapes: ['label "Holds:"'] } };
  await scanWith(CLEAN);
  assert.deepEqual(store.rsiChange, { buybacks: { at: 1, shapes: ['label "Holds:"'] } });
});

test('a scan that stops leaves the notice as it was', async () => {
  await reset();
  store.rsiChange = { hangar: { at: 1, shapes: ['label "Holds:"'] } };
  served = CLEAN;
  global.fetch = async () => new Response('', { status: 503 });
  OH.flags = { ...STORE_FLAGS, rsiChangeNotice: true };
  try {
    const r = await OH.scanSource('hangar');
    assert.equal(r.ok, false);
  } finally {
    OH.flags = STORE_FLAGS;
    global.fetch = async (url) =>
      /\/account\/pledges\?/.test(String(url))
        ? new Response(served, { status: 200 })
        : new Response('', { status: 404 });
  }
  assert.deepEqual(store.rsiChange.hangar.shapes, ['label "Holds:"']);
});

test('Got It holds for the same change and returns for a new one', async () => {
  await reset();
  const { rsiNotice, rsiSeenAfter, RSI_SEEN_MAX } = await popupData();
  await scanWith(RENAMED);
  const first = rsiNotice(store.rsiChange, store.rsiChangeSeen);
  store.rsiChangeSeen = rsiSeenAfter(first.shapes, store.rsiChangeSeen);
  assert.equal(rsiNotice(store.rsiChange, store.rsiChangeSeen), null, 'hidden');
  await scanWith(RENAMED);
  assert.equal(
    rsiNotice(store.rsiChange, store.rsiChangeSeen),
    null,
    'the same change: still hidden',
  );
  await scanWith(MORE);
  assert.deepEqual(store.rsiChange.hangar.shapes, ['label "Holds:"', 'label "Share"']);
  assert.deepEqual(rsiNotice(store.rsiChange, store.rsiChangeSeen), {
    shapes: ['label "Holds:"', 'label "Share"'],
  });
  // Kept short: the newest hidden first, RSI_SEEN_MAX at most.
  const many = Array.from({ length: 80 }, (_, i) => `label "L${i}"`);
  const kept = rsiSeenAfter(['label "New"'], many);
  assert.equal(kept.length, RSI_SEEN_MAX);
  assert.equal(kept[0], 'label "New"');
  // Anything else stored there reads as nothing.
  assert.equal(rsiNotice('x', null), null);
  assert.equal(rsiNotice({ hangar: { shapes: 'x' } }, null), null);
});

test('with the flag off a scan writes nothing about it', async () => {
  await reset();
  const r = await scanWith(RENAMED, {});
  assert.equal(r.ok, true);
  assert.equal(store.rsiChange, undefined);
});

test('the popup draws it as the shared notice, behind the flag, with Got It', () => {
  const src = fs.readFileSync(path.join(ROOT, 'ui/popup/Popup.svelte'), 'utf8');
  assert.match(src, /const RSI_NOTE = flag\('rsiChangeNotice'\);/);
  assert.match(src, /RSI_NOTE \? rsiNotice\(rsiChange, rsiSeen\) : null/);
  const block = src.slice(
    src.indexOf('{#if rsiNote}'),
    src.indexOf('{/if}', src.indexOf('{#if rsiNote}')),
  );
  assert.match(block, /<div class="pp-notice" id="pp-rsi-changed" role="status">/);
  assert.match(
    block,
    /<button type="button" class="pp-link quiet" id="pp-rsi-changed-ok" onclick=\{rsiGotIt\}>\{t\('popup\.got-it'\)\}<\/button>/,
  );
  assert.match(block, /t\('popup\.rsi-changed-notice'\)/);
  // Nothing about it is synced: the sync payload never names it.
  const lib = fs.readFileSync(path.join(ROOT, 'src/lib.js'), 'utf8');
  const exp = lib.slice(
    lib.indexOf('OH.exportDB = async'),
    lib.indexOf('return SHAPE.exportPayload'),
  );
  assert.ok(exp.length > 500, 'found the export');
  assert.doesNotMatch(exp, /rsiChange/);
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'src/hangar-shape.js'), 'utf8'), /rsiChange/);
});
