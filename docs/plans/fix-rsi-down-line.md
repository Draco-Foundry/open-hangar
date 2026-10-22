# fix/rsi-down-line (#747)

Goal: when RSI itself doesn't answer a scan (a 5xx, or a 429 after every retry), the popup
and the basic page say so, instead of the raw error or Log In to RSI, and nothing from the
last scan is lost. No status page, no new permission.

Steps
1. A 5xx partway through a pressed Scan saves nothing from the partial read (src/lib.js).
2. A pressed Scan's report carries `rsiDown` (ui/scan/runner.js); Auto Scan Daily gets a
   `rsi-down` line for a run that stopped before reading anything.
3. Popup: the line in the bar, or under Scan with the scanBar flag off (with the 429 wait
   and "Waiting on RSI" there too); the trouble box and Log In to RSI give way to it.
4. Basic page: the 5xx and 429 lines in the problem box.
5. Approved words, tests, a CHANGELOG bullet.

Done when: `npm run format:check`, `npm run lint:firefox`, `npm test`, `npm run build` and
`npm run check:store` pass, and the tests cover signed out not winning over RSI down, and a
5xx before the first page and partway through (as many items as before, or more).
