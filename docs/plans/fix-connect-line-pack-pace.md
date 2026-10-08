# fix/connect-line-pack-pace (review fixes)

Goal: the review's findings on the Connect line and the buy-back detail pacing.

Steps:

1. `src/lib.js` `fetchPage`, buy-back path only (`retryRateLimit: false`): a 5xx's
   Retry-After (seconds or a date) is waited in full; one longer than a retry wait
   (15 s) ends the page at once, so the batch holds until then. Scans keep their
   behaviour.
2. `OH.fetchBuybackDetails`: no pause after the last page or once Stop is pressed;
   the pause cap that could never be reached goes, and the comments say what happens
   (2 to 4 s after one failed page, 4 to 8 s after two, a third stops the batch). A
   batch held before it starts says so (`held`), and a 5xx hold says it's RSI being
   busy (`busy`), not a slow-down.
3. `src/dashboard.js` `loadBuybackDetails`: one batch at a time; hours for long holds;
   the automatic read after a scan says nothing while a hold is on; separate words for
   a busy RSI.
4. `ui/site/SiteConnect.svelte`: `Open&nbsp;Hangar`, so the name never splits.
5. Tests: the 5xx Retry-After cases (seconds, date, short), no network three times in
   a row, the slow-down count kept by a batch that reads nothing, no pause after the
   last page.
6. `ARCHITECTURE.md`: `bbDetails` no longer says "only when you ask". The Connect card
   overlap from 761 to 880px gets its own issue.

Done: `npm test`, `npm run test:ui`, `npm run format:check`, `npm run pack` and
`node scripts/check-store-build.mjs` pass; CI green.
