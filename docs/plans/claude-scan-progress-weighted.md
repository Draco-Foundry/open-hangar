# Scan Progress Weighted by Time

Goal: the popup's scan bar fills by the time a scan takes, not by fixed slices per part,
so Buy-Back Details' slow pages no longer leave it at 92% with most of the work to come.

Steps:

1. `ui/lib/scan-pace.js`: each part's share = its requests × its time per request, from
   the last scan's measured pace (the scan report's `pace`), first-scan guesses otherwise;
   the fill, where the next request puts it, and the time left.
2. `ui/scan/runner.js`: a tracker per scan writes `f`, `next`, `left`, `quick` into
   scanProgress and `pace` into the report.
3. `ui/popup/data.js`: the bar reads `f` and `next` (today's slices stay as the fallback);
   the time left and the step dots.
4. `ui/popup/ScanBar.svelte` and `popup.css`: the dots and time left under the bar; a
   quick scan shows no fill.
5. `src/background.js`: the % on the toolbar badge while a scan runs.
6. Words: new keys marked for the owner's OK; a changelog fragment.

Done: format check, `npm test`, build and check:store, the popup smoke test, Chrome and
Firefox loaded once.
