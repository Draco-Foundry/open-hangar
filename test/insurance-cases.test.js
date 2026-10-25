'use strict';

/*
 * A pledge's insurance from RSI's item lines (src/scraper/parser.js normalizePledge and
 * insuranceTerm), against test/fixtures/insurance-cases.json: the website reads the same
 * cases from a pinned copy, so both sides read RSI's text the same way. Run: `npm test`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { cases } = require('./fixtures/insurance-cases.json');

const dom = new JSDOM('');
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
require('../src/scraper/parser.js');
const OpenHangar = globalThis.OpenHangar;

// The parser's field ('LTI', '120M', RSI's text, null) in the cases' terms.
const meaning = (ins) => {
  if (ins == null) return null;
  if (ins === 'LTI') return 'LTI';
  const m = /^(\d+)M$/.exec(ins);
  return m ? Number(m[1]) : { unknown: ins };
};

test('every shared case reads as the website reads it', () => {
  for (const c of cases) {
    const p = OpenHangar.normalizePledge({ name: 'Standalone Ships - Test', contents: c.contents });
    assert.deepEqual(meaning(p.insurance), c.want, c.why);
  }
});
