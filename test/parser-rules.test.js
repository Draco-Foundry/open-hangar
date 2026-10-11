'use strict';
// The parser rules (connector step 4): where things are on RSI's pages, as data.
// src/data/parser-rules.json and its schema, their copy for the extension's scripts
// (src/parser-rules-data.js), the loader (src/parser-rules.js), and the code that
// reads them (src/scraper/parser.js, src/lib.js): every rule is read, nothing is read
// that isn't a rule, and the moved code keeps no pattern or selector of its own.
// Run: `npm test` (`npm run rules` after changing either JSON file).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const RULES_JSON = JSON.parse(read('src/data/parser-rules.json'));
const SCHEMA_JSON = JSON.parse(read('schema/parser-rules.schema.json'));

// The browser globals parser.js and lib.js expect, then both, the way a page loads them.
const dom = new JSDOM('');
global.window = globalThis;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.chrome = {
  storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
};
const { validate, prepare } = require('../src/schema-check.js');
const DATA = require('../src/parser-rules-data.js');
const { rules: RULES, load } = require('../src/parser-rules.js');
require('../src/scraper/parser.js');
require('../src/lib.js');
const P = globalThis.OpenHangar;
const OH = globalThis.OH;

// The files that read the rules, as RULES.<path>.
const READERS = ['src/scraper/parser.js', 'src/lib.js'];

// A rule is a leaf: a pattern ({ source, flags }), a string, a number or a list (read
// whole: a table, a list of selectors or labels), or a GraphQL request's fixed
// `variables` (sent whole).
const isPattern = (v) =>
  !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).join() === 'source,flags';
const isLeaf = (v, key) =>
  isPattern(v) || Array.isArray(v) || typeof v !== 'object' || key === 'variables';
function leaves(v, at = [], out = []) {
  if (isLeaf(v, at[at.length - 1])) out.push({ path: at.join('.'), value: v });
  else for (const [k, x] of Object.entries(v)) leaves(x, [...at, k], out);
  return out;
}
const RULE_LEAVES = leaves(RULES_JSON);
const at = (obj, p) => p.split('.').reduce((o, k) => o[k], obj);

// The rules of one kind, by the schema's own words: the paths whose schema is
// #/$defs/<def> (a selector, an attribute, a path…), lists included.
function byDef(def) {
  const out = [];
  const walk = (s, v, where) => {
    if (s.$ref) {
      const name = s.$ref.split('/').pop();
      if (name === def) out.push({ path: where.join('.'), value: v });
      s = SCHEMA_JSON.$defs[name];
    }
    if (Array.isArray(v) && s.items) v.forEach((x, i) => walk(s.items, x, [...where, i]));
    else if (v && typeof v === 'object' && s.properties)
      for (const [k, x] of Object.entries(v)) walk(s.properties[k], x, [...where, k]);
  };
  walk(SCHEMA_JSON, RULES_JSON, []);
  return out;
}

// The code without its comments (whole-line and trailing // comments, and /* */).
const code = (f) =>
  read(f)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');

const fresh = () => structuredClone({ schema: SCHEMA_JSON, rules: RULES_JSON });

test('the script copy carries the JSON files as they are, frozen', async () => {
  assert.deepEqual(DATA.rules, RULES_JSON, 'run `npm run rules`');
  assert.deepEqual(DATA.schema, SCHEMA_JSON, 'run `npm run rules`');
  const { rulesScript } = await import('../scripts/parser-rules.mjs');
  assert.equal(
    read('src/parser-rules-data.js'),
    await rulesScript(RULES_JSON, SCHEMA_JSON),
    'src/parser-rules-data.js is what `npm run rules` writes',
  );
  assert.ok(Object.isFrozen(DATA.rules.hangar) && Object.isFrozen(DATA.schema.$defs));
});

