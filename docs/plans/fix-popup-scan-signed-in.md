# fix-popup-scan-signed-in

Goal: the popup never locks Scan on RSI's `Rsi-Token` cookie alone, and shows Scan when the
cookie is there (owner, 2026-10-19/20: "says log in.. but im already logged into rsi").

Evidence: RSI sets `Rsi-Token` for visitors who aren't signed in too, so the cookie can't
say signed in or out; a scan reads the account and says so itself.

Steps:

1. `rsiSignIn` (ui/popup/rsi-cookie.js): cookie there → 'in'; gone, or the last scan said
   signed out with no answer from the cookie → 'maybe' (Log In first, Scan still works).
   No 'out', no `rsiCookieGone`.
2. Popup.svelte and Hangar.svelte: drop `goneAt` and `scanOff`.
3. Unit test (test/popup-settings.test.js) and smoke test updated.

Done: format:check, npm test, test:ui pass; draft PR with How to Check.
