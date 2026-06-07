# Open Hangar

[![Roadmap](https://img.shields.io/badge/%F0%9F%97%BA%EF%B8%8F-Roadmap-orange?style=for-the-badge)](ROADMAP.md)
[![Contributing](https://img.shields.io/badge/Contributing-guide-blueviolet?style=for-the-badge)](CONTRIBUTING.md)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.2.3-blue?style=for-the-badge)](manifest.json)

Open Hangar is an open-source browser extension that reads your own Star Citizen /
RSI account and saves it as clean, structured data on your own machine — so you, or
the app you're building, can use it instead of scraping it yourself.

RSI gives you a rich account: your hangar, your buy-backs, your balances, your org.
What it doesn't give you is a public API to read any of that programmatically. Open
Hangar fills that gap. It's a companion to your RSI account that takes what RSI
already shows you and hands it back as tidy, reusable records.

At heart it's a data tool for **developers**. It deals with RSI's session auth and
page markup for you and returns a structured database. It also ships with a simple
built-in browser so **enthusiasts** who just want to look through their fleet can do
that too, no code required.

> Unofficial, fan-made, and not affiliated with Cloud Imperium Games or RSI. It
> reads only _your own_ account, on your own computer, using the browser session
> you're already signed in with.

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

There's a lot of data behind an RSI account, but getting at it is the same chore
every time. RSI's site uses cookie-based sessions, a mix of classic server-rendered
pages and a newer GraphQL app, and paginated HTML, with no public API on top. So
anyone who wants to build a fleet tool, a CCU tracker, or a hangar viewer starts in
the same spot: working out how to pull the data before they can build anything
interesting.

Open Hangar solves that part once, out in the open. It's a readable, MIT-licensed
extension that handles the fetching and parsing and gives you structured data to
build on. The aim is to take "how do I even get this data" off the table, so the
next developer can skip straight to their actual idea — and so an enthusiast who
just wants to browse their fleet has something friendly to open.

## What it does

- Reads your **hangar** (pledges: ships, CCUs, add-ons, coupons) into structured
  records.
- Reads your **buy-backs** (melted pledges you can re-acquire), using the same
  page-parsing pipeline as the hangar.
- Reads your **account identity and balances** (handle, Store Credit, UEC, REC,
  plus org and rank).
- Reads your **referrals** (code plus recruits and prospects, current and legacy
  programs, with charts), via RSI's GraphQL API.
- **Classifies** each pledge (`ship` / `ccu` / `addon` / `coupon`) and reads CCU
  chains (`from → to`).
- **Stores** everything locally in a versioned database. Nothing leaves your
  browser.
- Includes a **viewer**: a fleet gallery with search, sort, filters, and stats —
  for browsing your hangar without writing a line of code.

For what's already built versus what's planned, see the [Roadmap](#roadmap).

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
ordered _who → what they own_ so it drops straight into a backend table:

```js
{ app, appVersion, exportedAt, schemaVersion,   // provenance
  account: {                                     // identity (schema v2+)
    handle, displayName, avatar,
    ueeRecord, enlistedSince, country,
    organization: { name, sid, rank, logo },     // null if none / private
    subscriber, concierge,
    balances: { storeCredit, uec, rec },         // storeCredit.value is in cents
    capturedAt },
  sources: { hangar: {…}, buybacks: {…},          // holdings
    referral: { items: { current, legacy, prospects,
                         recruitsList, prospectsList } } } }  // code/url NOT exported
```

## How it works

RSI authenticates with a **session cookie**. The extension has host permission for
`robertsspaceindustries.com`, so its own `fetch` requests carry your existing
session — no password, no RSI tab open, no server. Server-rendered pages are fetched
and parsed locally. RSI updates their site from time to time, as any site does, and
all of that parsing is isolated in `src/scraper/parser.js`, so when the markup
changes there's exactly one place to update.

```
manifest.json           permissions + config
src/
  background.js         opens the hub when the toolbar icon is clicked
  lib.js                scan loop + source registry + storage
  scraper/parser.js     RSI HTML -> normalized model   (the layer to maintain)
  dashboard.html / .js  the viewer (Home · Inventory · Stats · … · Developers)
```

## Install

Open Hangar isn't in the extension stores yet, so for now you load it yourself.

**Chrome / Edge / Brave** (unpacked):

1. Go to `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Make sure you're signed in to `robertsspaceindustries.com` in the same browser,
   click the Open Hangar icon, then **Scan Hangar**.

**Firefox:** load it from `about:debugging` › **This Firefox** › **Load Temporary
Add-on** and pick `manifest.json`. Firefox support is still being smoothed out — see
the [Roadmap](#roadmap).

**Safari:** a Safari build is on the roadmap. Safari needs the extension repackaged
as a Safari Web Extension through Xcode, so it's a proper port rather than a
drop-in load. See the [Roadmap](#roadmap).

## Using it

Click the toolbar icon to open the hub. **Scan Hangar** pulls your data; then browse
it in **Inventory** (gallery / compact / list, with search, filters, and sort) and
**Stats**. Re-scan any time to refresh. The Home page also has **Log in** / **Log
out** (RSI session) and **Clear Data** (wipe the local scan).

## For developers

Open Hangar is meant to be the data layer for _your_ project. The contract is the
local storage shape above, plus a **JSON export/import** (Developers page) that lets
you pull the whole database out — account identity, org, rank, balances, and
holdings — or restore it, as a single self-describing file. (Import restores the
holdings; the `account` block is a read-only snapshot.)

Still planned: an opt-in way for sites you approve to ask the extension for your
data directly, instead of exporting a file by hand. It would be limited to a short
list of domains you trust (using the browser's `externally_connectable` messaging
mechanism). See the in-app **Developers** page and [ROADMAP.md](ROADMAP.md). To add
a new data source, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Privacy

No password or credentials — only the session you already have. No server; your
scraped data never leaves your browser. The only outbound requests carry no personal
data: hangar thumbnails and the home banner image from RSI's media servers, the
current game version from the public star-citizen.wiki API, and — for items RSI
ships with no art (e.g. CCUs) — the missing ship image, looked up by **ship name**
from RSI's public ship-matrix (and, as a fallback, the star-citizen.wiki API). Those
lookups are cached locally and weakly reveal which ships you're viewing — the one
outbound signal beyond anonymous asset fetches. **Clear Data** (on the Home page)
wipes your scraped data on demand; removing the extension wipes everything. **Log
out** ends your RSI session by clearing robertsspaceindustries.com cookies from your
browser (this is the one action that changes browser state, and the reason the
extension requests the `cookies` permission alongside `storage`).

**Multiple accounts / shared browsers:** scraped data is tied to the RSI account it
was scanned from. If you open Open Hangar while signed in to a _different_ account,
it clears the previous account's hangar and prompts a fresh scan — so accounts never
mix. While you're signed out, your last scan stays visible (labelled with whose it
is) so you can still browse offline.

## Roadmap

Where things stand (struck-through items are done):

~~hangar scan~~ → ~~buy-backs~~ → ~~account identity + balances~~ → ~~org + rank~~ →
~~referrals (recruits/prospects)~~ → ~~JSON export/import~~ → ~~initial logo~~ →
store catalog & prices (incl. warbonds) → finer item-type classification → broader
browser support (Firefox polish + Safari) → an opt-in API for approved sites to read
the database.

Full detail in [ROADMAP.md](ROADMAP.md); deferred investigations live in
[TODO.md](TODO.md).

## Contributing

The single most valuable contribution is keeping `parser.js` working when RSI
updates their site. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Terms & fair use

Unofficial; not affiliated with Cloud Imperium Games or RSI. Read-only, personal,
and rate-limited — it reads only the signed-in user's own account. Respect
[RSI's Terms of Service](https://robertsspaceindustries.com/tos) and don't
redistribute other people's data.

## License & community

MIT — see [LICENSE](LICENSE).

- **GitHub:** [Draco-Foundry/open-hangar](https://github.com/Draco-Foundry/open-hangar)
- **Discord:** [Draco Foundry](https://discord.gg/FF8Wm5HdnV)
