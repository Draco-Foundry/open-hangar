# fix(rules): RSI's older ship names in the parser rules' aliases

Goal: the parser rules' `aliases` carry the same renames as the website's SHIP_RENAMES
(open-hangar-server, the owner's approved recs of 2026-11-16), so alerts find a ship scanned
under RSI's older name (Aurora LN, F7C Hornet, Nova Tank and the rest).

Steps:

1. src/data/parser-rules.json: the new aliases, revision 2026-11-16; `npm run rules`.
2. Test in test/alerts.test.js.

Done when: npm test and prettier pass.
