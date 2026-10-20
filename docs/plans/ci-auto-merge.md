# ci-auto-merge

Goal: GitHub merges ready PRs on its own (owner, 2026-10-20), so sessions only mark PRs
ready.

Steps:

1. `.github/workflows/auto-merge.yml`: auto-merge (squash) for qualifying PRs, through a
   GitHub App token so CI on main still runs after the merge.
2. docs/dev/git.md: how it works, `hold`, stacked PRs, required checks, the owner's setup.

Done: actionlint clean, the rules dry-run against open PRs, the owner's setup steps in
the PR. Merges only after openhangar.space's publish is the owner's step (pages.yml).
This plan is deleted before the PR is marked ready.
