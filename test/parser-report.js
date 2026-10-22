'use strict';

/*
 * The parser report: over every saved RSI page in test/fixtures/corpus/, what the
 * parser didn't recognize (OpenHangar.unrecognized in src/scraper/parser.js, against
 * `known` in src/data/parser-rules.json). test/parser-corpus.test.js fails while any
 * count is above 0; `npm run report:parser` prints it. New shapes get a fixture and a
 * rule, never a skip.
 */

const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const CORPUS = path.join(__dirname, 'fixtures', 'corpus');
const KINDS = ['pledges', 'items', 'tags', 'labels', 'hooks'];

function load() {
  if (!globalThis.DOMParser) {
    const dom = new JSDOM('');
    globalThis.window = globalThis.window || globalThis;
    globalThis.document = globalThis.document || dom.window.document;
    globalThis.DOMParser = dom.window.DOMParser;
  }
  require('../src/scraper/parser.js');
  return { P: globalThis.OpenHangar, RULES: globalThis.OHRules };
}

// The corpus: [{ file, kind: 'hangar' | 'buybacks', html }], sorted by name.
function corpus() {
  return fs
    .readdirSync(CORPUS)
    .filter((f) => f.endsWith('.html'))
    .sort()
    .map((file) => ({
      file,
      kind: file.startsWith('buybacks') ? 'buybacks' : 'hangar',
      html: fs.readFileSync(path.join(CORPUS, file), 'utf8'),
    }));
}

// One page → { pledges, items, tags, labels, hooks }, each line "file: what".
function pageReport({ file, kind, html }, { P }) {
  const r = P.unrecognized(html, kind);
  return Object.fromEntries(KINDS.map((k) => [k, r[k].map((line) => `${file}: ${line}`)]));
}

// The whole corpus → { pages, counts: { pledges, items, tags, labels, hooks }, found }.
function report() {
  const loaded = load();
  const pages = corpus();
  const found = Object.fromEntries(KINDS.map((k) => [k, []]));
  for (const page of pages) {
    const r = pageReport(page, loaded);
    for (const k of KINDS) found[k].push(...r[k]);
  }
  const counts = Object.fromEntries(KINDS.map((k) => [k, found[k].length]));
  return { pages: pages.map((p) => p.file), counts, found };
}

module.exports = { CORPUS, corpus, load, pageReport, report };

if (require.main === module) {
  const r = report();
  console.log(`parser report over ${r.pages.length} saved pages (test/fixtures/corpus/):`);
  for (const k of KINDS) console.log(`  ${k}: ${r.counts[k]} not recognized`);
  for (const k of KINDS) for (const line of r.found[k]) console.log(`    ${line}`);
  process.exitCode = KINDS.some((k) => r.counts[k] > 0) ? 1 : 0;
}
