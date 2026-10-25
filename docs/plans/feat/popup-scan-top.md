# Popup: Scan at the Top

Goal: Scan and its progress sit at the top of the popup, under the header, on every tab.
The Scan button is the bar: pressed, the same button fills with the part and its count;
after a full scan it says how long it took for 4 seconds, then Scan comes back. One height
in every state. A quieter Scan (tint, icon), hairline panels and one corner radius.

Steps:

1. `ui/popup/ScanBar.svelte`: Scan's area out of `Hangar.svelte` (the bar's fill and
   pace, RSI's wait, the done line), unchanged logic. `Popup.svelte` draws it under the
   header; the first run keeps it under its heading.
2. A scan that stopped: the button says Scan Again; the line at the top loses its link.
3. `popup.css`: the button-shaped bar, the done line's 4 seconds, the sleeker panels.
4. Smoke test (`scripts/screenshots/smoke.mjs`) updated for the new places.

Done: `npm run format:check`, `npm run lint:firefox`, `npm test`, `npm run test:ui`,
`npm run build`, `npm run check:store` pass; before and after screenshots.
