# Architecture

A map of how Open Hangar fits together, for new contributors and auditors. It should
take about ten minutes to read. Every claim points at the file (and usually the
function) it comes from, so you can check it. The big "why" decisions live in
[docs/decisions/](docs/decisions/README.md).

## The Big Picture

Open Hangar is a Manifest V3 browser extension (Chrome, Edge, Firefox). It has no
backend: everything it reads is kept in `chrome.storage.local` in your browser.

| Piece               | Files                                                    | Job                                                                |
| ------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| Service worker      | `src/background.js`                                      | Opens the dashboard, rescan reminder badge, update handling        |
| Dashboard (classic) | `src/dashboard.html`, `src/dashboard.js`                 | The whole app: views, scanning, state, most pages                  |
| Shared library      | `src/lib.js` (exposed as `window.OH`)                    | Source registry, scan loop, storage, export/import, outside data   |
| Parser              | `src/scraper/parser.js` (exposed as `window.OpenHangar`) | RSI HTML to normalized items; the only place that knows RSI markup |
| Svelte pages        | `ui/` (built into `src/ui/`)                             | The new Home page cards (0.3.0 redesign, in progress)              |
| Bundled data        | `src/data/ship-catalog.json`, `src/data/ship-codes.json` | Ship list and prices; ship codes for the HTF export                |
| Packaging           | `scripts/pack.mjs`                                       | Per-browser builds in `dist/chrome` and `dist/firefox`             |
| Website             | `site/`, `site-worker/wrangler.jsonc`                    | openhangar.space, including the `status.json` kill switch          |
| Workflows           | `.github/workflows/`                                     | CI, release, store publishing, site deploy, canary                 |

`manifest.json` asks for `storage`, `unlimitedStorage` and `cookies`, plus host access
to `https://robertsspaceindustries.com/*`. The content security policy only allows the
extension's own scripts (`script-src 'self'`).

## The Service Worker

`src/background.js` is deliberately thin. The toolbar button has no popup:
`chrome.action.onClicked` opens `src/dashboard.html` in a tab. It also:

- shows an amber `!` badge when the last hangar scan (`db.sources.hangar.scannedAt`) is
  7 days old or more (`updateReminder()`, turned off with the `remindRescan` key);
- holds back a browser update while a dashboard tab is open (`updateReady`), records
  `justUpdated` after an update, and reopens the Updates page after a reload
  (`reopenAfterUpdate`).

Scanning can't run here: MV3 service workers have no `DOMParser`, which the parser
needs (see the header of `src/lib.js` and CONTRIBUTING.md, "How Auth Works").

## The Scan Pipeline

Scanning runs in the dashboard page itself. `dashboard.html` loads, in order,
`scraper/parser.js`, `lib.js`, `quips.js`, `qr.js` and `dashboard.js`.

1. **Start.** `runScan()` in `src/dashboard.js` scans the chosen parts: hangar,
   buy-backs, referrals and (if you have a wishlist) the store. It looks up the RSI
   account once with `OH.getAccount()` and passes it to every save, so saves cost no
   extra RSI requests.
