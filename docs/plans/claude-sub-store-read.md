# Subscriber Store Read (#418)

Goal: bring back the signed-in Subscriber Store read (removed in #749) behind a dev-only
build flag, `subStore`, so a subscriber's own Subscriber Store can reach the website
through sync. Nothing turns on until the privacy policy names it.

Steps:

1. Flag `subStore` (default off, devOnly) in `src/flags.js`, docs/FLAGS.md, the flag test.
2. Parser rule `subStore` (GetBrowseSkusByFilter, facet `extras-subscribers-store`,
   product 65) asking only for the fields kept: id, name, url, thumbnail, price,
   nativePrice, stock, isPackage.
3. `src/lib.js`: the read (signed-in subscribers only, once a day, pages of 100 or RSI's
   20 until `totalCount`), cached as `subStore`; nothing else from the answer is kept.
4. The scan reads it after the buy-backs, before the sync (flag on only).
5. Sync format: optional `sources.subStore`, strict items; vectors 60 onward; our hangar
   page's view leaves it out.
6. Storage budget entry and worst case back.

Done: format check, `npm test`, build and `check:store`, the flag off in every store
build. The website PR (open-hangar-server) pins this schema.
