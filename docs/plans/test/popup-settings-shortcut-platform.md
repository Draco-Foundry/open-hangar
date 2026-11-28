# test/popup-settings-shortcut-platform

Goal: `npm run test:ui`'s "popup settings" check passes on a Mac too.

Cause: the check expects the shortcut as `Alt+Shift+O`, but on a real Mac the popup
writes it as `⌥⇧O` (ui/popup/data.js `isMac`), by design. CI runs Linux, so it passed there.

Steps:

1. Fake a Windows platform for that Settings load (like the faked-Mac step below it),
   removed after the layout and shortcut-click checks.
2. Run `npm run test:ui`, `npm run format:check`, `npm test`.

Done: all three pass on the Mac.
