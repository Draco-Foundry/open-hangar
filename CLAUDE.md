# Working on Open Hangar

Rules for anyone (people or AI sessions) changing this repo. They come from the owner's
decisions and aren't visible in the code. Big-picture docs: [ARCHITECTURE.md](ARCHITECTURE.md),
the 0.3.0 plan in [docs/REDESIGN-0.3.md](docs/REDESIGN-0.3.md), the voice in
[docs/VOICE.md](docs/VOICE.md).

## Never

- **Never release.** Don't bump the version, cut a release, run `npm run release` or
  the publish workflow, or upload to any store. The owner releases, one store update a
  day at most.
- **Never push to `main` directly.** Open a PR. Small fixes for 0.2.x go to `main`.
- **Never put private data in issues, PRs or commits** (the repo is public): no
  emails, addresses, hangar contents or tokens.

## The 0.3.0 Svelte Rebuild

- Rebuild work goes in PRs into **`redesign/0.3-svelte`**, never `main`. One page per PR.
- `src/lib.js` (reading RSI, parsing, storage, value math) and its tests stay as they
  are. Only the screens move to Svelte. If a page needs data `lib.js` doesn't expose,
  add a small read-only helper to `window.OHApp` in `src/dashboard.js`.
- Each page lives in `ui/<page>/` with a `main.js` entry, added to `input` in
  `vite.config.mjs` (`home` shows the pattern). Shared code goes in `ui/lib/`.
- Build pages from the signed-off specs in `docs/REDESIGN-0.3.md`. A page with no
  signed-off spec is ported with **the same content and behavior** it has today: no
  new design without the owner's OK (mockups get signed off first). The look doesn't
  have to match pixel for pixel; every page gets a styling pass once all of them are
  on Svelte (owner, 2026-10-04). Copy and style fixes the rules below call for are fine.
- The extension must keep working at every step: a half-moved page stays on the
  classic code until its Svelte version is complete.
- Before opening a PR: `npm test`, `npm run test:ui` (needs Chrome; say so in the PR
  if it couldn't run) and `npm run format:check`. Rewrite a page's UI smoke test along
  with the page.

## Look and Copy

- **One look only: Clean Pro.** No theme picker or alternative looks. Light mode comes
  later as a twin of the same look.
- **Title Case** for every heading and every link and button label ("Load Details",
  "Lost Your Keycard?"). Body sentences stay sentence case.
- **No emojis** anywhere in the UI. A simple drawn (SVG) icon when one is truly needed;
  the ✕ close button is fine.
- **No em dashes (—)** in user-facing text. Use periods, commas or parentheses.
- **Weights:** buttons 500; prices, names and headings 600 at most; only tiny all-caps
  tags may use 700. Never heavier.
- **No orphans:** no heading or caption ends with one word alone on its last line
  (`text-wrap: balance` on headings, `pretty` on body text); no `·` starting a line.
- **Voice:** fun, short Star Citizen player flavour (see docs/VOICE.md), always
  positive, never implying something was broken. The action must stay obvious; add a
  small muted hint after a joke label when needed. Legal and privacy text stays plain.

## What Not to Build

- No rankings or leaderboards of pilots or orgs.
- No LTI counts or LTI emphasis in summaries, no CCU-chain features, no "best use of
  your buy-back token" advice, no duplicates card, no insight cards (pages go straight
  to their search bar).
- No "First Time Ever" badge, and never call something new or rare from missing
  records. Store availability wording is about how often RSI sells it (Always
  Available, Sold Often, Sold Sometimes, Sold Rarely, Hardly Ever Sold, Events Only),
  never Epic/Legendary/Mythic.

## Requests to RSI and Others

- **The Scan stays fast:** list pages only. Anything needing one request per item
  (buy-back details and the like) is opt-in: a button, with progress, Stop, and a cache.
- **Be polite:** an honest User-Agent, one request at a time with pauses, no bursts,
  honor `Retry-After`, back off on 403/429/5xx and stop on a denial, cache where you can.
