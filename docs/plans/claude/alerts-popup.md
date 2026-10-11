# Plan: Extension Alerts in the popup and the settings (connector plan 0.4, part 2)

## Goal

The pilot sees the store alerts and switches them: the popup lists the matches with
why (opening it marks them seen), the basic page's settings has the switch, which asks
for Notifications (optional) when turned on and gives them back when turned off. Dark
behind the `alerts` build flag.

## Steps

1. ui/popup/Alerts.svelte: off (a line and the way to the switch) or on (the list,
   unseen marked, a row opens our Store, the "connect for your Wishlist" note).
2. ui/basic/AlertsCard.svelte in Settings: Turn On (Notifications asked first, the
   browser's own words), on line, last check, Notifications allowed or Allow, the
   Wishlist line, a calm trouble line, Turn Off.
3. src/popup.html and src/basic.html load src/alerts.js in a flag block; every new word
   a `[copy: …]` placeholder.
4. The UI test's Store Alerts section (the demo serves the connector pages as a build
   with alerts on); docs.

## Done

- format, npm test, test:ui in Chrome and Edge, build + store check, lint:firefox.
- End to end on a developer build: Chrome, Edge and Firefox, badge and notification.
