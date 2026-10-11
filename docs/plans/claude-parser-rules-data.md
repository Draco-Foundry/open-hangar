# Parser Rules As Data (connector step 4, phase 1)

## Goal

When RSI changes a page, the fix is a change to one bundled data file, not to code. The
extension keeps all of its parsing code; only the "where" (addresses, paging, selectors,
cell positions, patterns, JSON keys, GraphQL documents) moves into
`src/data/parser-rules.json`, checked against `schema/parser-rules.schema.json` by
`src/schema-check.js` in the tests and when it loads. Nothing is fetched: the rules ship
inside the extension. Behavior doesn't change.

## Steps

1. The rules file, its schema, the generated script copy (`npm run rules`) and the
   loader (`src/parser-rules.js`: check, compile patterns, freeze), loaded before
   parser.js and lib.js in every page that has them.
2. Move the hangar and buy-back readers: `src/scraper/parser.js` (cards, cells,
   buttons, detail page, classification, insurance, kinds, dates, the token sentence)
   and the scan's addresses, paging, markers and signed-out signs in `src/lib.js`.
3. Tests: the schema and the generated copy agree, the loader refuses a bad file,
   every rule is read by the code and every rule the code reads exists, the moved code
   holds no pattern or selector of its own, and the real token sentence fixture.
4. Docs: FLAGS.md (bundled data, not remote config; the signed remote copy is later and
   needs the owner), ARCHITECTURE.md, RSI-CHANGES.md.
5. Second PR: account JSON keys, dossier, referrals, Subscriber Store and the store list.
6. Third PR (after step 5's cart fixes merge): src/rsi-cart.js and the worker.

## Done When

- Every existing test passes unchanged; the new tests pass.
- `npm run format:check`, `npm test`, `npm run build` + `node scripts/check-store-build.mjs`
  (also with `connector` and `localMode` on), `npm run test:ui` (Chrome and Edge),
  `npm run lint:firefox`.
