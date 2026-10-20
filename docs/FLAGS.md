# Build Flags

Some features ship in some builds and not others: Org Fleet sharing only in a
developer's own build, for one. Build flags say which, in one place.

## Build-Time Only

A flag is decided when the extension is built, and nothing changes it after that.
**The extension never fetches a flag, a config or code to turn a feature on.** The
stores don't allow remote code or remote feature switches, so there is no remote config
here, ever. To change a flag for users, ship a new build.

Features on the website (openhangar.space) are switched on the website's side, by its
own flags. When the extension asks the website something, the answer is data (a list,
a status, "not available"), never code.

The parser rules are bundled data, not remote config. Where the extension finds things
on RSI's pages (addresses, selectors, name patterns) is one data file,
`src/data/parser-rules.json` (ARCHITECTURE.md, "Parser Rules"), so a change on RSI's
side is fixed in data, not code. It ships inside the extension and is never fetched:
changing it is a new build, like a flag. A signed copy from our site is planned for after
launch (ed25519, able only to narrow the bundled rules, never an address or a host); it
needs the owner's decision and this page changed first.

## The Registry

[`src/flags.js`](../src/flags.js) lists every flag:

```js
orgFleet: {
  about: 'Org Fleet sharing with your org on the website. Nothing behind it yet.',
  default: false,
  devOnly: true,
},
```

- `about`: one line on what the flag turns on.
- `default`: its value in the public store build. Off unless there's a reason.
- `beta` (optional): its value in Open Hangar Beta ([BETA.md](BETA.md)). Left out, the
  beta gets `default`.
- `devOnly` (optional): `true` keeps it out of every store build, the beta included.

Today's flags (from 0.3.0 every store build is the connector, with Local Mode, the
wishlist import and store alerts, and from 0.4.0 Auto Scan Daily):

| Flag             | What it turns on                                           | Store | Beta | Dev-only |
| ---------------- | ---------------------------------------------------------- | ----- | ---- | -------- |
| `sync`           | Website sync (Connect This Browser, Sync Now, ...)         | on    | on   | no       |
| `orgFleet`       | Org Fleet sharing (nothing behind it yet)                  | off   | off  | yes      |
| `localMode`      | Our hangar page reads this browser's hangar                | on    | on   | no       |
| `connector`      | A toolbar popup and one basic page (the connector)         | on    | on   | no       |
| `wishlistImport` | This browser's wishlist into the account (the basic page)  | on    | on   | no       |
| `alerts`         | Store alerts matched on the device (needs connector)       | on    | on   | no       |
| `autoScan`       | Auto Scan Daily, once a day while connected (needs alerts) | on    | on   | no       |
| `scanBar`        | The popup's scan as one counting bar where Scan sits       | off   | off  | no       |

## Adding or Retiring a Flag

1. Add an entry to `REGISTRY` in `src/flags.js`: a camelCase name, `about` and
   `default` (plus `beta` or `devOnly` if needed).
2. Read it in code (below), and wrap code that must not ship while it's off in markers.
3. Run `npm test`: `test/build-flags.test.js` checks the registry, every marker and
   every flag the code reads.

To retire a flag, remove its entry. The build then fails on any marker still naming
it, so the code it guarded has to be kept (markers removed) or deleted on purpose.

## Sync in the Store Build

`sync` is on in every store build from 0.3.0: its code stays (the `@sync` blocks), it's
built in to production (`app.openhangar.space`), and every build asks for `identity`
(Connect's sign-in window; it's in `manifest.json`). On Firefox the site bridge
(`src/site-bridge.js`) lets the website's Connect This Browser in, and the manifest lists
what sync sends as optional data collection, asked on the first Connect.

