# feat-popup-finish

## Goal

Finish the 0.4.0 popup: the approved words, Wishlist editing through the website's new
endpoint, the Currency setting, the signed-out Scan, the three exports, and the strings
the next PR needs.

## Steps

1. `ui/popup/copy.js`: the approved words (Next refill {date}, the last round), the NEW
   markers off the approved ones.
2. Wishlist tab: `GET /api/v1/wishlist?with=items` and `POST /api/v1/wishlist` (add,
   remove, save) with the sync token, a copy in this browser, one write at a time, no
   retry loop, Retry-After respected; a 404 keeps today's read-only list. Search on the
   device over the ship list and, with alerts on, the sale feed. Disconnect deletes the
   copy.
3. Currency: the picker (the browser's language by default), rates only for a currency
   other than USD, at most once a day, the dollar figure on hover.
4. Signed out of RSI: Log In to RSI and a greyed Scan while RSI's sign-in cookie isn't
   in this browser (presence only), checked on open and when that cookie changes.
5. Settings exports: JSON Backup, Pledges CSV, Buy-Backs CSV.
6. Fleet News empty line; the Auto Scan Daily status strings (row stays dev-only).
7. Tests: wishlist client, currency, cookie check, exports, storage budget; the popup
   smoke section and its demo shims.

## Done

`npm run format:check`, `npm test`, `npm run test:ui`, `npm run build` and
`npm run check:store` pass; this file deleted before merge.
