# docs-release-0-5-1

Goal: the approved 0.5.1 lines under `## Unreleased` in CHANGELOG.md, so the owner can run
`npm run release 0.5.1` after the batch merges.

Steps: add Claude chat's lines (Handoffs, 2026-10-20 14:10Z) word for word; check with
`npm run release 0.5.1 --dry-run`; delete this plan.

Done: format check, npm test, dry run passes.
