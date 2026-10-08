# fix/org-ships-not-values

## Goal

Org Fleet shows ships only, never values (#466). No store prices, fleet value or shares,
and nothing that puts one member's totals, values or counts next to another's. Keep which
ships the org's members fly and which roles the fleet covers. The Org CSV exports without
a price column.

## Steps

1. `ui/org/Org.svelte`: drop the store-price box and the Store Price columns; member chips
   without ship counts.
2. `ui/org/Members.svelte`: drop the Fleet Value and Share table, the member-vs-org boxes
   and charts, and Compare; a member's name opens the ships they fly and the roles they
   cover.
3. `ui/org/Roles.svelte`: a missing role's suggestions without prices and not ordered by
   them.
4. `src/dashboard.js`: the CSV export without the price column.
5. Remove what only the comparisons used (PairBars, `share()`, the compare CSS and the
   Color Key line), rewrite the Org UI smoke test, CHANGELOG entry.
6. Review against the no-rankings rule, merge `origin/redesign/0.3-svelte`, run the
   checks, open a draft PR.

## Done

- No dollar value, share or member-vs-member comparison anywhere on Org Fleet or in its
  CSV.
- `npm test`, `npm run format:check` and `npm run test:ui` pass.
- This file is deleted before the PR is ready.
