# Wishlist search: one row per ship, no unobtainable ships

Goal: audit every name the popup's Wishlist search can offer for the same ship twice, guard it
with a test on the real bundled list, and keep ships nobody can get from RSI anymore out of
the search.

Steps:

1. Audit the bundled ship list and the sale feed's ships (fixture) for duplicates. Fix the
   merge in `searchEntries` (a list name that is a spelling of a feed ship is that ship).
2. Guard test over the real bundled list and the feed fixture.
3. `unobtainable(name)` in `ui/popup/wishlist.js`: AMD package, in-game rewards (Wikelo, PYAM
   Exec, Alliance), retired ships (the website's list). Search skips them; a listed one shows
   a state word instead of a price.
4. Tests with AMD and time-limited counter-examples.

Done: format:check, npm test, build, check:store, test:ui for the popup, PR with one line per
check. Plan file deleted before merge.
