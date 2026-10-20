# fix/scan-gap-after-empty-scan

Goal: Scan right after Log In to RSI scans, instead of "A scan is already running." for
up to a minute after a scan that read nothing.

Steps:

1. `src/background.js` freeAskGap, run when the hidden page is done (scan-host
   afterDone): the last report is this request's and read nothing (signed out or held,
   no rows) → the one-a-minute limit goes. Expected: the next Scan is let in.
2. Test in `test/scan-host.test.js`: signed out and held free it; a scan that read, or an
   older report, keep it.
3. npm test, build, check in Firefox and Chrome.

Done: tests pass, and in the dev copy a signed-out Scan, Log In, then Scan scans at once.
This file is deleted before merge.
