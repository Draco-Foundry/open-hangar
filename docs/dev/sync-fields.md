# Sync Fields

Every field the sync payload can carry, from `schema/sync-payload.schema.json`. A developer
list, not player wording.

The privacy policy says what a sync carries. `test/sync-fields.test.js` fails when this list
and the schema differ in either direction: add, rename or remove a field and the test tells
you to update the list and ask the owner to check the privacy wording before release. The
policy's words are the owner's; this list never edits them.

## How to Read It

- `[]` is an item of an array, `[0]` a place in a short list, `<key>` the key of a map.
- A row that says "Open" is an object that allows keys the schema doesn't name; its
  `<other keys>` row stands for them. The test pins which objects are open.
- Everything else is strict: an unknown key (or a card, payment method, address or gift
  recipient) is refused at that level. The order history is strict all the way down.

## Fields

| Path                                                 | What it is                                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `app`                                                | Always "open-hangar": says which program made the payload.                              |
| `appVersion`                                         | The extension's version, or null outside the extension.                                 |
| `exportedAt`                                         | When the payload was made (ISO time).                                                   |
| `schemaVersion`                                      | The format number of the payload (2).                                                   |
| `account`                                            | Who the hangar belongs to, from the RSI account last read. Never the referral code.     |
| `account.handle`                                     | The pilot's RSI handle.                                                                 |
| `account.displayName`                                | The display name RSI shows.                                                             |
| `account.avatar`                                     | The address of the pilot's avatar image on RSI.                                         |
| `account.ueeRecord`                                  | The UEE citizen record number RSI shows.                                                |
| `account.enlistedSince`                              | The date the pilot enlisted, as RSI shows it.                                           |
| `account.country`                                    | The country RSI shows on the profile.                                                   |
| `account.organization`                               | The pilot's main organization (or null).                                                |
| `account.organization.name`                          | The organization's name.                                                                |
| `account.organization.sid`                           | The organization's Spectrum ID (SID).                                                   |
| `account.organization.rank`                          | The pilot's rank in it.                                                                 |
| `account.organization.logo`                          | The address of its logo image.                                                          |
| `account.subscriber`                                 | The pilot's RSI subscription (or null).                                                 |
| `account.subscriber.type`                            | The subscriber tier RSI shows.                                                          |
| `account.subscriber.frequency`                       | How often the subscription renews.                                                      |
| `account.concierge`                                  | The pilot's Concierge standing (or null).                                               |
| `account.concierge.level`                            | The current Concierge level.                                                            |
| `account.concierge.next`                             | The next Concierge level.                                                               |
| `account.concierge.percent`                          | Progress toward the next level.                                                         |
| `account.balances`                                   | The balances RSI shows (or null).                                                       |
| `account.balances.storeCredit`                       | A balance RSI reports, passed on as it is (an object or null).                          |
| `account.balances.storeCredit.value`                 | The amount. Store Credit is in cents.                                                   |
| `account.balances.storeCredit.currency`              | The currency code RSI shows.                                                            |
| `account.balances.storeCredit.symbol`                | The currency symbol RSI shows.                                                          |
| `account.balances.storeCredit.label`                 | The balance's name as RSI shows it.                                                     |
| `account.balances.uec`                               | A balance RSI reports, passed on as it is (an object or null).                          |
| `account.balances.uec.value`                         | The amount. Store Credit is in cents.                                                   |
| `account.balances.uec.currency`                      | The currency code RSI shows.                                                            |
| `account.balances.uec.symbol`                        | The currency symbol RSI shows.                                                          |
| `account.balances.uec.label`                         | The balance's name as RSI shows it.                                                     |
| `account.balances.rec`                               | A balance RSI reports, passed on as it is (an object or null).                          |
| `account.balances.rec.value`                         | The amount. Store Credit is in cents.                                                   |
| `account.balances.rec.currency`                      | The currency code RSI shows.                                                            |
| `account.balances.rec.symbol`                        | The currency symbol RSI shows.                                                          |
| `account.balances.rec.label`                         | The balance's name as RSI shows it.                                                     |
| `account.capturedAt`                                 | When the account was read (milliseconds since 1970).                                    |
| `sources`                                            | The scanned sources. Each one is optional.                                              |
| `sources.hangar`                                     | The hangar scan.                                                                        |
| `sources.hangar.items`                               | The pledges in the hangar.                                                              |
| `sources.hangar.items[]`                             | One pledge, as read from RSI. Open: other keys are allowed.                             |
| `sources.hangar.items[].id`                          | The pledge's RSI id.                                                                    |
| `sources.hangar.items[].name`                        | The pledge's name.                                                                      |
| `sources.hangar.items[].value`                       | What the pledge cost, as a number.                                                      |
| `sources.hangar.items[].currency`                    | The currency of that value.                                                             |
| `sources.hangar.items[].contents`                    | The things inside the pledge.                                                           |
| `sources.hangar.items[].contents[]`                  | One thing inside a pledge. Open: other keys are allowed.                                |
| `sources.hangar.items[].contents[].kind`             | What sort of thing it is (Ship, Insurance, ...).                                        |
| `sources.hangar.items[].contents[].label`            | Its name as RSI shows it.                                                               |
| `sources.hangar.items[].contents[].image`            | The address of its image.                                                               |
| `sources.hangar.items[].contents[].manufacturer`     | The maker line on its tile.                                                             |
| `sources.hangar.items[].contents[].guessed`          | True when the extension guessed its kind.                                               |
| `sources.hangar.items[].contents[].also`             | True when RSI lists it under Also Contains.                                             |
| `sources.hangar.items[].contents[].<other keys>`     | Any other key a content row may gain.                                                   |
| `sources.hangar.items[].image`                       | The address of the pledge's image.                                                      |
| `sources.hangar.items[].containsShip`                | True when the pledge holds a ship.                                                      |
| `sources.hangar.items[].isCCU`                       | True for a ship upgrade.                                                                |
| `sources.hangar.items[].ccu`                         | An upgrade's From and To ships (or null).                                               |
| `sources.hangar.items[].ccu.from`                    | The ship the upgrade starts from.                                                       |
| `sources.hangar.items[].ccu.to`                      | The ship the upgrade goes to.                                                           |
| `sources.hangar.items[].isAddOn`                     | True for an add-on.                                                                     |
| `sources.hangar.items[].isCoupon`                    | True for a coupon.                                                                      |
| `sources.hangar.items[].isPaint`                     | True for a paint.                                                                       |
| `sources.hangar.items[].kind`                        | The kind the extension sorted the pledge into.                                          |
| `sources.hangar.items[].giftable`                    | True when RSI offers Gift.                                                              |
| `sources.hangar.items[].meltable`                    | True when RSI offers Reclaim.                                                           |
| `sources.hangar.items[].insurance`                   | The insurance the pledge carries (LTI, months).                                         |
| `sources.hangar.items[].date`                        | The date on the pledge as RSI shows it.                                                 |
| `sources.hangar.items[].raw`                         | What the page read keeps for debugging (an object or null). Open: any keys.             |
| `sources.hangar.items[].raw.<other keys>`            | Any key in the raw object.                                                              |
| `sources.hangar.items[].<other keys>`                | Any other key a pledge row may gain.                                                    |
| `sources.hangar.scannedAt`                           | When the hangar was scanned.                                                            |
| `sources.hangar.meta`                                | What a hangar scan keeps next to its pledges.                                           |
| `sources.hangar.meta.shape`                          | How completely the scan read RSI's page: counts only.                                   |
| `sources.hangar.meta.shape.n`                        | A count of pledges (n) the scan read this way.                                          |
| `sources.hangar.meta.shape.date`                     | A count of pledges (date) the scan read this way.                                       |
| `sources.hangar.meta.shape.value`                    | A count of pledges (value) the scan read this way.                                      |
| `sources.hangar.meta.shape.contents`                 | A count of pledges (contents) the scan read this way.                                   |
| `sources.hangar.meta.shape.image`                    | A count of pledges (image) the scan read this way.                                      |
| `sources.hangar.meta.shape.tiles`                    | A count of pledges (tiles) the scan read this way.                                      |
| `sources.hangar.meta.shape.untyped`                  | A count of pledges (untyped) the scan read this way.                                    |
| `sources.hangar.meta.shape.guessed`                  | A count of pledges (guessed) the scan read this way.                                    |
| `sources.hangar.meta.probe`                          | What the next scan checks to skip an unchanged hangar.                                  |
| `sources.hangar.meta.probe.at`                       | When it was taken.                                                                      |
| `sources.hangar.meta.probe.n`                        | How many pledges there were.                                                            |
| `sources.hangar.meta.probe.v`                        | A short stamp of the page.                                                              |
| `sources.buybacks`                                   | The buy-back scan.                                                                      |
| `sources.buybacks.items`                             | The pledges on RSI's buy-back list.                                                     |
| `sources.buybacks.items[]`                           | One buy-back pledge. Open: other keys are allowed.                                      |
| `sources.buybacks.items[].id`                        | The buy-back's RSI id.                                                                  |
| `sources.buybacks.items[].name`                      | Its name.                                                                               |
| `sources.buybacks.items[].image`                     | The address of its image.                                                               |
| `sources.buybacks.items[].date`                      | The date on it as RSI shows it.                                                         |
| `sources.buybacks.items[].contains`                  | The line RSI shows for what it holds.                                                   |
| `sources.buybacks.items[].href`                      | Its RSI page address.                                                                   |
| `sources.buybacks.items[].price`                     | Its price as the buy-back's own page reads.                                             |
| `sources.buybacks.items[].priceFrom`                 | Always "page": the price came from its own page.                                        |
| `sources.buybacks.items[].insurance`                 | The insurance it carries.                                                               |
| `sources.buybacks.items[].contents`                  | The things in it, from its own page.                                                    |
| `sources.buybacks.items[].contents[]`                | One thing in a buy-back.                                                                |
| `sources.buybacks.items[].contents[].kind`           | Ship, Insurance or empty.                                                               |
| `sources.buybacks.items[].contents[].label`          | Its name.                                                                               |
| `sources.buybacks.items[].contents[].manufacturer`   | The ship's maker.                                                                       |
| `sources.buybacks.items[].contents[].focus`          | The ship's focus.                                                                       |
| `sources.buybacks.items[].isCCU`                     | True for a ship upgrade.                                                                |
| `sources.buybacks.items[].ccu`                       | An upgrade's From and To ships (or null).                                               |
| `sources.buybacks.items[].ccu.from`                  | The ship the upgrade starts from.                                                       |
| `sources.buybacks.items[].ccu.to`                    | The ship the upgrade goes to.                                                           |
| `sources.buybacks.items[].wasUpgraded`               | True when the pledge had been upgraded.                                                 |
| `sources.buybacks.items[].fromShipId`                | RSI's id of the upgrade's From ship.                                                    |
| `sources.buybacks.items[].toShipId`                  | RSI's id of the upgrade's To ship.                                                      |
| `sources.buybacks.items[].toSkuId`                   | RSI's id of the upgrade's To SKU.                                                       |
| `sources.buybacks.items[].kind`                      | The kind the extension sorted it into.                                                  |
| `sources.buybacks.items[].<other keys>`              | Any other key a buy-back row may gain.                                                  |
| `sources.buybacks.scannedAt`                         | When the buy-backs were scanned.                                                        |
| `sources.buybacks.meta`                              | What a buy-back scan keeps next to its list.                                            |
| `sources.buybacks.meta.tokens`                       | The buy-back tokens RSI shows, or null.                                                 |
| `sources.referral`                                   | The referral scan: counts and recruits, never the code.                                 |
| `sources.referral.items`                             | The referral counts.                                                                    |
| `sources.referral.items.current`                     | The current campaign's recruit count (or null). Open: other keys are allowed.           |
| `sources.referral.items.current.recruits`            | How many recruits.                                                                      |
| `sources.referral.items.current.<other keys>`        | Any other key it may gain.                                                              |
| `sources.referral.items.legacy`                      | The legacy campaign's recruit count (or null). Open: other keys are allowed.            |
| `sources.referral.items.legacy.recruits`             | How many recruits.                                                                      |
| `sources.referral.items.legacy.<other keys>`         | Any other key it may gain.                                                              |
| `sources.referral.items.prospects`                   | How many prospects: a count, never the list.                                            |
| `sources.referral.items.recruitsList`                | The recruits, without who they are.                                                     |
| `sources.referral.items.recruitsList[]`              | One recruit. Open: other keys are allowed.                                              |
| `sources.referral.items.recruitsList[].enlistedOn`   | The date the recruit enlisted, as RSI lists it.                                         |
| `sources.referral.items.recruitsList[].convertedOn`  | The date the recruit converted, as RSI lists it.                                        |
| `sources.referral.items.recruitsList[].campaign`     | "current" or "legacy": the campaign the extension tagged it with.                       |
| `sources.referral.items.recruitsList[].<other keys>` | Any other key a recruit row may gain.                                                   |
| `sources.referral.scannedAt`                         | When the referral page was scanned.                                                     |
| `sources.referral.meta`                              | Always empty: nothing is kept next to a referral scan.                                  |
| `sources.orders`                                     | The order history scan (behind the orderHistory flag, dev only).                        |
| `sources.orders.items`                               | The orders.                                                                             |
| `sources.orders.items[]`                             | One Pledge Store order. Strict: no payment method, card, address or gift recipient.     |
| `sources.orders.items[].id`                          | The order number.                                                                       |
| `sources.orders.items[].date`                        | The order date as RSI shows it.                                                         |
| `sources.orders.items[].status`                      | RSI's order status word.                                                                |
| `sources.orders.items[].payment`                     | RSI's payment status word, not how it was paid.                                         |
| `sources.orders.items[].fulfillment`                 | RSI's fulfillment status word.                                                          |
| `sources.orders.items[].currency`                    | The order's currency code.                                                              |
| `sources.orders.items[].items`                       | The lines' totals, whole cents.                                                         |
| `sources.orders.items[].discount`                    | Additional Discount, whole cents.                                                       |
| `sources.orders.items[].credit`                      | Credits used, whole cents.                                                              |
| `sources.orders.items[].beforeTax`                   | Total before tax, whole cents.                                                          |
| `sources.orders.items[].total`                       | Total with tax, whole cents.                                                            |
| `sources.orders.items[].lines`                       | The order's lines.                                                                      |
| `sources.orders.items[].lines[]`                     | One line of an order.                                                                   |
| `sources.orders.items[].lines[].name`                | The item's name.                                                                        |
| `sources.orders.items[].lines[].qty`                 | How many.                                                                               |
| `sources.orders.items[].lines[].price`               | The price of one, whole cents.                                                          |
| `sources.orders.items[].lines[].discount`            | The line's discount, whole cents.                                                       |
| `sources.orders.items[].lines[].total`               | The line's total, whole cents.                                                          |
| `sources.orders.scannedAt`                           | When the order history was scanned.                                                     |
| `sources.orders.meta`                                | How far the last order read got.                                                        |
| `sources.orders.meta.pages`                          | How many pages it read.                                                                 |
| `sources.orders.meta.complete`                       | True when it reached the oldest order.                                                  |
| `sources.subStore`                                   | Your Subscriber Store and Concierge items (behind the subStore flag, dev only).         |
| `sources.subStore.items`                             | The items, at most 2000.                                                                |
| `sources.subStore.items[]`                           | One store item RSI lists for this account. Strict: nothing about the account.           |
| `sources.subStore.items[].id`                        | The item's SKU id.                                                                      |
| `sources.subStore.items[].name`                      | The item's name.                                                                        |
| `sources.subStore.items[].kind`                      | subscriber, or the store category it was read from.                                     |
| `sources.subStore.items[].concierge`                 | True when RSI marks it for Concierge members.                                           |
| `sources.subStore.items[].url`                       | Its page on RSI's site, or null.                                                        |
| `sources.subStore.items[].img`                       | Its picture on RSI's site, or null.                                                     |
| `sources.subStore.items[].price`                     | The price you pay, whole US cents.                                                      |
| `sources.subStore.items[].was`                       | The price before a discount, or null.                                                   |
| `sources.subStore.items[].pack`                      | True for a kit or set.                                                                  |
| `sources.subStore.items[].inStock`                   | True when it's in stock.                                                                |
| `sources.subStore.scannedAt`                         | When the members' store was read.                                                       |
| `sources.subStore.meta`                              | How much of the list the last read got.                                                 |
| `sources.subStore.meta.total`                        | How many items RSI said it lists.                                                       |
| `sources.subStore.meta.complete`                     | True when every item came in.                                                           |
| `sources.pledgeLog`                                  | RSI's pledge log (behind the accountLogs flag, dev only). Never a handle or an email.   |
| `sources.pledgeLog.items`                            | The log's lines, newest first, at most 10,000.                                          |
| `sources.pledgeLog.items[]`                          | One pledge event. Strict: no handle, email or payment field.                            |
| `sources.pledgeLog.items[].at`                       | When it happened, UTC to the second.                                                    |
| `sources.pledgeLog.items[].pledge`                   | The pledge id.                                                                          |
| `sources.pledgeLog.items[].name`                     | The pledge's name as the log writes it.                                                 |
| `sources.pledgeLog.items[].kind`                     | What happened: bought, buy-back, melted, gift, granted or other.                        |
| `sources.pledgeLog.items[].order`                    | The order number (a purchase or a buy-back), or null.                                   |
| `sources.pledgeLog.items[].value`                    | Paid, melted for or a gift's value, whole US cents, or null.                            |
| `sources.pledgeLog.scannedAt`                        | When the pledge log was last read.                                                      |
| `sources.pledgeLog.meta`                             | How much of the log the reads covered.                                                  |
| `sources.pledgeLog.meta.pages`                       | How many pages the log had.                                                             |
| `sources.pledgeLog.meta.unread`                      | Lines the parser could not read (left out).                                             |
| `sources.creditLog`                                  | RSI's store credit log (behind the accountLogs flag, dev only).                         |
| `sources.creditLog.items`                            | The log's lines, newest first, at most 10,000.                                          |
| `sources.creditLog.items[]`                          | One store credit line. Strict: no payment field, nobody else.                           |
| `sources.creditLog.items[].at`                       | When it happened, UTC to the second.                                                    |
| `sources.creditLog.items[].dir`                      | in or out.                                                                              |
| `sources.creditLog.items[].amount`                   | The credit, whole US cents.                                                             |
| `sources.creditLog.items[].kind`                     | melt, order or other.                                                                   |
| `sources.creditLog.items[].pledge`                   | A melt's pledge id, or null.                                                            |
| `sources.creditLog.items[].name`                     | A melt's pledge name, or null.                                                          |
| `sources.creditLog.items[].order`                    | An order's number, or null.                                                             |
| `sources.creditLog.scannedAt`                        | When the store credit log was last read.                                                |
| `sources.creditLog.meta`                             | How much of the log the reads covered.                                                  |
| `sources.creditLog.meta.pages`                       | How many pages the log had.                                                             |
| `sources.creditLog.meta.unread`                      | Lines the parser could not read (left out).                                             |
| `history`                                            | Scan snapshots, oldest first (optional).                                                |
| `history[]`                                          | One snapshot.                                                                           |
| `history[].at`                                       | When it was taken.                                                                      |
| `history[].items`                                    | The pledges at that time.                                                               |
| `history[].items[]`                                  | One pledge as a short list: id, name, value.                                            |
| `history[].items[][0]`                               | The pledge's id.                                                                        |
| `history[].items[][1]`                               | The pledge's name.                                                                      |
| `history[].items[][2]`                               | The pledge's value.                                                                     |
| `history[].credit`                                   | Old versions only: store credit then. Not sent any more.                                |
| `history[].checkedAt`                                | Old versions only: when it was checked. Not sent any more.                              |
| `pledgeArchive`                                      | Pledges gone from the hangar, by pledge id (optional): only what buy-back details read. |
| `pledgeArchive.<key>`                                | One gone pledge, under its pledge id.                                                   |
| `pledgeArchive.<key>.id`                             | The pledge's id.                                                                        |
| `pledgeArchive.<key>.name`                           | Its name.                                                                               |
| `pledgeArchive.<key>.value`                          | Its value.                                                                              |
| `pledgeArchive.<key>.currency`                       | The currency of that value.                                                             |
| `pledgeArchive.<key>.insurance`                      | Its insurance.                                                                          |
| `pledgeArchive.<key>.ccu`                            | An upgrade's From and To ships (or null).                                               |
| `pledgeArchive.<key>.ccu.from`                       | The ship the upgrade starts from.                                                       |
| `pledgeArchive.<key>.ccu.to`                         | The ship the upgrade goes to.                                                           |
| `pledgeArchive.<key>.kind`                           | Its kind.                                                                               |
| `pledgeArchive.<key>.date`                           | Its date.                                                                               |
| `pledgeArchive.<key>.contents`                       | What it held.                                                                           |
| `pledgeArchive.<key>.contents[]`                     | One thing it held.                                                                      |
| `pledgeArchive.<key>.contents[].kind`                | What sort of thing.                                                                     |
| `pledgeArchive.<key>.contents[].label`               | Its name.                                                                               |
| `pledgeArchive.<key>.goneAt`                         | When it left the hangar.                                                                |
