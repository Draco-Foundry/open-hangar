'use strict';

/*
 * The Upgraded filter (src/flags.js upgradedFilter): a pledge RSI marks upgraded reads as
 * `upgraded` (src/scraper/parser.js, RULES.hangar.upgraded), Inventory's Upgraded chip keeps
 * only those (src/dashboard.js INV_GROUPS, Status, OH.isUpgraded) and each one's card adds
 * the ship it holds now (OH.upgradedNow, src/lib.js) after the name it was bought as.
 * Read from RSI's real page, test/fixtures/corpus/hangar-upgraded-page-1.html (November
 * 2026, scrubbed): its upgraded pledges list no item naming the ship they started as, so
 * the name, as RSI shows it, is all there is. Run: `npm test`.
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
global.chrome = { storage: { local: { get: async () => ({}), set: async () => {} } } };

require('../src/flags.js');
require('../src/scraper/parser.js');
require('../src/lib.js');
const OH = globalThis.OH;
const P = globalThis.OpenHangar;

const corpus = (f) => fs.readFileSync(path.join(__dirname, 'fixtures', 'corpus', f), 'utf8');
const REAL = corpus('hangar-upgraded-page-1.html');
const OLDER = corpus('hangar-page-1.html');

// The real page's cards by pledge id, and a page of just some of them.
const realDoc = new JSDOM(REAL).window.document;
const card = (id) => realDoc.querySelector(`.js-pledge-id[value="${id}"]`).closest('li').outerHTML;
const page = (...cards) =>
  `<html><body><ul class="list-items">${cards.join('')}</ul></body></html>`;
const MOLE = '9000006'; // "Cutter Scout plus Nightfall Paint", now a MOLE
const PROSPECTOR = '9000008'; // "Cutter plus Groundswell Paint", now a Prospector
const PLAIN = '9000010'; // not upgraded

// The Upgraded chip, as Inventory applies it.
const chip = (pledges) => pledges.filter(OH.isUpgraded);
const row = (p) => ({ name: p.name, now: OH.upgradedNow(p) });

test('the flag is off in the store build', () => {
  assert.equal(OH.flagRegistry.upgradedFilter.default, false);
  assert.equal(OH.flags.upgradedFilter, false);
});

test("RSI's real page: the two upgraded pledges, by the name they were bought as", () => {
  const pledges = P.parsePledges(REAL);
  assert.equal(pledges.length, 10);
  assert.deepEqual(chip(pledges).map(row), [
    { name: 'Standalone Ships - Cutter Scout plus Nightfall Paint', now: ['MOLE'] },
    { name: 'Standalone Ships - Cutter plus Groundswell Paint', now: ['Prospector'] },
  ]);
  // No item names the ship either started as.
  for (const p of chip(pledges)) assert.ok(!p.contents.some((c) => /upgrade/i.test(c.kind || '')));
  assert.deepEqual(P.unrecognized(REAL, 'hangar').hooks, []);
});

test('zero upgraded pledges: the chip keeps nothing and no card adds a ship', () => {
  const pledges = P.parsePledges(OLDER);
  assert.ok(pledges.length > 0);
  assert.deepEqual(chip(pledges), []);
  for (const p of pledges) {
    assert.equal(p.upgraded, false);
    assert.deepEqual(OH.upgradedNow(p), []);
  }
});

test('one upgraded pledge among plain ones', () => {
  const pledges = P.parsePledges(page(card(PLAIN), card(MOLE), card('9000001')));
  assert.deepEqual(
    chip(pledges).map((p) => p.id),
    [MOLE],
  );
  assert.deepEqual(OH.upgradedNow(chip(pledges)[0]), ['MOLE']);
});

test('several upgraded pledges, in hangar order', () => {
  const pledges = P.parsePledges(page(card(PROSPECTOR), card(PLAIN), card(MOLE)));
  assert.deepEqual(
    chip(pledges).map((p) => [p.id, OH.upgradedNow(p)]),
    [
      [PROSPECTOR, ['Prospector']],
      [MOLE, ['MOLE']],
    ],
  );
});

test('an upgraded pledge holding two ships shows both, in RSI order', () => {
  // Made up from the real card: a second Ship tile after the MOLE.
  const two = card(MOLE).replace(
    /(<div class="kind">Ship<\/div>[\s\S]*?<\/div>\s*<\/div>)/,
    '$1<div class="item"><div class="image"></div><div class="text"><div class="title">ROC</div><div class="kind">Vehicle</div></div></div>',
  );
  const [p] = P.parsePledges(page(two));
  assert.equal(p.upgraded, true);
  assert.deepEqual(OH.upgradedNow(p), ['MOLE', 'ROC']);
});

test('a gift-received upgraded pledge: still upgraded, its name unchanged', () => {
  // Made up from the real card: a pledge the pilot was given shows no Gift button here
  // (RSI's own marking of a received gift isn't captured yet).
  const gifted = card(MOLE).replace(/<a[^>]*js-gift-v2[^>]*>[\s\S]*?<\/a>/, '');
  const [p] = P.parsePledges(page(gifted));
  assert.equal(p.giftable, false);
  assert.equal(p.upgraded, true);
  assert.equal(p.name, 'Standalone Ships - Cutter Scout plus Nightfall Paint');
  assert.deepEqual(OH.upgradedNow(p), ['MOLE']);
  // The real card with its button reads as giftable (the js-gift-v2 hook).
  assert.equal(P.parsePledges(page(card(MOLE)))[0].giftable, true);
});

test("any one of RSI's three upgraded marks is enough", () => {
  const strip = (html, keep) => {
    let out = html;
    if (keep !== 'h3') out = out.replace(/<h3 class="upgraded"/, '<h3 class=""');
    if (keep !== 'span') out = out.replace(/<span class="upgraded">[^<]*<\/span>/, '');
    if (keep !== 'a') out = out.replace(/js-upgrade-log/, 'x-log');
    return out;
  };
  for (const keep of ['h3', 'span', 'a'])
    assert.equal(P.parsePledges(page(strip(card(MOLE), keep)))[0].upgraded, true, keep);
  assert.equal(P.parsePledges(page(strip(card(MOLE), 'none')))[0].upgraded, false);
});

test('Inventory reads the chip and the card line only behind the flag', () => {
  const dash = fs.readFileSync(path.join(__dirname, '..', 'src', 'dashboard.js'), 'utf8');
  assert.match(
    dash,
    /\.\.\.\(OH\.flags\.upgradedFilter \? \[\['upgraded', 'Upgraded', \(p\) => OH\.isUpgraded\(p\)\]\] : \[\]\)/,
  );
  assert.match(dash, /if \(!OH\.flags\.upgradedFilter\) return '';/);
});
