# Upgraded Filter (feat/upgraded-filter)

Goal: an Upgraded chip on Inventory's filters that shows only pledges RSI marks upgraded,
each row showing the pledge's name (what it was bought as) and the ship it holds now.

Steps:

1. Parser: read RSI's upgraded markup (h3.upgraded, span.upgraded, a.js-upgrade-log) into a
   pledge field `upgraded`; read the Gift button's new hook (js-gift-v2) too; bump PARSER_VERSION.
2. The owner's page, scrubbed into test/fixtures/corpus/ (handle check), so real upgraded markup
   is tested; the made-up Upgrade-item cards marked as not real.
3. Flag `upgradedFilter` (Off): the chip in the Status group and the "now" line on cards.
4. Tests: zero, one and several upgraded pledges, two ships, a gift-received pledge.

Done: npm run format:check, lint:firefox, npm test, build, check:store, test:ui pass; screenshots
of Inventory with the chip on and off; Words rows for any unapproved words.
