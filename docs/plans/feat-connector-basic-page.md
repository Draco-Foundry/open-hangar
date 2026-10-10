# feat/connector-basic-page

Goal: the connector's one extension page, frozen: it works offline and without
openhangar.space, and is what the background opens in a connector build.

Steps:

1. src/basic.html and ui/basic/: Pledges and Buy-Backs (search, totals, CSV), Export
   JSON, Report a Scan Problem, settings (openhangar.space, Clear Data, Saved Accounts,
   Log Out of RSI). Text only. New words are `[copy: …]` placeholders.
2. Its scan: lib.js only, the same depth (hangar, buy-backs and up to 30 unread packs,
   archive, balances, referrals, identity), then a sync when connected; it answers the
   background's scan requests and Firefox's asks.
3. src/background.js opens the basic page wherever it opened the dashboard (connector
   builds only); the popup's links go there too.
4. Tests: test/basic-page.test.js, test/connector.test.js, smoke.mjs Basic Page (with
   every request off the computer refused, and at 375 px).

Done when: `npm test`, `npm run test:ui` (Chrome and Edge), the store build check and
Firefox lint pass; the connector build's basic page lists, exports and scans in Chrome,
Edge and Firefox, and works offline.
