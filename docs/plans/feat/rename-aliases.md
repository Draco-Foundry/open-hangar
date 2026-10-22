# Ships Matched Through Renames

## Goal

When RSI renames a ship or pledge, a scan from before and one from after still find the
same ship in the extension's store matching (alerts and Fleet News): no drop, no
duplicate.

## Steps

1. Add `aliases` (a list of `{ old, now }` names) to the parser rules and their schema;
   regenerate `src/parser-rules-data.js`.
2. First entry: Phoenix Emerald, now Constellation Mk IV Phoenix Emerald.
3. `src/alerts.js`: a name is looked up as it is, then under each name it shares an
   entry with, both ways. Exact folded names only, no guessing.
4. Test the first entry: either name in the hangar, either name in the sale feed, one
   ship.

## Done When

- `npm test` and `npm run format:check` pass.
- The website keeps the same list for its own matching (separate PR there).
