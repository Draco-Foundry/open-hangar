# chore/catch-up-with-main

Goal: bring `main` into `redesign/0.3-svelte` now, so freeze day (Oct 27) isn't a big
merge. The 0.3.0 extension must work exactly as it does today.

Steps:

1. Merge `origin/main` into a branch cut from `origin/redesign/0.3-svelte`.
2. Resolve the conflicts:
   - `src/` and `ui/`: keep the 0.3 code, taking main's change only where it fixes
     the same thing (a real fix 0.3 lacks).
   - `site/`, `site-worker/`, `.github/`: keep main's changes, keeping any 0.3-only
     steps (beta build, privacy check) too.
   - Docs (README, CLAUDE.md, CONTRIBUTING, CHANGELOG, docs/): both sides' content,
     the 0.3 direction wins where they disagree.
   - Versions: keep the 0.3 scheme, never lower than the 0.2.19 that main released.
3. List every file this touches that can change what the extension does.

Done: `npm test`, `npm run format:check`, `npm run test:ui`, `npm run pack` and
`node scripts/check-store-build.mjs` pass; the built extension matches the 0.3 branch
except for files listed in the PR.
