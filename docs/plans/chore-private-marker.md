# chore/private-marker

Goal: the private-files guard also refuses files carrying the shared private marker
`draco-private: never commit`, which the owner's other private repos put in every Markdown file.

Steps:
1. `scripts/check-private.mjs`: check a list of markers (the existing one plus the new one).
2. `test/check-private.test.js`: a file with the new marker fails; the existing tests still pass.
3. Format, tests.

Done: `npm run format:check` and `npm test` pass; no plan file left.
