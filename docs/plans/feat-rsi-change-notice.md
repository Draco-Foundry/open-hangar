# feat/rsi-change-notice

Goal: after a scan whose RSI pages hold parts the parser doesn't recognize, the popup
shows one calm line saying RSI changed a page and some details may be missing until
Open Hangar catches up. Behind a new build flag, Off.

Steps:

1. Parser: `OpenHangar.unknownShapes(page, kind)`, the same checks as `unrecognized`
   counted per card, with no pledge ids in the shapes; `OpenHangar.rsiChangeShapes`
   applies the threshold (a shape on 2+ cards, js-* hooks left out).
2. Scan (src/lib.js scanHtmlSource and scanSource): with the flag on, add up each
   page's shapes; a complete, saved scan of hangar or buy-backs writes local
   `rsiChange[part]` (or clears it on a clean scan). Nothing else changes.
3. Popup: `rsiNotice()` in ui/popup/data.js, a `.pp-notice` line with Got It; Got It
   keeps the shapes seen in local `rsiChangeSeen`; a new shape shows it again.
4. Flag `rsiChangeNotice` (Off), docs/FLAGS.md, build-flags test, storage budget.
5. Tests: clean scan none; unknown markup shows; next clean scan clears; dismissal
   holds for the same and returns for a new one; flag Off.
6. Words: placeholder key, Words rows at Needs Words.

Done: format, lint:firefox, npm test, build, check:store, demo screenshots on and off.
