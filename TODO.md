# TODO / Later

## Ideas parked for a decision (not yet committed to a direction)

- **Hover-image behavior on cards.** The mouseover preview currently shows the
  full-res image, which takes a beat to load. Idea: instead of a visible hover
  popup, use the hover (or even render-time) purely to _prefetch_ the high-res
  image silently, so that when the user **clicks** the item the detail modal already
  has a crisp image ready. Open question: keep the hover preview at all, or replace
  it with silent prefetch? (Affects `onCardMouseMove` / `enhanceCardImages` / the
  modal in `dashboard.js`.) Undecided — revisit.
- **Show the user's dossier bio on the front page.** The public citizen dossier
  (`/en/citizens/<handle>`) has a free-text bio we could scrape (we already fetch
  that page for the UEE record + org). Open question: where does it fit on the
  Citizen Card without crowding it? Maybe a collapsible line under the org, or a
  hover/tooltip. Needs a layout decision before building.

## Buybacks — ✅ SOLVED (server-rendered HTML, not GraphQL)

The earlier conclusion below was **wrong**: buy-backs are NOT GraphQL-only. A full
GET to `/account/buy-back-pledges?page=N&pagesize=100` (with the session cookie)
returns the same kind of **server-rendered HTML** as the hangar — a list of
`<article>` cards. So buy-backs are now a normal `html` source in `OH.SOURCES`,
parsed by `OpenHangar.parseBuybacks` (selectors: `article` → `h1`, `.image`,
`.date-col`, `.items-col`, `.js-pledge-id`, reclaim link). The selector mapping was
confirmed against the MIT-licensed `SC-Open/hangarlink-hangarexport` extension,
which scrapes buy-backs the same way. The `scanHtmlSource` pipeline distinguishes a
genuinely-empty list (RSI's "No pledges available") from a JS-only shell
(`requiresRender`), so a future RSI change to a client-rendered page is reported
rather than silently empty.

If RSI ever _does_ move this page to a JS-only render (the scan would then report
"no server-rendered content"), the fallback is a content script on a real rendered
tab — see the original notes below.

<details><summary>Historical investigation (superseded — kept for context)</summary>

### What we learned (so the discovery isn't repeated)

- The buyback page is **not** server-rendered like the hangar. Fetching the URL
  returns an empty SPA shell — `0` of `.js-pledge-id` / `.row` / `.kind`. So the
  HTML-scrape approach used for the hangar (parser.js) does **not** work here.
- It's the newer **`rsi-heap` React + Apollo (GraphQL)** frontend. `window.__APOLLO_CLIENT__`
  exists, but its cache extracts empty (the buyback query runs no-cache and isn't
  retained as an observable, so it can't be read back from the client).
- The only data endpoint is **`https://robertsspaceindustries.com/graphql`** (POST).
  Everything else on the page is analytics/nav noise.
- Account-page navigation triggers a **full reload** (not a pure SPA route change),
  which kills any `fetch`/XHR console patch — so in-page interception is unreliable.
- GraphQL calls observed so far were only `MiniCartWidgetInitializationQuery` and
  `FeatureToggle` — the actual buyback-list query was **not yet captured**.

### Next step: capture the buyback query

Use DevTools → Network with **Preserve log** ON, navigate into the buy-back page,
then use the Network **Search** (magnifier / Esc → Search tab) to search all
response bodies for a **ship name you know is in your buybacks**. That pinpoints
the exact request regardless of operation name. Record:

- operationName, full `query` string, and `variables` (esp. pagination),
- response shape (fields for ship name, price/store-credit, id, totalCount/pageInfo),
- whether it needs an `x-rsi-token` (or similar) request header.

### Implementation sketch (once the query is known)

- Add a GraphQL source in `lib.js`: `POST /graphql` with `{ credentials: 'include' }`,
  body `{ operationName, query, variables }`, paginated via `variables`.
- If it needs an anti-CSRF token header, read it via `getCsrfToken()` (already in
  parser.js) — check `<meta>` / cookie / JS global for where RSI stores it.
- If it uses Apollo **persisted queries** (body has only `extensions.persistedQuery.sha256Hash`,
  no `query` text), send the full query on first call (standard APQ fallback).
- Parse the JSON response into the same normalized shape as pledges where possible.
- Promote storage to a versioned multi-source DB:
  `{ schemaVersion, hangar: { items, scannedAt }, buybacks: { items, scannedAt } }`,
  and add a source toggle (Hangar ⇄ Buybacks) to the dashboard.
- **Fallback** if the GraphQL call can't be replayed headlessly (token/SSR issues):
  scan via a content script injected on a real, rendered buy-back tab and read the
  DOM after the SPA renders.

</details>

### Buyback tokens on the Citizen Card (planned)

Surface the number of **buy-back tokens** available — and the **next-available
date** — on the front-page Citizen Card, next to the balances. Tokens cap how many
melted pledges you can re-acquire and replenish on a schedule, so both the count
and the reset date are useful at a glance.

- **Source (preferred):** the buy-back GraphQL response likely carries the token
  count and/or a reset timestamp — capture it alongside the buyback list (see
  above) so this comes "for free" with that pipeline.
- **Source (fallback):** if the API doesn't expose the reset date, derive "next
  available" from the documented replenish cadence on
  [starcitizen.tools/Buyback](https://starcitizen.tools/Buyback) (cached locally).
- **UI:** a pill on the Citizen Card like Store Credit / UEC / REC, e.g.
  "Buyback Tokens 3 · next Jun 12".

## Multi-account caching + character switcher (needs research first)

Today the model is **single-account by design**: the DB holds one account's data,
and `reconcileAccount` (dashboard.js) **wipes** it when a different RSI account signs
in, so accounts never mix. Idea: instead of wiping, **cache each account's scan
separately** and let the user pick which character to view via a dropdown/switcher.

Research before building — this is an architecture change, not a quick add:

- **Storage shape.** Move from one DB to keyed-by-owner, e.g.
  `{ accounts: { [nickname]: { schemaVersion, sources, owner, scannedAt } },
active }`. Plan a migration from the current single-DB shape (v6 cache → vNext).
- **What "active" means.** When signed in to RSI, does the UI auto-select the
  logged-in account, or honor the manual dropdown pick? Probably: live session wins,
  but you can browse any cached account while signed out (ties into the existing
  "cached scan" banner).
- **Privacy/consent.** Caching multiple people's data on a shared computer is more
  sensitive than the current wipe-on-switch behavior — which exists precisely as a
  multi-account _safety_ feature. Keep an explicit per-account "Clear" + a global
  "Clear all," and make retention obvious. Don't silently accumulate accounts.
- **UI.** A character dropdown near the Citizen Card (avatar + handle); switching
  re-renders all views from that account's cached data. Label clearly when viewing a
  non-active (cached) account.
- **Export/import.** Decide whether export is per-account (current behavior) or
  can bundle all accounts; importing shouldn't clobber other cached accounts.
- **Scope check.** Weigh against the project's privacy-first stance — the current
  wipe-on-switch is a feature, not a gap. This should be **opt-in**, not the default.

## Make a scan survive closing the dashboard tab (needs research first)

Today the scan persists across the extension's internal views (single page) but
dies if the dashboard tab is closed — it runs in the page, not the background
service worker. Moving it to survive a tab close is **not** a quick change; do the
research before touching it:

- **Why it's in the page:** MV3 service workers have no `DOMParser`, which
  `parser.js` needs. Confirm whether an **offscreen document**
  (`chrome.offscreen`, reason `DOM_PARSER`) is the right host — it gives a DOM in
  the background without a visible tab. Check MV3 offscreen lifecycle limits and
  Firefox support (Firefox has no `chrome.offscreen` yet → may need a different
  path or a hidden tab fallback).
- **Alternatives to weigh:** keep fetch in the worker but parse with a
  DOMParser-free approach (regex/`linkedom`-style) — fragile, defeats the "one
  parser" principle; or a hidden `chrome.tabs` tab running a content script.
- **State/UX:** progress would need to flow worker → UI via messaging; the header
  scan indicator should reflect a scan started elsewhere.
- Decide only after confirming offscreen-document support + limits across Chrome
  and Firefox.

## Ship-image coverage — ✅ ship-matrix primary + wiki fallback

Resolved. Two sources now, matched locally (`nameScore`) so RSI shorthands work
("Genesis" → "Genesis Starliner", "PTV Buggy" → "PTV", "C8R Pisces" → "C8R Pisces
Rescue", "600i Explorer" → "600i"):

- **Primary: RSI ship-matrix** (`/ship-matrix/index`) — one cached fetch returns
  ALL ~250 ships _with_ images, including in-concept ships the wiki lacks (Vulcan,
  Genesis, Odin). We cache a slim {name → image} (~25KB) for 30 days.
- **Fallback: star-citizen.wiki** — for anything the ship-matrix misses (catalog
  match → per-slug image fetch). Also fixed its catalog pagination bug (`limit=600`
  was silently capped at 200, dropping ~88 vehicles).

`hiRes()` upgrades ship-matrix `store_small.jpg` → `source.jpg` on hover/modal.
Resolver stays lazy, concurrency-capped, hard-cached (negatives too).

Remaining nice-to-have: a few items still won't resolve (non-ship rewards; a ship
absent from BOTH sources). Acceptable — they keep the kind placeholder.

## Rework Inventory + Buy-Backs layout (planned)

Redesign the Inventory and Buy-Backs views together so they share one presentation
layer. The image, hover-preview, and click-to-modal systems are already shared
(`enhanceCardImages` / `onCardMouseMove` / the detail modal); what's left is the
**layout** itself. Goals:

- One card/grid component used by both views (Buy-Backs currently has no
  Gallery / Compact / List toggle — fold it into the shared layout rather than
  bolting the toggle on now).
- Decide the reworked layout (denser grid? **table view** — useful for Buy-Backs,
  which can be long; grouping by kind?) and apply it consistently to both.
- (Interim filter/sort + per-card reclaim link already added to Buy-Backs; fold
  these into the shared layout during the rework.)
- Keep the source registry model — both are just `sources` (`hangar`, `buybacks`).

## Inventory item-type classification (needs work)

Today every non-ship pledge that carries contents collapses into one bucket —
`addon`. So reward **paints/skins** (and occasionally **ships**) get mislabelled:
e.g. "Luminalia 2953 Day 7" reads as ADD-ON when it's a paint, and Luminalia gift
ships can land in the wrong bucket. `normalizePledge` (parser.js) only checks
contents for `kind === "Ship"`; everything else non-ship becomes `addon`.

Two layers of fix:

1. **Use the `.kind` tiles we already scrape (no network).** Each contained item
   carries a `kind` ("Ship", "Skin", "Paint", "Decoration", "Armor", "Weapon",
   "Component", "Insurance", …). Derive a finer pledge category from the dominant
   non-ship content kind — a pledge whose contents are all Paint/Skin → `paint` /
   `skin`, not generic `addon`. This alone fixes most reward paints/skins. Then add
   the new kinds to `OH.KINDS` (+ chip colours) and the stats breakdown.
2. **External reference for untagged items.** Some reward items have no `.kind` at
   all — only their _name_ identifies them. Match the name against
   star-citizen.wiki / starcitizen.tools (cached) to assign a type. See ROADMAP
   "item-type enrichment". This is the only way to know a bare "Luminalia …" name
   is a paint when RSI tags nothing.

Keep `kind` backward-compatible (ship / ccu / addon / coupon / other) and extend
with the finer types; update the inventory filter chips + Stats accordingly.

## Hangar data enrichment + interop export (planned — do in one signed-in session)

Four related roadmap features. The first three depend on what RSI's live hangar
markup actually exposes, which needs a quick **signed-in inspection of a real
pledge card** before building (don't guess selectors — silent bad data). The fourth
is fully specced and ready. Tackle together next time RSI is logged in.

1. **Melt value per item.** Show each pledge's store-credit melt value in Inventory
   (and as a Stats total: "fleet melt value"). **Unconfirmed** whether melt value is
   in the hangar DOM — today we only read `js-pledge-value` (purchase price). Inspect
   a pledge card for a melt/credit field; if absent in the list view, it may require
   the per-pledge melt/manage endpoint (heavier — keep read-only, no actions).
2. **Base item of a package/CCU'd ship.** Surface the original base ship for
   packages and upgraded ships in the live hangar (we already do this for melted
   buybacks via the `- upgraded` fix). Check the package markup for the base-item
   field; `contents[]` may already carry enough to derive it.
3. **Status flags: LTI / Warbond / Gift / (subscriber).** Add filter chips for these
   collector-relevant attributes. **Unconfirmed** whether they're in the card markup
   (as classes/labels/inputs) — inspect first; if present, parse into the pledge
   model and add Inventory filters.
4. **Hangar Transfer Format (HTF) export — ✅ specced, ready to build.** A public
   community interchange format consumed by Erkul (DPS calc), FleetYards, Starship42
   (3D viewer), HangarXPLOR — exporting it directly serves the "be the data layer"
   goal. Spec: `https://docs.starcitizen.fans` (`hangar-transfer-format.yaml`, OAS3,
   v0.0.1 draft). Core schemas:
   - `rsi.pledge.json`: `pledge_id, pledge_name, pledge_date, pledge_cost` (we have
     id/name/cost; **pledge_date is not currently scraped** — check the card).
   - `rsi.ship.json`: `ship_code, ship_name, manufacturer_code, manufacturer_name`.
   - `core.entity.json`: `name, entity_type` (ship | component | decoration).
   - **Ship-code mapping:** ship names → codes (e.g. `ANVL_Carrack`) via
     `https://docs.starcitizen.fans/ship-codes.json` (array of
     `{ship_code, ship_name, manufacturer_code, manufacturer_name}`, ~186 ships).
     Fuzzy-match locally + cache, same pattern as `OH.getShipImage` / the ship-matrix
     (CSP-safe, no bundled blob). Add `docs.starcitizen.fans` to `host_permissions`.
   - **UI:** an "Export HTF" button beside the existing JSON export on the Developers
     page. Pledge-level export works with current data; ship-code mapping is the only
     fuzzy part — can ship pledge-only first, add codes second.

## Account identity + funds — ✅ SOLVED (server-side)

The `/en/account/dashboard` HTML embeds an HTML-escaped JSON blob (around the
`"nickname"` key) with **nickname, displayname, and `creditsData`** (Store Credit
in cents, UEC, REC). No GraphQL needed. Implemented in `lib.js` `OH.getAccount()`
(unescape entities → balanced-brace extract the object → parse); the dashboard
shows it as the "Signed in as …" pill and the home balances row.

## Citizen Card — org + rank — ✅ DONE

Main Organization (logo · name · rank, linked to the org page) shows on the
Citizen Card. Parsed from the public dossier (`/en/citizens/<nickname>`) in the
same fetch as the UEE record — `parseMainOrg` reads the `.main-org` block's
`.info .entry` label/value rows + `.thumb img` logo (`OH.getAccount().org`).
Private affiliations (`visibility-R` / REDACTED) and no-org members render
nothing. Long org names wrap (the name column has no nowrap).

## Referrals & prospects — ✅ DONE (GraphQL, not JS-render-gated after all)

Referral code, recruits, and prospects are scraped and shown: a pill on the Citizen
Card (recruit count + code + copy button) and a **Referrals section in the Stats
view** (summary tiles, an inline-SVG "recruits over time" chart, a prospect→recruit
conversion chart, and a Recruits/Prospects list with per-row links to each citizen).

**What we found (verified live against a real account, May 2026):**

- **Two pages, both behind login:** current `…/en/referral` (campaignId `2`) and
  legacy `…/en/referral-legacy` (campaignId `1`, pre-cutoff, different rewards).
- The pages are JS-rendered, BUT — unlike the early buy-backs fear — the **data API
  is plainly replayable**: `POST /graphql`, operation `GetReferralRecruitsList`,
  with `credentials:'include'` and **no CSRF token** (same trust model as the hangar
  fetch). Query is sent inline (no persisted-query hash). Pagination is `page`/`limit`
  (limit 50 verified; pages don't overlap). So no content-script/offscreen hack was
  needed — it's a normal cookie'd fetch.
- Each row: `{ id, displayName (moniker), nickname (handle), avatar, enlistedOn,
convertedOn }`. `converted:true` → recruits; `false` → the full prospect list.
- **Prospect pool is shared** across both campaigns; only **recruit** counts differ
  (legacy = all-time total, current = post-cutoff subset). We fetch legacy recruits
  as the superset and tag each row `current`/`legacy` by id-membership in the current
  set; prospects fetched once.
- **Referral code/url come for FREE:** the account dashboard HTML embeds a separate
  `{ referralCode, referralUrl, referralUrlCopy, referrerReferralCode }` blob (NOT
  inside the nickname object), so `getAccount` parses it in the same fetch — no extra
  request. `referralUrlCopy` is the clean enlist URL.

**Implementation:**

- `lib.js`: `extractReferral(html)` (+ refactored shared `extractObjectAround`) feeds
  `getAccount().referral = { code, url, referrerCode }`. `OH.getReferral()` does the
  GraphQL walk and persists a `referral` source:
  `{ code, url, current:{recruits}, legacy:{recruits}, prospects, recruitsList:[{id,
handle, moniker, avatar, enlistedOn, convertedOn, campaign}], prospectsList:[…] }`.
  Account cache bumped to v6. `importDB` accepts object-shaped sources (referral)
  alongside array sources. The referral **code/url are stripped on export**
  (`sanitizeSourcesForExport`) — kept in the runtime but never written to export
  files (personal credential); counts + recruit/prospect lists still export.
- `dashboard.js`: Citizen Card pill (`renderReferralPill`), Stats section
  (`renderReferrals`) with hand-built inline **SVG** charts (no chart lib / no
  network — honours CSP + zero-deps), Recruits/Prospects tabs, scan wiring, and
  load/clear/import/reconcile all updated to carry `state.referral`.

**Privacy:** recruit/prospect rows are _other people's_ handles + enlist dates tied
to your account — treated like the rest of the scraped DB (local only, in export,
never auto-shared). Keep the "don't redistribute other people's data" line in mind
for any future sharing/API.

**Not done / later:** the public Weekly/Monthly/All-time leaderboard on the page
(out of scope for v1). Display defaults to ALL_TIME; the API's `display` enum (other
ranges) and `sortBy` aren't surfaced in the UI yet.

### Referral rewards data — verify & complete (planned)

The reward ladders (`REFERRAL_LADDER_STANDARD` / `_LEGACY`) and event windows
(`REFERRAL_EVENTS`) in `dashboard.js` are **hardcoded best-effort** from
[starcitizen.tools/Referral_program](https://starcitizen.tools/Referral_program)
(captured May 2026). Two gaps to close:

1. **Completeness/accuracy audit.** ✅ Done June 2026 — standard + legacy ladders
   verified item-by-item against the wiki (accurate), and the event list completed to
   the full 23 events back to 2019 (`REFERRAL_EVENTS`). Ongoing: re-verify as the wiki
   updates, and append each new CIG event until the auto-refresh below lands.
2. **Keep it fresh without manual edits.** CIG adds a new incentive event roughly
   monthly. Decide a low-maintenance refresh path that works under extension CSP on
   **Chrome + Firefox + Safari** (no remote `<script>`; `fetch` to an allowed host is
   fine). Options, lightest → heaviest:
   - **Ship a versioned JSON** (`referral-rewards.json`) bundled in the extension;
     update it on release. Zero runtime network, but stale between releases.
   - **Fetch a community-maintained JSON** (e.g. a file in this GitHub repo / Pages)
     at runtime, cached locally with a TTL like the ship-matrix cache; fall back to
     the bundled copy offline. Needs the host in `host_permissions` + each store's
     review, but auto-updates without a release. **Likely the right balance.**
   - **Parse the wiki live** — fragile (wiki markup changes, 403s to non-browsers as
     we hit) and heavier; avoid unless the JSON approaches fail.
     Whatever the source, keep the parser/shape in ONE place and treat reward art the
     way ship images already work (lazy, cached, CSP-safe).

### Referral reward item links + hover art — make them correct (planned)

The per-item links/hover on the Referrals page (`rewardItemHtml` in `dashboard.js`)
are **placeholder-quality** and need finishing:

- **Links are searches, not destinations.** Ship items point at the RSI ship-matrix
  _search_ (`/ship-matrix/search?q=…`) and non-ship items at a starcitizen.tools
  _search_ — not the actual reward/item page. Replace with canonical deep links
  (curated per item, or resolved from the wiki/ship-matrix once and cached).
- **Hover art is ship-only.** Only `ship: true` items resolve an image (via
  `OH.getShipImage`); armor/statues/paints/figurines/decorations show no preview.
  Add image resolution for non-ship reward items (wiki image lookup, lazy + cached
  - CSP-safe, same pattern as ship art) so every item can hover-preview.
- **Verify ship-name overrides.** Some items use an `img:`/name override (e.g.
  "Esperia Blade" → `Blade`); confirm each resolves to the right art, especially
  replicas/variants vs. the flyable ship.
- Fold this into the rewards-data source above so links + image URLs travel with the
  reward definitions rather than being derived ad hoc at render time.

## Dashboard CSS cleanup (planned — maintainability, not user-facing)

A styling audit found the dashboard is visually consistent (uniform view titles,
correct color semantics: green=success/unlocked, cyan=next/in-progress,
gold=legacy/event) but has **maintainability** drift worth cleaning up. None of
this changes the rendered UI — it's for keeping the open-source CSS tidy. Ordered by
value:

1. **Semantic color tokens.** ~60 hardcoded colors repeat across views. Add to
   `:root`: `--ok:#7ee787` (success/unlocked), `--next:#3fb6d8` (in-progress),
   `--gold:#f0b429`, `--event:#f0c040`, `--error:#f85149`, `--warn:#d29922`,
   `--violet:#d2a8ff`, `--thumb-bg:#0b0e13`, plus an on-image white-overlay pair —
   then replace the literals. Consolidate the two near-identical golds (`#f0b429` vs
   `#f0c040`) and replace hardcoded `#58a6ff` with the existing `var(--link)`.
2. **Kill inline `style="margin-top:26px"` on every sub-heading** (~5× in
   `dashboard.js`). Either split `.view-title` (h2) from `.section-title` (h3) with a
   built-in top margin, or add a `.section-title.spaced` variant. Also fixes the
   heading-rhythm inconsistency (h3 26px vs `.stat-group-label` 18px tops).
3. **Move `.ref-conv-rate` inline styles into its (currently empty) CSS rule;**
   give `.ref-conv-legend .dot` modifier classes instead of inline `background:`.
4. **Extract shared base classes** (biggest dedup): `.tbl` for the 3 near-identical
   tables (`.ref-table`/`.reward-table`/`.modal-contents`), `.pill` for
   chip/sup-chip/bal/flair, `.field`/`.select` for the 3 duplicated search/sort input
   pairs, `.metric` for stat-box/sum-box (+ size modifiers for the 20/24/26px headline
   numbers). Merge the doubly-defined `.controls` rule.
5. **Standardize a spacing scale** (`--sp-2:8px; --sp-3:12px; --sp-4:16px`) for card
   padding + cluster bottom-margins, which currently drift (18/22/26px).

## Consumption layer (deferred — parked by design)

How external sites read the database (whitelisted `externally_connectable` API,
JSON export/import, etc.) — to be decided once the database (hangar + buybacks) is
complete. Keep it local-first/auditable to fit open-source + store distribution.
