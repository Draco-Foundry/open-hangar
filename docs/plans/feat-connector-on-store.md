# feat/connector-on-store

## Goal

The 0.3.0 store release is the connector (docs/CONNECTOR.md, step 2): `connector` and
`localMode` on in every store build and the beta, so the toolbar opens the popup and the
basic page is the extension's one page, with Local Mode on our hangar page.

## Steps

1. `src/flags.js`: `connector` and `localMode` default on; `alerts` stays off,
   `orgFleet` dev-only.
2. Every test that assumed the old defaults checks the same thing with the connector
   on, and keeps coverage for builds without it. Anything the connector build gets wrong
   for a player (a page that no longer exists opened by Connect, a scan or Firefox's
   ask) is fixed in code.
3. The checks that open the dashboard (the privacy check) work on the connector build.
4. Nothing the store build sends goes beyond what the privacy policy says.
5. docs/FLAGS.md, docs/CONNECTOR.md and the flag comments say where each flag stands.
6. Store screenshots of the popup and the basic page, 1280x800, with the demo data.
7. CHANGELOG: a placeholder for the connector line (its words come from the owner).

## Done

- `npm run format:check`, `npm test`, `npm run test:ui` pass.
- `npm run pack` then `node scripts/check-store-build.mjs` and `npm run test:privacy`;
  `npm run build:beta` and `node scripts/check-store-build.mjs --beta`.
- The store zip: no dashboard page, the popup opens, the basic page works, no `[copy:`
  placeholder shipped.
