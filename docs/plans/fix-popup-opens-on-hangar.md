# fix-popup-opens-on-hangar

Goal: clicking the toolbar icon always opens the popup on the Hangar tab (owner, 2026-10-19),
not on the tab it was last closed on.

Steps:
1. Popup.svelte opens on Hangar; picking a tab no longer saves it; prefs.js drops `tab`.
2. Unit test (test/popup.test.js) and smoke test (scripts/screenshots/smoke.mjs) updated.

Done: format:check, npm test, test:ui pass; draft PR with How to Check.
