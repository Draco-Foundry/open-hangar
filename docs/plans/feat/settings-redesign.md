# feat/settings-redesign

Goal: the popup's Settings tab in the owner's approved order (2026-10-24).

Steps:

1. One openhangar.space box: Connected as, Sync Now with Disconnect as a link, Auto Scan
   Daily, Notifications (and its hint line once that lands on main).
2. Look, Currency and Shortcut as list rows; the shortcut's value opens the browser's page.
3. Saved Accounts unchanged; an Export menu next to Log Out of RSI.
4. Help, Report a Scan Problem, Privacy, then Clear Data as a red link on its own line.
5. Smoke test updated; the Export menu's name from Claude chat.

Done: tests, format, lint:firefox, test:ui and the build pass; the approved Export name is
in; rebased on the Wishlist count and Notifications hint changes.
