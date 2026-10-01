# 0004: What Account Value Counts

- **Date:** 2026-09-30
- **Sources:** docs/REDESIGN-0.3.md, "Owner's Fix List" items 4 and 6; commit 582da97
  (#173); `OH.accountValue()` and `OH.snapshotValue()` in `src/lib.js`; CHANGELOG.md
  0.2.13

## Context

Account Value, the big number on Home, used to count only ships at store price. Its
chart used a different rule for some pledges, so the chart and the headline disagreed.

## Decision

Account Value counts everything you own, one number (owner, 2026-09-30):

- **Ships:** pledges with ships at today's store price, or melt value when none of their
  ships has a public price.
- **CCUs:** standard price, the gap between the two ships' store prices, or melt value
  when either ship is unpriced.
- **Other** (paints, gear, add-ons, hangars, game packages): melt value.
- **Store Credit:** face value.
- **Not counted:** buy-backs, because you'd pay to reclaim them, and UEC and REC,
  because they're in-game money.

Store prices come from star-citizen.wiki (`OH.getPriceIndex()`).

## Consequences

- The chart and "since <month>" use the same rules: `OH.snapshotValue()` values pledges
  still owned exactly like the headline, and estimates ones since melted from their
  names.
- Snapshots record Store Credit from 0.2.13; older ones don't have it.
- The Stats → Value note in `src/dashboard.js` explains the rules to users.
