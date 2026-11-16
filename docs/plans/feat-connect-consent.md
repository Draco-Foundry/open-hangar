# feat/connect-consent

Goal: every browser shows the Before You Connect card (what we send, what we never send)
and takes a click on Continue before Connect starts, so data leaves only after an
in-extension disclosure and an agree click (Chrome's rule since 2026-08-01, Edge's at
install). Firefox already showed it; Chrome and Edge didn't.

Steps:

1. A stored consent record (`dataConsent: { v, at }`) with a version, read as possibly
   missing; a pure helper and its test.
2. The basic page's Connect (its button, and the website's Connect This Browser) shows
   the card first when there's no consent; Continue saves it (and asks Firefox there),
   then connects. Not Now changes nothing.
3. The card's "Why Firefox asks" line only on Firefox; its heading on other browsers
   needs the owner's words.
4. Storage budget entry, smoke test, CHANGELOG fragment.

Done: npm test, format:check, build and check:store pass; test:ui passes; both builds load.
