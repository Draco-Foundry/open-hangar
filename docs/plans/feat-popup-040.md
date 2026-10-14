# feat-popup-040: the 0.4.0 popup

## Goal

Rebuild the toolbar popup to the owner's approved mockups (Final, Bell, States, ScanFlow,
Extras, Light, Android): three tabs (Hangar, Wishlist, Settings), the alerts bell in the
header, light mode, the phone layout and the keyboard shortcut.

## Steps

1. Light tokens in ui/tokens.css, scoped to pages that set `data-look` (the popup only).
2. ui/popup/data.js: the pure parts (scan age, value since, progress, Fleet News, the
   tab to open on, Wishlist rows), tested in test/popup.test.js.
3. Popup.svelte split into the header, the tabs and the bell view; Settings moved in
   from the basic page (calling OH directly, never the basic page's hub).
4. `commands._execute_action` in manifest.json, checked for every connector build.
5. The `autoScan` flag (dev only, off) hides the Auto Scan Daily row until Wave 2.
6. Demo shims and the smoke test's Popup section.

## Done When

- `npm run format:check`, `npm test`, `npm run test:ui`, `npm run build` and
  `npm run check:store` pass.
- Every new word is in ui/popup/copy.js marked as needing the owner's OK.
