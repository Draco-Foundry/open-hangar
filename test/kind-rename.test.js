'use strict';
// A kind RSI renames is fixed by data alone (#619). The saved hangar keeps RSI's own
// word for an item's kind; every reader asks OH.isShipItem, which matches the word with
// the parser rules' kinds.ship. Here RSI's hangar pages say "Vessel" where they said
// "Ship", and only the rules change: the scan, the value math and the stats read the
// same as before. This file loads the changed rules in place of the shipped ones (each
// test file runs in its own process). Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SHIPPED = {
  schema: JSON.parse(read('schema/parser-rules.schema.json')),
  rules: JSON.parse(read('src/data/parser-rules.json')),
};

// The fix, in data only: the rules learn RSI's new word and keep the old one.
const renamed = structuredClone(SHIPPED);
renamed.rules.kinds.ship = { source: '^(ship|vessel)$', flags: 'i' };
globalThis.OHParserRulesData = renamed;

const dom = new JSDOM('');
global.window = globalThis;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.chrome = {
  storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
};
const { rules: RULES, load } = require('../src/parser-rules.js');
require('../src/scraper/parser.js');
require('../src/lib.js');
const P = globalThis.OpenHangar;
const OH = globalThis.OH;

const PAGES = ['hangar-page-1.html', 'hangar-page-2.html', 'hangar-page-3.html'].map((f) =>
  read(`test/fixtures/corpus/${f}`),
);
const SHIP_TILE = '<div class="kind">Ship</div>';
const scan = (pages) => pages.flatMap((html) => P.parsePledges(html));
const before = scan(PAGES);
const after = scan(
  PAGES.map((html) => html.split(SHIP_TILE).join('<div class="kind">Vessel</div>')),
);

test('the changed rules are the ones loaded, and the shipped ones never knew the new word', () => {
  assert.equal(RULES.kinds.ship.source, '^(ship|vessel)$');
  assert.equal(load(structuredClone(SHIPPED)).kinds.ship.test('Vessel'), false);
  assert.ok(
    PAGES.every((html) => html.includes(SHIP_TILE)),
    'the corpus has Ship tiles',
  );
});

test("the scan keeps RSI's new word as it is, and still finds the ships", () => {
  const kinds = (items) => items.flatMap((p) => p.contents.map((c) => c.kind));
  assert.ok(!kinds(after).includes('Ship'));
  assert.equal(
    kinds(after).filter((k) => k === 'Vessel').length,
    kinds(before).filter((k) => k === 'Ship').length,
  );
  assert.deepEqual(
    after.map((p) => [p.id, p.containsShip, p.kind, p.image]),
    before.map((p) => [p.id, p.containsShip, p.kind, p.image]),
  );
  assert.ok(after.some((p) => p.containsShip));
});

test('every reader of the saved hangar counts the same ships under the new word', () => {
  const price = () => ({ price: 100, currency: 'USD' });
  const shipOf = () => null;
  const same = (f, what) => assert.deepEqual(f(after), f(before), what);
  same((items) => OH.hangarValue(items, price), 'hangarValue');
  same((items) => OH.fleetStats(items, shipOf), 'fleetStats');
  same((items) => OH.collectionStats(items, shipOf, []), 'collectionStats');
  same((items) => OH.buildHTF(items), 'buildHTF');
  same((items) => items.map((p) => OH.meltFacts(p)), 'meltFacts');
  assert.ok(OH.fleetStats(after, shipOf).ships > 0, 'ships counted');
  assert.equal(OH.isShipItem({ kind: 'Vessel' }), true);
  assert.equal(OH.isShipItem({ kind: ' Ship ' }), true);
  assert.equal(OH.isShipItem({ kind: 'Insurance' }), false);
  assert.equal(OH.isShipItem(null), false);
});

// One reader, everywhere: no code matches the kind word itself.
test('no file outside the rules matches a ship kind with a word of its own', () => {
  const files = [
    ...['src/lib.js', 'src/dashboard.js', 'src/scraper/parser.js', 'src/background.js'],
    ...fs
      .readdirSync(path.join(ROOT, 'ui'), { recursive: true })
      .filter((f) => /\.(js|svelte)$/.test(f))
      .map((f) => path.join('ui', f)),
  ];
  for (const f of files)
    assert.doesNotMatch(
      read(f),
      /\/\^ship\$\/i/,
      `${f}: use OH.isShipItem (the rules' kinds.ship)`,
    );
});
