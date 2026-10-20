# privacy-rsi-session-cookie

Goal: the privacy policy's cookies bullet stops calling RSI's cookie a sign-in cookie
(RSI sets it for visitors who aren't signed in too, #740) and says what the popup and
Auto Scan Daily do with it.

Steps:

1. Replace the bullet's two sentences in docs/PRIVACY.md and site/privacy.html with the
   owner's approved words, character for character.
2. Regenerate docs/store-assets/privacy-plain.txt and privacy-amo.md
   (`npm run privacy:plain`).
3. Last updated: set to the next extension release day before merging.

Done: the words match the approved text in all four files, `npm test` passes, and
Last updated is the release day. Delete this file before merging.
