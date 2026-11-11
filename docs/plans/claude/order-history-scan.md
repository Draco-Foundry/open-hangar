# Order History: the Scan Step and the Setting

Goal: with the `orderHistory` flag (developer builds only, off in FLAGS.md), a pilot can
turn on Order History on the popup's Settings tab; scans then read RSI's Pledge Store
order history and sync sends it as `sources.orders`.

## Steps

1. The reader (`src/lib.js` readOrderHistory): off until the switch is on; the first scan
   after reads every page, paced, resumable, kept only when whole; after that a scan reads
   from page 1 and stops at an order already kept; the status file can pause it.
2. Off stops the reads and the sending; the orders read stay until Clear Data.
3. Sync and the backup file carry `sources.orders` (`src/hangar-shape.js` withOrders),
   only the schema's keys. No sync format change.
4. Scan and Auto Scan Daily run it (`ui/scan/runner.js`); Auto Scan Daily never reads every
   page.
5. The Settings switch with placeholder words until the Words rows are approved.
6. Tests: `test/order-history.test.js`, storage budget.

## Done

- `npm run format:check`, `npm run lint:firefox`, `npm test`, `npm run build`,
  `npm run check:store`, `npm run test:ui` run and listed in the PR.
- The words approved and applied (a later push), then this file deleted before merge.
