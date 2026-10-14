# The Connector

The website (openhangar.space) is the full app; the extension becomes its connector
(owner, 2026-10-10). It reads your RSI account, hands the hangar to our pages (Local
Mode on hangar.openhangar.space, sync to app.openhangar.space), adds upgrades to your RSI
cart, and keeps one basic page that works on its own: the privacy policy promises the
extension works without the website, and the stores turn down an extension that only
opens a website.

It's the `connector` build flag ([FLAGS.md](FLAGS.md#the-connector)), on in every store
build and the beta from 0.3.0 (owner, 2026-10-13), with `localMode`, `wishlistImport` and
`alerts`.

## What a Connector Build Has

- **The toolbar popup** (`src/popup.html`, `ui/popup/`, the 0.4.0 mockups): a header with
  the version, the scan's age and the alerts bell (with the `alerts` flag; its Alerts
  view is `ui/popup/Alerts.svelte`, and opening the popup marks them seen), then three
  tabs. Hangar: the portrait the scan saved, Account Value and its change, Store Credit,
  buy-back tokens, Fleet News, Scan (with the scan's progress and report when the
  background shares them; greyed while RSI's sign-in cookie isn't in the browser,
  `ui/popup/rsi-cookie.js`, presence only), Open My Hangar. Wishlist, while connected:
  the account's Wishlist from the website (`ui/popup/wish-client.js`, a copy kept in
  `popupWish`), with a search on the device to add, a Target Price and Remove while the
  website takes changes from the extension; read only as the store alerts read it when
  it doesn't. Settings: what the basic page's settings do, plus Look (light mode),
  Currency (the day's rates for anything but USD) and the shortcut (`commands` in
  manifest.json, Alt+Shift+H), and JSON Backup, Pledges CSV and Buy-Backs CSV. Connect
  still opens the basic page: the browser's sign-in window would close the popup.
- **The basic page** (`src/basic.html`, `ui/basic/`): Pledges and Buy-Backs with search,
  totals and CSV, Export JSON, Report a Scan Problem, and the settings (openhangar.space,
  the store alerts' switch with the `alerts` flag, Clear Data, Saved Accounts, Log Out of
  RSI). Text only; it works with no network.
- **The background worker** as today: our pages' messages (bridge v2), the rescan badge,
  updates.
- **The scan**, at the same depth: account and balances, the hangar (with the pledge
  archive and history), buy-backs and up to 30 unread packs, referrals. It's the scan
  runner (`ui/scan/runner.js`), which the basic page runs in its tab; it stores its
  progress (session `scanProgress`) and its last report (`scanReport`) for any page.

`scripts/pack.mjs` leaves the dashboard out of it (`scripts/connector.mjs`):
`src/dashboard.html`, `src/dashboard.js`, `src/quips.js`, `src/qr.js`, `src/assets/`,
`CHANGELOG.md`, and every `src/ui/` file the two pages don't load (found by following
their imports). `scripts/check-store-build.mjs` refuses a connector build with any of
them, and a build without the connector that has the popup or the basic page.

