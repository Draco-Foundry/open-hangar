# Extension Is the Scraper (Docs)

## Goal

The docs say what Open Hangar is now: the extension reads your own RSI account, and new
features land on the website. The roadmap lives at openhangar.space/whats-next, Safari
and the approved-sites API are no longer planned, and no doc says "no server" without
the opt-in sync.

## Steps

1. README.md: the tagline near the top, the new Roadmap section, no Safari, no planned
   approved-sites API paragraph.
2. ROADMAP.md: replaced with the short pointer to the website.
3. docs/VOICE.md: the "flavor, not overload" line under the intro.
4. docs/COMPLIANCE.md: every "no server" or "local-only" line also says sync is opt-in
   (connect an openhangar.space account; then it syncs after each scan). Smallest
   accurate change, matching docs/PRIVACY.md.
5. List the other docs that still mention Safari or claim "no server" / "local-only".
6. TODO.md stays as it is; list what could become issues and what could go.
7. `npm test` and `npm run format:check`.

## Done When

- The four files read as above, with no em dashes in new text.
- The checks pass.
- The draft PR into `redesign/0.3-svelte` lists the leftovers for the owner.
