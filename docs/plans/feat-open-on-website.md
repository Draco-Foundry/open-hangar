# feat/open-on-website

Goal: the 0.3.0 pages that have a twin on the website (Home, Inventory, Buy-Backs,
Stats) link there. Connected, an Open On Website button opens your hangar on
openhangar.space (its My Hangar page for now, since the per-tab pages aren't open
yet). Not connected, a short See It on Any Device link starts Connect.

Steps:

1. `ui/site/OpenOnWebsite.svelte`: the button. Connected: Open On Website ↗, which opens
   `<site>/hangar` (the existing `OHApp.site.open`). Not connected: See It on Any Device,
   which starts Connect like the portrait menu's (Firefox's card first until Firefox
   says yes). Hidden until the website is switched on.
2. Only builds with sync get it: `ui/site/main.js` (loaded from a sync block in
   `dashboard.html`) hands the component to the pages through a small shared slot in
   `ui/lib`; a build without sync never fills it, so the pages show nothing.
3. Inventory and Buy-Backs: under the page title in the summary strip. Stats: under
   its title, above the tabs. Home: the Citizen Card's top right corner once connected
   (where Connect sits before that, so Home skips See It on Any Device).
4. One quiet link style in `ui/theme.css`; fits a 390px phone.
5. UI smoke test: hidden without a sync site; See It on Any Device on the three pages
   (not Home) starts Connect; connected, all four show Open On Website and it opens
   `<site>/hangar`.

Done: `npm test`, `npm run test:ui`, `npm run format:check`, `npm run pack` and
`node scripts/check-store-build.mjs` pass; screenshots checked wide and at phone width.
