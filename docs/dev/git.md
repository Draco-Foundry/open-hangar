# Git, PRs and Releases

## Branches

- Branch, open a PR, squash-merge. Never push to `main` directly.
- Small fixes for 0.2.x go to `main`. The 0.3.0 rebuild goes in PRs into
  `redesign/0.3-svelte`, one page per PR. `src/lib.js` (reading RSI, parsing, storage,
  value math) and its tests stay as they are; only screens move to Svelte. A page that
  needs data `lib.js` doesn't expose gets a small read-only helper on `window.OHApp` in
  `src/dashboard.js`. Each page lives in `ui/<page>/` with a `main.js` entry in
  `vite.config.mjs`. The extension keeps working at every step.
- Start a branch with `docs/plans/<branch>.md` (the goal, the steps, what "done" means).
  Delete it before merging; CI fails a PR that still has one. Anything left undone
  becomes a GitHub issue.

## PR Titles (Conventional Commits)

The squash commit takes the PR's title, so the title is the commit. CI checks it:
`type(scope): what changed`, where type is one of `feat`, `fix`, `perf`, `refactor`,
`docs`, `test`, `build`, `ci`, `chore`, `style` or `revert`, and the scope is optional.

## The Changelog

A change players will notice adds a bullet under `## Unreleased` in CHANGELOG.md,
starting with `New:`, `Improved:`, `Changed:` or `Fixed:`, written for players. The
release checks those prefixes.

## Releases

Owner only, one store update a day at most. `npm run release <version>` moves
Unreleased under the version, bumps it, tags it; the owner then runs Publish to stores.
Nothing automated ever publishes.
