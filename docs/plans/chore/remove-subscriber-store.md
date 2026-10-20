# Remove the Subscriber Store Read

Goal: delete the Subscriber Store (RSI /graphql GetBrowseSkusByFilter) and everything
that only it uses. Its one caller is the dashboard page (src/dashboard.js loadSubStore),
which store builds leave out since 0.3.0 (connector on), so it can't run for players. The
privacy policy doesn't name it and no website feature uses it.

Steps:

1. lib.js: drop the Your Subscriber Store block (keep 'subStore' in Clear Data's removal
   lists so a leftover copy from an old dashboard build still gets cleared).
2. dashboard.js: drop loadSubStore, its calls and the store page's `sub` / `refreshSub`.
3. ui/store/SubStore.svelte and its mount in Store.svelte; CitizenCard's link to it.
4. Parser rules: `subStore` out of src/data/parser-rules.json and the schema;
   regenerate src/parser-rules-data.js with `npm run rules`.
5. Tests: delete test/sub-store.test.js and its fixture (and from package.json's list),
   the storage-budget entry, the smoke test's section and the demo shim's data.

Done: no `subStore` reference left except Clear Data's key list; `npm run format:check`,
`npm test`, `npm run build` + `npm run check:store` pass; `npm run test:ui` if Chrome runs.
