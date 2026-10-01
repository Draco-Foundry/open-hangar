# 0003: Website Services in a Private Repo

- **Date:** 2026-09-30
- **Sources:** commit 219458a (PR #180)

## Context

Until 2026-09-30 this repo also held the app.openhangar.space backend (`app/`, an Astro
site on Cloudflare with accounts, 2FA and sync), `stats-worker/`, their deploy and
backup workflows, and the website plan and restore docs.

## Decision

Those moved to a private repo with full history, first named open-hangar-app and then
Draco-Foundry/open-hangar-server. This public repo keeps the extension, the static
site openhangar.space (`site/`, `site-worker/`) and the store and release workflows.

Reason not recorded. The commit says what moved, not why.

## Consequences

- The extension's sync code stays here, marked with `@sync-start` / `@sync-end` and cut
  from store builds (see [0001](0001-local-first.md)).
- Some files point at the private repo: docs/REDESIGN-0.3.md (the website plan),
  `scripts/site-stars.mjs` and `src/quips.js` (copies kept in step with the website),
  and `scripts/release.mjs` (the "private website plan").
- CI here no longer builds or deploys the website backend.
