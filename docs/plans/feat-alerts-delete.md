# feat-alerts-delete (#701)

Builds on feat-popup-alerts-scroll (#699): merge that first.

Goal: an alert can be deleted (×) and the bell has Clear All. Deleted alerts stay gone
through restarts and come back only when something new matches them again.

Steps:

1. src/alerts.js: `hidden` pairs in the state (capped like the others), `hide()` for one
   item or all, `shown()` for the list; `unseen()` (the badge) skips hidden pairs; a
   hidden pair is forgotten with the rest once it's been gone a day, so the same sale
   coming back later alerts again, and a new reason for an item shows it again.
2. src/background.js: the popup's `alerts-hide` message (one id, or all), the badge after.
3. Alerts.svelte: × on each row, Clear All at the top; the popup lists `shown()` only, and
   the bell's number follows. New words marked for the owner's OK.
4. Tests: test/alerts.test.js, test/alerts-background.test.js, storage budget, smoke.

Done: npm test, test:ui, format:check pass; Chrome, Edge and Firefox.
