/*
 * parser-rules.js — where things are on RSI's pages, as data (connector step 4).
 * ---------------------------------------------------------------------------
 * The parsing code stays in src/scraper/parser.js and src/lib.js. What it looks for
 * (addresses and paging, selectors and cell positions, name patterns) is one data
 * file, src/data/parser-rules.json, described by schema/parser-rules.schema.json, so a
 * change on RSI's side is fixed in data, not code. The file ships inside the
 * extension and is never fetched (docs/FLAGS.md). src/parser-rules-data.js is its copy
 * as a script, with the schema (`npm run rules` writes it).
 *
 * Loaded after src/schema-check.js and src/parser-rules-data.js, and before
 * scraper/parser.js and lib.js, by every page that has them; required by node tests.
 * Exposes self.OHRules: the rules, checked against their schema by src/schema-check.js
 * first, each pattern ({ source, flags }) compiled once with new RegExp (MV3 allows it:
 * it isn't eval), everything frozen. A file that doesn't fit, or a pattern that doesn't
 * compile, throws here, before anything reads it.
 */
(function (root) {
  if (!root.OHSchema && typeof require === 'function') require('./schema-check.js');
  if (!root.OHParserRulesData && typeof require === 'function') require('./parser-rules-data.js');
  const check = root.OHSchema;
  if (!check || !root.OHParserRulesData)
    throw new Error('parser rules: load schema-check.js and parser-rules-data.js first');

  const isPattern = (v) =>
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    Object.keys(v).length === 2 &&
    typeof v.source === 'string' &&
    typeof v.flags === 'string';

  // { schema, rules } → the rules, ready to read. Throws on a file that doesn't fit.
  function load({ schema, rules }) {
    const problem = check.validate(schema, rules);
    if (problem) throw new Error(`parser rules: ${problem.reason} at ${problem.path || '/'}`);
    const ready = (v, at) => {
      if (isPattern(v)) {
        try {
          return Object.freeze(new RegExp(v.source, v.flags));
        } catch {
          throw new Error(`parser rules: a pattern that doesn't compile at ${at}`);
        }
      }
      if (Array.isArray(v)) return Object.freeze(v.map((x, i) => ready(x, `${at}/${i}`)));
      if (v && typeof v === 'object')
        return Object.freeze(
          Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ready(x, `${at}/${k}`)])),
        );
      return v;
    };
    return ready(rules, '');
  }

  const rules = load(root.OHParserRulesData);
  root.OHRules = rules;
  if (typeof module !== 'undefined' && module.exports) module.exports = { rules, load };
})(typeof self !== 'undefined' ? self : globalThis);
