# fix/alerts-off-mid-check

Goal: turning Store Alerts off always leaves nothing behind, even when it happens
while a check is waiting on the network.

Steps:

1. A check reads the switch again before it asks for the Wishlist and before it
   keeps anything; off then, it stops.
2. The background's Off runs its clean-up again once a running check settles.
3. Test: Off while the feed or the Wishlist request is pending leaves no matches,
   no Wishlist keys, no alarm, no notification and no further request.

Done: format, npm test, build and store check, Firefox lint; this file deleted
before merge.
