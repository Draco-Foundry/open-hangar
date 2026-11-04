# scan-upgraded-pledges

Goal: test that a hangar scan reads upgraded pledges (a breakdown of their parts in the
item list) right on any page, fix only if a test fails.

Steps:

1. Fixture of upgraded cards in RSI's captured markup.
2. Tests: one upgrade on page 1; on page 9 or later of a 10+ page hangar; two upgrades in
   a row; a ship with only its paint beside an upgraded pledge.
3. Each checks: the scan reaches the last page, the pledge count, the breakdown stays in
   its pledge, the ship shows as what it is now.

Done: the tests in `npm test`, all checks pass.
