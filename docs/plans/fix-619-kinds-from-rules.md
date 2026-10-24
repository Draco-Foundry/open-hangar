# fix-619-kinds-from-rules

Goal: a kind RSI renames is fixed by data alone (#619), keeping RSI's word as saved.

Steps:

1. Option 2 of the issue: one reader, OH.isShipItem, matching the rules' kinds.ship;
   every place that tested the word itself asks it.
2. A fixture test: the corpus with "Ship" renamed, and only the rules changed.
3. A guard test: no code matches the word itself.

Done: format, tests and the store build check pass.
