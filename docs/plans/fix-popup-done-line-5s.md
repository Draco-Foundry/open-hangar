# Popup: the Scanned In Line Shows for 5 Seconds

Goal: the popup's "Scanned in X" line shows for 5 seconds after a scan ends, then Scan
again. A popup opened later never shows it.

Steps:

1. A pure `doneLeft(report, now)` in `ui/popup/data.js`, timed from the report's end
   (`report.at`), with a unit test.
2. `ui/popup/ScanBar.svelte` uses it for the bar and for the line without the bar.
3. The UI smoke test's hold check waits past 5 seconds.

Done: `npm test`, `npm run format:check` and `npm run test:ui` pass.
