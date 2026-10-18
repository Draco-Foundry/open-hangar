# fix/popup-settings-layout

Goal: the popup's Settings tab lays out cleanly at 360 px in Chrome, Edge and Firefox,
light and dark.

Steps:

1. Put back the Settings styles and the compact smoke check from #709 that #708's squash
   dropped (`.pp-two`, `.pp-trio`, `.pp-cell`, `.pp-cval`).
2. Currency shows the whole code; Look, Currency and Shortcut each put the name over the
   control, in straight columns, with a gap before Change.
3. Change is a plain link (the arrow symbol dropped, no other word change).
4. JSON Backup, Pledges CSV and Buy-Backs CSV fit inside the popup's width.
5. Notifications, off while Store Alerts is off, reads as off: its name dims with it.
6. The smoke test checks each of these.

Done: format:check, npm test, test:ui pass; checked at 360 px in Chrome, Edge and Firefox,
light and dark; draft PR with before and after screenshots.
