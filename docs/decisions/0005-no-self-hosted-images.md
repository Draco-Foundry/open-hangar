# 0005: Images Load From Their Source, Never Re-Hosted

- **Date:** 2026-06-01 (the approach is in the initial commit, d0f197b); the website
  dropped its last Star Citizen Fankit asset on 2026-09-28 (commit c81c394)
- **Sources:** the "Ship images" section of `src/lib.js`, TODO.md "Ship-image coverage",
  docs/PRIVACY.md, docs/COMPLIANCE.md section 6, commits fe64e83, a02d640 and c81c394

## Context

The extension shows a lot of Star Citizen art: pledge thumbnails, ship pictures,
referral rewards, org logos. RSI ships some items (notably CCUs) with no art at all.

## Decision

The extension bundles no game images. Pictures load at runtime from where they
already live:

- pledge thumbnails from RSI, as found in the hangar page (`src/scraper/parser.js`);
- missing ship art from RSI's public ship matrix, with star-citizen.wiki as a fallback
  (`OH.getShipImage()` in `src/lib.js`), and only image URLs are cached (`shipImages`);
- referral reward pictures from starcitizen.tools (`OH.wikiImageUrls()`).

Bundled files are data only: `src/data/ship-catalog.json` (names and prices) and
`src/data/ship-codes.json`. The website uses no Fankit material either (c81c394), and
promotional imagery uses the project's own artwork (docs/COMPLIANCE.md).

Reason not recorded. The repo records what is done, and CIG's fan-content rules are
discussed for the website, but no document states why ship images are never copied.

## Consequences

- Image lookups are outbound requests, listed in docs/PRIVACY.md. Lookups by ship name
  weakly reveal which ships you're viewing.
- Items missing from every source keep a placeholder (TODO.md).
