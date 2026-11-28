# Ship-Name Prefix Guard

Goal: a prefix match in the ship-name scorer (`rawScore` in `src/lib.js`) never ties a
base ship to a variant, or a variant to its base.

Steps:

1. Add a per-query guard built from every name the list knows: a "longer name" prefix
   (Genesis → Genesis Starliner) counts only when the query is not itself a known ship
   and only one variant family extends it; a "shorter name" prefix (PTV Buggy → PTV)
   counts only when the query is not itself a known ship and no longer known name fits.
2. Pass the guard from every caller: ship-matrix and ships-feed pictures, HTF ship codes
   (`bestByName`), and the hangar's ship index (`makeShipIndex`).
3. New test file `test/ship-name-guard.test.js`; run the ship-name and parser corpus tests.

Done: tests pass, the PR lists each caller and what changes for it.
