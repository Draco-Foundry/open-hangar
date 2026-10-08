# fix/connect-line-pack-pace

Goal: two small fixes. The Connect card says what happens once you connect, and the
buy-back detail reads (the automatic pack read after a scan, Load Details and Get
Details) go at a gentler pace and listen to RSI.

Steps:

1. `ui/site/SiteConnect.svelte`: the hint under Connect to openhangar.space adds "Open
   Hangar will sync after every scan. Disconnect any time." The UI smoke test checks it.
2. `src/lib.js`, `OH.fetchBuybackDetails`: a 1 to 2 s random pause between pages
   (was 0.4 to 1 s). A page that fails for a passing reason (5xx, no network) doubles
   the next pause, up to 30 s, and three in a row stop the batch.
3. A "slow down" (429 or 403) still stops the batch, now held off for the longer of
   RSI's Retry-After and a cooldown that doubles with each slow-down in a row (15 min,
   30 min, 1 h, up to 6 h), reset by a page read fine. A 5xx that still comes with a
   Retry-After after its retries stops the batch until then too.
4. `src/dashboard.js`: the Load Details time estimate follows the new pace.
5. `test/buyback-details.test.js`: tests for the pause range, the backoff and
   Retry-After. `test/storage-budget.test.js` lists the new count key.

Done: `npm test`, `npm run test:ui`, `npm run format:check` pass; the Connect card
checked wide and at phone width.
