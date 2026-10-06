# Open Hangar

[![Website](https://img.shields.io/badge/Website-openhangar.space-2f81f7?style=for-the-badge)](https://openhangar.space/)
[![Version](https://img.shields.io/badge/version-0.2.8-blue?style=for-the-badge)](manifest.json)
[![License](https://img.shields.io/badge/License-PolyForm%20Strict-blue?style=for-the-badge)](LICENSE)
[![Roadmap](https://img.shields.io/badge/%F0%9F%97%BA%EF%B8%8F-Roadmap-orange?style=for-the-badge)](ROADMAP.md)

**Your Star Citizen hangar, made useful: what your ships are worth, what you could
melt, what your CCUs saved you, and a clean local database you can export.**

Open Hangar is a free, source-available browser extension for **Chrome, Edge and Firefox**.
It reads your own RSI account using the session you're already signed in with, and
saves it on your machine as tidy, structured data. Browse your fleet in the built-in
viewer, or export everything as one JSON file and build on it.

- **No password, no account needed.** Your hangar stays in your browser. Want it on the
  web too? Connect [openhangar.space](https://openhangar.space) (optional, in closed beta):
  only then, and only when you sync, does a copy go there.
- **For players:** hangar value at today's store prices, melt candidates, fleet
  stats, history between scans, buy-backs, referrals, and fleet images to share.
- **For developers:** the data layer RSI doesn't offer. There's no public API, so
  Open Hangar handles the session auth and page parsing and hands you clean records.

👉 **[Install it from the website](https://openhangar.space/)**

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

| Source        | What you get                                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hangar**    | Every pledge (ships, CCUs `from → to`, paints, add-ons, coupons) with contents, value, date, insurance and whether it's giftable or meltable |
| **Buy-backs** | Melted pledges you can re-acquire, with a direct reclaim link                                                                                |
| **Account**   | Handle, display name, Store Credit, UEC, REC, main org and rank                                                                              |
| **Referrals** | Your recruits and prospects (current and legacy programs), reward tiers, event bonuses and charts                                            |

All of it is stored locally in one versioned database, and can be exported as a
single JSON file — or as a **Hangar Transfer Format** (HTF) file that FleetYards and
other community tools can import.

## Install

**From the store** — the easiest way. Pick your browser on the
[Open Hangar website](https://openhangar.space/). Brave, Opera and
Vivaldi use the Chrome Web Store build.

> **Live:** [Chrome Web Store](https://chromewebstore.google.com/detail/open-hangar/aeabioadfphghjennmdbnpelojlhndjl),
> [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/fmcnemfepnifokjelgjacgdhoodaiicl) and
> [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/open-hangar/). Or load it from
> source (below).

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
   - **Stats** — **hangar value** (ships and CCUs at today's store prices vs what you paid, best deals), **melt candidates**, fleet totals (cargo, crew, roles), and **history** of what changed between scans.
   - **Select → fleet image** — pick items in Inventory and copy a shareable picture of them (e.g. for a sale post).
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
                         recruitsList, prospectsList } } },  // referral code/url never exported
  history: [ { at, items: [[id, name, value]] } ] }        // scan snapshots; merged on import
```

## How it works

RSI authenticates with a **session cookie**. Because the extension has host
permission for `robertsspaceindustries.com`, its own `fetch` requests carry your
existing session (no password, no RSI tab open). Pages are fetched and
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
site/                   the public website (Cloudflare, site-worker/)
```

## For developers

Open Hangar is meant to be the data layer for _your_ project. The contract is the
data shape above plus the **JSON export/import** on the Developers page: pull the
whole database out as one self-describing file, or restore it. (Import restores
holdings; the `account` block is a read-only snapshot.)

**Export HTF** writes the community
[Hangar Transfer Format](https://docs.starcitizen.fans/hangar-transfer-format.yaml):
one entry per ship with `ship_code`, manufacturer, `pledge_*`, `lti` and `warbond` —
import it at FleetYards (Hangar → Import). Ship codes come from a bundled snapshot of
[HangarXPLOR](https://github.com/dolkensp/HangarXPLOR)'s MIT-licensed table
(`src/data/`); CCUs, paints and add-ons have no HTF equivalent and are skipped.

Planned: an opt-in way for sites you approve to request your data directly, limited
to domains you trust (via `externally_connectable`). See [ROADMAP.md](ROADMAP.md).

Useful commands:

| Command                | Does                                                              |
| ---------------------- | ----------------------------------------------------------------- |
| `npm test`             | Parser tests                                                      |
| `npm run build`        | Per-browser bundles in `dist/chrome` and `dist/firefox`           |
| `npm run pack`         | Store-ready zips in `dist/`                                       |
| `npm run lint:firefox` | Mozilla's `web-ext lint` against the Firefox build                |
| `npm run screenshots`  | Store screenshots (real UI + demo data) into `docs/store-assets/` |
| `npm run demo`         | Same demo dashboard at `localhost:8323`, for trying UI changes    |
| `npm run format`       | Prettier                                                          |

To add a data source, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Privacy

No credentials, only the session you already have. Your data stays in your browser
unless you connect openhangar.space. Once connected, every scan sends the same data as
the JSON export to your account there (Sync Now sends it right away); Disconnect stops
it and the website lets you download or delete everything. Details:
[PRIVACY.md](docs/PRIVACY.md). Every other outbound request carries no personal data:
thumbnails and the banner from RSI's media servers, the current game version from the
public star-citizen.wiki API, and (for items RSI ships without art) ship images looked up
by **name** from RSI's public ship-matrix (with star-citizen.wiki as a fallback).
Those lookups are cached and weakly reveal which ships you're viewing.

The `cookies` permission is used only by **Log out**, which clears RSI's cookies so
you can fully end your session. Signing in with a different RSI account clears the
previous account's data, so accounts never mix.

Full policy: [openhangar.space/privacy.html](https://openhangar.space/privacy.html).

## Roadmap

Done: ~~hangar~~ · ~~buy-backs~~ · ~~account + balances~~ · ~~org + rank~~ ·
~~referrals~~ · ~~JSON export/import~~ · ~~Chrome/Edge/Firefox builds~~ · ~~website~~

Next: store listings live → store catalog & prices (incl. warbonds) → finer
item-type classification → Hangar Transfer Format export → Safari → an opt-in API
for approved sites.

Full detail in [ROADMAP.md](ROADMAP.md); parked ideas in [TODO.md](TODO.md); release
notes in [CHANGELOG.md](CHANGELOG.md).

## Ideas & feedback

- **Got an idea?** Post it in [Discussions → Ideas](https://github.com/Draco-Foundry/open-hangar/discussions/categories/ideas)
  and upvote the ones you want most — that's how we decide what to build next.
- **Found a bug?** [Open an issue](https://github.com/Draco-Foundry/open-hangar/issues/new/choose).
- **No GitHub account?** Tell us on [Discord](https://discord.gg/FF8Wm5HdnV).

## Contributing

The most valuable contribution is keeping `parser.js` working when RSI updates their
site. See [CONTRIBUTING.md](CONTRIBUTING.md). New here? [ARCHITECTURE.md](ARCHITECTURE.md)
is a ten-minute tour of how it all fits together.

## Terms & fair use

Unofficial; not affiliated with Cloud Imperium Games or RSI. Read-only, personal and
rate-limited — it reads only the signed-in user's own account. Respect
[RSI's Terms of Service](https://robertsspaceindustries.com/tos) and don't
redistribute other people's data.

## License & community

Code: source available under the [PolyForm Strict License 1.0.0](LICENSE): read it, audit
it and use Open Hangar, but don't redistribute it or publish modified versions. Releases
before 0.2.12 were MIT. Third-party code keeps its own license
([THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)). Open Hangar uses no Star Citizen
Fankit assets.
Star Citizen® and related names are trademarks of Cloud Imperium Rights LLC; this is
an unofficial fan project, not affiliated with the Cloud Imperium group of companies.

- **Website:** [openhangar.space](https://openhangar.space/)
- **Discord:** [Draco Foundry](https://discord.gg/FF8Wm5HdnV)
- **Email:** [support@openhangar.space](mailto:support@openhangar.space)
- **Security issues:** please report privately, see [SECURITY.md](SECURITY.md).
