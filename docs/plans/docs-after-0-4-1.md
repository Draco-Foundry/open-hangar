# docs/after-0-4-1

## Goal

Bring the README and the Markdown docs in line with what shipped in 0.4.0 and 0.4.1
(CHANGELOG.md is the source of truth). Facts only: keep each file's voice and structure.

## Steps

1. Read the docs issues (#674, #660) for scope.
2. Audit README.md, CONTRIBUTING.md, ARCHITECTURE.md, ROADMAP.md, SECURITY.md, TODO.md,
   AGENTS.md, CLAUDE.md and docs/\*.md against the code and the 0.4.x changelog.
3. Fix stale facts: the store screenshot list, the English-only locales, the popup, the
   hidden scan, the smaller basic page, settings in the popup, the referral code.
4. Leave alone: the privacy policy, released CHANGELOG sections, site/, site-worker/,
   generated files, ui/\*/copy.js, and anything needing new player-facing words. List
   those in the PR.

## Done Criteria

- `npm run format:check` and `npm test` pass.
- A PR lists each file changed and why, and what was skipped.
- This plan file is deleted in the last commit.
