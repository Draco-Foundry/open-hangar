# docs/direction-site-fallback

## Goal

The landing site on `main` (openhangar.space) matches the new direction: the link
preview carries the tagline "The free Star Citizen fleet manager.", and the help page
says nothing that stops being true once sync arrives with 0.3.0.

## Steps

1. `scripts/og/og.html`: the tagline line becomes "The free Star Citizen fleet manager."
2. Re-render `site/img/og.jpg` with `node scripts/og/render.mjs` and check the image.
3. `site/help.html`: "Your data lives in this browser only" becomes "Your scans are
   saved in this browser", true for 0.2.x and for 0.3.0 with or without sync.
4. `npm run format:check`, `npm test`.

## Done

- The new og.jpg shows the new tagline and nothing else changed in it.
- Checks pass, the PR is a draft on hold (merges to `main` go live).
- This plan file is deleted before merge.
