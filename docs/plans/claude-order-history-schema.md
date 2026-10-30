# Order History in the Sync Format

## Goal

The sync format can carry a pilot's RSI order history (`sources.orders`), shaped like
RSI's Pledge Store order cards and strict so no payment processor, card, address or gift
recipient can be sent, with a page reader for it, behind a developer-only `orderHistory`
flag. The website uses it to show what each pledge cost.

## Steps

1. `schema/sync-payload.schema.json`: the `orders` source, `order`, `orderLine`, `orderMeta`.
2. Test vectors 52 to 59 (one valid, seven refused).
3. Our hangar page's view leaves orders out.
4. Parser rules `orders` and `parseOrders` / `ordersPath`, tested on an invented page
   of RSI's shape (`test/orders.test.js`).
5. `orderHistory` flag, devOnly.

## Done When

- `npm test`, `npm run format:check`, `npm run build` and `npm run check:store` pass.
- The website's matching PR pins this commit and accepts the new source before any
  extension build sends it.
- Left for the next PR: the scan step (newest page first, stop at a known order), the
  setting that turns it on, and their words.
