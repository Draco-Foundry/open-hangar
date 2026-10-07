# 0001: Local-First, No Server for Scan Data

- **Date:** 2026-06-01 (initial commit); sync rules added 2026-09-28 and 2026-09-30;
  sync in the store build 2026-10-08
- **Sources:** initial `README.md` (commit d0f197b), ROADMAP.md "Privacy & scope",
  CONTRIBUTING.md "Principles", commits fcc3603 and fc48dbf (#187), docs/PRIVACY.md

## Context

Open Hangar reads a player's own RSI account: pledges, buy-backs, balances, referrals.
That is personal data, and the end goal was to make it reusable by the player's own
tools and sites (ROADMAP.md).

## Decision

Scan data stays in the browser. The extension has no backend: it scans from its own
page with the existing RSI session and stores everything in `chrome.storage.local`.
The first README already said "nothing leaves your browser". ROADMAP.md asks to "keep
everything local-first and auditable; no silent collection", and CONTRIBUTING.md says
any sync must be opt-in, documented and kept out of the core scraper.

An optional website sync (app.openhangar.space) was planned on 2026-09-28 with the rule
"nothing syncs unless the user presses Sync" (commit fcc3603). Because it hasn't
launched and the privacy policy says nothing leaves the device, its code is marked with
`@sync-start` / `@sync-end` and cut from store builds (commit fc48dbf, #187).

## Consequences

- Sharing data means a file the user saves: JSON backup (`OH.exportDB`) or HTF export.
- Losing the browser profile loses the data, so the History tab nudges people to
  download a backup (`lastBackupAt`).
- `scripts/pack.mjs` strips sync code unless `OH_SYNC=1`, and fails if
  `app.openhangar.space` survives in a store build. New sync code must use the markers.
- From 0.3.0 (sync launches November 10, 2026; launch checklist #344) the store build
  keeps the sync code, built in to app.openhangar.space. It stays opt-in: nothing is
  sent until you connect. The markers are the `sync` build flag's (docs/FLAGS.md), and
  a `--flag sync=off` build still cuts them.
