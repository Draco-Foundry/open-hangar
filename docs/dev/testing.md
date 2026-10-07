# Testing and Builds

- `npm test`: the unit tests (`node --test`, listed in package.json's `test` script; add
  a new test file to that list).
- `npm run test:ui`: builds the Svelte UI and runs the dashboard smoke test in Chrome
  (scripts/screenshots/smoke.mjs). Rewrite a page's checks along with the page.
- `npm run format:check`: prettier over js, html, json and md.
- `npm run build`: the Chrome and Firefox builds in `dist/`. Then
  `node scripts/check-store-build.mjs` checks a store build carries nothing it mustn't.
- `npm run build:beta` / `npm run build:staging`: the beta and staging builds.
- `npm run lint:firefox`: Mozilla's linter on the Firefox build.

CI runs the tests, the UI test and the Firefox linter on every PR.
