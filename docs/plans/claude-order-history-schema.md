# Order History in the Sync Format

## Goal

The sync format can carry a pilot's RSI order history (`sources.orders`), strict so no
payment method, card, address or gift recipient can be sent, behind a developer-only
`orderHistory` flag. The website uses it to show what each pledge cost.

## Steps

1. `schema/sync-payload.schema.json`: the `orders` source, `order`, `orderLine`, `orderMeta`.
2. Test vectors 52 to 59 (one valid, seven refused).
3. Our hangar page's view leaves orders out.
4. `orderHistory` flag, devOnly, nothing behind it yet.

## Done When

- `npm test` and `npm run format:check` pass.
- The website's matching PR pins this commit and accepts the new source before any
  extension build sends it.
