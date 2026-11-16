# test: rename pairs for ship and paint names

Goal: a small set of name pairs that differ between the store and the hangar (the Anvil HM6
vehicles, the Ares slugs old and new, the F7 Hornet Mk II paint), run through the current
matching code, with the pairs that fail today marked as expected failures and left unfixed.
Tests only: no player-visible change.

Steps:

1. test/rename-pairs.test.js: made-up catalog, feed and pledges built from the names; one test
   per pair and matcher (lib.js makeShipIndex, alerts.js shipIndex, paint keys, buy-backs).
2. package.json: the file in the test list.

Done when: npm test and prettier pass.
