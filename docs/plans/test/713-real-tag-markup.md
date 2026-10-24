# The October hangar fixtures in real markup (#713)

Goal: `test/fixtures/pledge-tags.html` and `test/fixtures/game-library.html` follow the
real captured markup (scrubbed), and the tests check what the captures show.

Steps:

1. Rewrite both fixtures from the captures: made-up ids, names, prices, dates; no pictures.
2. Update `test/hangar-tags.test.js` to the real Gift and Exchange actions.
3. The parser report knows the Upgrades button (report only, parsed data unchanged).

Done: format, lint, `npm test`, build and check:store pass; the issue's checklist answered.
