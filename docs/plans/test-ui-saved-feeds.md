# test/ui-saved-feeds

## Goal

The UI smoke test's Game Status check on Home stops depending on what the public wikis
say today. The demo server answers the live game-status lookups with saved snapshots,
dated so the card reads the same on the fixed demo clock (2026-10-01 15:00 UTC) every
day: LIVE 4.10.1 released Sep 16, 4.10.2 on a test channel with RSI's Wave 3 notes from
Sep 29, and a Pirate Week event that ended Sep 16.

## Steps

1. Reproduce the failing `wave` / `stale` checks with `npm run test:ui` on main.
2. Find every live source behind the Game Status card (wiki main page settings, the
   game version list, Spectrum patch notes) and how the demo reaches each one.
3. Capture each live source's response shape once, politely and without cookies, then
   trim it to the fields the code reads and set the dates.
4. Save the snapshots in `test/fixtures/` beside the store snapshot and serve them from
   `run.mjs`, routed in `demo-shim.js` the same way as the store and patch notes.
5. Run the checks below; open the PR into `main`.

## Done

- `npm run format:check`, `npm test` and `npm run test:ui` pass locally.
- The smoke test's expectations are unchanged.
- No `src/` change; the snapshots are small and name nothing beyond public game and
  event names.
- This plan file is deleted before the merge.
