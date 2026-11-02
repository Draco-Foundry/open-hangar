# fix/scan-stops-account-history

Goal: a scan with Account History's full load under way finishes as a scan, never as
"Scan stopped", and the load goes on scan by scan.

Steps:

1. The scan renews its heartbeat after each log page (ui/scan/runner.js).
2. A per-scan page budget for the full history (src/lib.js readAccountLogs); reaching it
   is no error, the load goes on next scan.
3. A page RSI answers with something that isn't the log's JSON (a challenge page) stops
   both logs; a page the parser can't read stops that log only, never the scan.
4. Tests: a 173-page log over several scans, a 429 mid-load, a malformed page, the
   heartbeat during the load.

Done: npm test, format:check, build, check:store, test:ui pass.
