# Buy-Back Pages on Open

Goal: Scan no longer reads buy-backs' own RSI pages. A buy-back's page is read only when
the pilot opens that buy-back on the website or our hangar page.

Steps:

1. Scan stops reading buy-back pages (the runner and the developer's dashboard).
2. A new bridge v2 request, `oh-read-buyback { pledgeId }`, reads that one page in the
   hidden scan page and answers with the row; while connected, a sync follows.
3. Tests, smoke test, dev docs and the changelog line.

Done: `npm test`, `npm run test:ui`, `npm run build` and `npm run check:store` pass.
