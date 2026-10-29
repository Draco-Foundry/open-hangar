# A First Scan Cut Short Saves Nothing

Goal: a hangar or buy-back read that stops partway is never saved and so never synced,
even when this browser has no earlier scan of that RSI account.

Steps:

1. `src/lib.js` scanSource: drop the first-scan path that kept a partial read; it now
   returns an error like the others (signed out, or "nothing from this read was saved").
2. Tests: a first scan signed out after page 1 saves nothing (`test/scan.test.js`); the
   paging test's first case now expects nothing saved (`test/paging.test.js`).
3. Changelog fragment.

Done when: `npm test` passes, prettier is clean on touched files.