It stays opt-in: nothing personal goes to openhangar.space until you Connect. Before
that, the extension only reads the public feeds (the status file, ships, rates and, with
store alerts on, the sale feed), which carry nothing about you. `npm run test:privacy` (in CI) holds the built
Chrome store extension to that: never connected, it scans and opens every page, and any
request to the sync site fails the check. Until launch day the website answers a sync
from an account without beta access with "Sync opens November 10" (reason `not-open`,
a switch on the website's side): the extension shows that as a calm note in the scan
report ("Not Synced Yet"), not a problem, and stays connected. The note uses the
website's own sentence (its built-in copy only when there's none), so a new date only
changes on the website. After that answer the sync after a scan holds off for 6 hours
(Sync Now still asks), so a connected extension doesn't upload its whole hangar after
every scan just to hear it again. The website's limit of one sync per account every few
minutes (429, reason `too-soon`) is a calm note too, and its `Retry-After` holds every
sync, Sync Now included. An extension page only sees that header when the website
exposes it (`access-control-expose-headers`), so `retry_after` (seconds) in the JSON
counts too; with neither, it waits 5 minutes.

`--flag sync=off` still builds a copy without it, for a developer; the store check
refuses that build.

## Local Mode

`localMode` lets our hangar page, hangar.openhangar.space, read the hangar this browser
scanned, with no account (ARCHITECTURE.md, "Messages From Our Pages"). With it on, the
build lets that page in (the manifest's lists and the built page lists) and keeps the
`@flag-start localMode` blocks: its requests in `src/background.js` and the dashboard's
side of a scan it asks for. Off, the page isn't let in and its handlers are cut. It
needs `sync` (Firefox's consent card for sharing is sync's), so
`--flag sync=off --flag localMode=on` doesn't build.

It's on in every store build and the beta from 0.3.0 (owner, 2026-10-13): the privacy
policy (docs/PRIVACY.md and site/privacy.html) names our hangar page and what it may
read, and a store or beta build that lets in a page the policy doesn't name fails
`npm test` (test/privacy-permissions.test.js). `npm run build:staging` has it on too, so
the staging hangar page (hangar-staging.openhangar.space) can talk to that build.
`--flag localMode=off` builds a developer's copy without it, which needs
`--flag connector=off` as well.

## The Connector

`connector` is the extension as the website's connector (owner, 2026-10-10): the
website is the full app, and the extension scans RSI, hands the hangar to our pages and
keeps one basic page that works on its own. With it on, the toolbar icon opens a popup
(`src/popup.html`, `ui/popup/`: the Hangar, Wishlist and Settings tabs and the alerts
bell with the `alerts` flag, [CONNECTOR.md](CONNECTOR.md)) instead of a tab. Its scans
run in a hidden page, `src/scan.html` (`src/scan-host.js`, `ui/scan/main.js`): an
offscreen document on Chrome and Edge (the `offscreen` permission), a hidden frame of
the event page on Firefox (its pages' `frame-src 'self'`), so no tab opens
(`scripts/scan-host.mjs` adds both per browser; the store check checks both ways). The
extension's one page left is the basic page (`src/basic.html`, `ui/basic/`), small since
0.4.0: Firefox's asks, Allow Access to RSI, Connect (`#settings`) and a scan that can't
run hidden, with its progress, report and Report a Scan Problem; no lists. Its scan is
the dashboard's Scan All without the store check. Everything the background opened as
the dashboard (a scan that can't run hidden, Connect from the website, Firefox's asks,
the reload after an update) opens the basic page instead (`hubUrl()` in
`src/background.js`). The popup's Scan asks the background (`{ ohPopup: 'scan' }`, the
`@flag-start connector` block), the same scan our hangar page asks for. Off, the popup,
the basic page and the hidden scan page aren't in the build, and those handlers are
cut.
With it on, the dashboard and its pages are left out of the build, and the pages may
only send requests to RSI, openhangar.space and the sync site (`connect-src`);
`scripts/check-store-build.mjs` checks both ways. What it keeps, the plan for removing
the dashboard and the outbound requests that go: [CONNECTOR.md](CONNECTOR.md). It needs `localMode` (Open My
Hangar goes to our hangar page until you connect), so `--flag connector=on` alone
doesn't build. It's on in every store build and the beta from 0.3.0 (owner, 2026-10-13:
the extension ships as the connector). `--flag connector=off` still builds the
dashboard, for a developer; the store check refuses that build.

## The Wishlist Import

`wishlistImport` lets the basic page send the wishlist this browser kept (the 0.3.x
dashboard's Store page) to the openhangar.space account, once per connection
(`ui/scan/wishlist-import.js`, `POST /api/v1/wishlist/import` with the sync token; the
website adds it and removes nothing). Until 0.3.0 the wishlist never left the browser.
It's on in every store build and the beta from 0.3.0: the privacy policy (docs/PRIVACY.md
and site/privacy.html) explains it under Optional Sync ("Your old wishlist, once",
owner-approved words 2026-10-13), and a store or beta build with it on fails `npm test`
while either copy doesn't (test/privacy-permissions.test.js). It runs in the basic page,
so a build without `connector` has nothing to run it.

## Alerts

`alerts` is Extension Alerts (connector plan 0.4): a toolbar badge and notifications for
what a pilot cares about in RSI's store, matched on the device so nobody learns their
wishlist or hangar, us included. With it on, the background worker loads `src/alerts.js`
(Firefox's event page lists it) and checks at most every 30 minutes on an alarm: it
downloads openhangar.space's public sale feed (`/api/store/on-sale`, the same file for
everyone) and, while this browser is connected, the account's Wishlist keys
(`/api/v1/wishlist` with the sync token; read only), and matches them here against the
hangar and buy-backs this browser scanned. Each match says why: on your Wishlist, a ship
in your buy-backs is in the store again, a paint for a ship you own just arrived, a ship
you own is sold as a warbond, or is on a limited-time sale. The badge counts the items
you haven't seen (the popup lists them, `ui/popup/Alerts.svelte`, and opening it marks
them seen); a new one gets a notification. It's off until the pilot turns it on in the
popup's settings (Store Alerts), and asks nothing before that: the popup has its own
Notifications switch, and turning alerts off stops the checks and gives Notifications
back. The popup's switch asks as the click's very first step; if the popup closes for
the browser's question, the browser keeps the answer.

