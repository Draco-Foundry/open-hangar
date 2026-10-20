# feat/popup-scan-progress-bar

Goal: the toolbar popup shows a scan as one counting bar where Scan sits (owner,
2026-10-20), behind the `scanBar` flag, dark by default.

Signed off from the mockups (owner, 2026-10-20): the soft fill, 28 px tall, items read
counted on the right, the bar under the header dropped, and the finished bar ("Scanned in
1m 12s") staying above Scan until the popup closes. Scan can't be pressed right after a
click, while another page scans, or while RSI asks to wait; that note goes in the bar's
spot.

Steps:

1. `src/lib.js`: scanHtmlSource passes RSI's page count (the pager's highest page) to
   onProgress; RSI still asking to slow down after every retry comes back as `slowDown`
   with its Retry-After.
2. `ui/scan/runner.js`: `pages` in session scanProgress; referrals counted across their
   three lists; the report's `wait` (scanWait).
3. `ui/popup/data.js`: barFraction, barLabel, scanHold; `Hangar.svelte`, `Popup.svelte`
   and `popup.css` draw it with the flag on.
4. Tests: test/popup.test.js, test/scan-runner.test.js, test/paging.test.js,
   test/build-flags.test.js.

Done: npm test, format:check, build:ui, a dev build with `--flag scanBar=on` checked in
Chrome, Edge and Firefox and a narrow popup, draft PR. New words ("Waiting on RSI", "RSI
asked us to wait. Scan at {time}") wait for the owner's OK.
