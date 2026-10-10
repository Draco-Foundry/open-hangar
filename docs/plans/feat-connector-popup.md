# feat/connector-popup

Goal: the first piece of the connector (the website is the full app, the extension
scans and connects): a `connector` build flag and the toolbar popup.

Steps:

1. `connector` in src/flags.js (off everywhere), needing `localMode`; pack.mjs adds
   `action.default_popup` with it on and leaves the popup out without it.
2. The popup (src/popup.html, ui/popup/): Account Value, a place for the alert count,
   the last scan, Scan, Open My Hangar, where sync stands, a link to the extension's
   page. New words are `[copy: …]` placeholders.
3. Scan from the popup: the background's requestScan (the hangar page's scan), behind
   the connector markers, only from our own popup.
4. Tests: unit (test/connector.test.js, the build-flag tests), UI (smoke.mjs Popup).

Done when: `npm test`, `npm run test:ui` (Chrome and Edge), the store build check and
the Firefox lint pass, and a `--flag localMode=on --flag connector=on` build shows the
popup in Chrome, Edge and Firefox.
