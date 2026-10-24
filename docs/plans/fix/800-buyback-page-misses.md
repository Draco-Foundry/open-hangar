# Buy-back pages that never read stop taking a slot (#800)

Goal: a buy-back page that fails for a reason that won't pass (404, unreadable) no longer
takes one of the scan's 30 buy-back pages every scan.

Steps:

1. Remember those failures by pledge id (`bbdMisses`: count, time); a read clears one;
   pruned with the details.
2. The scan's pick skips a missed page for a day, doubling per miss (30 days at most),
   then tries it after the pages that never failed.
3. Tests: the store and the wait (buyback-details), the pick (scan-runner), the budget.

Done: `npm run format:check`, `npm run lint:firefox`, `npm test`, `npm run build`,
`npm run check:store` pass.
