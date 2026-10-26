# New Since Last Scan (Popup)

Goal: right after a scan, the popup's Hangar tab lists the pledges the scan found that
the one before it didn't, by pledge id, with name, picture, melt value, the G and M marks
and the insurance chip, and a total. Behind the build flag `newSinceScan`, off.

Steps:

1. A pure diff over the scan history (`ui/popup/data.js`), with unit tests.
2. The section on the Hangar tab, as the website's title-only pledge card in its row shape.
3. Placeholder words in `ui/popup/copy.js`, marked as waiting for the owner's OK.
4. The flag in `src/flags.js` and docs/FLAGS.md; a smoke test with the flag on.

Done: format, Firefox lint, tests, build and store check pass; the smoke test covers the
section on and off.
