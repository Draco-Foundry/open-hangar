# ci-parser-version

Goal: a stored-data version for what the parser reads, a CI check that a parser change
bumps it (or says why not), and stale marking for data an older parser read.

Steps: PARSER_VERSION and parserStale in src/hangar-shape.js; the scanParser stamp in
src/lib.js saveSource and OH.parserStale; scripts/check-parser-version.mjs in CI; docs.

Done: tests, format, Firefox lint and the store check pass. Showing stale data in the
popup and rescanning wait for the scan-recovery PR (#723), noted in the PR.
