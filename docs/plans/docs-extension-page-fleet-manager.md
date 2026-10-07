# Extension Page Fallback: Fleet Manager Copy

## Goal

The static page in `site/index.html` (served at openhangar.space/index.html, and as the
fallback for openhangar.space/ and /extension when the website can't answer) matches the
website's /extension page: the new fleet manager description, privacy wording that fits
the optional sync to openhangar.space, no Safari card, no "Add to X" line.

## Steps

1. Meta description: the owner's new fleet manager line (drops "No password, no server").
2. The Private by Design paragraph: the owner's new privacy wording.
3. Remove the Safari install card.
4. Remove the "Add to X" note on live install buttons; the browser name stays the visible
   label, with a hidden "Get Open Hangar for" for screen readers. A store that isn't
   live yet still gets its In Review or Soon note, now added by `site/main.js`.
5. Drop the Safari branch from the "your browser first" check, since no card matches it.

## Done When

- `npm run format:check` and `npm test` pass.
- The page checked locally at desktop and phone widths.
- Draft PR against `main` (the branch the Pages workflow deploys), marked Hold: merges
  go live; owner says when.
