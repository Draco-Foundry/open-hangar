# docs/direction-main

## Goal

The docs and GitHub forms on `main` follow the current direction: the extension is the
scraper (reading improvements and fixes from 0.3.0), new features land on the website,
sync is optional, no Safari, no approved-sites API, and no other community tools named.

## Steps

1. Issue templates: Title Case names without emojis; the feature form says where new
   features land and drops "never sends data to a server"; the bug form asks where it
   happened and only needs a version for the extension; no em dash.
2. package.json description: the free Star Citizen fleet manager.
3. docs/dev/copy-and-style.md: the voice line, the no-naming rule (#448), and the
   direction rules under What Not to Build.
4. docs/REDESIGN-0.3.md and decision 0003: no pointer to the private repo.
5. CLAUDE.md: what this repo holds.
6. docs/brand/open-hangar/og.py: removed (scripts/og is the generator in use).
7. README.md, ROADMAP.md, CONTRIBUTING.md: no Safari, no approved-sites API, no other
   tools named, the roadmap's new home.

## Done Means

- `npm run format:check` and `npm test` pass.
- No em dashes in the lines touched.
- This file is deleted before the PR is ready.
