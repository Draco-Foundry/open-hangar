# CLAUDE.md in a Standard Layout

## Goal

The root CLAUDE.md in the owner's standard sections (Overview, Stack, Layout, Commands,
Conventions, Related Repos, Rules, Gotchas), every existing rule kept, every command
checked to exist.

## Steps

1. Read the repo (package scripts, CI, tests, docs) and write the file.
2. Check every link and command, run the tests and the format check.

## Done

- `npm run format:check` passes; every path in CLAUDE.md exists.
- The retired 0.3.0 branch rule is dropped; the stale docs it left behind go in an issue.
