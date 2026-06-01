# Open Hangar

**An open-source browser extension that scrapes your own Star Citizen / RSI
account data into a clean, structured, local database — so you (or your app)
don't have to reverse-engineer robertsspaceindustries.com.**

At its core Open Hangar is a **data scraper**. It handles RSI's awkward auth and
markup for you and hands back tidy, structured data. It also ships with a simple
built-in viewer so non-developers can browse their hangar — but the point is
**reusable data you can build on**.

> ⚠️ Unofficial, fan-made tool. Not affiliated with Cloud Imperium Games / RSI.
> It reads only *your own* account, locally, using your existing browser session.

## Contents

- [Why it exists](#why-it-exists)
- [What it does](#what-it-does)
- [The data](#the-data)
- [How it works](#how-it-works)
- [Install](#install)
- [Using it](#using-it)
- [For developers](#for-developers)
- [Privacy](#privacy)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Terms & fair use](#terms--fair-use)
- [License & community](#license--community)

## Why it exists

Getting data out of RSI is genuinely annoying: cookie-based session auth, a mix
of server-rendered pages and a newer GraphQL app, paginated HTML, and no public
API. Every developer who wants to build a Star Citizen fleet/CCU tool ends up
re-solving the same scraping problem.

Open Hangar solves it **once, in the open** — a readable, auditable, MIT-licensed
extension that does the fetching + parsing and exposes structured data other
projects can consume. The goal is to eliminate the "how do I even get this data"
step for the next developer.

## What it does

- **Scrapes your hangar** (pledges: ships, CCUs, add-ons, coupons) into
  structured records — **working today**.
- **Scrapes your buy-backs** (melted pledges you can re-acquire) — working; same
  server-rendered HTML pipeline as the hangar.
- **Reads account identity + balances** (handle, Store Credit, UEC, REC) — working.
- **Classifies** each pledge (`ship` / `ccu` / `addon` / `coupon`) and parses CCU
  chains (`from → to`).
- **Stores** everything locally in a versioned database; nothing leaves your browser.
- **Viewer UI** (convenience layer): a fleet gallery with search, sort, filters, stats.
- **Planned**: store catalog/warbonds, and a live whitelisted API for other sites
  to consume the data — see [Roadmap](#roadmap).

## The data

Every pledge is normalized to one object:

```js
{ id, name, value, currency,
  contents: [{ kind, label, image }],
  image, containsShip,
  isCCU, ccu: { from, to },
  isAddOn, isCoupon,
  kind }            // ship | ccu | addon | coupon | other
```

Sources live in a registry (`OH.SOURCES`) and persist as one versioned object:
`{ schemaVersion, sources: { hangar: { items, scannedAt } }, owner }`.

The **JSON export** wraps that in provenance and a flattened identity block,
ordered *who → what they own* so it drops straight into a backend table:

```js
{ app, appVersion, exportedAt, schemaVersion,   // provenance
  account: {                                     // identity (schema v2+)
    handle, displayName, avatar,
    ueeRecord, enlistedSince, country,
    organization: { name, sid, rank, logo },     // null if none / private
    subscriber, concierge,
    balances: { storeCredit, uec, rec },         // storeCredit.value is in cents
    capturedAt },
  sources: { hangar: {…}, buybacks: {…} } }       // holdings
```

## How it works

RSI authenticates with a **session cookie**. The extension has host permission
for `robertsspaceindustries.com`, so its own `fetch` requests carry your existing
session — **no password, no RSI tab open, no server**. Server-rendered pages are
fetched and parsed locally. The fragile part (RSI's markup) is isolated in
`src/scraper/parser.js`, so when RSI changes their site there's exactly one place
to fix.

```
manifest.json           permissions + config
src/
  background.js         opens the hub when the toolbar icon is clicked
  lib.js                scan loop + source registry + storage
  scraper/parser.js     RSI HTML -> normalized model   (the fragile layer)
  dashboard.html / .js  the viewer (Home · Inventory · Stats · … · Developers)
```

## Install

**Chrome / Edge / Brave** (unpacked, during development):

1. Go to `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Make sure you're logged in to `robertsspaceindustries.com` in this browser,
   click the extension icon, then **Scan Hangar**.

## Using it

Click the toolbar icon to open the hub. **Scan Hangar** pulls your data; then
browse it in **Inventory** (gallery / compact / list, with search, filters, and
sort) and **Stats**. Re-scan any time to refresh. The Home page also has
**Log in** / **Log out** (RSI session) and **Clear Data** (wipe the local scan).

## For developers

Open Hangar is meant to be the data layer for *your* project. The contract is the
local storage shape above, and a **JSON export/import** (Developers page) lets you
pull the whole database out — including account identity, org, rank, and balances —
or restore it, as a single self-describing file (import restores the holdings; the
`account` block is a read-only snapshot).
Still planned: an opt-in, **whitelisted messaging API** (`externally_connectable`,
so approved sites can request the database directly). See the in-app **Developers**
page and [ROADMAP.md](ROADMAP.md). To add a new data source, see
[CONTRIBUTING.md](CONTRIBUTING.md).

## Privacy

No password or credentials — only the session you already have. No server; your
scraped data never leaves your browser. The only outbound requests carry no
personal data: hangar thumbnails + the home banner image from RSI's media
servers, the current game version from the public star-citizen.wiki API, and —
for items RSI ships with no art (e.g. CCUs) — the missing ship image, looked up by
**ship name** from RSI's public ship-matrix (and, as a fallback, the
star-citizen.wiki API). Those lookups are cached locally and weakly reveal which
ships you're viewing — the one outbound signal beyond anonymous asset fetches.
**Clear Data** (on the Home page) wipes your scraped data on demand; removing the
extension wipes everything. **Log out** ends your RSI session by clearing
robertsspaceindustries.com cookies from your browser (this is the one action that
changes browser state, and the reason the extension requests the `cookies`
permission alongside `storage`).

**Multiple accounts / shared browsers:** scraped data is tied to the RSI account
it was scanned from. If you open Open Hangar while signed in to a *different*
account, it clears the previous account's hangar and prompts a fresh scan — so
accounts never mix. While you're signed out, your last scan stays visible
(labelled with whose it is) so you can still browse offline.

## Roadmap

Short version: ~~buy-backs~~ (done) → store data (incl. warbonds) → account
balances → a live whitelisted API (JSON export/import already shipped) →
CCU-chain optimizer. Full detail in [ROADMAP.md](ROADMAP.md); deferred
investigations live in [TODO.md](TODO.md).

## Contributing

The single most valuable contribution is keeping `parser.js` working when RSI
changes their site. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Terms & fair use

Unofficial; not affiliated with Cloud Imperium Games / RSI. Read-only, personal,
and rate-limited — it reads only the signed-in user's own account. Respect
[RSI's Terms of Service](https://robertsspaceindustries.com/tos) and don't
redistribute other people's data.

## License & community

MIT — see [LICENSE](LICENSE).

- **GitHub:** [Draco-Foundry/open-hangar](https://github.com/Draco-Foundry/open-hangar)
- **Discord:** _coming soon_
