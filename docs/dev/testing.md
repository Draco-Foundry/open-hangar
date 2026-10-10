# Testing and Builds

- `npm test`: the unit tests (`node --test`, listed in package.json's `test` script; add
  a new test file to that list). The background worker's tests run it in a sandbox
  with a fake chrome API, built the way a build makes it (`test/bridge-env.js`).
- `npm run test:ui`: builds the Svelte UI and runs the dashboard smoke test in Chrome
  (scripts/screenshots/smoke.mjs). Rewrite a page's checks along with the page.
- `npm run format:check`: prettier over js, html, json and md.
- `npm run build`: the Chrome and Firefox builds in `dist/`. Then
  `node scripts/check-store-build.mjs` checks a store build carries nothing it mustn't
  (its pages' way in included: the manifest and the built page lists agree).
- `npm run build:beta` / `npm run build:staging`: the beta and staging builds. The
  staging build has `localMode` on, so the staging hangar page can talk to it
  (docs/FLAGS.md, "Local Mode").
- `npm run lint:firefox`: Mozilla's linter on the Firefox build.
- `npm run test:privacy` (after `npm run pack`): the Chrome store build in Chrome,
  never connected, sends nothing to the sync site (scripts/privacy-check.mjs).

CI runs the tests, the UI test, the Firefox linter, the store build and privacy checks
and the beta build on every PR; a docs-only PR runs just the tests and the format check.
