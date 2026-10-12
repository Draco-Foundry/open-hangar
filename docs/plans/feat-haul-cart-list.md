# feat/haul-cart-list

Goal: the extension part of the Haul (#635). The website's Store asks the extension to
put a list of store items in the RSI cart, in one request, on a click.

## Steps

1. Parser rules: RSI's `AddCartMultiItemMutation` (path `/graphql`, full query text,
   trimmed to what we read), with its schema entry; `npm run rules`.
2. `src/rsi-cart.js`: `addItemsToCart(items)`. Items cleaned (1 to 20 different SKUs,
   1 to 10 of each, no repeats), signed-out check first, the store page's csrf token,
   one POST in the cart's lane, never retried. Answer `{ ok, count, added }` or the
   cart's error kinds with RSI's own words.
3. Bridge: capability `addItems` (`oh-add-items { items }`) for the website's pages, its
   shape check, the handler, the Firefox bridge's type list.
4. Tests: rsi-cart (bodies, answers, never retried, 429, signed out, cleaning) and
   bridge-v2 (lists, shapes, who may ask).
5. Docs: ARCHITECTURE "Messages From Our Pages", CONNECTOR's request table.

## Done When

- `npm run format:check`, `npm test`, `npm run build` + `node scripts/check-store-build.mjs`
  and `npm run lint:firefox` pass.
- The privacy policy's new lines are with the owner for word-for-word approval (they
  land in their own PR before 0.3.0 ships).
- Left for the owner: one real send from a signed-in browser (does RSI take the full
  query text for this mutation, and what does `count` mean).
