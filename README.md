# Open Hangar

[![Website](https://img.shields.io/badge/Website-open--hangar-2f81f7?style=for-the-badge)](https://draco-foundry.github.io/open-hangar/)
[![Version](https://img.shields.io/badge/version-0.2.7-blue?style=for-the-badge)](manifest.json)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![Roadmap](https://img.shields.io/badge/%F0%9F%97%BA%EF%B8%8F-Roadmap-orange?style=for-the-badge)](ROADMAP.md)

**Your Star Citizen hangar, buy-backs, balances and referrals — in one clean, local
database you can browse and export.**

Open Hangar is a free, open-source browser extension for **Chrome, Edge and Firefox**.
It reads your own RSI account using the session you're already signed in with, and
saves it on your machine as tidy, structured data. Browse your fleet in the built-in
viewer, or export everything as one JSON file and build on it.

- **No password, no account, no server.** Nothing leaves your browser.
- **For players:** a fast, searchable view of your fleet, buy-backs, stats and
  referral progress.
- **For developers:** the data layer RSI doesn't offer — no public API, so Open
  Hangar handles the session auth and page parsing and hands you clean records.

👉 **[Install it from the website](https://draco-foundry.github.io/open-hangar/)**

> Unofficial and fan-made; not affiliated with Cloud Imperium Games or RSI. It reads
> only _your own_ account, on your own computer.

## Contents

- [What it reads](#what-it-reads)
- [Install](#install)
- [Using it](#using-it)
- [The data](#the-data)
- [How it works](#how-it-works)
- [For developers](#for-developers)
- [Privacy](#privacy)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Terms & fair use](#terms--fair-use)
- [License & community](#license--community)

## What it reads

| Source        | What you get                                                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hangar**    | Every pledge — ships, CCUs (`from → to`), paints, add-ons, coupons — with contents, value, insurance (LTI, 120M, …) and whether it's giftable |
| **Buy-backs** | Melted pledges you can re-acquire, with a direct reclaim link                                                                                 |
| **Account**   | Handle, display name, Store Credit, UEC, REC, main org and rank                                                                               |
| **Referrals** | Your recruits and prospects (current and legacy programs), reward tiers, event bonuses and charts                                             |

All of it is stored locally in one versioned database, and can be exported as a
single JSON file.

## Install

**From the store** — the easiest way. Pick your browser on the
[Open Hangar website](https://draco-foundry.github.io/open-hangar/). Brave, Opera and
Vivaldi use the Chrome Web Store build.

> Store listings are in review. Until they're live, load it from source (below).

**From source:**

```bash
git clone https://github.com/Draco-Foundry/open-hangar.git
cd open-hangar
npm install
npm run build
```

- **Chrome / Edge / Brave:** open `chrome://extensions`, turn on **Developer mode**,
  click **Load unpacked**, and pick `dist/chrome`.
- **Firefox (140+):** open `about:debugging` › **This Firefox** › **Load Temporary
  Add-on**, and pick `dist/firefox/manifest.json`.

(Chromium browsers can also load the repo root directly — `npm run build` is only
required for Firefox.)

**Safari** is on the roadmap. It needs an Xcode port, not a drop-in load.

## Using it

1. Sign in to `robertsspaceindustries.com` in the same browser.
2. Click the Open Hangar toolbar icon to open the hub.
3. Hit **Scan**, then explore:
   - **Home** — your Citizen Card: identity, org, balances, referral count.
   - **Inventory** — gallery, compact or list view, with search, filters and sort.
   - **Buy-Backs** — everything you can reclaim, with links back to RSI.
   - **Stats** — fleet breakdowns and your referral dashboard.
   - **Developers** — export or import the whole database as JSON.

Re-scan any time to refresh. **Clear Data** wipes the local copy; **Log out** ends
your RSI session.

## The data

Every pledge is normalized to one object:

```js
{ id, name, value, currency,
  contents: [{ kind, label, image }],   // items inside the pledge
  image, containsShip,
  isCCU, ccu: { from, to },
  isAddOn, isCoupon, isPaint,
  giftable,                              // hangar offers a "Gift" action
  insurance,                             // 'LTI' | '120M' | '6M' | … | null
  kind }                                 // ship | ccu | paint | addon | coupon | other
```

Sources live in a registry (`OH.SOURCES`) and persist as one versioned object:
`{ schemaVersion, sources: { hangar, buybacks, referral }, owner }`.

The **JSON export** wraps that with provenance and a flattened identity block,
ordered _who → what they own_ so it drops straight into a backend table:

```js
{ app, appVersion, exportedAt, schemaVersion,   // provenance
  account: {                                     // identity snapshot
    handle, displayName, avatar,
    ueeRecord, enlistedSince, country,
    organization: { name, sid, rank, logo },     // null if none / private
    subscriber, concierge,
    balances: { storeCredit, uec, rec },         // storeCredit.value is in cents
    capturedAt },
  sources: { hangar: {…}, buybacks: {…},
    referral: { items: { current, legacy, prospects,
                         recruitsList, prospectsList } } } }  // referral code/url never exported
```

## How it works

RSI authenticates with a **session cookie**. Because the extension has host
permission for `robertsspaceindustries.com`, its own `fetch` requests carry your
existing session — no password, no RSI tab open, no server. Pages are fetched and
parsed locally (referrals come from RSI's GraphQL API). Scans are read-only and
rate-limited.

RSI updates their site from time to time. All HTML parsing is isolated in
`src/scraper/parser.js`, so when the markup changes there's one place to fix.

```
manifest.json           permissions + config (Chrome-shaped; see scripts/pack.mjs)
src/
  background.js         opens the hub when the toolbar icon is clicked
  lib.js                source registry, scan loop, storage, export/import
  scraper/parser.js     RSI HTML -> normalized model   (the layer to maintain)
  dashboard.html / .js  the viewer
scripts/pack.mjs        builds per-browser bundles into dist/
site/                   the public website (GitHub Pages)
```

## For developers

Open Hangar is meant to be the data layer for _your_ project. The contract is the
data shape above plus the **JSON export/import** on the Developers page: pull the
whole database out as one self-describing file, or restore it. (Import restores
holdings; the `account` block is a read-only snapshot.)

Planned: an opt-in way for sites you approve to request your data directly, limited
to domains you trust (via `externally_connectable`). See [ROADMAP.md](ROADMAP.md).

Useful commands:

| Command                | Does                                                    |
| ---------------------- | ------------------------------------------------------- |
| `npm test`             | Parser tests                                            |
| `npm run build`        | Per-browser bundles in `dist/chrome` and `dist/firefox` |
| `npm run pack`         | Store-ready zips in `dist/`                             |
| `npm run lint:firefox` | Mozilla's `web-ext lint` against the Firefox build      |
| `npm run format`       | Prettier                                                |

To add a data source, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Privacy

No credentials — only the session you already have. No server; your data never
leaves your browser. The only outbound requests carry no personal data: thumbnails
and the banner from RSI's media servers, the current game version from the public
star-citizen.wiki API, and — for items RSI ships without art — ship images looked up
by **name** from RSI's public ship-matrix (with star-citizen.wiki as a fallback).
Those lookups are cached and weakly reveal which ships you're viewing.

The `cookies` permission is used only by **Log out**, which clears RSI's cookies so
you can fully end your session. Signing in with a different RSI account clears the
previous account's data, so accounts never mix.

Full policy: [draco-foundry.github.io/open-hangar/privacy.html](https://draco-foundry.github.io/open-hangar/privacy.html).

## Roadmap

Done: ~~hangar~~ · ~~buy-backs~~ · ~~account + balances~~ · ~~org + rank~~ ·
~~referrals~~ · ~~JSON export/import~~ · ~~Chrome/Edge/Firefox builds~~ · ~~website~~

Next: store listings live → store catalog & prices (incl. warbonds) → finer
item-type classification → Hangar Transfer Format export → Safari → an opt-in API
for approved sites.

Full detail in [ROADMAP.md](ROADMAP.md); parked ideas in [TODO.md](TODO.md).

## Contributing

The most valuable contribution is keeping `parser.js` working when RSI updates their
site. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Terms & fair use

Unofficial; not affiliated with Cloud Imperium Games or RSI. Read-only, personal and
rate-limited — it reads only the signed-in user's own account. Respect
[RSI's Terms of Service](https://robertsspaceindustries.com/tos) and don't
redistribute other people's data.

## License & community

Code: MIT — see [LICENSE](LICENSE). Star Citizen Fankit images on the website are
© Cloud Imperium and not covered by the MIT license — see
[site/img/fankit/NOTICE.md](site/img/fankit/NOTICE.md).

- **Website:** [draco-foundry.github.io/open-hangar](https://draco-foundry.github.io/open-hangar/)
- **Discord:** [Draco Foundry](https://discord.gg/FF8Wm5HdnV)
