# Plan: Extension Alerts, the background check (connector plan 0.4, part 1)

## Goal

A badge and notifications for what a pilot cares about in RSI's store, matched on the
device: the website's public sale feed against the pilot's hangar and buy-backs (never
sent) and, while connected, the account's Wishlist keys (read only). Dark behind a new
build flag `alerts`, off in store and beta builds.

## Steps

1. `alerts` in src/flags.js (needs connector); scripts/alerts.mjs: src/alerts.js, the
   `alarms` permission, `notifications` optional; pack.mjs and the store check both ways.
2. src/alerts.js: the feed and Wishlist readers, the name fold (the website's saleKey),
   the four hangar rules and the Wishlist match, what's been seen, notifications (three
   at most, then one for the rest), the badge, a polite check (30 to 35 minutes, ETag,
   Retry-After, backoff, a fresh copy reused, kill switch).
3. src/background.js: the alarm, the switch, a new scan matched again, the badge in
   place of the rescan reminder, a notification's click, the popup's "seen".
4. Tests: test/alerts.test.js, test/alerts-background.test.js, the build tests, the
   storage budget, the privacy policy guard. Docs: FLAGS, ARCHITECTURE, requests,
   CONNECTOR.

## Done

- format, npm test, build + store check (alerts off and on), lint:firefox.
- A developer build (alerts on) in Chrome and Edge: the real staging feed (served to the
  worker), an invented hangar, the badge, a notification, the requests carry nothing
  personal. Firefox too.
