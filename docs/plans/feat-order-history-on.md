# Order History On (0.5.11)

## Goal

Turn on `orderHistory` in the store builds and the beta, with the approved privacy policy
lines and changelog words, so the next release ships Order History. Each pilot's switch
still starts off.

## Steps

1. `orderHistory` on, not dev-only: `src/flags.js`, `docs/FLAGS.md`, the build-flag and
   connector-build tests. Comments that said "developer builds only" updated.
2. When the owner approves the words: the policy lines in `docs/PRIVACY.md`,
   `site/privacy.html`, `docs/store-assets/privacy-amo.md` and the generated plain text
   (`npm run privacy:plain`), with Last updated moved.
3. A privacy test that holds the flag to the approved sentences.
4. The changelog fragment with the approved words.
5. Full checks, both builds loaded once, then ready.

## Done When

- Store and beta builds carry `orderHistory`; the policy names the read word for word.
- format, lint:firefox, npm test, build, check:store all pass.
- This file is deleted before merge.
