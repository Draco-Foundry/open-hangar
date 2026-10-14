# feat-popup-040: review fixes

Goal: the 0.4.0 popup's review findings fixed on the same branch (PR #669).

Steps:

1. Wishlist tab: no request of its own; it shows the Wishlist the store alerts read, only
   while alerts are on (the privacy policy). Names from the ship list too; no empty list.
2. Scan report: held reports (busy, no-rsi, paused) never show a success line; partial
   rows count as trouble; a sync that asks about a new RSI account shows the question.
3. No "Retrying at" until something retries; the popup writes no siteSyncAgain.
4. No RSI cookie read in the popup.
5. Smaller: a refused Scan closes as today, one sync message, the phone layout from the
   platform, no Look flash, demo storage fires change events, tests.

Done when: format:check, npm test, test:ui, build and check:store pass; plan deleted.