The build adds the `alarms` permission (no install warning) and `notifications` as an
optional permission, asked only when the pilot turns alerts on, never a required one
(`scripts/alerts.mjs`; `scripts/check-store-build.mjs` checks both ways). It needs
`connector` (the popup shows the alerts), so `--flag alerts=on` with `--flag
connector=off` doesn't build. It's on in every store build and the beta from 0.3.0: the
privacy policy (docs/PRIVACY.md and site/privacy.html) has a Store Alerts section and
notes for the two permissions (owner-approved words 2026-10-13), and a store or beta
build with it on fails `npm test` while the policy doesn't name the sale feed, the
Wishlist read and both permissions (test/privacy-permissions.test.js). The store forms
take the two permissions' reasons from docs/STORE.md. Each pilot still turns alerts on
themselves. The kill switch (site/status.json) pauses the checks with
`"alerts": { "enabled": false }`.

## Auto Scan

`autoScan` is Auto Scan Daily (#666): once a day while connected, a quick check of the
newest page of the hangar and of buy-backs, and a full scan, saved part by part, only
when something there is new or a week has gone by (docs/CONNECTOR.md, its request budget
in docs/dev/requests.md). It's on in every store build and the beta from 0.4.0: the
privacy policy has its section and names it under alarms and Disconnect (owner-approved
words 2026-10-14), and a store or beta build with it on fails `npm test` while it
doesn't (test/privacy-permissions.test.js). Each pilot still turns it on themselves, in
the popup's Settings.

It needs `alerts`: its daily alarm is the `alarms` permission the alerts' build brings
(`scripts/alerts.mjs`), so `--flag autoScan=on` with `--flag alerts=off` doesn't build
(and a build without the alerts passes `--flag autoScan=off` too). Its code is the
`@flag-start autoScan` blocks in `src/background.js` (the alarm and the badge rule), the
popup's switch (`flag('autoScan')`) and the hidden scan page's run (`ui/scan/main.js`).
The kill switch (site/status.json) pauses it with `"autoScan": { "enabled": false }`.

## How Builds Set Them

`scripts/pack.mjs` picks each build's values and writes them into that build's copy,
`dist/<target>/src/flags.js` (`BUILD_VALUES`). The file in the repo always holds the
defaults.

| Build                                            | Flags                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------- |
| `npm run build`, `npm run pack` (public store)   | every flag at its `default`                                               |
| `npm run build:beta`                             | the beta set, exactly (no `--flag`)                                       |
| `npm run build:staging`                          | the defaults (Local Mode and the connector), built in to the staging site |
| `--site=<url>`, `OH_SITE=<url>`                  | the defaults, built in to that site instead                               |
| `--flag name=on` / `--flag name=off`, repeatable | a developer's own build, on top of any                                    |

For example `npm run build -- --flag orgFleet=on`. `OH_SYNC=1` and `--sync` are the
older spelling of `--flag sync=on`, which is the store build now. A build with a site of
its own lets the staging site talk to it too (and with `localMode` on, the staging
hangar page). The build log lists the flags that are on, and calls the build "dev build,
never for a store" when a dev-only flag is on, a flag is off its default, or the
built-in site isn't production.

`scripts/check-store-build.mjs` (`npm run check:store`, and `--beta` for the beta)
fails unless every build in `dist/` carries `src/flags.js` with exactly its set: the
defaults for the public build, the beta set for the beta, and no dev-only flag on. With
`sync` on, each build (every folder and every zip) also needs the sync code, built in to
production only, the `identity` permission and the website's way in (Chrome and Edge:
`externally_connectable`; Firefox: the site bridge and sync's optional data collection),
and no staging site anywhere. Every build also has its pages' way in agree with itself
(the manifest's list, the built `src/site-pages.js` and the Firefox bridge's copy), with
exactly the store's pages for its flags: the hangar page only with `localMode` on.

## Reading a Flag

`OH.flags.<name>` is `true` or `false`:

- **Dashboard:** `src/dashboard.html` loads `flags.js` before `lib.js`, so
  `window.OH.flags` is there for `lib.js`, `dashboard.js` and the rest.
- **Background worker:** `src/background.js` imports it (`self.OH.flags`). Firefox's
  event page has no `importScripts`, so its manifest lists `src/flags.js` first.
- **Svelte pages:** `flag('orgFleet')` from `ui/lib/flags.js`. A retired or unknown
  flag reads `false`.

## Markers

Code that must not ship in builds where a flag is off goes between markers. Each
marker sits on a line of its own, in a comment:

```js
// @flag-start orgFleet: Org Fleet sharing
shareFleet();
// @flag-end orgFleet
```

```html
<!-- @flag-start orgFleet -->
<script type="module" src="ui/org-fleet.js"></script>
<!-- @flag-end orgFleet -->
```

- With the flag off, `scripts/pack.mjs` cuts both marker lines and everything between
  them from every `.js`, `.html` and `.css` file under `dist/<target>/src`. With it
  on, the block stays as written.
- Blocks never nest. A block left open, an end that doesn't match its start, a marker
  without a name or one naming a flag the registry doesn't have all fail the build.
- `@sync-start` and `@sync-end` are the `sync` flag's markers under their older name.
- The Svelte build (`npm run build:ui`) drops comments, so markers inside `ui/`
  sources don't survive into `src/ui/`. For a whole Svelte page, put its `<script>` tag in
  `src/dashboard.html` inside a block (the way `ui/site.js` sits in a sync block);
  inside a page, use `flag()`.