test('the schema: only keywords the checker knows, strict everywhere, and the rules fit it', () => {
  assert.equal(SCHEMA_JSON.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.match(SCHEMA_JSON.$id, /\/1$/, 'its $id ends in the format');
  assert.equal(SCHEMA_JSON.properties.format.const, RULES_JSON.format);
  assert.doesNotThrow(() => prepare(SCHEMA_JSON));
  assert.equal(validate(SCHEMA_JSON, RULES_JSON), null);
  // Fixed keys all the way down: every object schema says which keys it takes.
  const walk = (s, where) => {
    if (!s || typeof s !== 'object') return;
    if (s.type === 'object')
      assert.equal(s.additionalProperties, false, `${where} takes only its own keys`);
    for (const [k, v] of Object.entries(s))
      if (v && typeof v === 'object') walk(v, `${where}/${k}`);
  };
  walk(SCHEMA_JSON, '#');
});

test('data only: strings, numbers, lists and objects; patterns are { source, flags }', () => {
  const walk = (v, where) => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${where}/${i}`));
    if (v && typeof v === 'object') {
      if ('source' in v || 'flags' in v) assert.ok(isPattern(v), `${where}: a pattern`);
      return Object.entries(v).forEach(([k, x]) => walk(x, `${where}/${k}`));
    }
    assert.ok(['string', 'number'].includes(typeof v), `${where}: ${typeof v}`);
  };
  walk(RULES_JSON, '');
  const patterns = RULE_LEAVES.filter((l) => isPattern(l.value)).length;
  assert.ok(patterns >= 30, `${patterns} patterns`);
  // No host anywhere: addresses are paths, the host stays in the code.
  assert.doesNotMatch(JSON.stringify(RULES_JSON), /https?:|\/\/[a-z]/i);
});

// A rule as data again: compiled patterns back to { source, flags }.
const plain = (v) => {
  if (Object.prototype.toString.call(v) === '[object RegExp]')
    return { source: v.source, flags: v.flags }; // from any realm (a worker's too)
  if (isPattern(v)) return plain(new RegExp(v.source, v.flags));
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === 'object')
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  return v;
};

test('loading: patterns compiled once and everything frozen', () => {
  assert.equal(globalThis.OHRules, RULES);
  for (const { path: p, value } of RULE_LEAVES) {
    const got = at(RULES, p);
    if (isPattern(value)) {
      assert.ok(got instanceof RegExp, p);
      assert.equal(got.source, new RegExp(value.source).source, p);
      assert.equal(got.flags, value.flags, p);
      assert.ok(Object.isFrozen(got), `${p} frozen`);
    } else assert.deepEqual(plain(got), plain(value), p);
  }
  const frozen = (v, where) => {
    if (!v || typeof v !== 'object') return;
    assert.ok(Object.isFrozen(v), `${where} frozen`);
    if (!(v instanceof RegExp)) for (const [k, x] of Object.entries(v)) frozen(x, `${where}/${k}`);
  };
  frozen(RULES, '');
  assert.ok(RULES.categories.kinds[0].pattern instanceof RegExp, 'patterns inside tables too');
});

test('loading refuses a file that does not fit, whole', () => {
  const refused = (change, why) => {
    const file = fresh();
    change(file.rules);
    assert.throws(() => load(file), why);
  };
  refused((r) => (r.format = 2), /parser rules: not the expected value at \/format/);
  refused((r) => (r.hangar.extra = '.x'), /not allowed here at \/hangar\/extra/);
  refused((r) => delete r.buybacks.tokens, /missing at \/buybacks\/tokens/);
  refused((r) => (r.names.coupon.flags = 'gi'), /\/names\/coupon\/flags/);
  refused((r) => (r.names.coupon.flags = 'y'), /\/names\/coupon\/flags/);
  refused((r) => (r.hangar.path = 'https://example.com/account/pledges'), /\/hangar\/path/);
  refused((r) => (r.hangar.path = '//example.com/x'), /\/hangar\/path/);
  refused((r) => (r.hangar.path = '/account//pledges'), /\/hangar\/path/);
  refused((r) => (r.hangar.pageSize = '10'), /\/hangar\/pageSize/);
  refused((r) => (r.categories.kinds[0].kind = 'starship'), /\/categories\/kinds\/0\/kind/);
  refused((r) => (r.buybacks.cellLayouts[0].min = 0), /\/buybacks\/cellLayouts\/0\/min/);
  refused((r) => (r.hangar.card = ''), /\/hangar\/card/);
  refused((r) => (r.names.ccu = '^upgrade'), /\/names\/ccu/);
  refused(
    (r) => (r.names.ccu.source = '(unclosed'),
    /a pattern that doesn't compile at \/names\/ccu/,
  );
  assert.doesNotThrow(() => load(fresh()));
});

test('the parts of a match the code reads are named groups in its pattern', () => {
  const GROUPS = {
    'names.ccu': ['from', 'to'],
    'names.category': ['prefix'],
    'buybacks.hrefId': ['id'],
    'buybacks.tokens': ['n'],
    'buybackDetail.infoLine': ['label', 'value'],
    'insurance.fromName.years': ['n'],
    'insurance.fromName.months': ['n'],
    'insurance.fromItem.years': ['n'],
    'insurance.fromItem.months': ['n'],
    'dates.iso': ['year', 'month', 'day'],
    'dates.named': ['year', 'month', 'day'],
    'dossier.orgSid': ['sid'],
  };
  const groupsOf = (re) =>
    Object.keys(new RegExp(`(?:${re.source})|`, re.flags).exec('').groups || {});
  for (const [p, want] of Object.entries(GROUPS))
    for (const g of want) assert.ok(groupsOf(at(RULES, p)).includes(g), `${p} names (?<${g}>…)`);
  // And a pattern with named groups is one the code reads them from: listed above.
  const named = byDef('pattern')
    .filter((l) => groupsOf(at(RULES, l.path)).length)
    .map((l) => l.path);
  assert.deepEqual(named.sort(), Object.keys(GROUPS).sort());
});

test('each GraphQL document defines the operation its request names', () => {
  const requests = byDef('operation');
  assert.ok(requests.length >= 3, `${requests.length} requests`);
  for (const { path: p, value: op } of requests) {
    const doc = at(RULES_JSON, p.replace(/operation$/, 'query'));
    assert.match(doc, new RegExp(`^\\s*(query|mutation)\\s+${op}\\b`), p);
  }
});

test('every selector parses, and cell layouts read cells the card has', () => {
  const doc = new JSDOM('<p></p>').window.document;
  const selectors = byDef('selector');
  assert.ok(selectors.length >= 30, `${selectors.length} selectors`);
  for (const { path: p, value } of selectors)
    assert.doesNotThrow(() => doc.querySelectorAll(value), `${p}: ${value}`);
  let last = Infinity;
  for (const l of RULES.buybacks.cellLayouts) {
    assert.ok(l.date < l.min && (l.contains == null || l.contains < l.min), JSON.stringify(l));
    assert.ok(l.min < last, 'the most cells first');
    last = l.min;
  }
});

test('every rule is read by the code, and the code reads only rules that exist', () => {
  const used = new Set();
  for (const f of READERS) {
    const text = code(f);
    for (const m of text.matchAll(/\bRULES((?:\.[A-Za-z_$][\w$]*)+)/g)) {
      const segs = m[1].slice(1).split('.');
      let node = RULES_JSON;
      let p = [];
      for (const s of segs) {
        if (isLeaf(node, p[p.length - 1])) break; // the rule's own method or part (.test…)
        assert.ok(
          Object.prototype.hasOwnProperty.call(node, s),
          `${f} reads RULES.${[...p, s].join('.')}, which isn't a rule`,
        );
        node = node[s];
        p.push(s);
      }
      assert.ok(
        isLeaf(node, p[p.length - 1]),
        `${f} reads RULES.${p.join('.')} whole: read its rules one by one`,
      );
      used.add(p.join('.'));
    }
    // The rules are only reached through RULES.
    const roots = [...text.matchAll(/\bOHRules\b/g)].length;
    assert.ok(roots <= 2, `${f}: OHRules only where RULES is set`);
  }
  // The loader reads `format` (the schema's const) and `revision` is for people.
  const unused = RULE_LEAVES.map((l) => l.path).filter(
    (p) => !used.has(p) && !['format', 'revision'].includes(p),
  );
  assert.deepEqual(unused, [], 'rules no code reads');
});