**Permissions** stay as they are (Extension Alerts, the `alerts` flag, add `alarms` and an
optional `notifications`, docs/FLAGS.md "Alerts"): `storage`, `unlimitedStorage` (big hangars, history
and the archive), `cookies` (Log Out of RSI), `identity` (Connect's sign-in window), and
host access to robertsspaceindustries.com only. The **hosts** the pages may reach shrink:
a connector build's content security policy adds
`connect-src 'self' https://robertsspaceindustries.com https://openhangar.space` plus
the sync site, so a request anywhere else fails in the browser itself.

## Removing the Dashboard

The pages the website now has leave in three steps. The code stays until the last one.

1. **Gated.** The `connector` flag leaves them out of a connector build; every store
   build still had them.
2. **Switched on (now, 0.3.0).** `connector` and `localMode` on in the store and the beta
   (`src/flags.js`, owner 2026-10-13). The store screenshots of the popup and the basic
   page are `docs/store-assets/screenshot-connector-*` (the older ones show the
   dashboard). The privacy policy and the store listing describe the connector
   (owner-approved 2026-10-13), store alerts and the wishlist import included.
3. **Deleted.** After a release with the connector on: the dashboard and its pages go
   from the repo (`src/dashboard.*`, `ui/` except `ui/popup`, `ui/basic` and what they
   import, `src/quips.js`, `src/qr.js`, `src/assets/`), with their tests, the UI test's
   dashboard sections, `scripts/screenshots/` views, the lib.js code only they used, and
   the storage keys only they wrote (`test/storage-budget.test.js`). One large job across
   many files.

Pages that leave: Home (news feeds, Game Status, For You, Customize), Inventory, the
standalone Buy-Backs page (its Market and Load Details), Stats, Referrals, Store and the
standalone Wishlist, Org Fleet import, Updates and Known Issues, Developers, the top bar
(the Alerts bell included), Global Search and the detail windows.

## Outbound Requests

What the extension asks of other sites today, and which stay in a connector build. "Goes"
means nothing in a connector build asks it any more (the functions stay in lib.js until
step 3 above).

**Stays**

| Request                                                                               | Why                                                                       |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| robertsspaceindustries.com `/account/pledges`, `/account/buy-back-pledges`            | Scan: hangar and buy-backs                                                |
| robertsspaceindustries.com `/pledge/buyback/<id>`                                     | Scan: up to 30 unread packs                                               |
| robertsspaceindustries.com `/en/account/dashboard`                                    | Identity and balances: Scan, and opening the basic page (kept 10 minutes) |
| robertsspaceindustries.com `/en/citizens/<handle>` (no cookies)                       | Citizen Record and org, with the one above                                |
| robertsspaceindustries.com `/media/…` portrait (no cookies, when it changes, **new**) | Scan: a small copy of your RSI picture for our pages (`avatarImg`)        |
| robertsspaceindustries.com `POST /graphql` (referral recruits)                        | Scan: referrals                                                           |
| robertsspaceindustries.com `/pledge-store/api/upgrade/graphql`, the cart              | Add to RSI Cart from our pages                                            |
| robertsspaceindustries.com `POST /graphql` (`AddCartMultiItemMutation`)               | The Store's Haul: store items into the RSI cart, on a click               |
| openhangar.space `status.json`                                                        | The kill switch                                                           |
| openhangar.space `api/ships` (once a day)                                             | The popup's Account Value                                                 |
| app.openhangar.space `/connect`, `/api/link/token`, `/link`                           | Connect                                                                   |
| app.openhangar.space `POST` and `DELETE /api/v1/sync`                                 | Sync, Disconnect                                                          |
| github.com new issue (only when you press Report a Scan Problem)                      | Report a Scan Problem                                                     |
| app.openhangar.space `POST /api/v1/wishlist/import` (once per connection, **new**)    | The 0.3.x wishlist into your account (`wishlistImport` flag)              |
| openhangar.space `api/store/on-sale` (alerts on, every 30 minutes at most, **new**)   | Extension Alerts: the public sale feed, matched on the device             |
| app.openhangar.space `GET /api/v1/wishlist` (alerts on and connected, **new**)        | Extension Alerts: your account's Wishlist keys, read only                 |
| app.openhangar.space `GET /api/v1/wishlist?with=items` (connected, 0.4.0)             | The popup's Wishlist tab (a copy younger than 5 minutes is used)          |
| app.openhangar.space `POST /api/v1/wishlist` (a click, one at a time, 0.4.0)          | The Wishlist tab: one change (a Target Price goes with its insurance)     |
| openhangar.space `rates.json` (a currency picked, not USD, once a day at most, 0.4.0) | The popup's Currency                                                      |

Extension Alerts' two requests are new too: the sale feed is the same public file for
everyone; the Wishlist read brings your account's Wishlist keys to this browser, and
what they match stays here. The privacy policy names both and the two permissions
(owner-approved 2026-10-13), and docs/STORE.md has the permissions' reasons for the
store forms.

The wishlist import is new: until now the wishlist never left the browser. It sends the
ships and store items on this browser's wishlist (names and store ids), once per
connection, and only once you've connected; the website adds them to your account's
wishlist and removes nothing. It has a flag of its own, `wishlistImport`
([FLAGS.md](FLAGS.md#the-wishlist-import)), on since the privacy policy explains it.

**Goes**

| Request                                                                     | Was for                                                                           |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| openhangar.space `api/game-status`                                          | Game Status pill, footer                                                          |
| openhangar.space `api/catalog`                                              | Store page, Wishlist Watch, store scan                                            |
| openhangar.space `api/referral-events` (and its reward pictures)            | Referrals page                                                                    |
| openhangar.space `api/known-issues`                                         | Known Issues                                                                      |
| openhangar.space `versions.json`                                            | Firefox's Check for Updates                                                       |
| openhangar.space `rates.json`                                               | Display currency (the basic page is USD)                                          |
| robertsspaceindustries.com `/ship-matrix/index`                             | Ship art, the HTF export                                                          |
| robertsspaceindustries.com `/api/spectrum/forum/channel/threads`            | Patch notes on Home and Updates                                                   |
| robertsspaceindustries.com `/pledge-store/api/upgrade/graphql` (store list) | Store status on the Store page                                                    |
| robertsspaceindustries.com `POST /graphql` (Subscriber Store, once a day)   | The Store page's subscriber items                                                 |
| support.robertsspaceindustries.com help articles                            | Loaner Ship Matrix, Included Vessels                                              |
| RSI's picture servers (thumbnails, ship art)                                | Pictures on every card                                                            |
| app.openhangar.space device-code link (`siteLinkStart`)                     | Connect's fallback code (the basic page opens the website's Connect page instead) |
| discord.gg invite (only on Send Flight Log)                                 | Send Flight Log                                                                   |

Add to RSI Cart's own upgrade lookups use the same RSI upgrade address as the Store
page's store list; only the store list goes.

## Firefox

Firefox asks before an extension sends anything off the device. The basic page shows the
ask for Connect (from the website) and for our hangar page (Local Mode), each with its
own words (ui/basic/FirefoxCard.svelte).
