# fix/scan-1: An Empty Page Partway Stops the Scan

Goal: issue #914 finding 1. A page RSI's pager linked to that comes back with no cards
stops the scan partway: nothing saved over the last scan, nothing archived, no buy-back
details pruned. Manual Scan and Auto Scan Daily, hangar and buy-backs.

Steps: failing tests over the saved pages (an empty page 2 and 3 of 3, both lists, error
page and no-cards page), then the stop in `scanHtmlSource`, then the paging suite green.

Done: `npm run format:check`, `npm test`, `npm run build`, `npm run check:store` pass.
