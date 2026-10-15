# Git, PRs and Releases

## Branches

- Branch from `main`, open a PR into `main`, squash-merge. Never push to `main`
  directly. (The 0.3.0 rebuild's `redesign/0.3-svelte` branch is merged; nothing goes
  there any more.)
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
Unreleased under the version, bumps it, tags it; the tag starts Publish to stores, which
uploads nothing until the owner approves it (the `stores` environment).
