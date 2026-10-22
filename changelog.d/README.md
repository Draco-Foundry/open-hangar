# Changelog Fragments

A PR with a change players will notice adds one file here instead of editing
CHANGELOG.md. The release folds the files into `## Unreleased` and deletes them.

- **File name:** `<PR number>-<short-slug>.md`, for example `760-scan-signed-out.md`.
- **Contents:** one or more bullets, each starting `- New:`, `- Improved:`, `- Changed:`
  or `- Fixed:`, written for players, exactly as they should appear in CHANGELOG.md.
- **Order:** the release folds the files by the number the name starts with (smallest
  first); the same number, or none, sorts by file name. Bullets already under
  `## Unreleased` come first. To reorder, change the numbers.
- **Preview:** `node scripts/changelog-fragments.mjs` prints the Unreleased section as the
  release would fold it. `npm run release <version> --dry-run` shows the counts.
- **CI:** a PR that changes `src/` without a fragment gets a warning, never a failure.
