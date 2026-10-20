# Git, PRs and Releases

## Branches

- Branch from `main`, open a PR into `main`, squash-merge. Never push to `main`
  directly. (The 0.3.0 rebuild's `redesign/0.3-svelte` branch is merged; nothing goes
  there any more.)
- Start a branch with `docs/plans/<branch>.md` (the goal, the steps, what "done" means).
  Delete it before merging; CI fails a PR that still has one. Anything left undone
  becomes a GitHub issue.

## Auto-Merge

Merges are automatic (owner, 2026-10-20). A session marks its PR ready
(`gh pr ready`); `.github/workflows/auto-merge.yml` turns on GitHub's auto-merge
(squash), and GitHub merges once the required checks pass and there are no conflicts.
No session runs `gh pr merge` or approves a PR.

- **What qualifies:** ready (not a draft), into `main`, from this repo (never a fork),
  not Dependabot's, a conventional-commit title, no branch plan in `docs/plans/`, no
  `hold` label, and no file the owner merges by hand. Breaking a rule later (back to
  draft, `hold`, a new plan, a bad title) turns auto-merge off again.
- **`hold`** is the owner's stop switch: a PR labeled `hold` never merges on its own.
  Take the label off to let it go.
- **The owner merges by hand:** anything in `.github/workflows/`, the privacy text
  (`site/privacy.html`, `docs/PRIVACY.md`, `docs/store-assets/privacy-*`;
  `OWNER_PATHS` in the workflow) and Dependabot's PRs.
- **The squash commit** is titled with the PR's title and `(#N)`.
- **Events only:** the workflow runs when a PR is opened, marked ready, pushed to,
  retitled, retargeted or labeled `hold`. A PR that was already ready before this
  existed gets auto-merge on its next such event.
- **Stacked PRs** (a PR whose base is another PR's branch) never get auto-merge, so a
  stack lands bottom first, in order. When the bottom one merges, GitHub deletes its
  branch and retargets the next PR to `main`; that retarget is an "edited" event, so the
  next one gets auto-merge and merges once its checks pass, and so on up. Its passing
  checks are from when its base was the parent branch (`main` doesn't have to be up to
  date): push to the PR to check it against `main` first. A PR the retarget left with
  conflicts waits until they're fixed. Not yet seen on a real stack: if the retarget
  doesn't start a run, a push or adding and removing `hold` does.
- **Merges come from a GitHub App,** not `GITHUB_TOKEN`: GitHub starts no workflow for
  a push made with `GITHUB_TOKEN`, so CI on `main` (which a release waits for) would
  never run. Until the App is set up, a run only says what it would do.
- **Still the owner's:** releases and store uploads (below), publishing
  openhangar.space (`pages.yml`), everything above that's merged by hand, and GitHub
  settings and secrets. A merge releases nothing.

The owner's one-time setup: a GitHub App with only Contents and Pull requests (read
and write), installed on this repo; the Actions variable `AUTO_MERGE_APP_CLIENT_ID` and
secret `AUTO_MERGE_APP_KEY`; the `hold` label; and `test` as the required check on
`main` (as now), with GitHub Actions as its source. Also `workflows`, while actionlint
is a job of its own: a required check that no longer runs blocks every merge. "Require
branches to be up to date" stays off.

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
