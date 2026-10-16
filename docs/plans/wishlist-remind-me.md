# Wishlist: A Remind Me Switch in the Popup

Stacked on #710 (`fix-privacy-wishlist-target`). Rides the next planned release.

## Goal

Each item in the popup's Wishlist tab gets the website's Remind Me switch (on/off),
shown only while the website offers it (its items carry `remind`). Off: the store
alerts skip that item.

## Steps

1. `ui/popup/wish-client.js`: read `remind` (boolean, else null); send
   `{ v: 1, do: 'save', key, remind }`.
2. `ui/popup/Wishlist.svelte` and `popup.css`: the switch beside each item's ✕.
3. Store alerts: the website leaves Remind Me off out of the keys they read, so
   `src/alerts.js` needs no rule of its own (comment only).
4. Placeholder words (`NEW_WORDS`) and the privacy spots marked; tests and the smoke test.

## Done When

- `npm test`, `npm run format:check`, `npm run test:ui`, build, `check:store`, Firefox lint pass.
- Claude chat's words replace the placeholders (labels, privacy line in all three copies,
  changelog), and this file is deleted before merge.
