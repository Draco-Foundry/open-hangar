# fix/popup-signed-out-scan

Goal: a popup Scan that RSI answers "signed out" shows Log In to RSI, instead of ending
with nothing on screen while RSI's cookie is there (0.5.1, #740's cookie rule).

Steps:

1. `ui/popup/rsi-cookie.js` rsiSignIn: the report the popup just shows (`shown`) said
   signed out → 'maybe', whatever the cookie says. Expected: Log In to RSI with grey Scan.
2. `ui/popup/Popup.svelte` passes `justOut: shown?.signedOut === true`.
3. Test in `test/popup-settings.test.js`; npm test, build, check in Firefox and Chrome.

Done: tests pass, a signed-out scan in the dev copy shows Log In to RSI, and a later
popup with the cookie shows Scan. This file is deleted before merge.
