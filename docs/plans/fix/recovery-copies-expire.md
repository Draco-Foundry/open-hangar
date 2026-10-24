# fix/recovery-copies-expire

Goal: the recovery copy (`dbRecovery`) and the damaged copies set aside (`dbCorrupt`)
are deleted 30 days after they're made, or sooner when a complete hangar scan
replaces them.

Steps:

1. `pruneRecoveryCopies` in `src/lib.js`: 30 days by each copy's `at`; a complete
   hangar scan removes the recovery copy of that account and damaged database copies.
2. Run it on every scan save and on the first load of each page.
3. Tests: expiry, a copy with no time, the first load, a scan replacing copies.

Done: format check, npm test, build and check:store pass.