2. **Check the kill switch.** `OH.scanSource(id)` in `src/lib.js` finds the source with
   `OH.getSource(id)` and asks `OH.sourcePaused(id)` first. A paused source returns at
   once and never touches RSI (see [The Kill Switch](#the-kill-switch)).
3. **Fetch.** `scanHtmlSource(src)` requests `src.url?page=N&pagesize=…` one page at a
   time. `fetchPage()` uses `fetch(url, { credentials: 'include' })`, so the browser's
   existing RSI session cookie goes with it: no password, no RSI tab. It retries only
   network errors, 5xx and 429 (up to 3 times, honouring `Retry-After`, capped at
   15 seconds), with a 30 second timeout per request. Between pages it waits
   `DELAY_MS` (400 ms). Pages are never fetched in parallel.
4. **Parse.** Each page goes through the source's `parse(html)`, which calls
   `window.OpenHangar.parsePledges` or `parseBuybacks` in `src/scraper/parser.js`.
   Items are de-duplicated by id, and the loop stops when a page adds no new ids (RSI
   returns the last page again for out-of-range page numbers). `MAX_PAGES` (1000) is a
   safety cap.
   **Skipping an unchanged hangar.** Sources with `probe: true` (the hangar) check page 1
   against the saved scan first. If it matches, `unchangedSince()` reads only the last
   page (and, when that one is full, the page after it, which RSI should clamp back) and
   compares them too. All equal means nothing was added, removed or moved, so the saved
   items are kept and the rest of the pages aren't fetched. It's only trusted within a
   day of a complete scan by the same version (`meta.probe`), for hangars of 3+ pages;
   anything off or any hiccup means the normal full scan.
5. **Tell empty from broken.** On page 1 with no items, `scanHtmlSource` checks, in
   order: signed out (`looksLoggedOut()`), a genuinely empty list (`emptyMarker`), data
   markers present but nothing parsed, meaning RSI changed their markup (`marker`), or
   an empty page where HTML was expected (`requiresRender`).
6. **Save.** `saveSource()` writes `db.sources[id]` and stamps `db.owner` with the RSI
   account. All writes to the live database go through one queue (`exclusive()`),
   which re-reads storage right before writing, so two saves can't overwrite each
   other.
7. **Partial scans never shrink your data.** If RSI stops answering mid-scan and an
   earlier scan had more items, `OH.scanSource` keeps the earlier scan and reports an
   error. Only complete hangar scans are added to the scan history.

Referrals are not in `OH.SOURCES`: `OH.getReferral()` reads them from RSI's GraphQL
endpoint (`POST /graphql`, `GetReferralRecruitsList`) and saves them as the `referral`
source. Account identity and balances come from `OH.getAccount()`, cached for
10 minutes under the `account` key.

All errors, retries and partial scans go to a small local log (`OH.log()`, key
`errorLog`, last 100 entries). `OH.scrubLog()` removes emails and referral codes, and
`OH.errorReport()` builds the text users paste into bug reports.

## `OH.SOURCES`

The source registry in `src/lib.js`. Each entry describes one paginated RSI page:

| Field             | Meaning                                                                        |
| ----------------- | ------------------------------------------------------------------------------ |
| `id`, `label`     | `hangar` / `Hangar`, `buybacks` / `Buy-Backs`                                  |
| `type`            | `'html'`; `OH.scanSource` reports any other type as not implemented yet        |
| `url`, `pageSize` | `/account/pledges` (10 per page), `/account/buy-back-pledges` (100 per page)   |
| `parse(html)`     | Turns one page into an array of normalized items                               |
| `marker`          | Hangar only: if this is in the page but nothing parsed, the markup changed     |
| `emptyMarker`     | Buy-backs only: RSI's "no pledges available" text, a real empty list           |
| `requiresRender`  | Buy-backs only: an empty page is an error, not "no buy-backs"                  |
| `meta(html)`      | Buy-backs only: reads buy-back tokens from page 1 into `sources.buybacks.meta` |

`OH.scanAll()` scans every registered source in order. To add a source, see
CONTRIBUTING.md, "Adding a Data Source".

## Storage

Everything lives in `chrome.storage.local` (the `unlimitedStorage` permission lifts the
browser's default quota). The main keys:

| Key                       | What it holds                                                                                    | Code                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| `db`                      | `{ schemaVersion, sources: { hangar, buybacks, referral: { items, scannedAt, meta? } }, owner }` | `readDB()`, `writeDB()`, `OH.loadDB()`    |
| `dbHistory`               | Scan history: `[{ at, items: [[id, name, value]], credit?, checkedAt? }]`                        | `recordHistory()`, `OH.trimHistory()`     |
| `dbCorrupt`               | Up to 3 damaged originals that failed the check, kept until Clear Data                           | `setAside()`, `OH.getDamaged()`           |
| `dbRecovery`              | `{ at, db }`: the previous account's data, saved before an automatic clear                       | `clearDataNow()`, `OH.recoverData()`      |
| `profile:<nickname>`      | Another RSI account's whole DB (history inside), parked while a different account is signed in   | `OH.switchProfile()`, `OH.listProfiles()` |
| `account`                 | Cached RSI identity and balances (10 minutes)                                                    | `OH.getAccount()`                         |
| `errorLog`                | The rolling error log                                                                            | `OH.log()`                                |
| `remoteStatus`, `netDown` | Cached kill switch file; sites that recently timed out                                           | `loadStatus()`, `OH.guarded()`            |
| `bbDetails`               | Buy-back details, fetched only when you ask                                                      | `OH.fetchBuybackDetails()`                |
| `lastBackupAt`            | When you last downloaded a backup file                                                           | `downloadBackup()` in `src/dashboard.js`  |

Other keys are caches of public data (for example `shipMatrix`, `shipCatalog`,
`shipImages`, `scVersion`, `rsiNews`, `patchNotes`, `storeShips`, `fxRates`) and UI
preferences read at start-up in `src/dashboard.js` (for example `uiLayout`, `currency`,
`wishlist`, `streamerMode`).

**Two version numbers.** `DB_VERSION` (3) is how the database is stored in this
browser; `EXPORT_VERSION` (2) is the backup file format. Both are defined at the top of
`src/lib.js`, with their history in the comment above them.

- Every load runs `OH.checkDB()`. A malformed DB never crashes the dashboard: the
  original is set aside under `dbCorrupt` first, whatever is still valid is kept, and
  the dashboard offers to restore a backup.
- Older stored versions go through `MIGRATIONS` and `OH.migrateDB()`. v2 to v3 moved
  scan history out of `db` into `dbHistory`. A DB written by an older version after a
  rollback is also handled on load (`test/db.test.js`).
- History keeps at most 100 snapshots and about 3 MB (`HISTORY_MAX`,
  `HISTORY_MAX_BYTES`). A scan that changed nothing only updates `checkedAt`.

**Accounts.** The live `db` always belongs to the signed-in RSI account. When a
different account signs in, the current DB is parked under `profile:<nickname>` and
the new account's parked DB (if any) comes back (`OH.switchProfile()`). Clear Data
(`OH.clearData()`) removes the DB, history, damaged copies, recovery slot, account
cache and log, but keeps UI preferences.

**Backups and export.** `OH.exportDB()` writes one JSON file:
`{ app, appVersion, exportedAt, schemaVersion, account, sources, history }`, with the
referral code and URL stripped (`sanitizeSourcesForExport()`). `OH.importDB()` refuses
files newer than it understands, merges history instead of replacing it
(`OH.mergeHistory()`), and never restores the `account` block. `OH.exportHTF()` writes
the community Hangar Transfer Format (one entry per ship).

## The Svelte and Classic Bridge

The dashboard is mostly classic JavaScript. The 0.3.0 redesign (docs/REDESIGN-0.3.md)
is moving pages to Svelte one at a time; today that's the Home page cards.

- **Build.** `vite.config.mjs` builds `ui/home/main.js` into `src/ui/home.js`,
  `src/ui/home.css` and `src/ui/fonts/`. Output is not minified, because store
  reviewers read it. `src/ui/` is generated and git-ignored: run `npm run build:ui`
  (or `npm run dev:ui` to watch).
- **Loading.** `src/dashboard.html` links `ui/home.css` and loads `ui/home.js` as a
  module. `ui/home/main.js` mounts `Home` into `#oh-home`, `ForYou` into `#oh-foryou`
  and `StatusCard` into `#oh-status`, but only when `window.OHApp` exists.
- **Classic to Svelte.** `src/dashboard.js` owns scanning, storage and state. At the
  end of the file it publishes `window.OHApp`: a getter for `state` plus read-only
  helpers (`hangarValue`, `accountValue`, `bigMoney`, `priceOf`, …) and a few actions
  that switch views (`openItem`, `showInventory`, `showBuybacks`). When Home's data
  changes it calls `homeUpdated()`, which fires one `oh:home` event per microtask.
- **In Svelte.** `ui/lib/app.svelte.js` turns `oh:home` into a reactive counter
  (`version.n`); components read `app()` (that is, `window.OHApp`) inside `$derived`
  blocks that also read `version.n`, so they redraw. `loadLive()` loads outside data
  (wiki, RSI news, patch notes) once per page view through `window.OH`.
- **Svelte to classic.** `ui/home/ForYou.svelte` sets `window.OHApp.alerts` to
  `{ list, ignore }`, which the bell in `src/dashboard.js` reads.
- **Inventory.** `ui/inventory/main.js` (built to `src/ui/inventory.js`) mounts the page around the list into `#oh-inventory`: summary
  strip, toolbar, the filter sidebar (Filters Pass), active-filter pills and saved
  views, plus the melt planner in Select mode's bar. It moves `#results` into its
  list column; the cards and the Market sale sheet in it are still drawn by
  `renderInventory()`. The filters live in `src/dashboard.js` (`INV_GROUPS`,
  `computeShown()`), because the list, Select All and the exports read them too;
  the Svelte controls call `window.OHApp.inv`. The toolbar, sidebar, pills, summary
  strip and Export menu are shared components in `ui/lib/`.
- **Buy-Backs.** `ui/buybacks/main.js` does the same for Buy-Backs (`#oh-buybacks`,
  moving `#buybacks-body`), with its own groups (`BB_GROUPS`, applied by
  `computeBuybacks()`) and `window.OHApp.bb`.
- **Shared chunk.** Code pages share (Svelte's runtime and `ui/lib/`) builds into
  `src/ui/shared.js` and `shared.css` (`manualChunks` in `vite.config.mjs`), so
  `dashboard.html` links one fixed stylesheet however many pages share it.

## Outbound Requests

The full list, with what is and isn't sent, is in [docs/PRIVACY.md](docs/PRIVACY.md).
In short:

- **robertsspaceindustries.com**: your own account pages, with your session
  (`fetchPage()`, `OH.getAccount()`, `OH.getReferral()`), plus public pages such as
  the ship matrix, Comm-Links and patch notes.
- **Public read-only data**: `api.star-citizen.wiki`, `starcitizen.tools` and
  `support.robertsspaceindustries.com`.
- **openhangar.space**: `status.json` (the kill switch) and `rates.json` (exchange
  rates, only for a currency other than USD). Nothing is sent.

Requests to sites other than your RSI account go through `OH.guarded()`: an 8 second
timeout, and a site that timed out or answered 429/5xx is skipped for 10 minutes
(`netDown`). Callers fall back to their cached copy.

Code for the optional sync to app.openhangar.space sits between `@sync-start` and
`@sync-end` markers in `src/lib.js`, `src/dashboard.js` and `src/dashboard.html`. It is
off unless a developer sets the `siteUrl` key, and `scripts/pack.mjs` cuts it out of
store builds (see [Build and Packaging](#build-and-packaging)).

## The Kill Switch

When RSI changes a page, every installed copy breaks until a fix clears store review.
`site/status.json` lets us pause a broken scan without a release. The playbook is
[docs/RSI-CHANGES.md](docs/RSI-CHANGES.md), step 0.

- `loadStatus()` in `src/lib.js` reads `https://openhangar.space/status.json` with
  `credentials: 'omit'`, caches it for 6 hours under `remoteStatus`, and after a
  failure keeps the last copy and tries again in 30 minutes.
- `OH.evalStatus()` (pure) turns the file into `{ paused, banner }` for the running
  version. A source is paused by `"enabled": false`, or by `"minVersion"` when the
  running version is older. Source ids: `hangar`, `buybacks`, `referrals`.
- It fails open: no file, a bad file or no connection means scan as normal.
- `OH.scanSource()` and `OH.getReferral()` check it before scanning;
  `renderSiteNotice()` in `src/dashboard.js` shows the banner.

## Build and Packaging

- `npm run build` runs `vite build` (the Svelte pages) and then `scripts/pack.mjs`.
- `scripts/pack.mjs` copies `_locales`, `icons` and `src` (minus `icons/icon.svg`)
  plus `CHANGELOG.md` (for the Updates page), `LICENSE` and `THIRD_PARTY_NOTICES.md`
  into `dist/chrome` and `dist/firefox`, and writes a manifest for each:
  - `dist/chrome`: `manifest.json` as is. The same zip goes to Chrome and Edge.
  - `dist/firefox`: adds `background.scripts` (Firefox MV3 runs an event page) and
    `browser_specific_settings.gecko` (add-on id `open-hangar@draco-foundry`, minimum
    Firefox 140, and `data_collection_permissions: none`).
- Unless `OH_SYNC=1`, it removes `@sync-start` to `@sync-end` blocks and fails the
  build if `app.openhangar.space` is still mentioned anywhere in `dist/*/src`.
- `npm run pack` zips both with `web-ext` into
  `dist/open-hangar-chrome-<version>.zip` and `dist/open-hangar-firefox-<version>.zip`.
  `npm run lint:firefox` runs Mozilla's linter on `dist/firefox`.

## Tests

- **Unit tests:** `npm test` runs `node --test` on an explicit list of files in
  `package.json`, so a new test file must be added to that list to run. Tests live in
  `test/`, with scrubbed RSI captures in `test/fixtures/`.
- **UI smoke test:** `npm run test:ui` builds the Svelte pages and runs
  `scripts/screenshots/smoke.mjs`. It serves the real dashboard with a fictional demo
  account (`scripts/screenshots/run.mjs --serve` on port 8323; `demo-shim.js` stubs
  `chrome.*`), drives your installed Chrome with `puppeteer-core`, and fails on page
  errors, empty views and misaligned List-view rows.
- **CI** (`.github/workflows/ci.yml`), on every push and PR: `npm ci`, `npm test`,
  `npm run format:check`, `npm run test:ui`, `npm run pack`, `web-ext lint` on the
  Firefox build, and `scripts/actionlint.sh` on the workflow files.
- **RSI canary** (`.github/workflows/canary.yml`): once a day, `scripts/canary.mjs`
  runs the real parsers on RSI's public pages and tells #ops if one broke. It can't
  see signed-in pages.

## Release and Publish

1. **Cut a release.** `npm run release <x.y.z>` (`scripts/release.mjs`) runs on a
   clean `main`: it checks the version goes up and that every Unreleased CHANGELOG
   bullet starts with New:, Improved:, Changed: or Fixed:, runs the tests, dates the
   CHANGELOG section, bumps `manifest.json` and `package.json`, commits, tags
   `v<x.y.z>` and pushes.
2. **GitHub Release.** `.github/workflows/release.yml` runs on the `v*` tag: tests,
   checks the tag matches `manifest.json`, runs `npm run pack`, and publishes a GitHub
   Release with both zips and that version's CHANGELOG section as the notes.
3. **Store upload.** `.github/workflows/publish.yml` only runs by hand (Actions,
   Publish to stores) with a tag and a store (`all`, `firefox`, `edge`, `chrome` or
   `discord`). The build job checks the tag's commit passed CI
   (`scripts/publish/ci-gate.mjs`), runs the unit tests, the UI test and the Firefox
   linter, then packs. Each upload job (Firefox, Edge, Chrome) uses the `stores`
   environment, so it waits for the owner to approve it before it can read the store
   keys. Firefox uploads also attach the source code (docs/AMO-SOURCE.md). After a full
   release a job posts to Discord #updates; a failure posts to #ops. PRs that touch
   publishing get a dry run.
4. **Docs.** Store setup and keys: [docs/STORE.md](docs/STORE.md). Rolling back a bad
   version: [docs/ROLLBACK.md](docs/ROLLBACK.md).

Each store still reviews every upload before it goes live.

## The Website

[openhangar.space](https://openhangar.space/) is the static site in `site/` (landing
page, troubleshooting page `help.html`, privacy policy, `status.json`). It's served by Cloudflare as Workers static
assets with no script: `site-worker/wrangler.jsonc` (worker `openhangar-site`, custom
domain `openhangar.space`). It moved off GitHub Pages on 2026-10-01
(docs/SITE-CLOUDFLARE.md).

`.github/workflows/pages.yml` deploys it with `wrangler` when `site/` (or a few shared
files) change on `main`, and daily to refresh exchange rates. Before deploying it
copies in the icon, banner and store screenshots, stamps the current version and its
date into `site/index.html`, and builds `site/rates.json` with
`scripts/update-rates.mjs`.

app.openhangar.space (accounts and opt-in sync) is not in this repo; it lives in the
private repo Draco-Foundry/open-hangar-server
([decision 0003](docs/decisions/0003-repo-split.md)).
