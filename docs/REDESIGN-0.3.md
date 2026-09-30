# 0.3.0: The Redesign

Decided 2026-09-30. One big extension release: every page redesigned and rebuilt in
**Svelte**, in one look: **Clean Pro**. Built on a branch while `main` keeps shipping
small fixes; beta-tested before the stores.

## What Stays

- **`lib.js`** (reading RSI, parsing, storage, value math) and its tests are reused
  as-is. Only the screens are rebuilt.
- The extension stays a scraper and viewer ("about me, from my RSI session, now"); see
  [WEBSITE-PLAN.md](WEBSITE-PLAN.md) for what belongs on the website.
- Colour meanings (Color Key): green good news, amber worth a look, red a problem, blue
  clickable, one colour per item type. Headings in Title Case.

## Style: Clean Pro (the Only Look)

The owner's call (2026-09-30): **one theme, simple and easy to read**. No theme picker,
no alternate looks; light mode stays the one scheduled option. Reference mockup: the
"Open Hangar Home Styles" artifact (Clean Pro tab).

- Graphite surfaces, no glow, no decoration. Colour only where it means something (the
  Color Key); everything else is neutral.
- Heavy, clear numbers: Manrope for headings and figures, Source Sans 3 for body text.
- Panels separated by fill, not borders; generous spacing; links in counts underlined
  quietly so they read as clickable.
- Big numbers shorten past a threshold (counts from 1,000: "1.2K"; money from $100,000:
  "$1.24M"), exact value on hover, so huge hangars never break a layout.

## Home (v5, signed off 2026-09-30)

Ordered by what a viewer needs first:

