# test-parser-corpus

Goal: run the parser over real, scrubbed RSI pages; fail on anything it doesn't
recognize; cross-check against numbers RSI prints and the parser doesn't read.

Steps: scrub script, corpus of 3 hangar pages and 1 buy-back page, `known` shapes in the
parser rules, the parser report, the corpus test, docs.

Done: `npm test` and `format:check` pass; the report counts 0; no personal data in any
fixture.
