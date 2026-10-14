# feat-auto-scan: Auto Scan Daily (#666)

## Goal

Auto Scan Daily for 0.4.0: an optional daily scan of the connected RSI account in the
hidden scan page, with a quick check first, saved part by part, and the approved status
lines in the popup. It makes the privacy policy's Auto Scan Daily section (5a, 5b), 9e,
10a and 10c true.

## Steps

1. Background: the alarm's lifecycle in one queue, the late-alarm rule, the skips, and
   `requestScan('auto', { hiddenOnly: true })`.
2. lib.js: the sign-in read, the quick check, auto mode for the parts (no partial saves,
   a keep gate), the sync stamp, Disconnect and Clear Data turning it off.
3. The runner's `autoScan()` with its local gates, the cookie check, `fullDue`, the
   saves part by part, the drop check and the run record.
4. The popup: the switch, the status line, the ask and "Scan stopped" after a restart.
5. The flag on in store builds, coupled to `alerts`; docs.
6. Tests for every rule and failure mode; smoke checks.

## Done

`npm run format:check`, `npm test`, `npm run test:ui`, `npm run build` then
`npm run check:store`, `npm run lint:firefox`, `npm run pack` then `npm run test:privacy`
all pass. This file is deleted before the PR is ready.