1. **Citizen Card** ("Pilot ID", signed off 2026-09-30), with **Hangar Alerts** beside it
   at a quarter of the row; the card spans the row when there are no alerts. No controls
   on the card. Portrait down the left at full height (RSI's 1024px `/source/` image, the
   165px thumbnail underneath as a fallback; initials when there's no portrait); name and
   portrait link to the RSI citizen page. Main org only: 44px logo + name with the rank
   under it, one plain-styled link to the org page, plus the logo as a faint watermark
   (opacity 0.08). No org, hidden or REDACTED: nothing shown. "UEE # · Est. Aug 2017 ·
   9 years" (full date on hover). Subscriber and Chairman's Club on one line, each only
   when it applies. Wallet two by two: Store Credit, UEC, REC, Buy-Back Tokens ("next
   Oct 5"). Referrals are not on the card (own Home card). Handle display: undecided.
2. **For You**: alerts, each with **Ignore** (stays hidden until something new happens):
   wishlist ship on sale, a ship you own changes status (e.g. flight ready), buy-backs
   matching your wishlist, milestones (enlistment anniversary). No CCU nagging (players
   hoard CCUs for future chains on purpose). Hidden when empty.
3. **Account Value** (stats, no chart): value today, "+$X since <first scan>", "+$X vs
   what you paid" (red when negative), clickable counts that open Inventory filtered,
   changes since last scan. New users: "vs paid" only until a second scan.
4. **Events**: the wiki event only while its dates say it's on (the wiki card can stay up
   after it ends), last event, referral bonus events, Free Fly (if a reliable source is
   found), next buy-back token.
5. **Game Status**: LIVE + PTU/EPTU with wave, link to the latest patch notes (Spectrum
   Patch Notes channel).
6. **Latest Acquisitions** (newest pledges, year shown when not this year) beside **Ship
   Spotlight** (a ship from your fleet: art, role, size, crew, cargo, length, store price;
   "Another" to flip).
7. **Latest From RSI** with chips **All · News · Patch Notes · Store** (This Week in Star
   Citizen as the lead; older weekly posts filtered) beside a small **Referrals** progress
   card (only with referral history).
8. The "Something big is coming" teaser as one quiet line at the bottom.

Empty blocks disappear; the grid never leaves a card alone in a row.

## Order of Work

1. **Design** (mockups only, nothing built until the owner says so): style guide and
   building blocks, then every page: Home (done), Inventory, Buy-Backs, Stats, Store, Org
   Fleet, Referrals, Updates, Developers, popup.
2. **Set up Svelte + Vite** on the branch; the extension must behave exactly as today.
   Firefox's store needs the source for built code (the repo is public).
3. **Rebuild page by page** from the signed-off mockups; rewrite the UI smoke tests
   alongside.
4. **Beta** with a few testers, fix, release **0.3.0**.

## Build Notes

- Svelte sources live in `ui/`; `npm run build:ui` (Vite) compiles them into `src/ui/`
  (generated, gitignored). `build`, `demo`, `screenshots` and `test:ui` run it first.
- The classic `src/dashboard.js` still owns scanning, storage and the other pages. It
  exposes read-only helpers on `window.OHApp` and fires `oh:home` when Home's data changes.
- Fonts (Manrope, Source Sans 3) are bundled from @fontsource; no requests to Google.
- **Firefox review note:** web-ext lint shows one warning (UNSAFE_VAR_ASSIGNMENT, innerHTML)
  inside Svelte's runtime. It clones compile-time template markup, never user or RSI data.
  Mention this in the AMO reviewer notes with the 0.3.0 upload (plus the source-code link).

## Top Bar

- **Pinned while scrolling** on every page except Home (owner, 2026-09-30), so the page
  links stay one click away on long pages like Inventory and Buy-Backs.
- Right side: **Scan All ▾** (reads "Scan Custom" when a source is unticked; the choice is
  remembered in `scanSources`), then the **gear menu**: currency, Streamer Mode, Rescan
  Reminder, Updates, Developers, **Log Out of RSI** ("For switching accounts. Your saved
  data stays."; it only clears RSI's cookies), Clear Data in red. The language picker
  goes in the gear menu when translations land. Updates and Developers left the nav.
- **Streamer Mode** (global, `streamerMode`): every money amount (fmtCurrency,
  shortMoney, bigMoney, formatValue) shows as dots, hover text included; UEC/REC on the
  card too. Its scope may grow beyond money.

## Top Menu Pass (approved and built 2026-09-30, branch redesign/passes)

All ten, as mocked up ("Top Menu Pass" artifact): alerts bell with a count and a
drop-down (every page); Scan is its own progress bar ("Scanning… 4/12", "✓ Done") with
"Last scan…" on hover; a search box on every page that expands (or /); your RSI
portrait replaces the gear and opens the menu (name + org at the top, then Currency,
Streamer Mode, Rescan Reminder, How to Use, Updates, Developers, Log Out of RSI, Clear
Data); a Streamer pill while it's on; counts beside Inventory and Buy-Backs; an update
dot on the portrait with "Update ready: Reload" in the menu; a slim bar while
scrolling down; a real logo mark; phone tabs you swipe.

## Inventory and Buy-Backs (approved and built 2026-09-30, branch redesign/passes)

- Stay two pages (different jobs: what you own vs what you could get back; 1,000+
  buy-backs would bury a hangar). Global Hangar Search already covers both.
- Shared new look for both: one toolbar row (search, sort, view, Export ▾), one tidy
  chip row with Clear filters and a Hide small stuff switch (paints, add-ons; on by
  default on Buy-Backs), a summary strip on top that follows the filters, and rows
  with big names and prices.
- Signed off from the "Inventory And Buy-Backs Pass" mockup: Inventory strip =
  Pledges, Melt Value, Store Value (no LTI count: the owner doesn't want LTI
  emphasised); saved views; "$X under store" in green; the melt planner bar when you
  tick rows; Export of what's showing (CSV, share image, full backup). Buy-Backs strip
  = count, tokens with the next date, below store price; identical buy-backs stack
  ("×3") only when you turn on Stack identical (off by default: each buy-back is its own
  item); a Below store price chip. Straight into the search bar, no insight cards.
- Melt planner (owner): no "ticked" or "store credit if melted" wording; it says what the
  pick buys from your wishlist, in the store or from your buy-backs (with the note that a
  store-credit buy-back takes a token each, cash ones don't). Names in rows at 700 weight.
- Rejected: duplicates card, CCU chains ("don't want to get into the CCU chain game"),
  "Best use of your token" (everyone's priorities differ).
- Already done: List rows with big names (wrap to two lines) and big prices, no small
  contents text in the middle.

## Scheduled Alongside

- Light mode (Dark default / Light / Auto) after the redesign's pages exist.
- RSI server status on Game Status (needs a CORS-safe route, e.g. via app.openhangar.space).
- The parked draft PR #155 (first Home build) is reference only; its data functions
  (wiki events/patches, buy-back dates, stale-event guard, tests) get reused.
