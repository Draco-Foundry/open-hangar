'use strict';

/*
 * Unit tests for src/scraper/parser.js — the fragile layer.
 * parser.js is a browser IIFE that needs DOMParser + document globals, so we
 * provide them via jsdom, then load the script and exercise parsePledges()
 * against a saved (scrubbed) fixture. Run: `npm test`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

// Provide the browser globals parser.js expects, then load it (it attaches to
// globalThis.OpenHangar).
const dom = new JSDOM('');
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;

require('../src/scraper/parser.js');
const OpenHangar = globalThis.OpenHangar;

const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'pledges.sample.html'), 'utf8');
const pledges = OpenHangar.parsePledges(fixture);
const byId = (id) => pledges.find((p) => p.id === id);

test('parses every pledge card', () => {
  assert.equal(pledges.length, 3);
});

test('classifies a standalone ship (value + currency + containsShip)', () => {
  const p = byId('111');
  assert.equal(p.kind, 'ship');
  assert.equal(p.containsShip, true);
  assert.equal(p.value, 55);
  assert.equal(p.currency, 'USD');
});

test('parses a CCU into { from, to }', () => {
  const p = byId('222');
  assert.equal(p.kind, 'ccu');
  assert.equal(p.isCCU, true);
  assert.deepEqual(p.ccu, { from: 'Aurora MR', to: 'Avenger Titan' });
});

test('classifies a standalone add-on (no ship)', () => {
  const p = byId('333');
  assert.equal(p.kind, 'addon');
  assert.equal(p.isAddOn, true);
  assert.equal(p.containsShip, false);
});

test('detectCCU only matches "Upgrade - X to Y" names', () => {
  assert.equal(OpenHangar.detectCCU('Origin 300i'), null);
  assert.deepEqual(OpenHangar.detectCCU('Upgrade - Cutlass Black to Freelancer'), {
    from: 'Cutlass Black',
    to: 'Freelancer',
  });
});

test('parsePledges returns [] for empty / non-pledge input', () => {
  assert.deepEqual(OpenHangar.parsePledges(null), []);
  assert.deepEqual(OpenHangar.parsePledges('<div>no pledges here</div>'), []);
});

// --- Buy-backs ---

const buybackFixture = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'buybacks.sample.html'),
  'utf8',
);
const buybacks = OpenHangar.parseBuybacks(buybackFixture);

test('parses buy-back <article> cards (name, date, items from <dd>, id/href from .holosmallbtn)', () => {
  assert.equal(buybacks.length, 2);
  const a = buybacks[0];
  assert.equal(a.id, '987654');
  assert.equal(a.name, 'Drake Cutlass Black');
  assert.equal(a.date, '2023-11-24');
  assert.equal(a.contains, 'Cutlass Black · Lifetime Insurance'); // dd[2] of 4
  assert.match(a.image, /store_small\.jpg$/);
  assert.equal(a.href, '/account/buy-back-pledges/reclaim/987654');
  assert.equal(a.toShipId, '42');
  assert.equal(a.kind, 'ship'); // a melted ship classifies as 'ship' (classifyBuyback default)
});

test('buy-back id falls back to the reclaim URL when data-pledgeid is absent', () => {
  assert.equal(buybacks[1].id, '123456');
  assert.equal(buybacks[1].contains, 'Avenger Titan'); // dd[1] of 2
});

test('parseBuybacks returns [] for empty input', () => {
  assert.deepEqual(OpenHangar.parseBuybacks(null), []);
  assert.deepEqual(OpenHangar.parseBuybacks('<div>nothing</div>'), []);
});
