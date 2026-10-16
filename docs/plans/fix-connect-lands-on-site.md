# fix-connect-lands-on-site (#692)

Goal: once Connect finishes in the basic page, the tab goes on to My Hangar on the
website instead of staying on the extension's page.

Steps:

1. A pure `afterConnect` (ui/basic/after-connect.js): the My Hangar address Open My Hangar
   uses, only for a page opened for Connect (`#settings`, or the website's Connect This
   Browser through the Firefox card), with no scan running in it and nothing to read.
2. `connect()` (ui/basic/hub.svelte.js) sends the tab there after the first sync and the
   wishlist.
3. Tests in test/basic-page.test.js.

Done: npm test, test:ui, format:check pass; checked in Chrome, Edge and Firefox.
