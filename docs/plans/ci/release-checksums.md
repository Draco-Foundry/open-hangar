# Release Checksums

Goal: every GitHub release carries a `SHA256SUMS` file for its zips, so a download can
be checked against the release.

Steps:

1. `release.yml`: after the store-build check, write `dist/SHA256SUMS` from the zips and
   upload it with them (new release and rerun by hand).
2. CONTRIBUTING.md: say the release has the file.

Done when: actionlint passes in CI, the zips and Publish to stores are unchanged, and
nothing runs on merge (the workflow still starts only on a `v*` tag or by hand).
