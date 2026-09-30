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

1. **Citizen Card** with Scan, settings and a built-in search box ("/").
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

## Scheduled Alongside

- Light mode (Dark default / Light / Auto) after the redesign's pages exist.
- RSI server status on Game Status (needs a CORS-safe route, e.g. via app.openhangar.space).
- Citizen Card trim (referral code and subscriber badge placement), pending sign-off.
- The parked draft PR #155 (first Home build) is reference only; its data functions
  (wiki events/patches, buy-back dates, stale-event guard, tests) get reused.
