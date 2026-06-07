# Roadmap — toward an all-in-one RSI hangar extractor

**Vision:** an open-source, local-first browser extension that scrapes _all_ of a
user's own RSI / Star Citizen account data, organizes it into one clean, portable
database, and (eventually) lets the user share that database with other tools/sites.

## Two scraping pipelines

RSI runs two frontends, so the extension needs two strategies behind one interface:

1. **HTML pipeline** — legacy server-rendered pages. `fetch(url, {credentials})` →
   parse the HTML (this is what `parser.js` does for the hangar). Simple, robust.
2. **GraphQL pipeline** — newer `rsi-heap` React/Apollo pages. Data comes from
   `POST https://robertsspaceindustries.com/graphql`. Requires capturing the
   operation (query + variables) once, then replaying it from the extension with
   the session cookie (and possibly a CSRF token header). RSI is migrating pages
   to this frontend over time, so this pipeline is strategically important.

## Source registry (the enabling refactor) — ✅ DONE

Scanning is generalized: every data source is an entry in `OH.SOURCES` (lib.js),
and the database holds them all under one versioned key:

```js
OH.SOURCES = [
  { id: 'hangar', label: 'Hangar', type: 'html', url: '…/account/pledges', parse: parsePledges },
  // { id: 'buybacks', type: 'graphql', … }   ← add an entry + a parser
];
// OH.scanSource(id) / OH.scanAll() persist to:
// storage.db = { schemaVersion, sources: { hangar: {items, scannedAt}, … } }
// OH.loadDB() / OH.loadSource(id) read it (migrates the legacy {hangar} shape).
```

Adding a source = one registry entry + a parser. `scanHtmlSource` handles the
paginated-HTML pipeline today; a `graphql`/`api` pipeline gets added the same way.
A full-DB **JSON export/import** that emits the whole `sources` object is done
(`OH.exportDB`/`OH.importDB`); still TODO on top of this: a dashboard **source switcher**.

## Data surface

| Source                                                     | Page / endpoint                        | Served as    | Status         | Notes                                                                                    |
| ---------------------------------------------------------- | -------------------------------------- | ------------ | -------------- | ---------------------------------------------------------------------------------------- |
| **Hangar / pledges**                                       | `/account/pledges`                     | HTML         | ✅ Done        | ships, CCUs, add-ons, coupons; thumbnails                                                |
| **Buy-backs**                                              | `/account/buy-back-pledges`            | HTML         | ✅ Done        | server-rendered `<article>` cards — same HTML pipeline as the hangar (no GraphQL needed) |
| **Store credit / funds**                                   | account header / GraphQL               | TBD          | 🔜             | small but useful (spendable balance)                                                     |
| **CCU chain / optimizer**                                  | derived from pledges + ship prices     | n/a          | 🔜             | analysis layer; uses external ship-matrix prices (cached)                                |
| **Org membership**                                         | `/account/organization` (or community) | TBD          | ❓             | optional                                                                                 |
| **Profile** (handle, moniker, citizen record, enlist date) | profile page                           | HTML/GraphQL | ❓             | low-sensitivity public-ish data                                                          |
| **Wallet / transactions / billing**                        | `/account/...`                         | TBD          | ⚠️ Opt-in only | **PII / financial** — see privacy note                                                   |

## Privacy & scope (important for a shareable tool)

Because the end goal is feeding this data to _other sites_, be deliberate about
what's collected:

- **Default scope = fleet data** (ships, CCUs, add-ons, buybacks, store credit).
- **Financial/PII data** (transaction history, billing, email) stays **opt-in and
  off by default**, and ideally is excluded from anything shared externally.
- Keep everything local-first and auditable; no silent collection.

## Suggested order

1. ~~**Source-registry refactor**~~ — ✅ done (`OH.SOURCES` + versioned DB in lib.js).
2. **Store Data** — RSI store catalog & prices (likely a cached `api`-type source).
   Includes a **current warbonds** view broken into Standalone / Package / CCU.
   - **Pricing foundation (done, not yet surfaced):** `OH.getShipPrice(name)` in
     lib.js resolves `{ msrp, pledgeUrl }` for a ship from the star-citizen.wiki
     per-vehicle record (the RSI ship-matrix carries images but **no** prices).
     Same lazy, locally-matched, hard-cached approach as `OH.getShipImage`. This
     is the building block for: store value of your hangar, paid-vs-current
     comparison, and CCU-chain pricing. No UI yet — wire it into Inventory/Stats
     and the Store Data view when this lands.
   - **Item-type enrichment:** classify add-ons precisely (paint vs decoration vs
     armor vs gear, etc.) by matching item names against star-citizen.wiki /
     starcitizen.tools, cached locally. Today's classifier can't tell a reward
     _paint_ (e.g. "Luminalia 2953 Day 7") from a generic add-on because RSI
     doesn't tag it — only an external reference can. Refs:
     starcitizen.tools/Luminalia, starcitizen.tools/Freelancer_series/Paints.
3. ~~**Buy-backs**~~ — ✅ done. Turned out to be **server-rendered HTML** (`<article>`
   cards at `/account/buy-back-pledges?page=N&pagesize=100`), not the GraphQL frontend
   earlier notes assumed — so it reuses the existing HTML pipeline (`parseBuybacks`).
4. **Consumption layer** — JSON export/import is ✅ done (`OH.exportDB`/`OH.importDB`,
   Developers page). Still to decide: how sites read the DB live (whitelisted
   `externally_connectable` messaging API).
5. **CCU-chain optimizer** — the high-value analysis feature on top of the DB.
6. **Dashboard source switcher** + full-DB export.
7. Optional sources (org, profile) and opt-in PII sources as needed.
