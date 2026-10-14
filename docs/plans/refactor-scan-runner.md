# refactor-scan-runner

## Goal

The scan, the pack reads and the sync after a scan move out of the basic page into one
page-agnostic runner (`ui/scan/runner.js`), with no change in what the basic page does
or shows. The runner also writes the scan's progress and report to storage, so another
page (the popup, a hidden scan page later) can show them.

## Steps

1. `ui/scan/runner.js`: `createRunner(env)` with scan, readPacks, sync, keepSyncForScan,
   takeKeptSync, retryIfDue, wishlistToAccount, otherScan and reconcile. No runes, no
   copy words, no clicks.
2. Move `ui/basic/sync-timing.js` and `ui/basic/wishlist-import.js` to `ui/scan/`;
   `scanElsewhere` keyed on the mark's run when it has one.
3. The runner writes session `scanRunning` (with run and by) and `scanProgress`
   (throttled), and local `scanReport`; buy-back details flushed and storage settled
   before scan and readPacks resolve (`OH.flushBuybackDetails`).
4. The portrait: a small data URL copy of the RSI avatar in `avatarImg` after the
   account read.
5. `ui/basic/hub.svelte.js` becomes a thin adapter: the runner with `by: 'tab'`, its
   words through a pure `reportLines(report, t)`, the click-bound asks and the UI kept.
6. Pinned tests updated in pairs; `test/scan-runner.test.js` added to `npm test`; the
   basic page's smoke checks cover the stored progress and report.

## Done

`npm run format:check`, `npm test`, `npm run test:ui`, `npm run build` and
`npm run check:store` pass; the basic page scans, reports and syncs as before.
