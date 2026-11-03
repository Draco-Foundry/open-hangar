# Wishlist paint: Keys

## Goal

Accept the website's new Wishlist key kind, `paint:<slug>` (a paint the Star Citizen Wiki
lists, wished before the store sold it), in the store alerts and the Wishlist tab, and
match it by the on-sale feed's `paint` field. Older versions drop the key.

## Steps

1. `src/alerts.js`: WISH_KEY_RE, readFeed keeps a paint's `paint`, wishKeysOf adds it.
2. `ui/popup/wish-client.js` KEY_RE; `ui/popup/data.js` saleIndex and wishRows.
3. Tests in test/alerts.test.js and test/popup-wishlist.test.js.

## Done When

format:check, npm test and lint:firefox pass; rides the next planned release.