test('the moved code keeps no pattern or selector of its own', () => {
  // parser.js: its patterns are the rules, but for these, which read text, not RSI.
  const GENERIC = new Set([
    String(/\s+/g), // collapsing whitespace
    String(/url\((['"]?)(.*?)\1\)/i), // CSS url(…) in a style attribute
    String(/[^0-9.]/g), // the number in "$35.00 USD"
    String(/^[A-Z]{3}$/), // an ISO 4217 currency code
    String(/\b([A-Z]{3})\b/),
    String(/<[^>]+>/g), // HTML tags, for the text around them
  ]);
  const regexLiterals = (text) =>
    [
      ...text.matchAll(
        /(?:^|[=(,:!&|?{};]|\breturn)\s*(\/(?![*/])(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n[])+\/[dgimsuyv]*)/gm,
      ),
    ].map((m) => m[1]);
  const parser = code('src/scraper/parser.js');
  const found = regexLiterals(parser);
  assert.ok(found.length >= GENERIC.size, 'the finder finds them');
  for (const re of found) assert.ok(GENERIC.has(re), `parser.js has a pattern of its own: ${re}`);
  // Selectors and RSI's attributes come from the rules, never a literal.
  for (const m of parser.matchAll(/\.(querySelector|querySelectorAll|closest|matches)\(\s*(\S)/g))
    assert.ok(!/['"`]/.test(m[2]), `parser.js: ${m[1]}() with a selector of its own`);
  for (const m of parser.matchAll(/\.getAttribute\(\s*(['"`])([^'"`]*)\1/g))
    assert.ok(['src', 'href', 'style'].includes(m[2]), `parser.js reads RSI's ${m[2]}`);
  assert.doesNotMatch(parser, /classList/, 'classes are selectors in the rules');

  // Both readers: no rule written out again as a literal (a pattern, an address, a
  // selector or one of RSI's attributes). lib.js reads the saved hangar's item kinds
  // ("Ship", as RSI wrote it) in its value math: that's the saved model, not RSI's page.
  const MODEL = { 'src/lib.js': ['kinds.ship'] };
  for (const f of READERS) {
    const text = code(f);
    const literals = [...text.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)].map((m) => m[2]);
    for (const { path: p, value } of byDef('pattern'))
      if (!(MODEL[f] || []).includes(p))
        assert.ok(!text.includes(`/${value.source}/`), `${f} spells out ${p}`);
    for (const { path: p, value } of byDef('path'))
      assert.ok(!literals.some((s) => s.includes(value)), `${f} spells out ${p}: ${value}`);
  }
  // Both read every selector, attribute and RSI JSON key from the rules, and never
  // hand a selector of their own to the DOM.
  for (const f of READERS) {
    const text = code(f);
    const literals = [...text.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)].map((m) => m[2]);
    for (const { path: p, value } of [...byDef('selector'), ...byDef('attribute')])
      assert.ok(!literals.includes(value), `${f} spells out ${p}: ${value}`);
    for (const m of text.matchAll(/\.(querySelector|querySelectorAll|closest|matches)\(\s*(\S)/g))
      assert.ok(!/['"`]/.test(m[2]), `${f}: ${m[1]}() with a selector of its own`);
    for (const { path: p, value } of byDef('operation'))
      assert.ok(!literals.includes(value), `${f} spells out ${p}: ${value}`);
  }
  // lib.js reads the account's JSON (OH.getAccount, up to the referrals) by the rules'
  // keys, never obj.<key> of its own.
  const lib = code('src/lib.js');
  const account = lib.slice(
    lib.indexOf('function extractAccount'),
    lib.indexOf('async function fetchReferralPage'),
  );
  assert.ok(account.length > 2000, 'found OH.getAccount');
  for (const { path: p, value } of byDef('jsonKey').filter((l) => /^account\./.test(l.path)))
    assert.doesNotMatch(account, new RegExp(`\\b(obj|sub|con|c)\\.${value}\\b`), p);
});

test('the rules load in a worker too: no window, document, chrome or require', () => {
  const vm = require('node:vm');
  const ctx = vm.createContext({});
  ctx.self = ctx;
  for (const f of ['schema-check.js', 'parser-rules-data.js', 'parser-rules.js'])
    vm.runInContext(read(`src/${f}`), ctx, { filename: f });
  assert.ok(ctx.OHRules.names.ccu.test('Upgrade - Pulse to C8R Pisces'));
  assert.deepEqual(JSON.parse(JSON.stringify(plain(ctx.OHRules))), plain(RULES));
  // Without the checker first, it says so instead of loading unchecked rules.
  const bare = vm.createContext({});
  bare.self = bare;
  vm.runInContext(read('src/parser-rules-data.js'), bare);
  assert.throws(
    () => vm.runInContext(read('src/parser-rules.js'), bare),
    /load schema-check\.js and parser-rules-data\.js first/,
  );
  assert.equal(bare.OHRules, undefined);
});

test('every page that reads RSI loads the rules first', () => {
  for (const page of ['src/dashboard.html', 'src/basic.html', 'src/popup.html']) {
    const order = [...read(page).matchAll(/\bsrc="([^"]+\.js)"/g)].map((m) => m[1]);
    const pos = (f) => order.indexOf(f);
    assert.ok(pos('schema-check.js') >= 0, `${page}: schema-check.js`);
    assert.ok(pos('schema-check.js') < pos('parser-rules-data.js'), page);
    assert.ok(pos('parser-rules-data.js') < pos('parser-rules.js'), page);
    for (const reader of ['scraper/parser.js', 'lib.js', 'rsi-cart.js'])
      if (pos(reader) >= 0) assert.ok(pos('parser-rules.js') < pos(reader), `${page}: ${reader}`);
  }
});

test("RSI's real buy-back token sentence, from the list page", () => {
  const html = read('test/fixtures/buyback-tokens.html');
  assert.equal(P.parseBuybackTokens(html), 2);
  // What a buy-back scan keeps from page 1 next to the rows.
  assert.deepEqual(OH.getSource('buybacks').meta(html), { tokens: 2 });
  // The sentence's other forms.
  const one = html.replace('<strong>2</strong> opportunity', '<strong>1</strong> opportunity');
  assert.equal(P.parseBuybackTokens(one), 1);
  const none = html.replace('<strong>2</strong> opportunity', '<strong>no</strong> opportunities');
  assert.equal(P.parseBuybackTokens(none), 0);
  assert.equal(P.parseBuybackTokens(html.replace('You have', 'You had')), null);
});

test('the scan reads the addresses, paging and signs from the rules', () => {
  const hangar = OH.getSource('hangar');
  const buybacks = OH.getSource('buybacks');
  assert.equal(hangar.url, 'https://robertsspaceindustries.com/account/pledges');
  assert.equal(hangar.pageSize, 10);
  assert.equal(hangar.marker, RULES.hangar.marker);
  assert.equal(buybacks.url, 'https://robertsspaceindustries.com/account/buy-back-pledges');
  assert.equal(buybacks.pageSize, 100);
  assert.equal(buybacks.emptyMarker, RULES.buybacks.empty);
  assert.ok(buybacks.emptyMarker.test('You have no pledges available for buy back.'));
});
